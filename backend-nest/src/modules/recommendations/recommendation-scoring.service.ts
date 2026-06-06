import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type RecommendationProductRecord = {
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
  images: Array<{
    id: string;
    wbUrl: string;
    localUrl: string | null;
    isMain: boolean | null;
    sortOrder: number;
  }>;
  variants: RecommendationVariantRecord[];
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

export type RecommendationVariantRecord = {
  id: string;
  sizeName: string | null;
  russianSize: string | null;
  techSize: string | null;
  wbSize: string | null;
  sellerSku: string | null;
  isActive: boolean;
  basePrice: Prisma.Decimal | null;
  discountPrice: Prisma.Decimal | null;
  stockQuantity: number;
  reservedStock: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  createdAt: Date;
};

export type RecommendationPlacement =
  | 'home'
  | 'product_detail'
  | 'search'
  | 'cart_later_reserved';

export type RecommendationReasonCode =
  | 'same_category'
  | 'matching_category_name'
  | 'based_on_viewed_category'
  | 'same_color'
  | 'same_brand'
  | 'keyword_match'
  | 'popular'
  | 'fresh'
  | 'high_rating'
  | 'in_stock'
  | 'same_shop'
  | 'has_image';

export type RecommendationPreferenceProfile = {
  categoryIds: Set<string>;
  categoryTerms: Set<string>;
  brands: Set<string>;
  colors: Set<string>;
  searchTerms: string[];
};

export type RecommendationScoreBreakdown = {
  categoryScore: number;
  textScore: number;
  popularityScore: number;
  freshnessScore: number;
  ratingScore: number;
  stockScore: number;
  shopScore: number;
  penaltyScore: number;
  sponsoredBoostScore: number;
  businessBoostScore: number;
  maxSponsoredBoost: number;
};

export type ScoredRecommendation = {
  score: number;
  reasonCodes: RecommendationReasonCode[];
  scoreBreakdown: RecommendationScoreBreakdown;
  sponsoredReason: string | null;
};

export type RecommendationSponsoredRankingConfig = {
  enabled: boolean;
  sponsoredProductIds: Set<string>;
  businessBoostShopIds: Set<string>;
  sponsoredBoost: number;
  businessBoost: number;
  maxSponsoredBoost: number;
};

export const RECOMMENDATION_SCORING_WEIGHTS = {
  category: {
    sameCategory: 35,
    matchingCategoryName: 28,
    basedOnViewedCategory: 24,
  },
  text: {
    match: 5,
    max: 20,
  },
  popularity: {
    perFeedback: 1.25,
    max: 15,
    reasonThreshold: 6,
  },
  freshness: {
    max: 10,
    decayDays: 3,
    reasonThreshold: 4,
  },
  rating: {
    max: 10,
    reasonThreshold: 7,
  },
  stock: {
    base: 2,
    perTenUnits: 10,
    max: 5,
  },
  shop: {
    hasImage: 2,
    sameShop: 3,
    max: 5,
  },
  penalty: {
    missingImage: 4,
    outOfStock: 2,
  },
} as const;

export const RECOMMENDATION_SPONSORED_RANKING_LIMITS = {
  sponsoredBoostDefault: 4,
  businessBoostDefault: 2,
  maxSponsoredBoostDefault: 5,
  maxConfiguredBoost: 12,
  relevanceCapRatio: 0.2,
} as const;

export const RECOMMENDATION_REASON_LABELS: Record<
  RecommendationReasonCode,
  string
> = {
  same_category: 'Same category as the source product',
  matching_category_name: 'Matching category name fallback matched',
  based_on_viewed_category: 'Aligned with recent viewed category interest',
  same_color: 'Matches preferred or source color',
  same_brand: 'Matches preferred or source brand',
  keyword_match: 'Matched search or source text intent',
  popular: 'Strong feedback volume popularity signal',
  fresh: 'Recently published or updated item',
  high_rating: 'High rating signal',
  in_stock: 'Currently in stock',
  same_shop: 'From the same shop as the source product',
  has_image: 'Has product imagery available',
};

@Injectable()
export class RecommendationScoringService {
  scoreSimilarProduct(
    source: RecommendationProductRecord,
    candidate: RecommendationProductRecord,
    sponsoredRanking?: RecommendationSponsoredRankingConfig,
  ): ScoredRecommendation {
    return this.scoreCandidate(candidate, {
      placement: 'product_detail',
      sourceProduct: source,
      sponsoredRanking,
    });
  }

  scoreHomeProduct(
    candidate: RecommendationProductRecord,
    preferenceProfile: RecommendationPreferenceProfile,
    sponsoredRanking?: RecommendationSponsoredRankingConfig,
  ): ScoredRecommendation {
    return this.scoreCandidate(candidate, {
      placement: 'home',
      preferenceProfile,
      sponsoredRanking,
    });
  }

  scoreSearchProduct(
    query: string,
    candidate: RecommendationProductRecord,
    sponsoredRanking?: RecommendationSponsoredRankingConfig,
  ): ScoredRecommendation {
    return this.scoreCandidate(candidate, {
      placement: 'search',
      query,
      sponsoredRanking,
    });
  }

  private scoreCandidate(
    candidate: RecommendationProductRecord,
    input: {
      placement: RecommendationPlacement;
      sourceProduct?: RecommendationProductRecord;
      preferenceProfile?: RecommendationPreferenceProfile;
      query?: string;
      sponsoredRanking?: RecommendationSponsoredRankingConfig;
    },
  ): ScoredRecommendation {
    const reasonCodes = new Set<RecommendationReasonCode>();
    const categoryScore = this.resolveCategoryScore(
      candidate,
      input,
      reasonCodes,
    );
    const textScore = this.resolveTextScore(candidate, input, reasonCodes);
    const popularityScore = this.resolvePopularityScore(candidate, reasonCodes);
    const freshnessScore = this.resolveFreshnessScore(candidate, reasonCodes);
    const ratingScore = this.resolveRatingScore(candidate, reasonCodes);
    const stockScore = this.resolveStockScore(candidate, reasonCodes);
    const shopScore = this.resolveShopScore(candidate, input, reasonCodes);
    const penaltyScore = this.resolvePenaltyScore(candidate);
    const organicScore =
      categoryScore +
      textScore +
      popularityScore +
      freshnessScore +
      ratingScore +
      stockScore +
      shopScore -
      penaltyScore;
    const sponsoredBoost = this.resolveSponsoredBoost(
      candidate,
      organicScore,
      input.sponsoredRanking,
    );
    const score =
      organicScore +
      sponsoredBoost.sponsoredBoostScore +
      sponsoredBoost.businessBoostScore;

    return {
      score: Number(score.toFixed(2)),
      reasonCodes: [...reasonCodes],
      scoreBreakdown: {
        categoryScore,
        textScore,
        popularityScore,
        freshnessScore,
        ratingScore,
        stockScore,
        shopScore,
        penaltyScore,
        sponsoredBoostScore: sponsoredBoost.sponsoredBoostScore,
        businessBoostScore: sponsoredBoost.businessBoostScore,
        maxSponsoredBoost: sponsoredBoost.maxSponsoredBoost,
      },
      sponsoredReason: sponsoredBoost.sponsoredReason,
    };
  }

  private resolveSponsoredBoost(
    candidate: RecommendationProductRecord,
    organicScore: number,
    config?: RecommendationSponsoredRankingConfig,
  ) {
    const disabledResult = {
      sponsoredBoostScore: 0,
      businessBoostScore: 0,
      maxSponsoredBoost: config?.enabled ? config.maxSponsoredBoost : 0,
      sponsoredReason: null as string | null,
    };

    if (!config?.enabled || !this.isBoostEligible(candidate)) {
      return disabledResult;
    }

    const baseSponsoredBoost = config.sponsoredProductIds.has(candidate.id)
      ? config.sponsoredBoost
      : 0;
    const baseBusinessBoost = config.businessBoostShopIds.has(candidate.shopId)
      ? config.businessBoost
      : 0;
    const rawBoost = baseSponsoredBoost + baseBusinessBoost;
    if (rawBoost <= 0) {
      return disabledResult;
    }

    const effectiveCap = Math.min(
      config.maxSponsoredBoost,
      Number(
        (
          Math.max(0, organicScore) *
          RECOMMENDATION_SPONSORED_RANKING_LIMITS.relevanceCapRatio
        ).toFixed(2),
      ),
    );
    if (effectiveCap <= 0) {
      return disabledResult;
    }

    const scale = Math.min(1, effectiveCap / rawBoost);
    const sponsoredBoostScore = Number((baseSponsoredBoost * scale).toFixed(2));
    const businessBoostScore = Number((baseBusinessBoost * scale).toFixed(2));

    return {
      sponsoredBoostScore,
      businessBoostScore,
      maxSponsoredBoost: config.maxSponsoredBoost,
      sponsoredReason: this.resolveSponsoredReason(
        sponsoredBoostScore,
        businessBoostScore,
      ),
    };
  }

  private resolveSponsoredReason(
    sponsoredBoostScore: number,
    businessBoostScore: number,
  ) {
    if (sponsoredBoostScore > 0 && businessBoostScore > 0) {
      return 'Internal sponsored and business boost applied within safety cap';
    }
    if (sponsoredBoostScore > 0) {
      return 'Internal sponsored boost applied within safety cap';
    }
    if (businessBoostScore > 0) {
      return 'Internal business boost applied within safety cap';
    }
    return null;
  }

  private isBoostEligible(candidate: RecommendationProductRecord) {
    return (
      candidate.visibility === 'ACTIVE' &&
      candidate.catalogStatus === 'PUBLISHED' &&
      candidate.archivedAt === null &&
      candidate.unpublishedAt === null &&
      candidate.shop.status === 'ACTIVE' &&
      candidate.shop.sellerProfile.approvalStatus === 'APPROVED' &&
      this.resolveAvailableQuantity(candidate.variants) > 0
    );
  }

  private resolveCategoryScore(
    candidate: RecommendationProductRecord,
    input: {
      sourceProduct?: RecommendationProductRecord;
      preferenceProfile?: RecommendationPreferenceProfile;
    },
    reasonCodes: Set<RecommendationReasonCode>,
  ) {
    const normalizedCandidateCategory = this.normalize(
      candidate.category?.name ??
        candidate.categoryName ??
        candidate.sourceCategoryName,
    );
    const normalizedCandidateSourceCategory = this.normalize(
      candidate.sourceCategoryName,
    );
    const candidateCategoryId = candidate.categoryId?.toString() ?? null;

    if (
      input.sourceProduct?.categoryId &&
      candidate.categoryId === input.sourceProduct.categoryId
    ) {
      reasonCodes.add('same_category');
      return RECOMMENDATION_SCORING_WEIGHTS.category.sameCategory;
    }

    const sourceTerms = [
      this.normalize(input.sourceProduct?.category?.name ?? null),
      this.normalize(input.sourceProduct?.categoryName ?? null),
      this.normalize(input.sourceProduct?.sourceCategoryName ?? null),
    ].filter(Boolean);

    if (
      sourceTerms.some(
        (value) =>
          value === normalizedCandidateCategory ||
          value === normalizedCandidateSourceCategory,
      )
    ) {
      reasonCodes.add('matching_category_name');
      return RECOMMENDATION_SCORING_WEIGHTS.category.matchingCategoryName;
    }

    if (
      input.preferenceProfile &&
      ((candidateCategoryId &&
        input.preferenceProfile.categoryIds.has(candidateCategoryId)) ||
        (normalizedCandidateCategory &&
          input.preferenceProfile.categoryTerms.has(
            normalizedCandidateCategory,
          )) ||
        (normalizedCandidateSourceCategory &&
          input.preferenceProfile.categoryTerms.has(
            normalizedCandidateSourceCategory,
          )))
    ) {
      reasonCodes.add('based_on_viewed_category');
      return RECOMMENDATION_SCORING_WEIGHTS.category.basedOnViewedCategory;
    }

    return 0;
  }

  private resolveTextScore(
    candidate: RecommendationProductRecord,
    input: {
      sourceProduct?: RecommendationProductRecord;
      preferenceProfile?: RecommendationPreferenceProfile;
      query?: string;
    },
    reasonCodes: Set<RecommendationReasonCode>,
  ) {
    const terms = new Set<string>();
    this.tokenize(input.query).forEach((term) => terms.add(term));
    input.preferenceProfile?.searchTerms.forEach((term) => terms.add(term));
    this.tokenize(
      input.sourceProduct?.localTitle ?? input.sourceProduct?.wbTitle,
    ).forEach((term) => terms.add(term));
    this.tokenize(input.sourceProduct?.brand).forEach((term) =>
      terms.add(term),
    );
    this.tokenize(input.sourceProduct?.color).forEach((term) =>
      terms.add(term),
    );

    if (!terms.size) {
      return 0;
    }

    const haystack = [
      candidate.localTitle,
      candidate.wbTitle,
      candidate.localDescription,
      candidate.wbDescription,
      candidate.brand,
      candidate.color,
      candidate.category?.name,
      candidate.categoryName,
      candidate.sourceCategoryName,
    ]
      .filter(Boolean)
      .map((value) => this.normalize(value))
      .join(' ');

    const matches = [...terms].filter(
      (term) => term.length >= 2 && haystack.includes(term),
    ).length;

    if (matches > 0) {
      reasonCodes.add('keyword_match');
    }

    return Math.min(
      RECOMMENDATION_SCORING_WEIGHTS.text.max,
      matches * RECOMMENDATION_SCORING_WEIGHTS.text.match,
    );
  }

  private resolvePopularityScore(
    candidate: RecommendationProductRecord,
    reasonCodes: Set<RecommendationReasonCode>,
  ) {
    const feedbackCount = Math.max(0, candidate.feedbackCount ?? 0);
    const score = Math.min(
      RECOMMENDATION_SCORING_WEIGHTS.popularity.max,
      feedbackCount * RECOMMENDATION_SCORING_WEIGHTS.popularity.perFeedback,
    );
    if (score >= RECOMMENDATION_SCORING_WEIGHTS.popularity.reasonThreshold) {
      reasonCodes.add('popular');
    }
    return Number(score.toFixed(2));
  }

  private resolveFreshnessScore(
    candidate: RecommendationProductRecord,
    reasonCodes: Set<RecommendationReasonCode>,
  ) {
    const reference =
      candidate.publishedAt ?? candidate.updatedAt ?? candidate.createdAt;
    const ageDays = Math.max(
      0,
      (Date.now() - reference.getTime()) / (1000 * 60 * 60 * 24),
    );
    const score = Math.max(
      0,
      RECOMMENDATION_SCORING_WEIGHTS.freshness.max -
        ageDays / RECOMMENDATION_SCORING_WEIGHTS.freshness.decayDays,
    );
    if (score >= RECOMMENDATION_SCORING_WEIGHTS.freshness.reasonThreshold) {
      reasonCodes.add('fresh');
    }
    return Number(score.toFixed(2));
  }

  private resolveRatingScore(
    candidate: RecommendationProductRecord,
    reasonCodes: Set<RecommendationReasonCode>,
  ) {
    const rating = Number(candidate.averageRating?.toString() ?? '0');
    const score = Math.max(
      0,
      Math.min(
        RECOMMENDATION_SCORING_WEIGHTS.rating.max,
        (rating / 5) * RECOMMENDATION_SCORING_WEIGHTS.rating.max,
      ),
    );
    if (score >= RECOMMENDATION_SCORING_WEIGHTS.rating.reasonThreshold) {
      reasonCodes.add('high_rating');
    }
    return Number(score.toFixed(2));
  }

  private resolveStockScore(
    candidate: RecommendationProductRecord,
    reasonCodes: Set<RecommendationReasonCode>,
  ) {
    const quantity = this.resolveAvailableQuantity(candidate.variants);
    if (quantity <= 0) {
      return 0;
    }

    reasonCodes.add('in_stock');
    return Math.min(
      RECOMMENDATION_SCORING_WEIGHTS.stock.max,
      RECOMMENDATION_SCORING_WEIGHTS.stock.base +
        quantity / RECOMMENDATION_SCORING_WEIGHTS.stock.perTenUnits,
    );
  }

  private resolveShopScore(
    candidate: RecommendationProductRecord,
    input: {
      sourceProduct?: RecommendationProductRecord;
    },
    reasonCodes: Set<RecommendationReasonCode>,
  ) {
    let score = 0;

    if (candidate.images.length > 0) {
      score += RECOMMENDATION_SCORING_WEIGHTS.shop.hasImage;
      reasonCodes.add('has_image');
    }

    if (
      input.sourceProduct &&
      input.sourceProduct.shopId === candidate.shopId
    ) {
      score += RECOMMENDATION_SCORING_WEIGHTS.shop.sameShop;
      reasonCodes.add('same_shop');
    }

    return Math.min(RECOMMENDATION_SCORING_WEIGHTS.shop.max, score);
  }

  private resolvePenaltyScore(candidate: RecommendationProductRecord) {
    let penalty = 0;

    if (candidate.images.length === 0) {
      penalty += RECOMMENDATION_SCORING_WEIGHTS.penalty.missingImage;
    }
    if (this.resolveAvailableQuantity(candidate.variants) <= 0) {
      penalty += RECOMMENDATION_SCORING_WEIGHTS.penalty.outOfStock;
    }

    return penalty;
  }

  private resolveAvailableQuantity(variants: RecommendationVariantRecord[]) {
    return variants.reduce((sum, variant) => {
      if (!variant.trackInventory) {
        return sum + 999999;
      }
      return sum + Math.max(0, variant.stockQuantity);
    }, 0);
  }

  private tokenize(value: string | null | undefined) {
    return this.normalize(value)
      .split(' ')
      .map((part) => part.trim())
      .filter((part) => part.length >= 2);
  }

  private normalize(value: string | null | undefined) {
    return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  }
}
