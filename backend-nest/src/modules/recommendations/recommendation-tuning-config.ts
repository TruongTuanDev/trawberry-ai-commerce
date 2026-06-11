export const RECOMMENDATION_TUNING_WORKFLOW_FLAG =
  'RECOMMENDATION_TUNING_WORKFLOW_ENABLED';
export const RECOMMENDATION_TUNING_PRESETS_FLAG =
  'RECOMMENDATION_TUNING_PRESETS_ENABLED';
export const RECOMMENDATION_TUNING_ACTIVE_PRESET_FLAG =
  'RECOMMENDATION_TUNING_ACTIVE_PRESET_ENABLED';

export const RECOMMENDATION_TUNING_STATUSES = [
  'draft',
  'active',
  'archived',
] as const;

export type RecommendationTuningStatus =
  (typeof RECOMMENDATION_TUNING_STATUSES)[number];

export type RecommendationTuningWeights = {
  categoryScore: number;
  textScore: number;
  popularityScore: number;
  freshnessScore: number;
  ratingScore: number;
  stockScore: number;
  shopScore: number;
  personalizationScore: number;
  analyticsPerformanceScore: number;
  sponsoredBoost: number;
};

export type RecommendationTuningGuardrails = {
  maxSponsoredBoostScore: number;
  maxBusinessBoostScore: number;
  maxAnalyticsPerformanceScore: number;
  maxPersonalizationScore: number;
};

export type RecommendationTuningConfig = {
  presetId: string;
  presetKey: string;
  version: number;
  weights: RecommendationTuningWeights;
  guardrails: RecommendationTuningGuardrails;
};

export const DEFAULT_RECOMMENDATION_TUNING_WEIGHTS: RecommendationTuningWeights =
  {
    categoryScore: 1,
    textScore: 1,
    popularityScore: 1,
    freshnessScore: 1,
    ratingScore: 1,
    stockScore: 1,
    shopScore: 1,
    personalizationScore: 1,
    analyticsPerformanceScore: 1,
    sponsoredBoost: 1,
  };

export const DEFAULT_RECOMMENDATION_TUNING_GUARDRAILS: RecommendationTuningGuardrails =
  {
    maxSponsoredBoostScore: 5,
    maxBusinessBoostScore: 2,
    maxAnalyticsPerformanceScore: 6,
    maxPersonalizationScore: 18,
  };

export const RECOMMENDATION_TUNING_LIMITS = {
  coreWeightMin: 0.5,
  coreWeightMax: 1.5,
  coreWeightSumMin: 4,
  coreWeightSumMax: 9.5,
  optionalWeightMin: 0,
  optionalWeightMax: 1.5,
  sponsoredWeightMin: 0,
  sponsoredWeightMax: 1,
  maxSponsoredBoostScore: 5,
  maxBusinessBoostScore: 2,
  maxAnalyticsPerformanceScore: 6,
  maxPersonalizationScore: 18,
} as const;

export const RECOMMENDATION_TUNING_CORE_WEIGHT_KEYS = [
  'categoryScore',
  'textScore',
  'popularityScore',
  'freshnessScore',
  'ratingScore',
  'stockScore',
  'shopScore',
] as const satisfies ReadonlyArray<keyof RecommendationTuningWeights>;
