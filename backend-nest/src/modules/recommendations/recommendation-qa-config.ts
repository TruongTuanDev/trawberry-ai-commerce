import type { RecommendationQaPackDto } from './dto/recommendation-qa-pack.dto';
import type { RecommendationQaSnapshotDto } from './dto/recommendation-qa-diff.dto';

type QaThresholds = NonNullable<
  RecommendationQaPackDto['expectedSummaryThresholds']
>;

export type RecommendationQaThresholdPresetId =
  | 'strict'
  | 'balanced'
  | 'lenient'
  | 'search-intent-sensitive'
  | 'similar-products-sensitive';

export type RecommendationQaThresholdPreset = {
  id: RecommendationQaThresholdPresetId;
  name: string;
  description: string;
  version: string;
  updatedAt: string;
  owner: string;
  notes: string;
  stability: 'experimental' | 'stable' | 'deprecated';
  thresholds: QaThresholds;
};

export type RecommendationQaBaselineCatalogEntry = {
  id: string;
  name: string;
  description: string;
  version: string;
  updatedAt: string;
  owner: string;
  notes: string;
  stability: 'experimental' | 'stable' | 'deprecated';
  scenarioType: 'home' | 'similar' | 'search';
  query: string | null;
  productId: string | null;
  defaultLimit: number;
  recommendedThresholdPresetId: RecommendationQaThresholdPresetId;
  mockPack: {
    packName: string;
    description: string;
    thresholdPresetId: RecommendationQaThresholdPresetId;
    baselineSnapshot: RecommendationQaSnapshotDto;
    candidateSnapshot: RecommendationQaSnapshotDto;
  } | null;
};

function buildSnapshotItem(
  productId: string,
  name: string,
  rank: number,
  score: number,
  reasons: string[],
  scoreBreakdown: {
    categoryScore: number;
    textScore: number;
    popularityScore: number;
    freshnessScore: number;
    ratingScore: number;
    stockScore: number;
    shopScore: number;
    penaltyScore: number;
    sponsoredBoostScore?: number;
    businessBoostScore?: number;
    maxSponsoredBoost?: number;
  },
) {
  return {
    product: {
      id: productId,
      name,
      seoSlug: null,
      categoryName: 'Jackets',
      brand: 'North Berry',
      color: 'Black',
      price: '1499',
      inStock: true,
      imageUrl: 'https://example.com/image.jpg',
      shopName: 'Ready Shop',
      shopSlug: 'ready-shop',
    },
    rankMovement: null,
    ruleBasedV1: null,
    ruleBasedV2: {
      algorithm: 'rule_based_v2' as const,
      rank,
      finalScore: score,
      reasons,
      scoreBreakdown: {
        ...scoreBreakdown,
        sponsoredBoostScore: scoreBreakdown.sponsoredBoostScore ?? 0,
        businessBoostScore: scoreBreakdown.businessBoostScore ?? 0,
        maxSponsoredBoost: scoreBreakdown.maxSponsoredBoost ?? 0,
      },
      sponsoredReason: null,
      sponsoredPreset: null,
    },
  };
}

export const RECOMMENDATION_QA_THRESHOLD_PRESETS: RecommendationQaThresholdPreset[] =
  [
    {
      id: 'strict',
      name: 'Strict',
      description: 'Tight guardrails for low movement and low score drift.',
      version: '1.0.0',
      updatedAt: '2026-06-06T23:00:00.000Z',
      owner: 'recommendations-team',
      notes: 'Use for low-risk readiness checks before rollout.',
      stability: 'stable',
      thresholds: {
        maxMovedDownCount: 0,
        maxAddedCount: 0,
        maxRemovedCount: 0,
        maxScoreDelta: 2,
        maxAbsoluteRankMovement: 1,
        minUnchangedCount: 2,
        maxTotalChangedCount: 1,
      },
    },
    {
      id: 'balanced',
      name: 'Balanced',
      description: 'General-purpose QA thresholds for routine ranking tuning.',
      version: '1.0.0',
      updatedAt: '2026-06-06T23:00:00.000Z',
      owner: 'recommendations-team',
      notes: 'Default preset for most Phase 2 rule-based ranking changes.',
      stability: 'stable',
      thresholds: {
        maxMovedDownCount: 1,
        maxAddedCount: 1,
        maxRemovedCount: 1,
        maxScoreDelta: 4,
        maxAbsoluteRankMovement: 2,
        minUnchangedCount: 1,
        maxTotalChangedCount: 4,
      },
    },
    {
      id: 'lenient',
      name: 'Lenient',
      description: 'Broader room for experiments and heavier ranking changes.',
      version: '1.0.0',
      updatedAt: '2026-06-06T23:00:00.000Z',
      owner: 'recommendations-team',
      notes: 'Useful for exploratory tuning, not for strict release signoff.',
      stability: 'experimental',
      thresholds: {
        maxMovedDownCount: 3,
        maxMovedUpCount: 3,
        maxAddedCount: 2,
        maxRemovedCount: 2,
        maxScoreDelta: 8,
        maxAbsoluteRankMovement: 4,
        maxTotalChangedCount: 6,
      },
    },
    {
      id: 'search-intent-sensitive',
      name: 'Search intent sensitive',
      description:
        'Search-focused preset that is stricter on adds, removals, and score drift.',
      version: '1.0.0',
      updatedAt: '2026-06-06T23:00:00.000Z',
      owner: 'recommendations-team',
      notes:
        'Prioritize intent stability for keyword-driven recommendation blocks.',
      stability: 'stable',
      thresholds: {
        maxMovedDownCount: 1,
        maxAddedCount: 1,
        maxRemovedCount: 0,
        maxScoreDelta: 3,
        maxAbsoluteRankMovement: 2,
        minUnchangedCount: 1,
        maxTotalChangedCount: 3,
      },
    },
    {
      id: 'similar-products-sensitive',
      name: 'Similar products sensitive',
      description:
        'Similar-products preset that allows light reshuffling but watches removals closely.',
      version: '1.0.0',
      updatedAt: '2026-06-06T23:00:00.000Z',
      owner: 'recommendations-team',
      notes: 'Use when validating product detail recommendation safety.',
      stability: 'stable',
      thresholds: {
        maxMovedDownCount: 1,
        maxMovedUpCount: 1,
        maxAddedCount: 1,
        maxRemovedCount: 1,
        maxScoreDelta: 3,
        maxAbsoluteRankMovement: 1,
        minUnchangedCount: 0,
        maxTotalChangedCount: 3,
      },
    },
  ];

export const RECOMMENDATION_QA_BASELINE_CATALOG: RecommendationQaBaselineCatalogEntry[] =
  [
    {
      id: 'home-ranking-stability',
      name: 'Home ranking stability',
      description:
        'Safe mock home audit scenario for watching moved-down items and unchanged coverage.',
      version: '1.0.0',
      updatedAt: '2026-06-06T23:00:00.000Z',
      owner: 'recommendations-team',
      notes:
        'Baseline catalog entry for homepage fallback and movement checks.',
      stability: 'stable',
      scenarioType: 'home',
      query: null,
      productId: null,
      defaultLimit: 5,
      recommendedThresholdPresetId: 'balanced',
      mockPack: {
        packName: 'Sample home QA pack',
        description:
          'Safe mock QA pack for repeatable home ranking audits with sample recommendation data.',
        thresholdPresetId: 'balanced',
        baselineSnapshot: {
          scenarioType: 'home',
          placement: 'home',
          sponsoredRanking: null,
          productId: null,
          query: null,
          limit: 5,
          generatedAt: '2026-06-06T13:00:00.000Z',
          comparedAlgorithms: ['rule_based_v1', 'rule_based_v2'],
          items: [
            buildSnapshotItem('prod-1', 'Stable Product', 1, 10, ['Popular'], {
              categoryScore: 4,
              textScore: 1,
              popularityScore: 3,
              freshnessScore: 1,
              ratingScore: 1,
              stockScore: 0,
              shopScore: 0,
              penaltyScore: 0,
            }),
            buildSnapshotItem('prod-2', 'Moved Up Product', 4, 7, ['Popular'], {
              categoryScore: 2,
              textScore: 0,
              popularityScore: 2,
              freshnessScore: 1,
              ratingScore: 1,
              stockScore: 0,
              shopScore: 1,
              penaltyScore: 0,
            }),
            buildSnapshotItem(
              'prod-3',
              'Moved Down Product',
              1,
              12,
              ['Fresh'],
              {
                categoryScore: 5,
                textScore: 1,
                popularityScore: 2,
                freshnessScore: 2,
                ratingScore: 1,
                stockScore: 1,
                shopScore: 0,
                penaltyScore: 0,
              },
            ),
          ],
        },
        candidateSnapshot: {
          scenarioType: 'home',
          placement: 'home',
          sponsoredRanking: null,
          productId: null,
          query: null,
          limit: 5,
          generatedAt: '2026-06-06T13:30:00.000Z',
          comparedAlgorithms: ['rule_based_v1', 'rule_based_v2'],
          items: [
            buildSnapshotItem('prod-1', 'Stable Product', 1, 11, ['Popular'], {
              categoryScore: 4,
              textScore: 1,
              popularityScore: 3,
              freshnessScore: 1,
              ratingScore: 1,
              stockScore: 1,
              shopScore: 0,
              penaltyScore: 0,
            }),
            buildSnapshotItem(
              'prod-2',
              'Moved Up Product',
              2,
              9,
              ['Popular', 'Currently in stock'],
              {
                categoryScore: 2,
                textScore: 0,
                popularityScore: 2,
                freshnessScore: 1,
                ratingScore: 1,
                stockScore: 1,
                shopScore: 1,
                penaltyScore: 0,
              },
            ),
            buildSnapshotItem('prod-3', 'Moved Down Product', 3, 8, ['Fresh'], {
              categoryScore: 3,
              textScore: 0,
              popularityScore: 1,
              freshnessScore: 2,
              ratingScore: 1,
              stockScore: 1,
              shopScore: 0,
              penaltyScore: 0,
            }),
          ],
        },
      },
    },
    {
      id: 'search-intent-stability',
      name: 'Search intent stability',
      description:
        'Safe mock search audit scenario for tracking intent drift and added results.',
      version: '1.0.0',
      updatedAt: '2026-06-06T23:00:00.000Z',
      owner: 'recommendations-team',
      notes:
        'Use this when tuning search-intent-sensitive recommendation weights.',
      stability: 'stable',
      scenarioType: 'search',
      query: 'jacket',
      productId: null,
      defaultLimit: 4,
      recommendedThresholdPresetId: 'search-intent-sensitive',
      mockPack: {
        packName: 'Sample search QA pack',
        description:
          'Safe mock QA pack for repeatable search ranking audits with sample search intent data.',
        thresholdPresetId: 'search-intent-sensitive',
        baselineSnapshot: {
          scenarioType: 'search',
          placement: 'search',
          sponsoredRanking: null,
          productId: null,
          query: 'jacket',
          limit: 4,
          generatedAt: '2026-06-06T14:00:00.000Z',
          comparedAlgorithms: ['rule_based_v1', 'rule_based_v2'],
          items: [
            buildSnapshotItem(
              'search-1',
              'Keyword Match Jacket',
              1,
              18,
              ['Keyword overlap with the search intent'],
              {
                categoryScore: 0,
                textScore: 12,
                popularityScore: 2,
                freshnessScore: 1,
                ratingScore: 1,
                stockScore: 1,
                shopScore: 1,
                penaltyScore: 0,
              },
            ),
            buildSnapshotItem(
              'search-2',
              'Popular Black Jacket',
              2,
              14,
              ['Keyword overlap with the search intent'],
              {
                categoryScore: 0,
                textScore: 10,
                popularityScore: 2,
                freshnessScore: 1,
                ratingScore: 1,
                stockScore: 0,
                shopScore: 0,
                penaltyScore: 0,
              },
            ),
          ],
        },
        candidateSnapshot: {
          scenarioType: 'search',
          placement: 'search',
          sponsoredRanking: null,
          productId: null,
          query: 'jacket',
          limit: 4,
          generatedAt: '2026-06-06T14:20:00.000Z',
          comparedAlgorithms: ['rule_based_v1', 'rule_based_v2'],
          items: [
            buildSnapshotItem(
              'search-1',
              'Keyword Match Jacket',
              1,
              19,
              ['Keyword overlap with the search intent'],
              {
                categoryScore: 0,
                textScore: 12,
                popularityScore: 3,
                freshnessScore: 1,
                ratingScore: 1,
                stockScore: 1,
                shopScore: 1,
                penaltyScore: 0,
              },
            ),
            buildSnapshotItem(
              'search-3',
              'New Search Result',
              2,
              15,
              ['Keyword overlap with the search intent', 'Currently in stock'],
              {
                categoryScore: 0,
                textScore: 11,
                popularityScore: 1,
                freshnessScore: 1,
                ratingScore: 1,
                stockScore: 1,
                shopScore: 0,
                penaltyScore: 0,
              },
            ),
            buildSnapshotItem(
              'search-2',
              'Popular Black Jacket',
              3,
              13,
              ['Keyword overlap with the search intent'],
              {
                categoryScore: 0,
                textScore: 9,
                popularityScore: 2,
                freshnessScore: 1,
                ratingScore: 1,
                stockScore: 0,
                shopScore: 0,
                penaltyScore: 0,
              },
            ),
          ],
        },
      },
    },
    {
      id: 'similar-products-stability',
      name: 'Similar products stability',
      description:
        'Safe mock similar-products audit scenario for removals and small rank movement.',
      version: '1.0.0',
      updatedAt: '2026-06-06T23:00:00.000Z',
      owner: 'recommendations-team',
      notes:
        'Focuses on safe similar-product reshuffling without real storefront exports.',
      stability: 'stable',
      scenarioType: 'similar',
      query: null,
      productId: 'public-source-product',
      defaultLimit: 4,
      recommendedThresholdPresetId: 'similar-products-sensitive',
      mockPack: {
        packName: 'Sample similar-products QA pack',
        description:
          'Safe mock QA pack for repeatable similar-products audits with sample productId metadata.',
        thresholdPresetId: 'similar-products-sensitive',
        baselineSnapshot: {
          scenarioType: 'similar',
          placement: 'product_detail',
          sponsoredRanking: null,
          productId: 'public-source-product',
          query: null,
          limit: 4,
          generatedAt: '2026-06-06T15:00:00.000Z',
          comparedAlgorithms: ['rule_based_v1', 'rule_based_v2'],
          items: [
            buildSnapshotItem(
              'similar-1',
              'Same Category Jacket',
              1,
              16,
              ['Matched source product category'],
              {
                categoryScore: 9,
                textScore: 1,
                popularityScore: 2,
                freshnessScore: 1,
                ratingScore: 1,
                stockScore: 1,
                shopScore: 1,
                penaltyScore: 0,
              },
            ),
            buildSnapshotItem(
              'similar-2',
              'Brand Match Jacket',
              2,
              13,
              ['Shares the source brand'],
              {
                categoryScore: 6,
                textScore: 0,
                popularityScore: 2,
                freshnessScore: 1,
                ratingScore: 1,
                stockScore: 1,
                shopScore: 1,
                penaltyScore: 0,
              },
            ),
          ],
        },
        candidateSnapshot: {
          scenarioType: 'similar',
          placement: 'product_detail',
          sponsoredRanking: null,
          productId: 'public-source-product',
          query: null,
          limit: 4,
          generatedAt: '2026-06-06T15:15:00.000Z',
          comparedAlgorithms: ['rule_based_v1', 'rule_based_v2'],
          items: [
            buildSnapshotItem(
              'similar-2',
              'Brand Match Jacket',
              1,
              15,
              ['Shares the source brand', 'Currently in stock'],
              {
                categoryScore: 6,
                textScore: 0,
                popularityScore: 3,
                freshnessScore: 1,
                ratingScore: 1,
                stockScore: 2,
                shopScore: 1,
                penaltyScore: 0,
              },
            ),
            buildSnapshotItem(
              'similar-3',
              'Category Fallback Jacket',
              2,
              12,
              ['Matched source product category'],
              {
                categoryScore: 7,
                textScore: 0,
                popularityScore: 1,
                freshnessScore: 1,
                ratingScore: 1,
                stockScore: 1,
                shopScore: 1,
                penaltyScore: 0,
              },
            ),
          ],
        },
      },
    },
  ];
