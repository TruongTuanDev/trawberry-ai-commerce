import { Prisma } from '@prisma/client';
import {
  RecommendationScoringService,
  RECOMMENDATION_SCORING_WEIGHTS,
  type RecommendationPreferenceProfile,
  type RecommendationProductRecord,
} from '../src/modules/recommendations/recommendation-scoring.service';

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
});

function emptyPreferenceProfile(): RecommendationPreferenceProfile {
  return {
    categoryIds: new Set<string>(),
    categoryTerms: new Set<string>(),
    brands: new Set<string>(),
    colors: new Set<string>(),
    searchTerms: [],
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
