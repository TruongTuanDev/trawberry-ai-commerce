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

export type ScoredRecommendation = {
  score: number;
  reasonCodes: RecommendationReasonCode[];
  debug: {
    categoryScore: number;
    textScore: number;
    popularityScore: number;
    freshnessScore: number;
    ratingScore: number;
    stockScore: number;
    shopScore: number;
    penaltyScore: number;
  };
};

@Injectable()
export class RecommendationScoringService {
  scoreSimilarProduct(
    source: RecommendationProductRecord,
    candidate: RecommendationProductRecord,
  ): ScoredRecommendation {
    return this.scoreCandidate(candidate, {
      placement: 'product_detail',
      sourceProduct: source,
    });
  }

  scoreHomeProduct(
    candidate: RecommendationProductRecord,
    preferenceProfile: RecommendationPreferenceProfile,
  ): ScoredRecommendation {
    return this.scoreCandidate(candidate, {
      placement: 'home',
      preferenceProfile,
    });
  }

  scoreSearchProduct(
    query: string,
    candidate: RecommendationProductRecord,
  ): ScoredRecommendation {
    return this.scoreCandidate(candidate, {
      placement: 'search',
      query,
    });
  }

  private scoreCandidate(
    candidate: RecommendationProductRecord,
    input: {
      placement: RecommendationPlacement;
      sourceProduct?: RecommendationProductRecord;
      preferenceProfile?: RecommendationPreferenceProfile;
      query?: string;
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

    const score =
      categoryScore +
      textScore +
      popularityScore +
      freshnessScore +
      ratingScore +
      stockScore +
      shopScore -
      penaltyScore;

    return {
      score: Number(score.toFixed(2)),
      reasonCodes: [...reasonCodes],
      debug: {
        categoryScore,
        textScore,
        popularityScore,
        freshnessScore,
        ratingScore,
        stockScore,
        shopScore,
        penaltyScore,
      },
    };
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
      return 35;
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
      return 28;
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
      return 24;
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

    return Math.min(20, matches * 5);
  }

  private resolvePopularityScore(
    candidate: RecommendationProductRecord,
    reasonCodes: Set<RecommendationReasonCode>,
  ) {
    const feedbackCount = Math.max(0, candidate.feedbackCount ?? 0);
    const score = Math.min(15, feedbackCount * 1.25);
    if (score >= 6) {
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
    const score = Math.max(0, 10 - ageDays / 3);
    if (score >= 4) {
      reasonCodes.add('fresh');
    }
    return Number(score.toFixed(2));
  }

  private resolveRatingScore(
    candidate: RecommendationProductRecord,
    reasonCodes: Set<RecommendationReasonCode>,
  ) {
    const rating = Number(candidate.averageRating?.toString() ?? '0');
    const score = Math.max(0, Math.min(10, (rating / 5) * 10));
    if (score >= 7) {
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
    return Math.min(5, 2 + quantity / 10);
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
      score += 2;
      reasonCodes.add('has_image');
    }

    if (
      input.sourceProduct &&
      input.sourceProduct.shopId === candidate.shopId
    ) {
      score += 3;
      reasonCodes.add('same_shop');
    }

    return Math.min(5, score);
  }

  private resolvePenaltyScore(candidate: RecommendationProductRecord) {
    let penalty = 0;

    if (candidate.images.length === 0) {
      penalty += 4;
    }
    if (this.resolveAvailableQuantity(candidate.variants) <= 0) {
      penalty += 2;
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
