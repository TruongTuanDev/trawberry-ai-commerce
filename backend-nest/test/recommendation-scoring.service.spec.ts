import { Prisma } from '@prisma/client';
import {
  RecommendationScoringService,
  RECOMMENDATION_SCORING_WEIGHTS,
  type RecommendationAnalyticsTuningConfig,
  type RecommendationPreferenceProfile,
  type RecommendationProductRecord,
} from '../src/modules/recommendations/recommendation-scoring.service';
import {
  DEFAULT_RECOMMENDATION_TUNING_GUARDRAILS,
  DEFAULT_RECOMMENDATION_TUNING_WEIGHTS,
  type RecommendationTuningConfig,
} from '../src/modules/recommendations/recommendation-tuning-config';

describe('RecommendationScoringService', () => {
  const service = new RecommendationScoringService();

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-10T00:00:00.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('scores same-category similar products ahead of category-name fallback', () => {
    const source = buildProduct({
      id: 'source',
      categoryId: 11n,
      categoryName: 'Jackets',
      sourceCategoryName: 'Outerwear',
    });
    const sameCategory = buildProduct({
      id: 'candidate-same-category',
      categoryId: 11n,
      categoryName: 'Different label',
      sourceCategoryName: 'Different source label',
    });
    const sameNameOnly = buildProduct({
      id: 'candidate-same-name',
      categoryId: 22n,
      categoryName: 'Jackets',
      sourceCategoryName: 'Other source label',
    });

    const sameCategoryScore = service.scoreSimilarProduct(source, sameCategory);
    const sameNameScore = service.scoreSimilarProduct(source, sameNameOnly);

    expect(sameCategoryScore.scoreBreakdown.categoryScore).toBe(
      RECOMMENDATION_SCORING_WEIGHTS.category.sameCategory,
    );
    expect(sameCategoryScore.reasonCodes).toContain('same_category');
    expect(sameNameScore.scoreBreakdown.categoryScore).toBe(
      RECOMMENDATION_SCORING_WEIGHTS.category.matchingCategoryName,
    );
    expect(sameNameScore.reasonCodes).toContain('matching_category_name');
    expect(sameCategoryScore.score).toBeGreaterThan(sameNameScore.score);
  });

  it('keeps the baseline score unchanged with no controlled tuning preset', () => {
    const candidate = buildProduct({ id: 'baseline-no-preset' });
    const baseline = service.scoreHomeProduct(
      candidate,
      emptyPreferenceProfile(),
    );
    const explicitNoPreset = service.scoreHomeProduct(
      candidate,
      emptyPreferenceProfile(),
      undefined,
      undefined,
      null,
    );

    expect(explicitNoPreset).toEqual(baseline);
  });

  it('applies bounded controlled tuning weights to existing score dimensions', () => {
    const candidate = buildProduct({
      id: 'controlled-tuning',
      feedbackCount: 8,
      stockQuantity: 20,
    });
    const baseline = service.scoreHomeProduct(
      candidate,
      emptyPreferenceProfile(),
    );
    const tuned = service.scoreHomeProduct(
      candidate,
      emptyPreferenceProfile(),
      undefined,
      undefined,
      tuningConfig({
        popularityScore: 0.5,
        freshnessScore: 1.5,
      }),
    );

    expect(tuned.scoreBreakdown.popularityScore).toBe(
      Number((baseline.scoreBreakdown.popularityScore * 0.5).toFixed(2)),
    );
    expect(tuned.scoreBreakdown.freshnessScore).toBe(
      Number((baseline.scoreBreakdown.freshnessScore * 1.5).toFixed(2)),
    );
  });

  it('never lets controlled tuning increase the existing sponsored boost', () => {
    const candidate = buildProduct({
      id: 'controlled-sponsored',
      shopId: 'sponsored-shop',
    });
    const sponsored = sponsoredConfig({
      sponsoredProductIds: [candidate.id],
      businessBoostShopIds: [candidate.shopId],
      sponsoredBoost: 5,
      businessBoost: 2,
      maxSponsoredBoost: 5,
      maxBusinessBoost: 2,
    });
    const baseline = service.scoreHomeProduct(
      candidate,
      emptyPreferenceProfile(),
      sponsored,
    );
    const tuned = service.scoreHomeProduct(
      candidate,
      emptyPreferenceProfile(),
      sponsored,
      undefined,
      tuningConfig({ sponsoredBoost: 0.5 }),
    );

    expect(tuned.scoreBreakdown.sponsoredBoostScore).toBeLessThanOrEqual(
      baseline.scoreBreakdown.sponsoredBoostScore,
    );
    expect(tuned.scoreBreakdown.businessBoostScore).toBeLessThanOrEqual(
      baseline.scoreBreakdown.businessBoostScore,
    );
    expect(tuned.scoreBreakdown.sponsoredBoostScore).toBeLessThanOrEqual(5);
    expect(tuned.scoreBreakdown.businessBoostScore).toBeLessThanOrEqual(2);
  });

  it('reports an eligible campaign when controlled tuning suppresses its boost', () => {
    const candidate = buildProduct({
      id: 'controlled-sponsored-suppressed',
      shopId: 'sponsored-shop',
    });
    const scored = service.scoreHomeProduct(
      candidate,
      emptyPreferenceProfile(),
      sponsoredConfig({
        sponsoredProductIds: [candidate.id],
        sponsoredBoost: 5,
        maxSponsoredBoost: 5,
      }),
      undefined,
      tuningConfig({ sponsoredBoost: 0 }),
    );

    expect(scored.scoreBreakdown.sponsoredBoostScore).toBe(0);
    expect(scored.campaignReadiness.sponsoredBoostApplied).toBe(false);
    expect(scored.campaignReadiness.campaignReadinessStatus).toBe('eligible');
    expect(scored.sponsored).toBe(false);
  });

  it('scores text and search intent matches with keyword reasons', () => {
    const candidate = buildProduct({
      id: 'candidate-search',
      title: 'Blue linen blazer',
      description: 'Lightweight linen blazer for summer',
      brand: 'North Berry',
      color: 'Blue',
    });

    const scored = service.scoreSearchProduct('linen blue', candidate);

    expect(scored.scoreBreakdown.textScore).toBe(10);
    expect(scored.reasonCodes).toContain('keyword_match');
  });

  it('caps popularity scoring and adds the popularity reason', () => {
    const candidate = buildProduct({
      id: 'candidate-popular',
      feedbackCount: 99,
    });

    const scored = service.scoreHomeProduct(
      candidate,
      emptyPreferenceProfile(),
    );

    expect(scored.scoreBreakdown.popularityScore).toBe(
      RECOMMENDATION_SCORING_WEIGHTS.popularity.max,
    );
    expect(scored.reasonCodes).toContain('popular');
  });

  it('applies freshness, rating, stock, shop, and image contributions', () => {
    const source = buildProduct({
      id: 'source-shop',
      shopId: 'shop-1',
    });
    const candidate = buildProduct({
      id: 'candidate-weighted',
      shopId: 'shop-1',
      publishedAt: '2026-06-09T00:00:00.000Z',
      averageRating: '4.5',
      feedbackCount: 8,
      stockQuantity: 12,
      imagesCount: 1,
    });

    const scored = service.scoreSimilarProduct(source, candidate);

    expect(scored.scoreBreakdown.freshnessScore).toBe(9.67);
    expect(scored.scoreBreakdown.ratingScore).toBe(9);
    expect(scored.scoreBreakdown.stockScore).toBe(3.2);
    expect(scored.scoreBreakdown.shopScore).toBe(5);
    expect(scored.reasonCodes).toEqual(
      expect.arrayContaining([
        'fresh',
        'high_rating',
        'in_stock',
        'same_shop',
        'has_image',
      ]),
    );
  });

  it('applies penalties for missing images and no stock', () => {
    const candidate = buildProduct({
      id: 'candidate-penalty',
      imagesCount: 0,
      stockQuantity: 0,
      feedbackCount: 0,
      averageRating: '0',
    });

    const scored = service.scoreHomeProduct(
      candidate,
      emptyPreferenceProfile(),
    );

    expect(scored.scoreBreakdown.penaltyScore).toBe(
      RECOMMENDATION_SCORING_WEIGHTS.penalty.missingImage +
        RECOMMENDATION_SCORING_WEIGHTS.penalty.outOfStock,
    );
    expect(scored.reasonCodes).not.toContain('in_stock');
  });

  it('uses preference profile category terms for home personalization fallback', () => {
    const candidate = buildProduct({
      id: 'candidate-preference',
      categoryId: 22n,
      categoryName: 'Dresses',
    });

    const scored = service.scoreHomeProduct(candidate, {
      categoryIds: new Set<string>(),
      categoryTerms: new Set<string>(['dresses']),
      brands: new Set<string>(),
      colors: new Set<string>(),
      searchTerms: [],
      recentViewProductScores: new Map<string, number>(),
      recentViewBrandScores: new Map<string, number>(),
      recentViewColorScores: new Map<string, number>(),
      categoryAffinityScores: new Map<string, number>(),
      categoryTermAffinityScores: new Map<string, number>(),
      searchIntentScores: new Map<string, number>(),
      clickAffinityProductScores: new Map<string, number>(),
      clickAffinityCategoryScores: new Map<string, number>(),
      clickAffinityCategoryTermScores: new Map<string, number>(),
      clickAffinityBrandScores: new Map<string, number>(),
      clickAffinityColorScores: new Map<string, number>(),
    });

    expect(scored.scoreBreakdown.categoryScore).toBe(
      RECOMMENDATION_SCORING_WEIGHTS.category.basedOnViewedCategory,
    );
    expect(scored.reasonCodes).toContain('based_on_viewed_category');
  });

  it('keeps sponsored/business boosts disabled when the config is off', () => {
    const candidate = buildProduct({
      id: 'candidate-sponsored-disabled',
      shopId: 'shop-sponsored',
    });

    const scored = service.scoreHomeProduct(
      candidate,
      emptyPreferenceProfile(),
      sponsoredConfig({
        enabled: false,
        sponsoredProductIds: ['candidate-sponsored-disabled'],
        businessBoostShopIds: ['shop-sponsored'],
      }),
    );

    expect(scored.scoreBreakdown.sponsoredBoostScore).toBe(0);
    expect(scored.scoreBreakdown.businessBoostScore).toBe(0);
    expect(scored.sponsoredReason).toBeNull();
    expect(scored.sponsoredPreset?.id).toBe('balanced');
    expect(scored.campaignReadiness.campaignReadinessStatus).toBe('disabled');
  });

  it('keeps sponsored boost bounded by the configured safety cap', () => {
    const candidate = buildProduct({
      id: 'candidate-sponsored-capped',
      feedbackCount: 40,
    });

    const scored = service.scoreHomeProduct(
      candidate,
      emptyPreferenceProfile(),
      sponsoredConfig({
        sponsoredProductIds: ['candidate-sponsored-capped'],
        businessBoostShopIds: ['shop-1'],
        sponsoredBoost: 8,
        businessBoost: 4,
        maxSponsoredBoost: 5,
      }),
    );

    expect(
      scored.scoreBreakdown.sponsoredBoostScore +
        scored.scoreBreakdown.businessBoostScore,
    ).toBeLessThanOrEqual(5);
    expect(scored.scoreBreakdown.maxSponsoredBoost).toBe(5);
    expect(scored.campaignReadiness.sponsoredBoostApplied).toBe(true);
    expect(scored.campaignReadiness.billingMode).toBe('none');
  });

  it('clamps business boost against its own preset cap before the total cap', () => {
    const candidate = buildProduct({
      id: 'candidate-business-capped',
      feedbackCount: 40,
    });

    const scored = service.scoreHomeProduct(
      candidate,
      emptyPreferenceProfile(),
      sponsoredConfig({
        sponsoredProductIds: ['candidate-business-capped'],
        businessBoostShopIds: ['shop-1'],
        sponsoredBoost: 4,
        businessBoost: 9,
        maxSponsoredBoost: 6,
        maxBusinessBoost: 2,
      }),
    );

    expect(scored.scoreBreakdown.businessBoostScore).toBeLessThanOrEqual(2);
    expect(scored.scoreBreakdown.sponsoredBoostScore).toBeGreaterThan(0);
  });

  it('keeps campaign-readiness as not_targeted when the product is eligible but not targeted', () => {
    const candidate = buildProduct({
      id: 'candidate-not-targeted',
      feedbackCount: 12,
    });

    const scored = service.scoreHomeProduct(
      candidate,
      emptyPreferenceProfile(),
      sponsoredConfig({
        sponsoredProductIds: ['different-product'],
      }),
    );

    expect(scored.campaignReadiness.sponsoredEligible).toBe(true);
    expect(scored.campaignReadiness.sponsoredBoostApplied).toBe(false);
    expect(scored.campaignReadiness.campaignReadinessStatus).toBe(
      'not_targeted',
    );
  });

  it('does not let sponsored boost fully override a clearly stronger organic result', () => {
    const highlyRelevant = buildProduct({
      id: 'highly-relevant',
      title: 'Linen blue jacket',
      description: 'Linen blue tailored jacket',
      feedbackCount: 20,
      averageRating: '4.8',
      stockQuantity: 12,
    });
    const weakButSponsored = buildProduct({
      id: 'weak-but-sponsored',
      title: 'Generic item',
      description: 'Generic item',
      feedbackCount: 0,
      averageRating: '1.5',
      stockQuantity: 1,
      imagesCount: 1,
    });

    const organicStrong = service.scoreSearchProduct(
      'linen blue jacket',
      highlyRelevant,
      sponsoredConfig(),
    );
    const boostedWeak = service.scoreSearchProduct(
      'linen blue jacket',
      weakButSponsored,
      sponsoredConfig({
        sponsoredProductIds: ['weak-but-sponsored'],
        businessBoostShopIds: ['shop-1'],
        sponsoredBoost: 8,
        businessBoost: 4,
        maxSponsoredBoost: 5,
      }),
    );

    expect(organicStrong.score).toBeGreaterThan(boostedWeak.score);
  });

  it('does not boost out-of-stock or inactive candidates', () => {
    const outOfStockCandidate = buildProduct({
      id: 'candidate-out-of-stock-sponsored',
      stockQuantity: 0,
      feedbackCount: 10,
    });

    const scored = service.scoreHomeProduct(
      outOfStockCandidate,
      emptyPreferenceProfile(),
      sponsoredConfig({
        sponsoredProductIds: ['candidate-out-of-stock-sponsored'],
        businessBoostShopIds: ['shop-1'],
      }),
    );

    expect(scored.scoreBreakdown.sponsoredBoostScore).toBe(0);
    expect(scored.scoreBreakdown.businessBoostScore).toBe(0);
    expect(scored.sponsoredReason).toBeNull();
    expect(scored.campaignReadiness.campaignReadinessStatus).toBe('ineligible');
  });

  it('adds bounded recent-view and category-affinity personalization scores', () => {
    const candidate = buildProduct({
      id: 'candidate-personalized-view',
      categoryId: 77n,
      categoryName: 'Dresses',
      brand: 'North Berry',
      color: 'Blue',
    });

    const scored = service.scoreHomeProduct(candidate, {
      ...emptyPreferenceProfile(),
      recentViewBrandScores: new Map([['north berry', 0.9]]),
      recentViewColorScores: new Map([['blue', 0.8]]),
      categoryAffinityScores: new Map([['77', 0.85]]),
      categoryTermAffinityScores: new Map([['dresses', 0.75]]),
    });

    expect(scored.scoreBreakdown.recentViewScore).toBeGreaterThan(0);
    expect(scored.scoreBreakdown.categoryAffinityScore).toBeGreaterThan(0);
    expect(scored.scoreBreakdown.personalizationScore).toBeGreaterThan(0);
    expect(scored.scoreBreakdown.personalizationScore).toBeLessThanOrEqual(18);
    expect(scored.reasonCodes).toEqual(
      expect.arrayContaining([
        'based_on_recent_views',
        'based_on_category_affinity',
      ]),
    );
  });

  it('adds bounded search-intent and click-affinity personalization scores', () => {
    const candidate = buildProduct({
      id: 'candidate-personalized-search',
      title: 'Blue linen dress',
      description: 'Summer linen dress in blue',
      categoryId: 55n,
      categoryName: 'Dresses',
      brand: 'North Berry',
      color: 'Blue',
    });

    const scored = service.scoreSearchProduct('summer dress', candidate, {
      ...emptyPreferenceProfile(),
      searchIntentScores: new Map([
        ['linen', 0.8],
        ['dress', 0.7],
        ['blue', 0.4],
      ]),
      clickAffinityProductScores: new Map([[candidate.id, 0.5]]),
      clickAffinityCategoryScores: new Map([['55', 0.7]]),
      clickAffinityBrandScores: new Map([['north berry', 0.6]]),
      clickAffinityColorScores: new Map([['blue', 0.5]]),
      clickAffinityCategoryTermScores: new Map([['dresses', 0.65]]),
    });

    expect(scored.scoreBreakdown.searchIntentScore).toBeGreaterThan(0);
    expect(scored.scoreBreakdown.clickAffinityScore).toBeGreaterThan(0);
    expect(scored.scoreBreakdown.personalizationScore).toBeLessThanOrEqual(18);
    expect(scored.reasonCodes).toEqual(
      expect.arrayContaining([
        'based_on_search_intent',
        'based_on_recommendation_clicks',
      ]),
    );
  });

  it('keeps analytics tuning disabled by default when no config is provided', () => {
    const candidate = buildProduct({
      id: 'candidate-no-analytics-config',
    });

    const scored = service.scoreHomeProduct(
      candidate,
      emptyPreferenceProfile(),
    );

    expect(scored.analyticsTuningEnabled).toBe(false);
    expect(scored.analyticsSignalsUsed).toEqual([]);
    expect(scored.scoreBreakdown.analyticsPerformanceScore).toBe(0);
    expect(scored.scoreBreakdown.ctrScore).toBe(0);
    expect(scored.scoreBreakdown.productEngagementScore).toBe(0);
  });

  it('keeps analytics tuning safe when a candidate has no analytics signals', () => {
    const candidate = buildProduct({
      id: 'candidate-missing-signals',
    });

    const scored = service.scoreHomeProduct(
      candidate,
      emptyPreferenceProfile(),
      undefined,
      analyticsTuningConfig(),
    );

    expect(scored.analyticsTuningEnabled).toBe(true);
    expect(scored.analyticsSignalsUsed).toEqual([
      'algorithm_hint',
      'scenario_hint',
    ]);
    expect(scored.scoreBreakdown.analyticsPerformanceScore).toBe(0);
    expect(scored.scoreBreakdown.ctrScore).toBe(0);
    expect(scored.scoreBreakdown.productEngagementScore).toBe(0);
  });

  it('applies a bounded analytics boost for strong ctr and engagement', () => {
    const candidate = buildProduct({
      id: 'candidate-analytics-boost',
      feedbackCount: 6,
    });

    const scored = service.scoreHomeProduct(
      candidate,
      emptyPreferenceProfile(),
      undefined,
      analyticsTuningConfig({
        productSignalsById: new Map([
          [
            candidate.id,
            {
              impressions: 20,
              clicks: 8,
              ctr: 40,
            },
          ],
        ]),
        algorithmPerformanceHint: 10,
        scenarioPerformanceHint: 12,
      }),
    );

    expect(scored.analyticsTuningEnabled).toBe(true);
    expect(scored.scoreBreakdown.ctrScore).toBeGreaterThan(0);
    expect(scored.scoreBreakdown.productEngagementScore).toBeGreaterThan(0);
    expect(scored.scoreBreakdown.analyticsPerformanceScore).toBeGreaterThan(0);
    expect(scored.scoreBreakdown.analyticsPerformanceScore).toBeLessThanOrEqual(
      3,
    );
    expect(scored.analyticsSignalsUsed).toEqual(
      expect.arrayContaining([
        'ctr',
        'engagement',
        'algorithm_hint',
        'scenario_hint',
      ]),
    );
  });

  it('applies a bounded analytics penalty for deeply underperforming ctr without burying new products', () => {
    const weakCandidate = buildProduct({
      id: 'candidate-analytics-weak',
      feedbackCount: 8,
    });
    const newCandidate = buildProduct({
      id: 'candidate-analytics-new',
      feedbackCount: 8,
    });

    const tuning = analyticsTuningConfig({
      maxLowCtrPenalty: 0.5,
      productSignalsById: new Map([
        [
          weakCandidate.id,
          {
            impressions: 18,
            clicks: 0,
            ctr: 0,
          },
        ],
        [
          newCandidate.id,
          {
            impressions: 2,
            clicks: 0,
            ctr: 0,
          },
        ],
      ]),
      algorithmPerformanceHint: 10,
      scenarioPerformanceHint: 12,
    });

    const weakScored = service.scoreHomeProduct(
      weakCandidate,
      emptyPreferenceProfile(),
      undefined,
      tuning,
    );
    const newScored = service.scoreHomeProduct(
      newCandidate,
      emptyPreferenceProfile(),
      undefined,
      tuning,
    );

    expect(weakScored.scoreBreakdown.ctrScore).toBeLessThan(0);
    expect(
      weakScored.scoreBreakdown.analyticsPerformanceScore,
    ).toBeGreaterThanOrEqual(-0.5);
    expect(newScored.scoreBreakdown.analyticsPerformanceScore).toBe(0);
    expect(newScored.score).toBeGreaterThan(weakScored.score);
  });

  it('lets analytics, personalization, and sponsored boosts coexist safely', () => {
    const candidate = buildProduct({
      id: 'candidate-analytics-sponsored',
      categoryId: 88n,
      categoryName: 'Outerwear',
      brand: 'North Berry',
      color: 'Blue',
      feedbackCount: 18,
    });

    const scored = service.scoreHomeProduct(
      candidate,
      {
        ...emptyPreferenceProfile(),
        recentViewBrandScores: new Map([['north berry', 0.8]]),
        categoryAffinityScores: new Map([['88', 0.7]]),
      },
      sponsoredConfig({
        sponsoredProductIds: [candidate.id],
        businessBoostShopIds: ['shop-1'],
        sponsoredBoost: 4,
        businessBoost: 2,
        maxSponsoredBoost: 5,
      }),
      analyticsTuningConfig({
        productSignalsById: new Map([
          [
            candidate.id,
            {
              impressions: 15,
              clicks: 5,
              ctr: 33.33,
            },
          ],
        ]),
        algorithmPerformanceHint: 9,
        scenarioPerformanceHint: 10,
      }),
    );

    expect(scored.scoreBreakdown.personalizationScore).toBeGreaterThan(0);
    expect(scored.scoreBreakdown.analyticsPerformanceScore).toBeGreaterThan(0);
    expect(scored.scoreBreakdown.sponsoredBoostScore).toBeGreaterThan(0);
    expect(scored.scoreBreakdown.businessBoostScore).toBeGreaterThan(0);
    expect(scored.sponsored).toBe(true);
  });
});

function emptyPreferenceProfile(): RecommendationPreferenceProfile {
  return {
    categoryIds: new Set<string>(),
    categoryTerms: new Set<string>(),
    brands: new Set<string>(),
    colors: new Set<string>(),
    searchTerms: [],
    recentViewProductScores: new Map<string, number>(),
    recentViewBrandScores: new Map<string, number>(),
    recentViewColorScores: new Map<string, number>(),
    categoryAffinityScores: new Map<string, number>(),
    categoryTermAffinityScores: new Map<string, number>(),
    searchIntentScores: new Map<string, number>(),
    clickAffinityProductScores: new Map<string, number>(),
    clickAffinityCategoryScores: new Map<string, number>(),
    clickAffinityCategoryTermScores: new Map<string, number>(),
    clickAffinityBrandScores: new Map<string, number>(),
    clickAffinityColorScores: new Map<string, number>(),
  };
}

function sponsoredConfig(
  overrides?: Partial<{
    enabled: boolean;
    sponsoredProductIds: string[];
    businessBoostShopIds: string[];
    sponsoredBoost: number;
    businessBoost: number;
    maxSponsoredBoost: number;
    maxBusinessBoost: number;
  }>,
) {
  return {
    enabled: overrides?.enabled ?? true,
    sponsoredProductIds: new Set(overrides?.sponsoredProductIds ?? []),
    businessBoostShopIds: new Set(overrides?.businessBoostShopIds ?? []),
    sponsoredBoost: overrides?.sponsoredBoost ?? 4,
    businessBoost: overrides?.businessBoost ?? 2,
    maxSponsoredBoost: overrides?.maxSponsoredBoost ?? 5,
    maxBusinessBoost: overrides?.maxBusinessBoost ?? 2,
    preset: {
      id: 'balanced',
      name: 'Balanced',
      description: 'Default internal preset',
      version: '1.0.0',
      stability: 'stable',
      maxSponsoredBoost: overrides?.maxSponsoredBoost ?? 5,
      maxBusinessBoost: overrides?.maxBusinessBoost ?? 2,
      allowedScenarioTypes: ['home', 'similar', 'search'],
      notes: 'Test preset only',
    },
    campaign: {
      campaignId: 'campaign-test',
      sponsorType: 'campaign',
      maxBoost: overrides?.maxSponsoredBoost ?? 5,
      scenarioType: 'home',
      billingMode: 'none',
      rolloutMode: overrides?.enabled === false ? 'disabled' : 'internal',
    },
  };
}

function analyticsTuningConfig(
  overrides?: Partial<RecommendationAnalyticsTuningConfig>,
): RecommendationAnalyticsTuningConfig {
  return {
    enabled: overrides?.enabled ?? true,
    minEventsForCtrBoost: overrides?.minEventsForCtrBoost ?? 5,
    minClicksForEngagementBoost: overrides?.minClicksForEngagementBoost ?? 2,
    maxAnalyticsBoost: overrides?.maxAnalyticsBoost ?? 3,
    maxCtrBoost: overrides?.maxCtrBoost ?? 2,
    maxLowCtrPenalty: overrides?.maxLowCtrPenalty ?? 0.5,
    maxEngagementBoost: overrides?.maxEngagementBoost ?? 1.25,
    algorithmPerformanceHint: overrides?.algorithmPerformanceHint ?? 8,
    scenarioPerformanceHint: overrides?.scenarioPerformanceHint ?? 9,
    productSignalsById:
      overrides?.productSignalsById ??
      new Map<
        string,
        {
          impressions: number;
          clicks: number;
          ctr: number;
        }
      >(),
  };
}

function tuningConfig(
  weightOverrides?: Partial<RecommendationTuningConfig['weights']>,
): RecommendationTuningConfig {
  return {
    presetId: 'preset-1',
    presetKey: 'preset-key-1',
    version: 1,
    weights: {
      ...DEFAULT_RECOMMENDATION_TUNING_WEIGHTS,
      ...weightOverrides,
    },
    guardrails: { ...DEFAULT_RECOMMENDATION_TUNING_GUARDRAILS },
  };
}

function buildProduct({
  id,
  title = 'Fallback product',
  description,
  shopId = 'shop-1',
  categoryId = 11n,
  categoryName = 'Jackets',
  sourceCategoryName = 'Jackets',
  brand = 'North Berry',
  color = 'Black',
  averageRating = '4.7',
  feedbackCount = 12,
  stockQuantity = 8,
  publishedAt = '2026-06-02T00:00:00.000Z',
  imagesCount = 1,
}: {
  id: string;
  title?: string;
  description?: string;
  shopId?: string;
  categoryId?: bigint | null;
  categoryName?: string;
  sourceCategoryName?: string;
  brand?: string | null;
  color?: string | null;
  averageRating?: string;
  feedbackCount?: number;
  stockQuantity?: number;
  publishedAt?: string;
  imagesCount?: number;
}): RecommendationProductRecord {
  return {
    id,
    shopId,
    wbTitle: title,
    localTitle: title,
    wbDescription: description ?? `${title} description`,
    localDescription: description ?? `${title} description`,
    brand,
    color,
    gender: 'Unisex',
    composition: 'Cotton',
    sellerSku: `SKU-${id}`,
    seoSlug: null,
    categoryName,
    sourceCategoryName,
    aiTryOnEnabled: false,
    visibility: 'ACTIVE',
    catalogStatus: 'PUBLISHED',
    averageRating: new Prisma.Decimal(averageRating),
    feedbackCount,
    categoryId,
    subjectId: 1n,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    publishedAt: new Date(publishedAt),
    updatedAt: new Date('2026-06-08T00:00:00.000Z'),
    archivedAt: null,
    unpublishedAt: null,
    images: Array.from({ length: imagesCount }, (_, index) => ({
      id: `image-${id}-${index}`,
      wbUrl: `https://example.com/${id}-${index}.jpg`,
      localUrl: null,
      isMain: index === 0,
      sortOrder: index,
    })),
    variants: [
      {
        id: `variant-${id}`,
        sizeName: 'M',
        russianSize: '46',
        techSize: 'M',
        wbSize: 'M',
        sellerSku: `SKU-${id}-M`,
        isActive: true,
        basePrice: new Prisma.Decimal('1999'),
        discountPrice: new Prisma.Decimal('1499'),
        stockQuantity,
        reservedStock: 0,
        lowStockThreshold: 2,
        trackInventory: true,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
      },
    ],
    shop: {
      id: shopId,
      name: `Shop ${shopId}`,
      slug: `shop-${shopId}`,
      logoUrl: null,
      paymentInstructions: 'Manual transfer',
      status: 'ACTIVE',
      sellerProfile: {
        approvalStatus: 'APPROVED',
      },
    },
    category:
      categoryId === null
        ? null
        : {
            id: categoryId,
            name: categoryName,
            slug: categoryName.toLowerCase(),
          },
  };
}
