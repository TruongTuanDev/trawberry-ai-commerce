import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type ProductVariant } from '@prisma/client';
import { createHash } from 'crypto';
import type { Request } from 'express';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { ProductReadinessService } from '../products/product-readiness.service';
import { RecommendationQueryDto } from './dto/recommendation-query.dto';
import { TrackProductViewDto } from './dto/track-product-view.dto';
import { TrackRecommendationEventDto } from './dto/track-recommendation-event.dto';
import { TrackSearchDto } from './dto/track-search.dto';
import {
  RECOMMENDATION_REASON_LABELS,
  RecommendationPreferenceProfile,
  RecommendationProductRecord,
  type RecommendationReasonCode,
  RecommendationScoringService,
  type RecommendationScoreBreakdown,
  type RecommendationVariantRecord,
  type RecommendationPlacement,
} from './recommendation-scoring.service';

type RecommendationApiItem = {
  product: ReturnType<RecommendationsService['mapProduct']>;
  rank: number;
  score: number | null;
  reasonCodes: string[];
  scoreExplanation?: {
    algorithm: string;
    finalScore: number | null;
    reasons: string[];
    scoreBreakdown: RecommendationScoreBreakdown | null;
  };
};

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly productReadiness: ProductReadinessService,
    private readonly scoring: RecommendationScoringService,
  ) {}

  async getHomeRecommendations(
    query: RecommendationQueryDto,
    request: Request,
    user?: AuthenticatedUser | null,
  ) {
    if (!this.isPublicRecommendationsEnabled()) {
      return this.emptyResponse('home');
    }

    if (!this.isSmartRankingEnabled()) {
      return this.getHomeRecommendationsV1(query);
    }

    try {
      const [products, preferenceProfile] = await Promise.all([
        this.prisma.product.findMany({
          where: this.buildPublicVisibilityWhere(),
          include: this.getProductInclude(),
          take: 150,
          orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
        }),
        this.buildPreferenceProfile(query, request, user),
      ]);

      const items = products
        .filter((product) => this.isPublicVisible(product))
        .map((product) => ({
          product,
          scored: this.scoring.scoreHomeProduct(product, preferenceProfile),
        }))
        .sort((left, right) => right.scored.score - left.scored.score)
        .slice(0, query.limit);

      return this.buildResponse('home', 'rule_based_v2', items, query.debug);
    } catch {
      return this.emptyResponse('home');
    }
  }

  async getSimilarProducts(productId: string, query: RecommendationQueryDto) {
    if (!this.isPublicRecommendationsEnabled()) {
      return this.emptyResponse('product_detail');
    }

    if (!this.isSmartRankingEnabled()) {
      return this.getSimilarProductsV1(productId, query);
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
        return this.emptyResponse('product_detail');
      }

      const candidates = await this.loadSimilarCandidates(
        sourceProduct,
        query.limit,
      );

      const items = candidates
        .filter(
          (product) =>
            this.isPublicVisible(product) && product.id !== productId,
        )
        .map((product) => ({
          product,
          scored: this.scoring.scoreSimilarProduct(sourceProduct, product),
        }))
        .sort((left, right) => right.scored.score - left.scored.score)
        .slice(0, query.limit);

      return this.buildResponse(
        'product_detail',
        'rule_based_v2',
        items,
        query.debug,
      );
    } catch {
      return this.emptyResponse('product_detail');
    }
  }

  async getSearchRecommendations(query: RecommendationQueryDto) {
    const searchQuery = query.q?.trim() ?? '';
    if (!this.isPublicRecommendationsEnabled() || !searchQuery) {
      return this.emptyResponse('search');
    }

    if (!this.isSmartRankingEnabled()) {
      return this.emptyResponse('search');
    }

    try {
      const tokens = this.normalizeQuery(searchQuery)
        .split(' ')
        .filter((token) => token.length >= 2);
      const or: Prisma.ProductWhereInput[] = [
        { wbTitle: { contains: searchQuery, mode: 'insensitive' } },
        { localTitle: { contains: searchQuery, mode: 'insensitive' } },
        { wbDescription: { contains: searchQuery, mode: 'insensitive' } },
        { localDescription: { contains: searchQuery, mode: 'insensitive' } },
        { categoryName: { contains: searchQuery, mode: 'insensitive' } },
        { sourceCategoryName: { contains: searchQuery, mode: 'insensitive' } },
        { brand: { contains: searchQuery, mode: 'insensitive' } },
        { color: { contains: searchQuery, mode: 'insensitive' } },
      ];

      for (const token of tokens) {
        or.push(
          { wbTitle: { contains: token, mode: 'insensitive' } },
          { localTitle: { contains: token, mode: 'insensitive' } },
          { wbDescription: { contains: token, mode: 'insensitive' } },
          { localDescription: { contains: token, mode: 'insensitive' } },
          { categoryName: { contains: token, mode: 'insensitive' } },
          { sourceCategoryName: { contains: token, mode: 'insensitive' } },
          { brand: { contains: token, mode: 'insensitive' } },
          { color: { contains: token, mode: 'insensitive' } },
        );
      }

      const candidates = await this.prisma.product.findMany({
        where: {
          ...this.buildPublicVisibilityWhere(),
          OR: or,
        },
        include: this.getProductInclude(),
        take: 150,
        orderBy: [{ updatedAt: 'desc' }, { publishedAt: 'desc' }],
      });

      const items = candidates
        .filter((product) => this.isPublicVisible(product))
        .map((product) => ({
          product,
          scored: this.scoring.scoreSearchProduct(searchQuery, product),
        }))
        .filter((item) => item.scored.score > 0)
        .sort((left, right) => right.scored.score - left.scored.score)
        .slice(0, query.limit);

      return this.buildResponse('search', 'rule_based_v2', items, query.debug);
    } catch {
      return this.emptyResponse('search');
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
          algorithm: dto.algorithm?.trim() || 'rule_based_v2',
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

  private async getHomeRecommendationsV1(query: RecommendationQueryDto) {
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
            this.scoreHomeProductV1(right) - this.scoreHomeProductV1(left),
        )
        .slice(0, query.limit)
        .map((product) => ({
          product,
          scored: {
            score: null,
            reasonCodes: [] as RecommendationReasonCode[],
            scoreBreakdown: null,
          },
        }));

      return this.buildResponse('home', 'rule_based_v1', items, query.debug);
    } catch {
      return this.emptyResponse('home');
    }
  }

  private async getSimilarProductsV1(
    productId: string,
    query: RecommendationQueryDto,
  ) {
    try {
      const sourceProduct = await this.prisma.product.findFirst({
        where: {
          id: productId,
          ...this.buildPublicVisibilityWhere(),
        },
        include: this.getProductInclude(),
      });

      if (!sourceProduct || !this.isPublicVisible(sourceProduct)) {
        return this.emptyResponse('product_detail');
      }

      const candidates = await this.loadSimilarCandidates(
        sourceProduct,
        query.limit,
      );

      const items = candidates
        .filter(
          (product) =>
            this.isPublicVisible(product) && product.id !== productId,
        )
        .sort(
          (left, right) =>
            this.scoreSimilarProductV1(sourceProduct, right) -
            this.scoreSimilarProductV1(sourceProduct, left),
        )
        .slice(0, query.limit)
        .map((product) => ({
          product,
          scored: {
            score: null,
            reasonCodes: [] as RecommendationReasonCode[],
            scoreBreakdown: null,
          },
        }));

      return this.buildResponse(
        'product_detail',
        'rule_based_v1',
        items,
        query.debug,
      );
    } catch {
      return this.emptyResponse('product_detail');
    }
  }

  private async loadSimilarCandidates(
    sourceProduct: RecommendationProductRecord,
    limit: number,
  ) {
    const candidateWhere: Prisma.ProductWhereInput = {
      ...this.buildPublicVisibilityWhere(),
      id: {
        not: sourceProduct.id,
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

    const primaryCandidates = await this.prisma.product.findMany({
      where: or.length ? { ...candidateWhere, OR: or } : candidateWhere,
      include: this.getProductInclude(),
      take: 120,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    if (primaryCandidates.length >= limit) {
      return primaryCandidates;
    }

    const fallbackCandidates = await this.prisma.product.findMany({
      where: candidateWhere,
      include: this.getProductInclude(),
      take: 120,
      orderBy: [
        { feedbackCount: 'desc' },
        { publishedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    const seen = new Set(primaryCandidates.map((item) => item.id));
    return [
      ...primaryCandidates,
      ...fallbackCandidates.filter((item) => !seen.has(item.id)),
    ];
  }

  private buildResponse(
    placement: RecommendationPlacement,
    algorithm: string,
    items: Array<{
      product: RecommendationProductRecord;
      scored: {
        score: number | null;
        reasonCodes: RecommendationReasonCode[];
        scoreBreakdown?: RecommendationScoreBreakdown | null;
      };
    }>,
    debug = false,
  ) {
    const includeExplainability = this.shouldIncludeExplainability(debug);
    const mappedItems: RecommendationApiItem[] = items.map((item, index) => {
      const mappedItem: RecommendationApiItem = {
        product: this.mapProduct(item.product),
        rank: index + 1,
        score: item.scored.score,
        reasonCodes: item.scored.reasonCodes,
      };

      if (includeExplainability) {
        mappedItem.scoreExplanation = {
          algorithm,
          finalScore: item.scored.score,
          reasons: item.scored.reasonCodes.map(
            (reasonCode) => RECOMMENDATION_REASON_LABELS[reasonCode],
          ),
          scoreBreakdown: item.scored.scoreBreakdown ?? null,
        };
      }

      return mappedItem;
    });

    return {
      algorithm,
      placement,
      items: mappedItems,
      products: mappedItems.map((item) => item.product),
    };
  }

  private emptyResponse(placement: RecommendationPlacement) {
    return {
      algorithm: this.isSmartRankingEnabled()
        ? 'rule_based_v2'
        : 'rule_based_v1',
      placement,
      items: [] as RecommendationApiItem[],
      products: [] as ReturnType<RecommendationsService['mapProduct']>[],
    };
  }

  private async buildPreferenceProfile(
    query: RecommendationQueryDto,
    request: Request,
    user?: AuthenticatedUser | null,
  ): Promise<RecommendationPreferenceProfile> {
    const customerId = user?.userId ?? null;
    const guestSessionId = this.resolveGuestSessionId(
      query.guestSessionId,
      request,
    );

    if (!customerId && !guestSessionId) {
      return {
        categoryIds: new Set<string>(),
        categoryTerms: new Set<string>(),
        brands: new Set<string>(),
        colors: new Set<string>(),
        searchTerms: [],
      };
    }

    const actorWhere = customerId ? { customerId } : { guestSessionId };

    const [views, searches] = await Promise.all([
      this.prisma.productViewLog.findMany({
        where: actorWhere,
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          productId: true,
        },
      }),
      this.prisma.searchLog.findMany({
        where: actorWhere,
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: {
          query: true,
          normalizedQuery: true,
        },
      }),
    ]);

    const categoryIds = new Set<string>();
    const categoryTerms = new Set<string>();
    const brands = new Set<string>();
    const colors = new Set<string>();
    const searchTerms = new Set<string>();

    const viewedProductIds = views
      .map((view) => view.productId)
      .filter((value): value is string => Boolean(value));
    const viewedProducts = viewedProductIds.length
      ? await this.prisma.product.findMany({
          where: {
            id: {
              in: viewedProductIds,
            },
          },
          select: {
            categoryId: true,
            categoryName: true,
            sourceCategoryName: true,
            brand: true,
            color: true,
            category: {
              select: {
                name: true,
              },
            },
          },
        })
      : [];

    for (const product of viewedProducts) {
      if (!product) {
        continue;
      }
      if (product.categoryId) {
        categoryIds.add(product.categoryId.toString());
      }
      [product.category?.name, product.categoryName, product.sourceCategoryName]
        .map((value) => this.normalizeQuery(value ?? ''))
        .filter(Boolean)
        .forEach((value) => categoryTerms.add(value));
      if (product.brand?.trim()) {
        brands.add(this.normalizeQuery(product.brand));
      }
      if (product.color?.trim()) {
        colors.add(this.normalizeQuery(product.color));
      }
    }

    for (const search of searches) {
      const normalized =
        search.normalizedQuery ?? this.normalizeQuery(search.query);
      normalized
        .split(' ')
        .filter((token) => token.length >= 2)
        .forEach((token) => searchTerms.add(token));
    }

    return {
      categoryIds,
      categoryTerms,
      brands,
      colors,
      searchTerms: [...searchTerms],
    };
  }

  private isPublicRecommendationsEnabled() {
    return (
      this.readFlag('RECOMMENDATIONS_ENABLED', true) &&
      this.readFlag('PUBLIC_RECOMMENDATIONS_ENABLED', true)
    );
  }

  private isSmartRankingEnabled() {
    return this.readFlag('RECOMMENDATION_SMART_RANKING_ENABLED', true);
  }

  private isTrackingEnabled() {
    return (
      this.readFlag('RECOMMENDATIONS_ENABLED', true) &&
      this.readFlag('RECOMMENDATION_TRACKING_ENABLED', true)
    );
  }

  private shouldIncludeExplainability(debug = false) {
    return (
      debug && this.readFlag('RECOMMENDATION_EXPLAINABILITY_ENABLED', false)
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

  private resolveVariantPrice(
    variant: ProductVariant | RecommendationVariantRecord,
  ) {
    return variant.discountPrice ?? variant.basePrice ?? null;
  }

  private resolveVariantAvailableQuantity(
    variant: ProductVariant | RecommendationVariantRecord,
  ) {
    return variant.trackInventory ? Math.max(0, variant.stockQuantity) : 999999;
  }

  private resolveAvailableQuantity(
    variants: Array<ProductVariant | RecommendationVariantRecord>,
  ) {
    return variants.reduce(
      (sum, variant) => sum + this.resolveVariantAvailableQuantity(variant),
      0,
    );
  }

  private resolvePrice(
    variants: Array<ProductVariant | RecommendationVariantRecord>,
  ) {
    const pricedVariants = variants
      .map((variant) => this.resolveVariantPrice(variant))
      .filter((value): value is Prisma.Decimal => value !== null);
    if (!pricedVariants.length) {
      return null;
    }

    return pricedVariants.sort((left, right) => left.comparedTo(right))[0];
  }

  private resolveOriginalPrice(
    variants: Array<ProductVariant | RecommendationVariantRecord>,
  ) {
    const originalPrices = variants
      .map((variant) => variant.basePrice ?? null)
      .filter((value): value is Prisma.Decimal => value !== null);
    if (!originalPrices.length) {
      return null;
    }

    return originalPrices.sort((left, right) => left.comparedTo(right))[0];
  }

  private scoreSimilarProductV1(
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
    score += this.recencyScoreV1(candidate);

    return score;
  }

  private scoreHomeProductV1(product: RecommendationProductRecord) {
    let score = 0;

    if (this.resolveAvailableQuantity(product.variants) > 0) {
      score += 50;
    }
    if (product.publishedAt) {
      score += 25;
    }
    score += Number(product.averageRating?.toString() ?? '0') * 5;
    score += Math.min(product.feedbackCount ?? 0, 25);
    score += this.recencyScoreV1(product);

    return score;
  }

  private recencyScoreV1(product: RecommendationProductRecord) {
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
