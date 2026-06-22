import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type ProductImage, type ProductVariant } from '@prisma/client';
import { createHash } from 'crypto';
import type { Request } from 'express';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { ProductReadinessService } from '../products/product-readiness.service';
import { CreateVisualSearchDto } from './dto/create-visual-search.dto';
import { TrackVisualSearchEventDto } from './dto/track-visual-search-event.dto';
import {
  VisualEmbeddingClient,
  type VisualEmbeddingResult,
} from './visual-embedding.client';

const ALGORITHM = 'visual_search_semantic_attributes_v2';
const VECTOR_ALGORITHM = 'visual_search_clip_pgvector_hybrid_v3';
const PROVIDER_FALLBACK = 'rule_based_ai_v1';
const VISUAL_SEARCH_MAX_BYTES = 20 * 1024 * 1024;
const SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';
const DEFAULT_OPENAI_TIMEOUT_MS = 15_000;
const VISUAL_SEARCH_CANDIDATE_LIMIT = 500;
const VISUAL_SEARCH_RESULT_LIMIT = 24;

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
  productDetected: boolean;
  category: string | null;
  color: string | null;
  gender: string | null;
  material: string | null;
  pattern: string | null;
  style: string | null;
  keywords: string[];
  confidence: number;
};

type OpenAiAnalysisPayload = {
  productDetected: boolean;
  category: string | null;
  color: string | null;
  gender: string | null;
  material: string | null;
  pattern: string | null;
  style: string | null;
  confidence: number;
  keywordsRu: string[];
  keywordsEn: string[];
};

type RankedVisualProduct = {
  product: PublicProductRecord;
  score: number;
  reasons: string[];
};

type VectorProductMatch = {
  id: string;
  score: number;
};

@Injectable()
export class VisualSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly productReadiness: ProductReadinessService,
    private readonly visualEmbeddingClient: VisualEmbeddingClient,
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
          productDetected: false,
          category: dto.categoryHint?.trim() || null,
          color: null,
          gender: null,
          material: null,
          pattern: null,
          style: null,
          keywords: [],
          confidence: 0,
        },
        products: [],
        matches: [],
        algorithm: ALGORITHM,
        provider: PROVIDER_FALLBACK,
        fallbackUsed: true,
        vectorUsed: false,
        visualSearchLogId: null,
        disabled: true,
      };
    }

    this.validateImage(image);
    const [analysisResult, queryEmbedding] = await Promise.all([
      this.analyzeImage(image!, dto),
      this.safeEmbedQueryImage(image!.buffer),
    ]);
    const vectorProducts = queryEmbedding
      ? await this.matchVectorProducts(
          queryEmbedding,
          analysisResult.analysis,
          dto.categoryHint,
        )
      : [];
    const vectorUsed = vectorProducts.length > 0;
    const rankedProducts = vectorUsed
      ? vectorProducts
      : await this.matchProducts(analysisResult.analysis, dto.categoryHint);
    const products = rankedProducts.map((entry) =>
      this.mapProduct(entry.product),
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
      matches: rankedProducts.map((entry) => ({
        product: this.mapProduct(entry.product),
        score: entry.score,
        reasons: entry.reasons,
      })),
      algorithm: vectorUsed ? VECTOR_ALGORITHM : ALGORITHM,
      provider: analysisResult.provider,
      fallbackUsed: analysisResult.provider === PROVIDER_FALLBACK,
      vectorUsed,
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
      throw new BadRequestException('Image size must be 20MB or smaller.');
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
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.resolveOpenAiTimeoutMs(),
      );
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.configService.get<string>('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.resolveOpenAiModel(),
          text: {
            format: {
              type: 'json_schema',
              name: 'visual_search_analysis',
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  productDetected: { type: 'boolean' },
                  category: { type: ['string', 'null'] },
                  color: { type: ['string', 'null'] },
                  gender: { type: ['string', 'null'] },
                  material: { type: ['string', 'null'] },
                  pattern: { type: ['string', 'null'] },
                  style: { type: ['string', 'null'] },
                  confidence: { type: 'number', minimum: 0, maximum: 1 },
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
                  'productDetected',
                  'category',
                  'color',
                  'gender',
                  'material',
                  'pattern',
                  'style',
                  'confidence',
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
                    'Identify the main visible apparel, footwear, bag, jewelry, or accessory item.',
                    'Ignore people, background, text overlays, and unrelated objects.',
                    'Set productDetected=false when no shoppable item is clearly visible.',
                    'Return category, dominant color, target gender when evident, material, pattern, style, and concise Russian plus English search keywords.',
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
      }).finally(() => clearTimeout(timeout));

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
            productDetected: parsed.productDetected === true,
            category: parsed.category,
            color: parsed.color,
            gender: parsed.gender,
            material: parsed.material,
            pattern: parsed.pattern,
            style: parsed.style,
            confidence: parsed.confidence,
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
  ): Promise<RankedVisualProduct[]> {
    if (!analysis.productDetected && !categoryHint?.trim()) {
      return [];
    }

    const signals = this.buildAnalysisSignals(analysis, categoryHint);
    if (signals.length === 0) {
      return [];
    }

    const candidates = await this.prisma.product.findMany({
      where: {
        ...this.buildPublicVisibilityWhere(),
        OR: this.buildCandidatePredicates(signals),
      },
      include: this.getProductInclude(),
      take: VISUAL_SEARCH_CANDIDATE_LIMIT,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    const normalizedKeywords = analysis.keywords
      .map((value) => this.normalizeSearchText(value))
      .filter((value): value is string => Boolean(value));
    const normalizedCategory = this.normalizeSearchText(analysis.category);
    const normalizedCategoryHint = this.normalizeSearchText(categoryHint);
    const normalizedColor = this.normalizeSearchText(analysis.color);
    const normalizedGender = this.normalizeSearchText(analysis.gender);
    const normalizedMaterial = this.normalizeSearchText(analysis.material);
    const normalizedPattern = this.normalizeSearchText(analysis.pattern);
    const normalizedStyle = this.normalizeSearchText(analysis.style);

    return candidates
      .filter(
        (product) => this.productReadiness.getReadiness(product).publicVisible,
      )
      .map((product) => ({
        product,
        ...this.scoreProduct(
          product,
          normalizedCategory,
          normalizedCategoryHint,
          normalizedColor,
          normalizedGender,
          normalizedMaterial,
          normalizedPattern,
          normalizedStyle,
          normalizedKeywords,
        ),
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, VISUAL_SEARCH_RESULT_LIMIT);
  }

  async reindexPublishedImages(limit = 100, offset = 0) {
    const batchLimit = Math.min(Math.max(limit, 1), 500);
    const images = await this.prisma.productImage.findMany({
      where: {
        product: this.buildPublicVisibilityWhere(),
      },
      select: {
        id: true,
        productId: true,
        localUrl: true,
        wbUrl: true,
        updatedAt: true,
      },
      orderBy: { id: 'asc' },
      skip: Math.max(offset, 0),
      take: batchLimit,
    });

    const summary = {
      requested: images.length,
      indexed: 0,
      skipped: 0,
      failed: 0,
      failures: [] as Array<{ imageId: string; error: string }>,
      nextOffset: Math.max(offset, 0) + images.length,
      hasMore: images.length === batchLimit,
    };

    for (const image of images) {
      const sourceUrl = this.resolveEmbeddingSourceUrl(
        image.localUrl ?? image.wbUrl,
      );
      const sourceFingerprint = createHash('sha256')
        .update(`${sourceUrl}|${image.updatedAt.toISOString()}`)
        .digest('hex');
      try {
        const existing = await this.prisma.$queryRaw<
          Array<{ sourceFingerprint: string; model: string; status: string }>
        >(Prisma.sql`
          SELECT
            "source_fingerprint" AS "sourceFingerprint",
            "model",
            "status"
          FROM "product_image_embeddings"
          WHERE "product_image_id" = ${image.id}::uuid
          LIMIT 1
        `);
        if (
          existing[0]?.sourceFingerprint === sourceFingerprint &&
          existing[0]?.model === this.resolveEmbeddingModelName() &&
          existing[0]?.status === 'READY'
        ) {
          summary.skipped += 1;
          continue;
        }

        const result = await this.visualEmbeddingClient.embedUrl(sourceUrl);
        const vectorLiteral = this.toVectorLiteral(result.embedding);
        await this.prisma.$executeRaw(Prisma.sql`
          INSERT INTO "product_image_embeddings" (
            "product_image_id", "product_id", "source_url",
            "source_fingerprint", "model", "dimensions", "embedding",
            "status", "last_error", "updated_at"
          ) VALUES (
            ${image.id}::uuid, ${image.productId}::uuid, ${sourceUrl},
            ${sourceFingerprint}, ${result.model}, ${result.dimensions},
            ${vectorLiteral}::vector, 'READY', NULL, CURRENT_TIMESTAMP
          )
          ON CONFLICT ("product_image_id") DO UPDATE SET
            "product_id" = EXCLUDED."product_id",
            "source_url" = EXCLUDED."source_url",
            "source_fingerprint" = EXCLUDED."source_fingerprint",
            "model" = EXCLUDED."model",
            "dimensions" = EXCLUDED."dimensions",
            "embedding" = EXCLUDED."embedding",
            "status" = 'READY',
            "last_error" = NULL,
            "updated_at" = CURRENT_TIMESTAMP
        `);
        summary.indexed += 1;
      } catch (error) {
        summary.failed += 1;
        summary.failures.push({
          imageId: image.id,
          error:
            error instanceof Error
              ? error.message.slice(0, 300)
              : 'Unknown error',
        });
      }
    }

    return summary;
  }

  private async safeEmbedQueryImage(image: Buffer) {
    if (!this.isVectorSearchEnabled()) {
      return null;
    }
    try {
      return await this.visualEmbeddingClient.embedBytes(image);
    } catch {
      return null;
    }
  }

  private async matchVectorProducts(
    embedding: VisualEmbeddingResult,
    analysis: VisualSearchAnalysis,
    categoryHint?: string,
  ): Promise<RankedVisualProduct[]> {
    try {
      const vectorLiteral = this.toVectorLiteral(embedding.embedding);
      const limit = this.resolveVectorCandidateLimit();
      const minimumScore = this.resolveVectorMinimumScore();
      const matches = await this.prisma.$queryRaw<VectorProductMatch[]>(
        Prisma.sql`
          SELECT
            "product_id" AS id,
            MAX(1 - ("embedding" <=> ${vectorLiteral}::vector))::double precision AS score
          FROM "product_image_embeddings"
          WHERE "status" = 'READY'
            AND "embedding" IS NOT NULL
            AND "model" = ${embedding.model}
          GROUP BY "product_id"
          HAVING MAX(1 - ("embedding" <=> ${vectorLiteral}::vector)) >= ${minimumScore}
          ORDER BY score DESC
          LIMIT ${limit}
        `,
      );
      if (matches.length === 0) return [];

      const scoreById = new Map(
        matches.map((match) => [match.id, Number(match.score)]),
      );
      const products = await this.prisma.product.findMany({
        where: {
          ...this.buildPublicVisibilityWhere(),
          id: { in: matches.map((match) => match.id) },
        },
        include: this.getProductInclude(),
      });

      return products
        .filter(
          (product) =>
            this.productReadiness.getReadiness(product).publicVisible,
        )
        .map((product) => {
          const semantic = this.scoreProductForAnalysis(
            product,
            analysis,
            categoryHint,
          );
          const vectorScore = Math.max(0, scoreById.get(product.id) ?? 0);
          return {
            product,
            score: Number(
              (vectorScore * 100 + semantic.score * 0.25).toFixed(4),
            ),
            reasons: ['image_similarity', ...semantic.reasons],
          };
        })
        .sort((left, right) => right.score - left.score)
        .slice(0, VISUAL_SEARCH_RESULT_LIMIT);
    } catch {
      return [];
    }
  }

  private scoreProductForAnalysis(
    product: PublicProductRecord,
    analysis: VisualSearchAnalysis,
    categoryHint?: string,
  ) {
    return this.scoreProduct(
      product,
      this.normalizeSearchText(analysis.category),
      this.normalizeSearchText(categoryHint),
      this.normalizeSearchText(analysis.color),
      this.normalizeSearchText(analysis.gender),
      this.normalizeSearchText(analysis.material),
      this.normalizeSearchText(analysis.pattern),
      this.normalizeSearchText(analysis.style),
      analysis.keywords
        .map((value) => this.normalizeSearchText(value))
        .filter((value): value is string => Boolean(value)),
    );
  }

  private scoreProduct(
    product: PublicProductRecord,
    category: string | null,
    categoryHint: string | null,
    color: string | null,
    gender: string | null,
    material: string | null,
    pattern: string | null,
    style: string | null,
    keywords: string[],
  ) {
    let score = 0;
    const reasons: string[] = [];
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
      reasons.push('category');
    }

    if (
      categoryHint &&
      this.matchesAnyField(categoryHint, [
        product.category?.name,
        product.categoryName,
        product.sourceCategoryName,
      ])
    ) {
      score += 20;
      reasons.push('category_hint');
    }

    if (color && this.matchesAnyField(color, [product.color])) {
      score += 18;
      reasons.push('color');
    }

    if (gender && this.matchesAnyField(gender, [product.gender])) {
      score += 8;
      reasons.push('gender');
    }

    if (material && this.matchesAnyField(material, [product.composition])) {
      score += 14;
      reasons.push('material');
    }

    if (pattern && haystack.includes(pattern)) {
      score += 12;
      reasons.push('pattern');
    }

    if (style && haystack.includes(style)) {
      score += 12;
      reasons.push('style');
    }

    let keywordMatches = 0;
    for (const keyword of keywords) {
      if (!keyword) {
        continue;
      }
      if (haystack.includes(keyword)) {
        score += 8;
        keywordMatches += 1;
      }
    }
    if (keywordMatches > 0) reasons.push('keywords');

    if (this.resolveAvailableQuantity(product.variants) > 0) {
      score += 4;
      reasons.push('in_stock');
    }

    score += Number(product.averageRating?.toString() ?? '0');
    score += Math.min(product.feedbackCount ?? 0, 20) / 4;

    return { score: Number(score.toFixed(4)), reasons };
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
      product.gender,
      product.composition,
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
    const material = analysis.material?.trim() || null;
    const pattern = analysis.pattern?.trim() || null;
    const style = analysis.style?.trim() || null;
    const keywords = [
      ...new Set(
        analysis.keywords
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
          .slice(0, 12),
      ),
    ];

    return {
      productDetected: analysis.productDetected === true,
      category,
      color,
      gender,
      material,
      pattern,
      style,
      keywords,
      confidence: Math.min(1, Math.max(0, Number(analysis.confidence) || 0)),
    };
  }

  private buildFallbackAnalysis(categoryHint?: string): VisualSearchAnalysis {
    const category = categoryHint?.trim() || null;
    return {
      productDetected: Boolean(category),
      category,
      color: null,
      gender: null,
      material: null,
      pattern: null,
      style: null,
      keywords: [],
      confidence: category ? 0.15 : 0,
    };
  }

  private buildAnalysisSignals(
    analysis: VisualSearchAnalysis,
    categoryHint?: string,
  ) {
    return [
      analysis.category,
      categoryHint,
      analysis.color,
      analysis.gender,
      analysis.material,
      analysis.pattern,
      analysis.style,
      ...analysis.keywords,
    ]
      .map((value) => value?.normalize('NFKC').trim())
      .filter((value): value is string => Boolean(value))
      .filter((value, index, values) => values.indexOf(value) === index)
      .slice(0, 16);
  }

  private buildCandidatePredicates(
    signals: string[],
  ): Prisma.ProductWhereInput[] {
    return signals.flatMap((signal) => {
      const contains = {
        contains: signal,
        mode: Prisma.QueryMode.insensitive,
      };
      return [
        { localTitle: contains },
        { wbTitle: contains },
        { brand: contains },
        { categoryName: contains },
        { category: { name: contains } },
        { sourceCategoryName: contains },
        { wbDescription: contains },
        { localDescription: contains },
        { color: contains },
        { gender: contains },
        { composition: contains },
      ];
    });
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
          detectedKeywords: [
            ...input.analysis.keywords,
            input.analysis.material,
            input.analysis.pattern,
            input.analysis.style,
          ].filter((value): value is string => Boolean(value)),
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

  private resolveOpenAiModel() {
    return (
      this.configService.get<string>('VISUAL_SEARCH_OPENAI_MODEL')?.trim() ||
      DEFAULT_OPENAI_MODEL
    );
  }

  private resolveOpenAiTimeoutMs() {
    const configured = Number(
      this.configService.get<string>('VISUAL_SEARCH_OPENAI_TIMEOUT_MS'),
    );
    return Number.isFinite(configured) && configured >= 1_000
      ? Math.min(configured, 60_000)
      : DEFAULT_OPENAI_TIMEOUT_MS;
  }

  private isVectorSearchEnabled() {
    return (
      this.isPublicVisualSearchEnabled() &&
      this.readFlag('VISUAL_SEARCH_VECTOR_ENABLED', false)
    );
  }

  private resolveVectorCandidateLimit() {
    const configured = Number(
      this.configService.get<string>('VISUAL_SEARCH_VECTOR_CANDIDATE_LIMIT'),
    );
    return Number.isInteger(configured) && configured > 0
      ? Math.min(configured, 1000)
      : VISUAL_SEARCH_CANDIDATE_LIMIT;
  }

  private resolveVectorMinimumScore() {
    const configured = Number(
      this.configService.get<string>('VISUAL_SEARCH_VECTOR_MIN_SCORE'),
    );
    return Number.isFinite(configured)
      ? Math.min(Math.max(configured, -1), 1)
      : 0.15;
  }

  private resolveEmbeddingModelName() {
    const provider = this.configService
      .get<string>('VISUAL_EMBEDDING_PROVIDER', 'mock')
      .trim()
      .toLowerCase();
    if (provider === 'mock') return 'deterministic_mock_v1';
    return (
      this.configService.get<string>('VISUAL_EMBEDDING_MODEL')?.trim() ||
      'ViT-B-32'
    );
  }

  private resolveEmbeddingSourceUrl(sourceUrl: string) {
    const s3Endpoint = this.configService.get<string>('S3_ENDPOINT');
    const s3Bucket = this.configService.get<string>('S3_BUCKET');
    const replacements = [
      [
        this.configService.get<string>('BACKEND_PUBLIC_BASE_URL'),
        this.configService.get<string>('BACKEND_INTERNAL_BASE_URL'),
      ],
      [
        this.configService.get<string>('S3_PUBLIC_BASE_URL'),
        s3Endpoint && s3Bucket
          ? `${s3Endpoint.replace(/\/$/, '')}/${s3Bucket}`
          : undefined,
      ],
    ] as const;

    for (const [publicBase, internalBase] of replacements) {
      if (publicBase && internalBase && sourceUrl.startsWith(publicBase)) {
        return `${internalBase.replace(/\/$/, '')}${sourceUrl.slice(publicBase.replace(/\/$/, '').length)}`;
      }
    }
    return sourceUrl;
  }

  private toVectorLiteral(embedding: number[]) {
    if (
      embedding.length !== 512 ||
      embedding.some((value) => !Number.isFinite(value))
    ) {
      throw new Error('Visual embedding must contain 512 finite values.');
    }
    return `[${embedding.map((value) => Number(value).toFixed(8)).join(',')}]`;
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
