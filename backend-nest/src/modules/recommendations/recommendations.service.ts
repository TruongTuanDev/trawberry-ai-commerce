import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type ProductImage, type ProductVariant } from '@prisma/client';
import type { Request } from 'express';
import { createHash } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { ProductReadinessService } from '../products/product-readiness.service';
import { RecommendationQueryDto } from './dto/recommendation-query.dto';
import { TrackProductViewDto } from './dto/track-product-view.dto';
import { TrackRecommendationEventDto } from './dto/track-recommendation-event.dto';
import { TrackSearchDto } from './dto/track-search.dto';

type RecommendationProductRecord = {
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

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly productReadiness: ProductReadinessService,
  ) {}

  async getHomeRecommendations(query: RecommendationQueryDto) {
    if (!this.isPublicRecommendationsEnabled()) {
      return { algorithm: 'rule_based_v1', items: [] };
    }

    try {
      const products = await this.prisma.product.findMany({
        where: this.buildPublicVisibilityWhere(),
        include: this.getProductInclude(),
        take: 120,
        orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
      });

      const items = products
        .filter((product) => this.isPublicVisible(product))
        .sort(
          (left, right) =>
            this.scoreHomeProduct(right) - this.scoreHomeProduct(left),
        )
        .slice(0, query.limit)
        .map((item) => this.mapProduct(item));

      return { algorithm: 'rule_based_v1', items };
    } catch {
      return { algorithm: 'rule_based_v1', items: [] };
    }
  }

  async getSimilarProducts(productId: string, query: RecommendationQueryDto) {
    if (!this.isPublicRecommendationsEnabled()) {
      return { algorithm: 'rule_based_v1', items: [] };
    }

    try {
      const sourceProduct = await this.prisma.product.findFirst({
        where: {
          id: productId,
          ...this.buildPublicVisibilityWhere(),
        },
        include: this.getProductInclude(),
      });

      if (!sourceProduct || !this.isPublicVisible(sourceProduct)) {
        return { algorithm: 'rule_based_v1', items: [] };
      }

      const candidateWhere: Prisma.ProductWhereInput = {
        ...this.buildPublicVisibilityWhere(),
        id: {
          not: productId,
        },
      };

      const or: Prisma.ProductWhereInput[] = [];
      if (sourceProduct.categoryId) {
        or.push({ categoryId: sourceProduct.categoryId });
      }
      if (sourceProduct.categoryName?.trim()) {
        or.push({ categoryName: sourceProduct.categoryName.trim() });
      }
      if (sourceProduct.sourceCategoryName?.trim()) {
        or.push({
          sourceCategoryName: sourceProduct.sourceCategoryName.trim(),
        });
      }
      if (sourceProduct.brand?.trim()) {
        or.push({ brand: sourceProduct.brand.trim() });
      }
      if (sourceProduct.color?.trim()) {
        or.push({ color: sourceProduct.color.trim() });
      }

      const candidates = await this.prisma.product.findMany({
        where: or.length ? { ...candidateWhere, OR: or } : candidateWhere,
        include: this.getProductInclude(),
        take: 120,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      });

      const items = candidates
        .filter((product) => this.isPublicVisible(product))
        .sort(
          (left, right) =>
            this.scoreSimilarProduct(sourceProduct, right) -
            this.scoreSimilarProduct(sourceProduct, left),
        )
        .slice(0, query.limit)
        .map((item) => this.mapProduct(item));

      return { algorithm: 'rule_based_v1', items };
    } catch {
      return { algorithm: 'rule_based_v1', items: [] };
    }
  }

  async trackProductView(
    dto: TrackProductViewDto,
    request: Request,
    user?: AuthenticatedUser | null,
  ) {
    if (!this.isTrackingEnabled()) {
      return;
    }

    try {
      const product = await this.prisma.product.findUnique({
        where: { id: dto.productId },
        select: { shopId: true },
      });

      await this.prisma.productViewLog.create({
        data: {
          productId: dto.productId,
          customerId: user?.userId ?? null,
          guestSessionId: this.resolveGuestSessionId(
            dto.guestSessionId,
            request,
          ),
          shopId: product?.shopId ?? null,
          source: dto.source?.trim() || null,
          referrer: dto.referrer?.trim() || request.get('referer') || null,
          userAgent: request.get('user-agent') ?? null,
          ipHash: this.hashRequestIp(request),
        },
      });
    } catch {
      return;
    }
  }

  async trackSearch(
    dto: TrackSearchDto,
    request: Request,
    user?: AuthenticatedUser | null,
  ) {
    if (!this.isTrackingEnabled()) {
      return;
    }

    const query = dto.query.trim();
    if (!query) {
      return;
    }

    try {
      await this.prisma.searchLog.create({
        data: {
          query,
          normalizedQuery: this.normalizeQuery(query),
          customerId: user?.userId ?? null,
          guestSessionId: this.resolveGuestSessionId(
            dto.guestSessionId,
            request,
          ),
          resultCount: dto.resultCount ?? 0,
          locale: dto.locale?.trim() || null,
        },
      });
    } catch {
      return;
    }
  }

  async trackRecommendationEvent(
    dto: TrackRecommendationEventDto,
    request: Request,
    user?: AuthenticatedUser | null,
  ) {
    if (!this.isTrackingEnabled()) {
      return;
    }

    try {
      await this.prisma.recommendationEvent.create({
        data: {
          type: dto.type,
          placement: dto.placement.trim(),
          productId: dto.productId,
          sourceProductId: dto.sourceProductId ?? null,
          customerId: user?.userId ?? null,
          guestSessionId: this.resolveGuestSessionId(
            dto.guestSessionId,
            request,
          ),
          algorithm: dto.algorithm?.trim() || 'rule_based_v1',
          rank: dto.rank ?? null,
          score:
            typeof dto.score === 'number'
              ? new Prisma.Decimal(dto.score)
              : null,
        },
      });
    } catch {
      return;
    }
  }

  private isPublicRecommendationsEnabled() {
    return (
      this.readFlag('RECOMMENDATIONS_ENABLED', true) &&
      this.readFlag('PUBLIC_RECOMMENDATIONS_ENABLED', true)
    );
  }

  private isTrackingEnabled() {
    return (
      this.readFlag('RECOMMENDATIONS_ENABLED', true) &&
      this.readFlag('RECOMMENDATION_TRACKING_ENABLED', true)
    );
  }

  private readFlag(name: string, fallback: boolean) {
    const raw = this.configService.get<string>(name);
    if (raw === undefined) {
      return fallback;
    }
    return !['0', 'false', 'off', 'no'].includes(raw.toLowerCase());
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

  private isPublicVisible(product: RecommendationProductRecord) {
    return this.productReadiness.getReadiness(product).publicVisible;
  }

  private mapProduct(product: RecommendationProductRecord) {
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
      images: product.images.map((image) => ({
        id: image.id,
        url: image.localUrl ?? image.wbUrl,
        isMain: image.isMain ?? false,
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
    if (!pricedVariants.length) {
      return null;
    }

    return pricedVariants.sort((left, right) => left.comparedTo(right))[0];
  }

  private resolveOriginalPrice(variants: ProductVariant[]) {
    const originalPrices = variants
      .map((variant) => variant.basePrice ?? null)
      .filter((value): value is Prisma.Decimal => value !== null);
    if (!originalPrices.length) {
      return null;
    }

    return originalPrices.sort((left, right) => left.comparedTo(right))[0];
  }

  private scoreSimilarProduct(
    source: RecommendationProductRecord,
    candidate: RecommendationProductRecord,
  ) {
    let score = 0;

    if (source.categoryId && candidate.categoryId === source.categoryId) {
      score += 50;
    }
    if (
      source.categoryName &&
      candidate.categoryName &&
      source.categoryName.localeCompare(candidate.categoryName, undefined, {
        sensitivity: 'accent',
      }) === 0
    ) {
      score += 30;
    }
    if (
      source.sourceCategoryName &&
      candidate.sourceCategoryName &&
      source.sourceCategoryName.localeCompare(
        candidate.sourceCategoryName,
        undefined,
        {
          sensitivity: 'accent',
        },
      ) === 0
    ) {
      score += 20;
    }
    if (source.brand && candidate.brand === source.brand) {
      score += 12;
    }
    if (source.color && candidate.color === source.color) {
      score += 8;
    }
    if (this.resolveAvailableQuantity(candidate.variants) > 0) {
      score += 6;
    }

    score += Number(candidate.averageRating?.toString() ?? '0') * 4;
    score += candidate.feedbackCount ?? 0;
    score += this.recencyScore(candidate);

    return score;
  }

  private scoreHomeProduct(product: RecommendationProductRecord) {
    let score = 0;

    if (this.resolveAvailableQuantity(product.variants) > 0) {
      score += 50;
    }
    if (product.publishedAt) {
      score += 25;
    }
    score += Number(product.averageRating?.toString() ?? '0') * 5;
    score += Math.min(product.feedbackCount ?? 0, 25);
    score += this.recencyScore(product);

    return score;
  }

  private recencyScore(product: RecommendationProductRecord) {
    const reference =
      product.publishedAt ?? product.updatedAt ?? product.createdAt;
    const ageDays = Math.max(
      0,
      (Date.now() - reference.getTime()) / (1000 * 60 * 60 * 24),
    );

    return Math.max(0, 20 - ageDays);
  }

  private normalizeQuery(query: string) {
    return query.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private resolveGuestSessionId(
    guestSessionId: string | undefined,
    request: Request,
  ) {
    return guestSessionId?.trim() || request.get('x-guest-session-id') || null;
  }

  private hashRequestIp(request: Request) {
    const forwarded = request.headers['x-forwarded-for'];
    const rawIp =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded)
        ?.split(',')[0]
        ?.trim() ||
      request.ip ||
      request.socket.remoteAddress ||
      '';

    if (!rawIp) {
      return null;
    }

    return createHash('sha256').update(rawIp).digest('hex');
  }
}
