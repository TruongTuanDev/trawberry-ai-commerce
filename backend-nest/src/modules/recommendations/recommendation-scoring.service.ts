import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  RecommendationCampaignReadinessMetadata,
  RecommendationSponsoredCampaignMetadata,
  RecommendationSponsoredPresetMetadata,
} from './recommendation-sponsored-config';
import type { RecommendationTuningConfig } from './recommendation-tuning-config';

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
  | 'based_on_recent_views'
  | 'based_on_category_affinity'
  | 'based_on_search_intent'
  | 'based_on_recommendation_clicks'
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
  recentViewProductScores: Map<string, number>;
  recentViewBrandScores: Map<string, number>;
  recentViewColorScores: Map<string, number>;
  categoryAffinityScores: Map<string, number>;
  categoryTermAffinityScores: Map<string, number>;
  searchIntentScores: Map<string, number>;
  clickAffinityProductScores: Map<string, number>;
  clickAffinityCategoryScores: Map<string, number>;
  clickAffinityCategoryTermScores: Map<string, number>;
  clickAffinityBrandScores: Map<string, number>;
  clickAffinityColorScores: Map<string, number>;
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
  personalizationScore: number;
  recentViewScore: number;
  categoryAffinityScore: number;
  searchIntentScore: number;
  clickAffinityScore: number;
  analyticsPerformanceScore: number;
  ctrScore: number;
  productEngagementScore: number;
  engagementScore: number;
  algorithmPerformanceHint: number;
  scenarioPerformanceHint: number;
  sponsoredBoostScore: number;
  businessBoostScore: number;
  maxSponsoredBoost: number;
};

export type RecommendationAnalyticsSignalKey =
  | 'ctr'
  | 'engagement'
  | 'algorithm_hint'
  | 'scenario_hint';

export type RecommendationAnalyticsTuningConfig = {
  enabled: boolean;
  minEventsForCtrBoost: number;
  minClicksForEngagementBoost: number;
  maxAnalyticsBoost: number;
  maxCtrBoost: number;
  maxLowCtrPenalty: number;
  maxEngagementBoost: number;
  algorithmPerformanceHint: number;
  scenarioPerformanceHint: number;
  productSignalsById: Map<
    string,
    {
      impressions: number;
      clicks: number;
      ctr: number;
    }
  >;
};

export type ScoredRecommendation = {
  score: number;
  reasonCodes: RecommendationReasonCode[];
  scoreBreakdown: RecommendationScoreBreakdown;
  analyticsSignalsUsed: RecommendationAnalyticsSignalKey[];
  analyticsTuningEnabled: boolean;
  sponsoredReason: string | null;
  sponsoredPreset: RecommendationSponsoredPresetMetadata | null;
  campaignReadiness: RecommendationCampaignReadinessMetadata;
  sponsoredCampaign: RecommendationSponsoredCampaignMetadata | null;
  sponsored: boolean;
};

export type RecommendationSponsoredTargetConfig = {
  campaignId: string;
  shopId: string;
  productId: string;
  boost: number;
  billingMode: 'none' | 'cpc' | 'cpm' | 'fixed';
  scenarioType: 'home' | 'similar' | 'search';
};

export type RecommendationSponsoredRankingConfig = {
  enabled: boolean;
  sponsoredProductIds: Set<string>;
  sponsoredTargetsByProductId: Map<string, RecommendationSponsoredTargetConfig>;
  businessBoostShopIds: Set<string>;
  sponsoredBoost: number;
  businessBoost: number;
  maxSponsoredBoost: number;
  maxBusinessBoost: number;
  preset: RecommendationSponsoredPresetMetadata | null;
  campaign: RecommendationSponsoredCampaignMetadata | null;
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
  personalization: {
    totalMax: 18,
    recentView: {
      productMatch: 6,
      brandMatch: 2.5,
      colorMatch: 1.5,
      max: 7,
    },
    categoryAffinity: {
      max: 6,
    },
    searchIntent: {
      perToken: 2.25,
      max: 5,
    },
    clickAffinity: {
      productMatch: 5,
      categoryMatch: 2.5,
      brandMatch: 2,
      colorMatch: 1.25,
      max: 6,
    },
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
  based_on_recent_views: 'Aligned with recent product viewing behavior',
  based_on_category_affinity:
    'Aligned with category affinity from recent behavior',
  based_on_search_intent: 'Aligned with recent search intent',
  based_on_recommendation_clicks:
    'Aligned with prior recommendation click affinity',
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
    preferenceProfileOrSponsored?:
      | RecommendationPreferenceProfile
      | RecommendationSponsoredRankingConfig,
    sponsoredRanking?: RecommendationSponsoredRankingConfig,
    analyticsTuning?: RecommendationAnalyticsTuningConfig,
    tuningConfig?: RecommendationTuningConfig | null,
  ): ScoredRecommendation {
    const preferenceProfile = this.isSponsoredRankingConfig(
      preferenceProfileOrSponsored,
    )
      ? undefined
      : preferenceProfileOrSponsored;
    const resolvedSponsoredRanking = this.isSponsoredRankingConfig(
      preferenceProfileOrSponsored,
    )
      ? preferenceProfileOrSponsored
      : sponsoredRanking;

    return this.scoreCandidate(candidate, {
      placement: 'product_detail',
      sourceProduct: source,
      preferenceProfile,
      sponsoredRanking: resolvedSponsoredRanking,
      analyticsTuning,
      tuningConfig,
    });
  }

  scoreHomeProduct(
    candidate: RecommendationProductRecord,
    preferenceProfile: RecommendationPreferenceProfile,
    sponsoredRanking?: RecommendationSponsoredRankingConfig,
    analyticsTuning?: RecommendationAnalyticsTuningConfig,
    tuningConfig?: RecommendationTuningConfig | null,
  ): ScoredRecommendation {
    return this.scoreCandidate(candidate, {
      placement: 'home',
      preferenceProfile,
      sponsoredRanking,
      analyticsTuning,
      tuningConfig,
    });
  }

  scoreSearchProduct(
    query: string,
    candidate: RecommendationProductRecord,
    preferenceProfileOrSponsored?:
      | RecommendationPreferenceProfile
      | RecommendationSponsoredRankingConfig,
    sponsoredRanking?: RecommendationSponsoredRankingConfig,
    analyticsTuning?: RecommendationAnalyticsTuningConfig,
    tuningConfig?: RecommendationTuningConfig | null,
  ): ScoredRecommendation {
    const preferenceProfile = this.isSponsoredRankingConfig(
      preferenceProfileOrSponsored,
    )
      ? undefined
      : preferenceProfileOrSponsored;
    const resolvedSponsoredRanking = this.isSponsoredRankingConfig(
      preferenceProfileOrSponsored,
    )
      ? preferenceProfileOrSponsored
      : sponsoredRanking;

    return this.scoreCandidate(candidate, {
      placement: 'search',
      query,
      preferenceProfile,
      sponsoredRanking: resolvedSponsoredRanking,
      analyticsTuning,
      tuningConfig,
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
      analyticsTuning?: RecommendationAnalyticsTuningConfig;
      tuningConfig?: RecommendationTuningConfig | null;
    },
  ): ScoredRecommendation {
    const reasonCodes = new Set<RecommendationReasonCode>();
    const rawCategoryScore = this.resolveCategoryScore(
      candidate,
      input,
      reasonCodes,
    );
    const rawTextScore = this.resolveTextScore(candidate, input, reasonCodes);
    const rawPopularityScore = this.resolvePopularityScore(
      candidate,
      reasonCodes,
    );
    const rawFreshnessScore = this.resolveFreshnessScore(
      candidate,
      reasonCodes,
    );
    const rawRatingScore = this.resolveRatingScore(candidate, reasonCodes);
    const rawStockScore = this.resolveStockScore(candidate, reasonCodes);
    const rawShopScore = this.resolveShopScore(candidate, input, reasonCodes);
    const penaltyScore = this.resolvePenaltyScore(candidate);
    const rawPersonalization = this.resolvePersonalizationScore(
      candidate,
      input.preferenceProfile,
      reasonCodes,
    );
    const categoryScore = this.applyTuningWeight(
      rawCategoryScore,
      input.tuningConfig?.weights.categoryScore,
    );
    const textScore = this.applyTuningWeight(
      rawTextScore,
      input.tuningConfig?.weights.textScore,
    );
    const popularityScore = this.applyTuningWeight(
      rawPopularityScore,
      input.tuningConfig?.weights.popularityScore,
    );
    const freshnessScore = this.applyTuningWeight(
      rawFreshnessScore,
      input.tuningConfig?.weights.freshnessScore,
    );
    const ratingScore = this.applyTuningWeight(
      rawRatingScore,
      input.tuningConfig?.weights.ratingScore,
    );
    const stockScore = this.applyTuningWeight(
      rawStockScore,
      input.tuningConfig?.weights.stockScore,
    );
    const shopScore = this.applyTuningWeight(
      rawShopScore,
      input.tuningConfig?.weights.shopScore,
    );
    const personalizationScore = Math.min(
      input.tuningConfig?.guardrails.maxPersonalizationScore ??
        Number.MAX_SAFE_INTEGER,
      this.applyTuningWeight(
        rawPersonalization.personalizationScore,
        input.tuningConfig?.weights.personalizationScore,
      ),
    );
    const organicScore =
      categoryScore +
      textScore +
      popularityScore +
      freshnessScore +
      ratingScore +
      stockScore +
      shopScore +
      personalizationScore -
      penaltyScore;
    const rawAnalyticsTuning = this.resolveAnalyticsTuningScore(
      candidate,
      organicScore,
      input.analyticsTuning,
    );
    const analyticsPerformanceScore = this.clampTunedAnalyticsScore(
      rawAnalyticsTuning.analyticsPerformanceScore,
      input.tuningConfig,
    );
    const rawSponsoredBoost = this.resolveSponsoredBoost(
      candidate,
      organicScore + analyticsPerformanceScore,
      input.sponsoredRanking,
    );
    const sponsoredBoostScore = this.clampTunedSponsoredScore(
      rawSponsoredBoost.sponsoredBoostScore,
      input.tuningConfig?.weights.sponsoredBoost,
      input.tuningConfig?.guardrails.maxSponsoredBoostScore,
    );
    const businessBoostScore = this.clampTunedSponsoredScore(
      rawSponsoredBoost.businessBoostScore,
      input.tuningConfig?.weights.sponsoredBoost,
      input.tuningConfig?.guardrails.maxBusinessBoostScore,
    );
    const score =
      organicScore +
      analyticsPerformanceScore +
      sponsoredBoostScore +
      businessBoostScore;

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
        personalizationScore,
        recentViewScore: rawPersonalization.recentViewScore,
        categoryAffinityScore: rawPersonalization.categoryAffinityScore,
        searchIntentScore: rawPersonalization.searchIntentScore,
        clickAffinityScore: rawPersonalization.clickAffinityScore,
        analyticsPerformanceScore,
        ctrScore: rawAnalyticsTuning.ctrScore,
        productEngagementScore: rawAnalyticsTuning.productEngagementScore,
        engagementScore: rawAnalyticsTuning.productEngagementScore,
        algorithmPerformanceHint: rawAnalyticsTuning.algorithmPerformanceHint,
        scenarioPerformanceHint: rawAnalyticsTuning.scenarioPerformanceHint,
        sponsoredBoostScore,
        businessBoostScore,
        maxSponsoredBoost: Math.min(
          rawSponsoredBoost.maxSponsoredBoost,
          input.tuningConfig?.guardrails.maxSponsoredBoostScore ??
            rawSponsoredBoost.maxSponsoredBoost,
        ),
      },
      analyticsSignalsUsed: rawAnalyticsTuning.analyticsSignalsUsed,
      analyticsTuningEnabled: rawAnalyticsTuning.analyticsTuningEnabled,
      sponsoredReason: rawSponsoredBoost.sponsoredReason,
      sponsoredPreset: input.sponsoredRanking?.enabled
        ? input.sponsoredRanking.preset
        : null,
      campaignReadiness: {
        ...rawSponsoredBoost.campaignReadiness,
        sponsoredBoostApplied: sponsoredBoostScore + businessBoostScore > 0,
        sponsoredBoostScore: Number(
          (sponsoredBoostScore + businessBoostScore).toFixed(2),
        ),
        campaignReadinessStatus:
          sponsoredBoostScore + businessBoostScore > 0
            ? 'boosted'
            : rawSponsoredBoost.campaignReadiness.campaignReadinessStatus ===
                'boosted'
              ? 'eligible'
              : rawSponsoredBoost.campaignReadiness.campaignReadinessStatus,
      },
      sponsoredCampaign: rawSponsoredBoost.sponsoredCampaign,
      sponsored:
        sponsoredBoostScore + businessBoostScore > 0 &&
        rawSponsoredBoost.hasCampaign,
    };
  }

  private applyTuningWeight(score: number, weight = 1) {
    return Number((score * weight).toFixed(2));
  }

  private clampTunedAnalyticsScore(
    score: number,
    tuningConfig: RecommendationTuningConfig | null | undefined,
  ) {
    if (!tuningConfig) {
      return score;
    }
    const weighted = this.applyTuningWeight(
      score,
      tuningConfig.weights.analyticsPerformanceScore,
    );
    return Number(
      Math.max(
        -tuningConfig.guardrails.maxAnalyticsPerformanceScore,
        Math.min(
          tuningConfig.guardrails.maxAnalyticsPerformanceScore,
          weighted,
        ),
      ).toFixed(2),
    );
  }

  private clampTunedSponsoredScore(
    score: number,
    weight = 1,
    configuredCap = Number.MAX_SAFE_INTEGER,
  ) {
    return Number(
      Math.min(
        score,
        configuredCap,
        this.applyTuningWeight(score, weight),
      ).toFixed(2),
    );
  }

  private resolveSponsoredBoost(
    candidate: RecommendationProductRecord,
    organicScore: number,
    config?: RecommendationSponsoredRankingConfig,
  ): {
    sponsoredBoostScore: number;
    businessBoostScore: number;
    maxSponsoredBoost: number;
    sponsoredReason: string | null;
    campaignReadiness: RecommendationCampaignReadinessMetadata;
    sponsoredCampaign: RecommendationSponsoredCampaignMetadata | null;
    totalBoostScore: number;
    hasCampaign: boolean;
  } {
    const disabledResult: {
      sponsoredBoostScore: number;
      businessBoostScore: number;
      maxSponsoredBoost: number;
      sponsoredReason: string | null;
      campaignReadiness: RecommendationCampaignReadinessMetadata;
      sponsoredCampaign: RecommendationSponsoredCampaignMetadata | null;
      totalBoostScore: number;
      hasCampaign: boolean;
    } = {
      sponsoredBoostScore: 0,
      businessBoostScore: 0,
      maxSponsoredBoost: config?.enabled ? config.maxSponsoredBoost : 0,
      sponsoredReason: null as string | null,
      campaignReadiness: {
        sponsoredEligible: false,
        sponsoredBoostApplied: false,
        sponsoredBoostScore: 0,
        sponsoredReason: null,
        sponsoredPresetId: config?.preset?.id ?? null,
        campaignReadinessStatus: 'disabled',
        billingMode: config?.campaign?.billingMode ?? 'none',
        rolloutMode: config?.campaign?.rolloutMode ?? 'disabled',
      },
      sponsoredCampaign: null,
      totalBoostScore: 0,
      hasCampaign: false,
    };

    if (!config?.enabled) {
      return disabledResult;
    }

    const sponsoredEligible = this.isBoostEligible(candidate);
    const targetedCampaign =
      config.sponsoredTargetsByProductId.get(candidate.id) ?? null;
    if (!sponsoredEligible) {
      return {
        ...disabledResult,
        maxSponsoredBoost: config.maxSponsoredBoost,
        campaignReadiness: {
          sponsoredEligible: false,
          sponsoredBoostApplied: false,
          sponsoredBoostScore: 0,
          sponsoredReason: null,
          sponsoredPresetId: config.preset?.id ?? null,
          campaignReadinessStatus: 'ineligible',
          billingMode:
            targetedCampaign?.billingMode ??
            config.campaign?.billingMode ??
            'none',
          rolloutMode: config.campaign?.rolloutMode ?? 'disabled',
        },
        sponsoredCampaign: targetedCampaign
          ? {
              campaignId: targetedCampaign.campaignId,
              sponsorType: 'campaign',
              maxBoost: targetedCampaign.boost,
              scenarioType: targetedCampaign.scenarioType,
              billingMode: targetedCampaign.billingMode,
              rolloutMode: config.campaign?.rolloutMode ?? 'disabled',
            }
          : null,
        hasCampaign: Boolean(targetedCampaign),
      };
    }

    const baseSponsoredBoost = targetedCampaign
      ? Math.min(targetedCampaign.boost, config.maxSponsoredBoost)
      : config.sponsoredProductIds.has(candidate.id)
        ? Math.min(config.sponsoredBoost, config.maxSponsoredBoost)
        : 0;
    const baseBusinessBoost = config.businessBoostShopIds.has(candidate.shopId)
      ? Math.min(config.businessBoost, config.maxBusinessBoost)
      : 0;
    const rawBoost = baseSponsoredBoost + baseBusinessBoost;
    if (rawBoost <= 0) {
      return {
        ...disabledResult,
        maxSponsoredBoost: config.maxSponsoredBoost,
        campaignReadiness: {
          sponsoredEligible: true,
          sponsoredBoostApplied: false,
          sponsoredBoostScore: 0,
          sponsoredReason: null,
          sponsoredPresetId: config.preset?.id ?? null,
          campaignReadinessStatus: 'not_targeted',
          billingMode:
            targetedCampaign?.billingMode ??
            config.campaign?.billingMode ??
            'none',
          rolloutMode: config.campaign?.rolloutMode ?? 'disabled',
        },
        sponsoredCampaign: targetedCampaign
          ? {
              campaignId: targetedCampaign.campaignId,
              sponsorType: 'campaign',
              maxBoost: targetedCampaign.boost,
              scenarioType: targetedCampaign.scenarioType,
              billingMode: targetedCampaign.billingMode,
              rolloutMode: config.campaign?.rolloutMode ?? 'disabled',
            }
          : config.campaign,
        hasCampaign: Boolean(targetedCampaign),
      };
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
      return {
        ...disabledResult,
        maxSponsoredBoost: config.maxSponsoredBoost,
        campaignReadiness: {
          sponsoredEligible: true,
          sponsoredBoostApplied: false,
          sponsoredBoostScore: 0,
          sponsoredReason: null,
          sponsoredPresetId: config.preset?.id ?? null,
          campaignReadinessStatus: 'eligible',
          billingMode:
            targetedCampaign?.billingMode ??
            config.campaign?.billingMode ??
            'none',
          rolloutMode: config.campaign?.rolloutMode ?? 'disabled',
        },
        sponsoredCampaign: targetedCampaign
          ? {
              campaignId: targetedCampaign.campaignId,
              sponsorType: 'campaign',
              maxBoost: targetedCampaign.boost,
              scenarioType: targetedCampaign.scenarioType,
              billingMode: targetedCampaign.billingMode,
              rolloutMode: config.campaign?.rolloutMode ?? 'disabled',
            }
          : config.campaign,
        hasCampaign: Boolean(targetedCampaign),
      };
    }

    const scale = Math.min(1, effectiveCap / rawBoost);
    const sponsoredBoostScore = Number((baseSponsoredBoost * scale).toFixed(2));
    const businessBoostScore = Number((baseBusinessBoost * scale).toFixed(2));

    const sponsoredReason = this.resolveSponsoredReason(
      sponsoredBoostScore,
      businessBoostScore,
    );
    const totalBoostScore = Number(
      (sponsoredBoostScore + businessBoostScore).toFixed(2),
    );

    return {
      sponsoredBoostScore,
      businessBoostScore,
      maxSponsoredBoost: config.maxSponsoredBoost,
      sponsoredReason,
      totalBoostScore,
      campaignReadiness: {
        sponsoredEligible: true,
        sponsoredBoostApplied: totalBoostScore > 0,
        sponsoredBoostScore: totalBoostScore,
        sponsoredReason,
        sponsoredPresetId: config.preset?.id ?? null,
        campaignReadinessStatus: totalBoostScore > 0 ? 'boosted' : 'eligible',
        billingMode:
          targetedCampaign?.billingMode ??
          config.campaign?.billingMode ??
          'none',
        rolloutMode: config.campaign?.rolloutMode ?? 'disabled',
      },
      sponsoredCampaign: targetedCampaign
        ? {
            campaignId: targetedCampaign.campaignId,
            sponsorType: 'campaign',
            maxBoost: targetedCampaign.boost,
            scenarioType: targetedCampaign.scenarioType,
            billingMode: targetedCampaign.billingMode,
            rolloutMode: config.campaign?.rolloutMode ?? 'disabled',
          }
        : config.campaign,
      hasCampaign: Boolean(targetedCampaign),
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

  private isSponsoredRankingConfig(
    value:
      | RecommendationPreferenceProfile
      | RecommendationSponsoredRankingConfig
      | undefined,
  ): value is RecommendationSponsoredRankingConfig {
    return (
      Boolean(value) &&
      typeof value === 'object' &&
      'enabled' in value &&
      'sponsoredProductIds' in value
    );
  }

  private resolvePersonalizationScore(
    candidate: RecommendationProductRecord,
    preferenceProfile: RecommendationPreferenceProfile | undefined,
    reasonCodes: Set<RecommendationReasonCode>,
  ) {
    if (!preferenceProfile) {
      return {
        personalizationScore: 0,
        recentViewScore: 0,
        categoryAffinityScore: 0,
        searchIntentScore: 0,
        clickAffinityScore: 0,
      };
    }

    const recentViewScore = this.resolveRecentViewScore(
      candidate,
      preferenceProfile,
    );
    const categoryAffinityScore = this.resolveCategoryAffinityScore(
      candidate,
      preferenceProfile,
    );
    const searchIntentScore = this.resolveSearchIntentScore(
      candidate,
      preferenceProfile,
    );
    const clickAffinityScore = this.resolveClickAffinityScore(
      candidate,
      preferenceProfile,
    );
    const personalizationScore = Number(
      Math.min(
        RECOMMENDATION_SCORING_WEIGHTS.personalization.totalMax,
        recentViewScore +
          categoryAffinityScore +
          searchIntentScore +
          clickAffinityScore,
      ).toFixed(2),
    );

    if (recentViewScore > 0) {
      reasonCodes.add('based_on_recent_views');
    }
    if (categoryAffinityScore > 0) {
      reasonCodes.add('based_on_category_affinity');
    }
    if (searchIntentScore > 0) {
      reasonCodes.add('based_on_search_intent');
    }
    if (clickAffinityScore > 0) {
      reasonCodes.add('based_on_recommendation_clicks');
    }

    return {
      personalizationScore,
      recentViewScore,
      categoryAffinityScore,
      searchIntentScore,
      clickAffinityScore,
    };
  }

  private resolveRecentViewScore(
    candidate: RecommendationProductRecord,
    preferenceProfile: RecommendationPreferenceProfile,
  ) {
    const exactProduct = Math.min(
      RECOMMENDATION_SCORING_WEIGHTS.personalization.recentView.productMatch,
      (preferenceProfile.recentViewProductScores.get(candidate.id) ?? 0) *
        RECOMMENDATION_SCORING_WEIGHTS.personalization.recentView.productMatch,
    );
    const brandScore = Math.min(
      RECOMMENDATION_SCORING_WEIGHTS.personalization.recentView.brandMatch,
      (candidate.brand
        ? (preferenceProfile.recentViewBrandScores.get(
            this.normalize(candidate.brand),
          ) ?? 0)
        : 0) *
        RECOMMENDATION_SCORING_WEIGHTS.personalization.recentView.brandMatch,
    );
    const colorScore = Math.min(
      RECOMMENDATION_SCORING_WEIGHTS.personalization.recentView.colorMatch,
      (candidate.color
        ? (preferenceProfile.recentViewColorScores.get(
            this.normalize(candidate.color),
          ) ?? 0)
        : 0) *
        RECOMMENDATION_SCORING_WEIGHTS.personalization.recentView.colorMatch,
    );

    return Number(
      Math.min(
        RECOMMENDATION_SCORING_WEIGHTS.personalization.recentView.max,
        exactProduct + brandScore + colorScore,
      ).toFixed(2),
    );
  }

  private resolveCategoryAffinityScore(
    candidate: RecommendationProductRecord,
    preferenceProfile: RecommendationPreferenceProfile,
  ) {
    const candidateCategoryId = candidate.categoryId?.toString() ?? null;
    const normalizedCategory = this.normalize(
      candidate.category?.name ??
        candidate.categoryName ??
        candidate.sourceCategoryName,
    );
    const normalizedSourceCategory = this.normalize(
      candidate.sourceCategoryName,
    );

    const idScore = candidateCategoryId
      ? (preferenceProfile.categoryAffinityScores.get(candidateCategoryId) ?? 0)
      : 0;
    const termScore = Math.max(
      normalizedCategory
        ? (preferenceProfile.categoryTermAffinityScores.get(
            normalizedCategory,
          ) ?? 0)
        : 0,
      normalizedSourceCategory
        ? (preferenceProfile.categoryTermAffinityScores.get(
            normalizedSourceCategory,
          ) ?? 0)
        : 0,
    );

    return Number(
      Math.min(
        RECOMMENDATION_SCORING_WEIGHTS.personalization.categoryAffinity.max,
        Math.max(idScore, termScore) *
          RECOMMENDATION_SCORING_WEIGHTS.personalization.categoryAffinity.max,
      ).toFixed(2),
    );
  }

  private resolveSearchIntentScore(
    candidate: RecommendationProductRecord,
    preferenceProfile: RecommendationPreferenceProfile,
  ) {
    const candidateTokens = new Set(
      [
        candidate.localTitle,
        candidate.wbTitle,
        candidate.localDescription,
        candidate.wbDescription,
        candidate.brand,
        candidate.color,
        candidate.category?.name,
        candidate.categoryName,
        candidate.sourceCategoryName,
      ].flatMap((value) => this.tokenize(value)),
    );

    let matchedScore = 0;
    candidateTokens.forEach((token) => {
      matchedScore += preferenceProfile.searchIntentScores.get(token) ?? 0;
    });

    return Number(
      Math.min(
        RECOMMENDATION_SCORING_WEIGHTS.personalization.searchIntent.max,
        matchedScore *
          RECOMMENDATION_SCORING_WEIGHTS.personalization.searchIntent.perToken,
      ).toFixed(2),
    );
  }

  private resolveClickAffinityScore(
    candidate: RecommendationProductRecord,
    preferenceProfile: RecommendationPreferenceProfile,
  ) {
    const candidateCategoryId = candidate.categoryId?.toString() ?? null;
    const normalizedCategory = this.normalize(
      candidate.category?.name ??
        candidate.categoryName ??
        candidate.sourceCategoryName,
    );
    const normalizedSourceCategory = this.normalize(
      candidate.sourceCategoryName,
    );

    const exactProduct = Math.min(
      RECOMMENDATION_SCORING_WEIGHTS.personalization.clickAffinity.productMatch,
      (preferenceProfile.clickAffinityProductScores.get(candidate.id) ?? 0) *
        RECOMMENDATION_SCORING_WEIGHTS.personalization.clickAffinity
          .productMatch,
    );
    const categoryScore = Math.min(
      RECOMMENDATION_SCORING_WEIGHTS.personalization.clickAffinity
        .categoryMatch,
      Math.max(
        candidateCategoryId
          ? (preferenceProfile.clickAffinityCategoryScores.get(
              candidateCategoryId,
            ) ?? 0)
          : 0,
        normalizedCategory
          ? (preferenceProfile.clickAffinityCategoryTermScores.get(
              normalizedCategory,
            ) ?? 0)
          : 0,
        normalizedSourceCategory
          ? (preferenceProfile.clickAffinityCategoryTermScores.get(
              normalizedSourceCategory,
            ) ?? 0)
          : 0,
      ) *
        RECOMMENDATION_SCORING_WEIGHTS.personalization.clickAffinity
          .categoryMatch,
    );
    const brandScore = Math.min(
      RECOMMENDATION_SCORING_WEIGHTS.personalization.clickAffinity.brandMatch,
      (candidate.brand
        ? (preferenceProfile.clickAffinityBrandScores.get(
            this.normalize(candidate.brand),
          ) ?? 0)
        : 0) *
        RECOMMENDATION_SCORING_WEIGHTS.personalization.clickAffinity.brandMatch,
    );
    const colorScore = Math.min(
      RECOMMENDATION_SCORING_WEIGHTS.personalization.clickAffinity.colorMatch,
      (candidate.color
        ? (preferenceProfile.clickAffinityColorScores.get(
            this.normalize(candidate.color),
          ) ?? 0)
        : 0) *
        RECOMMENDATION_SCORING_WEIGHTS.personalization.clickAffinity.colorMatch,
    );

    return Number(
      Math.min(
        RECOMMENDATION_SCORING_WEIGHTS.personalization.clickAffinity.max,
        exactProduct + categoryScore + brandScore + colorScore,
      ).toFixed(2),
    );
  }

  private resolveAnalyticsTuningScore(
    candidate: RecommendationProductRecord,
    organicScore: number,
    analyticsTuning: RecommendationAnalyticsTuningConfig | undefined,
  ) {
    const disabled = {
      analyticsPerformanceScore: 0,
      ctrScore: 0,
      productEngagementScore: 0,
      algorithmPerformanceHint: 0,
      scenarioPerformanceHint: 0,
      analyticsSignalsUsed: [] as RecommendationAnalyticsSignalKey[],
      analyticsTuningEnabled: Boolean(analyticsTuning?.enabled),
    };

    if (!analyticsTuning?.enabled) {
      return disabled;
    }

    const productSignals = analyticsTuning.productSignalsById.get(candidate.id);
    if (!productSignals) {
      return disabled;
    }

    const analyticsSignalsUsed: RecommendationAnalyticsSignalKey[] = [];
    const impressions = productSignals.impressions;
    const clicks = productSignals.clicks;
    const productCtr = productSignals.ctr;

    let ctrScore = 0;
    if (impressions >= analyticsTuning.minEventsForCtrBoost) {
      const ctrBaseline = Math.max(
        1,
        analyticsTuning.scenarioPerformanceHint,
        analyticsTuning.algorithmPerformanceHint,
      );
      const ctrDeltaRatio = (productCtr - ctrBaseline) / ctrBaseline;

      if (ctrDeltaRatio > 0) {
        ctrScore = Math.min(
          analyticsTuning.maxCtrBoost,
          ctrDeltaRatio * analyticsTuning.maxCtrBoost,
        );
      } else if (
        impressions >= analyticsTuning.minEventsForCtrBoost * 2 &&
        productCtr < ctrBaseline * 0.35
      ) {
        ctrScore = -Math.min(
          analyticsTuning.maxLowCtrPenalty,
          Math.abs(ctrDeltaRatio) * analyticsTuning.maxLowCtrPenalty,
        );
      }

      if (ctrScore !== 0) {
        analyticsSignalsUsed.push('ctr');
      }
    }

    let productEngagementScore = 0;
    if (clicks >= analyticsTuning.minClicksForEngagementBoost) {
      productEngagementScore = Math.min(
        analyticsTuning.maxEngagementBoost,
        (Math.log1p(clicks) / Math.log(11)) *
          analyticsTuning.maxEngagementBoost,
      );
      if (productEngagementScore > 0) {
        analyticsSignalsUsed.push('engagement');
      }
    }

    const cappedAnalyticsScore = Math.max(
      -analyticsTuning.maxLowCtrPenalty,
      Math.min(
        analyticsTuning.maxAnalyticsBoost,
        ctrScore + productEngagementScore,
      ),
    );

    if (analyticsTuning.algorithmPerformanceHint > 0) {
      analyticsSignalsUsed.push('algorithm_hint');
    }
    if (analyticsTuning.scenarioPerformanceHint > 0) {
      analyticsSignalsUsed.push('scenario_hint');
    }

    const scaleCap = Math.max(
      analyticsTuning.maxAnalyticsBoost,
      Math.abs(cappedAnalyticsScore),
    );
    const relevanceSafetyCap = Math.max(
      analyticsTuning.maxLowCtrPenalty,
      Math.min(scaleCap, Number((Math.max(0, organicScore) * 0.12).toFixed(2))),
    );
    const analyticsPerformanceScore = Number(
      Math.max(
        -analyticsTuning.maxLowCtrPenalty,
        Math.min(relevanceSafetyCap, cappedAnalyticsScore),
      ).toFixed(2),
    );

    return {
      analyticsPerformanceScore,
      ctrScore: Number(ctrScore.toFixed(2)),
      productEngagementScore: Number(productEngagementScore.toFixed(2)),
      algorithmPerformanceHint: Number(
        analyticsTuning.algorithmPerformanceHint.toFixed(2),
      ),
      scenarioPerformanceHint: Number(
        analyticsTuning.scenarioPerformanceHint.toFixed(2),
      ),
      analyticsSignalsUsed: [...new Set(analyticsSignalsUsed)],
      analyticsTuningEnabled: true,
    };
  }
}
