import { RECOMMENDATION_SPONSORED_RANKING_LIMITS } from './recommendation-scoring.service';

export type RecommendationSponsoredScenarioType = 'home' | 'similar' | 'search';

export type RecommendationSponsoredPresetId =
  | 'conservative'
  | 'balanced'
  | 'aggressive-internal-only'
  | 'stock-safe'
  | 'search-safe';

export type RecommendationSponsoredPresetStability =
  | 'experimental'
  | 'stable'
  | 'deprecated';

export type RecommendationSponsoredPresetMetadata = {
  id: RecommendationSponsoredPresetId;
  name: string;
  description: string;
  version: string;
  stability: RecommendationSponsoredPresetStability;
  maxSponsoredBoost: number;
  maxBusinessBoost: number;
  allowedScenarioTypes: RecommendationSponsoredScenarioType[];
  notes: string;
};

export type RecommendationSponsoredPresetDefinition =
  RecommendationSponsoredPresetMetadata & {
    sponsoredBoost: number;
    businessBoost: number;
  };

const ALL_SCENARIOS: RecommendationSponsoredScenarioType[] = [
  'home',
  'similar',
  'search',
];

export const DEFAULT_RECOMMENDATION_SPONSORED_PRESET_ID: RecommendationSponsoredPresetId =
  'balanced';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function sanitizePreset(
  preset: RecommendationSponsoredPresetDefinition,
): RecommendationSponsoredPresetDefinition {
  const maxSponsoredBoost = clamp(
    preset.maxSponsoredBoost,
    0,
    RECOMMENDATION_SPONSORED_RANKING_LIMITS.maxConfiguredBoost,
  );
  const maxBusinessBoost = clamp(
    preset.maxBusinessBoost,
    0,
    RECOMMENDATION_SPONSORED_RANKING_LIMITS.maxConfiguredBoost,
  );

  return {
    ...preset,
    maxSponsoredBoost,
    maxBusinessBoost,
    sponsoredBoost: clamp(preset.sponsoredBoost, 0, maxSponsoredBoost),
    businessBoost: clamp(preset.businessBoost, 0, maxBusinessBoost),
    allowedScenarioTypes: preset.allowedScenarioTypes.length
      ? [...preset.allowedScenarioTypes]
      : [...ALL_SCENARIOS],
  };
}

export function toSafeSponsoredPresetMetadata(
  preset: RecommendationSponsoredPresetDefinition,
): RecommendationSponsoredPresetMetadata {
  return {
    id: preset.id,
    name: preset.name,
    description: preset.description,
    version: preset.version,
    stability: preset.stability,
    maxSponsoredBoost: preset.maxSponsoredBoost,
    maxBusinessBoost: preset.maxBusinessBoost,
    allowedScenarioTypes: [...preset.allowedScenarioTypes],
    notes: preset.notes,
  };
}

export const RECOMMENDATION_SPONSORED_PRESETS: RecommendationSponsoredPresetDefinition[] =
  [
    sanitizePreset({
      id: 'conservative',
      name: 'Conservative',
      description:
        'Low-risk preset for lightly boosting curated products without major rank movement.',
      version: '1.0.0',
      stability: 'stable',
      maxSponsoredBoost: 3,
      maxBusinessBoost: 1,
      allowedScenarioTypes: ['home', 'similar'],
      notes:
        'Use for careful storefront smoke checks where organic relevance must dominate.',
      sponsoredBoost: 2,
      businessBoost: 1,
    }),
    sanitizePreset({
      id: 'balanced',
      name: 'Balanced',
      description:
        'Default internal rollout preset with moderate boosts and bounded scenario coverage.',
      version: '1.0.0',
      stability: 'stable',
      maxSponsoredBoost: 5,
      maxBusinessBoost: 2,
      allowedScenarioTypes: ['home', 'similar', 'search'],
      notes:
        'Recommended preset for most QA comparisons and initial staged rollout checks.',
      sponsoredBoost: 4,
      businessBoost: 2,
    }),
    sanitizePreset({
      id: 'aggressive-internal-only',
      name: 'Aggressive internal only',
      description:
        'Higher-cap preset reserved for internal QA stress testing of rollout guardrails.',
      version: '1.0.0',
      stability: 'experimental',
      maxSponsoredBoost: 8,
      maxBusinessBoost: 4,
      allowedScenarioTypes: ['home', 'similar', 'search'],
      notes:
        'Do not use as a public default; intended only for internal comparison and cap validation.',
      sponsoredBoost: 6,
      businessBoost: 3,
    }),
    sanitizePreset({
      id: 'stock-safe',
      name: 'Stock safe',
      description:
        'Inventory-friendly preset that keeps boosts modest for stable in-stock assortments.',
      version: '1.0.0',
      stability: 'stable',
      maxSponsoredBoost: 4,
      maxBusinessBoost: 1,
      allowedScenarioTypes: ['home', 'similar'],
      notes:
        'Pair with inventory-heavy audits where eligibility checks must stay visible in QA.',
      sponsoredBoost: 3,
      businessBoost: 1,
    }),
    sanitizePreset({
      id: 'search-safe',
      name: 'Search safe',
      description:
        'Search-focused preset with tighter caps to avoid overwhelming keyword relevance.',
      version: '1.0.0',
      stability: 'stable',
      maxSponsoredBoost: 3,
      maxBusinessBoost: 1,
      allowedScenarioTypes: ['search'],
      notes:
        'Use for keyword-driven recommendation audits where intent stability matters most.',
      sponsoredBoost: 2,
      businessBoost: 1,
    }),
  ];
