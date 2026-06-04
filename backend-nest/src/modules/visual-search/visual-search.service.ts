import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type ProductImage, type ProductVariant } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { ProductReadinessService } from '../products/product-readiness.service';
import { CreateVisualSearchDto } from './dto/create-visual-search.dto';
import { TrackVisualSearchEventDto } from './dto/track-visual-search-event.dto';

const ALGORITHM = 'visual_search_rule_based_v1';
const PROVIDER_FALLBACK = 'rule_based_ai_v1';
const VISUAL_SEARCH_MAX_BYTES = 8 * 1024 * 1024;
const SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const OPENAI_MODEL = 'gpt-4.1-mini';

type PublicProductRecord = {
  id: string;
  shopId: string;
  wbTitle: string;
  localTitle: string | null;
  wbDescription: string | null;
  localDescription: string | null;
  brand: string | null;
  color: string | null;
  gender: string | null;
  composition: string | null;
  sellerSku: string | null;
  seoSlug: string | null;
  categoryName: string | null;
  sourceCategoryName: string | null;
  aiTryOnEnabled: boolean;
  visibility: string | null;
  catalogStatus: string;
  averageRating: Prisma.Decimal | null;
  feedbackCount: number | null;
  categoryId: bigint | null;
  subjectId: bigint | null;
  createdAt: Date;
  publishedAt: Date | null;
  unpublishedAt: Date | null;
  updatedAt: Date;
  archivedAt: Date | null;
  images: ProductImage[];
  variants: ProductVariant[];
  shop: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    paymentInstructions: string | null;
    status: string;
    sellerProfile: {
      approvalStatus: string;
    };
  };
  category: {
    id: bigint;
    name: string;
    slug: string | null;
  } | null;
};

type VisualSearchAnalysis = {
  category: string | null;
  color: string | null;
  gender: string | null;
  keywords: string[];
};

type OpenAiAnalysisPayload = {
  category: string | null;
  color: string | null;
  gender: string | null;
  keywordsRu: string[];
  keywordsEn: string[];
};

@Injectable()
export class VisualSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly productReadiness: ProductReadinessService,
  ) {}

  async search(
    image: Express.Multer.File | undefined,
    dto: CreateVisualSearchDto,
    request: Request,
    user?: AuthenticatedUser | null,
  ) {
    if (!this.isPublicVisualSearchEnabled()) {
      return {
        analysis: {
          category: dto.categoryHint?.trim() || null,
          color: null,
          gender: null,
          keywords: [],
        },
        products: [],
        algorithm: ALGORITHM,
        visualSearchLogId: null,
        disabled: true,
      };
    }

    this.validateImage(image);
    const analysisResult = await this.analyzeImage(image!, dto);
    const products = await this.matchProducts(
      analysisResult.analysis,
      dto.categoryHint,
    );

    const log = await this.safeCreateLog({
      customerId: user?.userId ?? null,
      guestSessionId: this.resolveGuestSessionId(dto.guestSessionId, request),
      categoryHint: dto.categoryHint?.trim() || null,
      analysis: analysisResult.analysis,
      cropX: dto.cropX ?? null,
      cropY: dto.cropY ?? null,
      cropWidth: dto.cropWidth ?? null,
      cropHeight: dto.cropHeight ?? null,
      resultCount: products.length,
      provider: analysisResult.provider,
    });

    return {
      analysis: analysisResult.analysis,
      products,
      algorithm: ALGORITHM,
      visualSearchLogId: log?.id ?? null,
    };
  }

  async trackEvent(
    dto: TrackVisualSearchEventDto,
    request: Request,
    user?: AuthenticatedUser | null,
  ) {
    if (!this.isTrackingEnabled()) {
      return;
    }

    try {
      await this.prisma.visualSearchEvent.create({
        data: {
          type: dto.type,
          visualSearchLogId: dto.visualSearchLogId ?? null,
          productId: dto.productId,
          rank: dto.rank ?? null,
          score:
            typeof dto.score === 'number'
              ? new Prisma.Decimal(dto.score)
              : null,
        },
      });

      if (
        user?.userId ||
        this.resolveGuestSessionId(dto.guestSessionId, request)
      ) {
        return;
      }
    } catch {
      return;
    }
  }

  private validateImage(image: Express.Multer.File | undefined) {
    if (!image) {
      throw new BadRequestException('Image is required.');
    }

    if (!SUPPORTED_MIME_TYPES.has(image.mimetype)) {
      throw new BadRequestException(
        'Only JPEG, PNG, and WEBP images are supported.',
      );
    }

    if (image.size > VISUAL_SEARCH_MAX_BYTES) {
      throw new BadRequestException('Image size must be 8MB or smaller.');
    }
  }

  private async analyzeImage(
    image: Express.Multer.File,
    dto: CreateVisualSearchDto,
  ): Promise<{ analysis: VisualSearchAnalysis; provider: string }> {
    if (!this.canUseOpenAiVision()) {
      return {
        analysis: this.buildFallbackAnalysis(dto.categoryHint),
        provider: PROVIDER_FALLBACK,
      };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.configService.get<string>('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          text: {
            format: {
              type: 'json_schema',
              name: 'visual_search_analysis',
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  category: { type: ['string', 'null'] },
                  color: { type: ['string', 'null'] },
                  gender: { type: ['string', 'null'] },
                  keywordsRu: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  keywordsEn: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
                required: [
                  'category',
                  'color',
                  'gender',
                  'keywordsRu',
                  'keywordsEn',
                ],
              },
            },
          },
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: [
                    'Analyze this marketplace product image and return product hints only.',
                    'Focus on visible apparel or accessory item.',
                    `Category hint: ${dto.categoryHint?.trim() || 'none'}.`,
                    'Return short values suitable for marketplace search.',
                  ].join(' '),
                },
                {
                  type: 'input_image',
                  image_url: `data:${image.mimetype};base64,${image.buffer.toString('base64')}`,
                  detail: 'low',
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI visual search failed with ${response.status}`);
      }

      const body = (await response.json()) as {
        output_text?: string;
      };
      const parsed = JSON.parse(
        body.output_text ?? '{}',
      ) as OpenAiAnalysisPayload;

      return {
        analysis: this.normalizeAnalysis(
          {
            category: parsed.category,
            color: parsed.color,
            gender: parsed.gender,
            keywords: [
              ...(parsed.keywordsRu ?? []),
              ...(parsed.keywordsEn ?? []),
            ],
          },
          dto.categoryHint,
        ),
        provider: 'openai',
      };
    } catch {
      return {
        analysis: this.buildFallbackAnalysis(dto.categoryHint),
        provider: PROVIDER_FALLBACK,
      };
    }
  }

  private async matchProducts(
    analysis: VisualSearchAnalysis,
    categoryHint?: string,
  ) {
    const candidates = await this.prisma.product.findMany({
      where: this.buildPublicVisibilityWhere(),
      include: this.getProductInclude(),
      take: 250,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    const normalizedKeywords = analysis.keywords
      .map((value) => this.normalizeSearchText(value))
      .filter((value): value is string => Boolean(value));
    const normalizedCategory = this.normalizeSearchText(analysis.category);
    const normalizedCategoryHint = this.normalizeSearchText(categoryHint);
    const normalizedColor = this.normalizeSearchText(analysis.color);

    return candidates
      .filter(
        (product) => this.productReadiness.getReadiness(product).publicVisible,
      )
      .map((product) => ({
        product,
        score: this.scoreProduct(
          product,
          normalizedCategory,
          normalizedCategoryHint,
          normalizedColor,
          normalizedKeywords,
        ),
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 24)
      .map((entry) => this.mapProduct(entry.product));
  }

  private scoreProduct(
    product: PublicProductRecord,
    category: string | null,
    categoryHint: string | null,
    color: string | null,
    keywords: string[],
  ) {
    let score = 0;
    const haystack = this.buildSearchHaystack(product);

    if (
      category &&
      this.matchesAnyField(category, [
        product.category?.name,
        product.categoryName,
        product.sourceCategoryName,
      ])
    ) {
      score += 50;
    }

    if (
      categoryHint &&
      this.matchesAnyField(categoryHint, [
        product.category?.name,
        product.categoryName,
        product.sourceCategoryName,
      ])
    ) {
      score += 30;
    }

    if (color && this.matchesAnyField(color, [product.color])) {
      score += 18;
    }

    for (const keyword of keywords) {
      if (!keyword) {
        continue;
      }
      if (haystack.includes(keyword)) {
        score += 12;
      }
    }

    if (this.resolveAvailableQuantity(product.variants) > 0) {
      score += 8;
    }

    score += Number(product.averageRating?.toString() ?? '0') * 2;
    score += Math.min(product.feedbackCount ?? 0, 10);

    return score;
  }

  private buildSearchHaystack(product: PublicProductRecord) {
    return [
      product.wbTitle,
      product.localTitle,
      product.wbDescription,
      product.localDescription,
      product.category?.name,
      product.categoryName,
      product.sourceCategoryName,
      product.brand,
      product.color,
    ]
      .map((value) => this.normalizeSearchText(value))
      .filter((value): value is string => Boolean(value))
      .join(' ');
  }

  private matchesAnyField(
    value: string,
    fields: Array<string | null | undefined>,
  ) {
    return fields.some((field) => {
      const normalizedField = this.normalizeSearchText(field);
      return normalizedField ? normalizedField.includes(value) : false;
    });
  }

  private normalizeAnalysis(
    analysis: VisualSearchAnalysis,
    categoryHint?: string,
  ): VisualSearchAnalysis {
    const category = analysis.category?.trim() || categoryHint?.trim() || null;
    const color = analysis.color?.trim() || null;
    const gender = analysis.gender?.trim() || null;
    const keywords = [
      ...new Set(
        analysis.keywords
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
          .slice(0, 12),
      ),
    ];

    return {
      category,
      color,
      gender,
      keywords,
    };
  }

  private buildFallbackAnalysis(categoryHint?: string): VisualSearchAnalysis {
    return {
      category: categoryHint?.trim() || null,
      color: null,
      gender: null,
      keywords: [],
    };
  }

  private async safeCreateLog(input: {
    customerId: string | null;
    guestSessionId: string | null;
    categoryHint: string | null;
    analysis: VisualSearchAnalysis;
    cropX: number | null;
    cropY: number | null;
    cropWidth: number | null;
    cropHeight: number | null;
    resultCount: number;
    provider: string;
  }) {
    if (!this.isTrackingEnabled()) {
      return null;
    }

    try {
      return await this.prisma.visualSearchLog.create({
        data: {
          customerId: input.customerId,
          guestSessionId: input.guestSessionId,
          imageUrl: null,
          imageStorageKey: null,
          categoryHint: input.categoryHint,
          detectedCategory: input.analysis.category,
          detectedColor: input.analysis.color,
          detectedGender: input.analysis.gender,
          detectedKeywords: input.analysis.keywords,
          cropX: input.cropX,
          cropY: input.cropY,
          cropWidth: input.cropWidth,
          cropHeight: input.cropHeight,
          resultCount: input.resultCount,
          provider: input.provider,
        },
        select: {
          id: true,
        },
      });
    } catch {
      return null;
    }
  }

  private canUseOpenAiVision() {
    const provider = this.configService
      .get<string>('VISUAL_SEARCH_AI_PROVIDER', PROVIDER_FALLBACK)
      .trim()
      .toLowerCase();
    const openAiKey = this.configService.get<string>('OPENAI_API_KEY');
    return provider === 'openai' && Boolean(openAiKey?.trim());
  }

  private isPublicVisualSearchEnabled() {
    return (
      this.readFlag('VISUAL_SEARCH_ENABLED', false) &&
      this.readFlag('PUBLIC_VISUAL_SEARCH_ENABLED', false)
    );
  }

  private isTrackingEnabled() {
    return (
      this.readFlag('VISUAL_SEARCH_ENABLED', false) &&
      this.readFlag('VISUAL_SEARCH_TRACKING_ENABLED', false)
    );
  }

  private readFlag(name: string, fallback: boolean) {
    const raw = this.configService.get<string>(name);
    if (raw === undefined) {
      return fallback;
    }

    return !['0', 'false', 'off', 'no'].includes(raw.toLowerCase());
  }

  private resolveGuestSessionId(
    guestSessionId: string | undefined,
    request: Request,
  ) {
    return guestSessionId?.trim() || request.get('x-guest-session-id') || null;
  }

  private buildPublicVisibilityWhere(): Prisma.ProductWhereInput {
    return {
      visibility: 'ACTIVE',
      catalogStatus: 'PUBLISHED',
      archivedAt: null,
      unpublishedAt: null,
      images: {
        some: {},
      },
      shop: {
        status: 'ACTIVE',
        sellerProfile: {
          approvalStatus: 'APPROVED',
        },
      },
      variants: {
        some: {
          isActive: true,
          OR: [{ discountPrice: { gt: 0 } }, { basePrice: { gt: 0 } }],
        },
      },
    };
  }

  private getProductInclude() {
    return {
      images: {
        orderBy: [{ isMain: 'desc' as const }, { sortOrder: 'asc' as const }],
      },
      variants: {
        where: {
          isActive: true,
          OR: [{ discountPrice: { gt: 0 } }, { basePrice: { gt: 0 } }],
        },
        orderBy: { createdAt: 'asc' as const },
      },
      category: true,
      shop: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          paymentInstructions: true,
          status: true,
          sellerProfile: {
            select: {
              approvalStatus: true,
            },
          },
        },
      },
    };
  }

  private mapProduct(product: PublicProductRecord) {
    const price = this.resolvePrice(product.variants);
    const availableQuantity = this.resolveAvailableQuantity(product.variants);

    return {
      id: product.id,
      shopId: product.shopId,
      name: product.localTitle ?? product.wbTitle,
      description: product.localDescription ?? product.wbDescription,
      brand: product.brand,
      color: product.color,
      gender: product.gender,
      composition: product.composition,
      sellerSku: product.sellerSku,
      seoSlug: product.seoSlug,
      categoryId: product.category?.id.toString() ?? null,
      categorySlug: product.category?.slug ?? null,
      categoryName: product.category?.name ?? product.categoryName,
      sourceCategoryName: product.sourceCategoryName,
      price: price?.toString() ?? null,
      oldPrice: this.resolveOriginalPrice(product.variants)?.toString() ?? null,
      inStock: availableQuantity > 0,
      availableQuantity,
      averageRating: product.averageRating?.toString() ?? null,
      feedbackCount: product.feedbackCount ?? 0,
      images: product.images.map((entry) => ({
        id: entry.id,
        url: entry.localUrl ?? entry.wbUrl,
        isMain: entry.isMain ?? false,
      })),
      variants: product.variants.map((variant) => {
        const variantPrice = this.resolveVariantPrice(variant);
        const variantAvailableQuantity =
          this.resolveVariantAvailableQuantity(variant);

        return {
          id: variant.id,
          sizeName: variant.sizeName,
          russianSize: variant.russianSize,
          techSize: variant.techSize,
          wbSize: variant.wbSize,
          sellerSku: variant.sellerSku,
          price: variantPrice?.toString() ?? null,
          originalPrice:
            (variant.basePrice ?? variant.discountPrice)?.toString() ?? null,
          stockQuantity: variant.stockQuantity,
          lowStockThreshold: variant.lowStockThreshold,
          trackInventory: variant.trackInventory,
          inStock: !variant.trackInventory || variantAvailableQuantity > 0,
          availableQuantity: variantAvailableQuantity,
        };
      }),
      shop: {
        id: product.shop.id,
        name: product.shop.name,
        slug: product.shop.slug,
        logoUrl: product.shop.logoUrl,
        paymentInstructions: product.shop.paymentInstructions,
      },
      aiTryOn: {
        enabled: product.aiTryOnEnabled,
      },
    };
  }

  private resolveVariantPrice(variant: ProductVariant) {
    return variant.discountPrice ?? variant.basePrice ?? null;
  }

  private resolveVariantAvailableQuantity(variant: ProductVariant) {
    return variant.trackInventory ? Math.max(0, variant.stockQuantity) : 999999;
  }

  private resolveAvailableQuantity(variants: ProductVariant[]) {
    return variants.reduce(
      (sum, variant) => sum + this.resolveVariantAvailableQuantity(variant),
      0,
    );
  }

  private resolvePrice(variants: ProductVariant[]) {
    const pricedVariants = variants
      .map((variant) => this.resolveVariantPrice(variant))
      .filter((value): value is Prisma.Decimal => value !== null);

    return (
      pricedVariants.sort((left, right) => left.comparedTo(right))[0] ?? null
    );
  }

  private resolveOriginalPrice(variants: ProductVariant[]) {
    const values = variants
      .map((variant) => variant.basePrice ?? variant.discountPrice)
      .filter((value): value is Prisma.Decimal => value !== null);

    return values.sort((left, right) => left.comparedTo(right))[0] ?? null;
  }

  private normalizeSearchText(value: string | null | undefined) {
    const normalized = value?.normalize('NFKC').trim().toLowerCase();
    return normalized || null;
  }
}
