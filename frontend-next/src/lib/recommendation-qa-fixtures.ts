import type { RecommendationQaPack } from "@/lib/public-api";

type RecommendationQaFixture = {
  id: string;
  label: string;
  scenario: string;
  pack: RecommendationQaPack;
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
  },
) {
  return {
    product: {
      id: productId,
      name,
      seoSlug: null,
      categoryName: "Jackets",
      brand: "North Berry",
      color: "Black",
      price: "1499",
      inStock: true,
      imageUrl: "https://example.com/image.jpg",
      shopName: "Ready Shop",
      shopSlug: "ready-shop",
    },
    rankMovement: null,
    ruleBasedV1: null,
    ruleBasedV2: {
      algorithm: "rule_based_v2" as const,
      rank,
      finalScore: score,
      reasons,
      scoreBreakdown,
    },
  };
}

export const RECOMMENDATION_QA_SAMPLE_PACKS: RecommendationQaFixture[] = [
  {
    id: "home-ranking-stability",
    label: "Home ranking stability",
    scenario: "Safe mock home pack focused on moved-down and unchanged thresholds.",
    pack: {
      packName: "Sample home QA pack",
      description:
        "Safe mock QA pack for repeatable home ranking audits with sample recommendation data.",
      scenarioType: "home",
      query: null,
      productId: null,
      limit: 5,
      baselineSnapshot: {
        scenarioType: "home",
        placement: "home",
        productId: null,
        query: null,
        limit: 5,
        generatedAt: "2026-06-06T13:00:00.000Z",
        comparedAlgorithms: ["rule_based_v1", "rule_based_v2"],
        items: [
          buildSnapshotItem("prod-1", "Stable Product", 1, 10, ["Popular"], {
            categoryScore: 4,
            textScore: 1,
            popularityScore: 3,
            freshnessScore: 1,
            ratingScore: 1,
            stockScore: 0,
            shopScore: 0,
            penaltyScore: 0,
          }),
          buildSnapshotItem("prod-2", "Moved Up Product", 4, 7, ["Popular"], {
            categoryScore: 2,
            textScore: 0,
            popularityScore: 2,
            freshnessScore: 1,
            ratingScore: 1,
            stockScore: 0,
            shopScore: 1,
            penaltyScore: 0,
          }),
          buildSnapshotItem("prod-3", "Moved Down Product", 1, 12, ["Fresh"], {
            categoryScore: 5,
            textScore: 1,
            popularityScore: 2,
            freshnessScore: 2,
            ratingScore: 1,
            stockScore: 1,
            shopScore: 0,
            penaltyScore: 0,
          }),
        ],
      },
      candidateSnapshot: {
        scenarioType: "home",
        placement: "home",
        productId: null,
        query: null,
        limit: 5,
        generatedAt: "2026-06-06T13:30:00.000Z",
        comparedAlgorithms: ["rule_based_v1", "rule_based_v2"],
        items: [
          buildSnapshotItem("prod-1", "Stable Product", 1, 11, ["Popular"], {
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
            "prod-2",
            "Moved Up Product",
            2,
            9,
            ["Popular", "Currently in stock"],
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
          buildSnapshotItem("prod-3", "Moved Down Product", 3, 8, ["Fresh"], {
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
      expectedSummaryThresholds: {
        maxMovedDownCount: 1,
        maxScoreDelta: 5,
        minUnchangedCount: 1,
        maxAbsoluteRankMovement: 2,
      },
    },
  },
  {
    id: "search-intent-stability",
    label: "Search intent stability",
    scenario: "Safe mock search pack focused on text intent drift and added results.",
    pack: {
      packName: "Sample search QA pack",
      description:
        "Safe mock QA pack for repeatable search ranking audits with sample search intent data.",
      scenarioType: "search",
      query: "jacket",
      productId: null,
      limit: 4,
      baselineSnapshot: {
        scenarioType: "search",
        placement: "search",
        productId: null,
        query: "jacket",
        limit: 4,
        generatedAt: "2026-06-06T14:00:00.000Z",
        comparedAlgorithms: ["rule_based_v1", "rule_based_v2"],
        items: [
          buildSnapshotItem("search-1", "Keyword Match Jacket", 1, 18, ["Keyword overlap with the search intent"], {
            categoryScore: 0,
            textScore: 12,
            popularityScore: 2,
            freshnessScore: 1,
            ratingScore: 1,
            stockScore: 1,
            shopScore: 1,
            penaltyScore: 0,
          }),
          buildSnapshotItem("search-2", "Popular Black Jacket", 2, 14, ["Keyword overlap with the search intent"], {
            categoryScore: 0,
            textScore: 10,
            popularityScore: 2,
            freshnessScore: 1,
            ratingScore: 1,
            stockScore: 0,
            shopScore: 0,
            penaltyScore: 0,
          }),
        ],
      },
      candidateSnapshot: {
        scenarioType: "search",
        placement: "search",
        productId: null,
        query: "jacket",
        limit: 4,
        generatedAt: "2026-06-06T14:20:00.000Z",
        comparedAlgorithms: ["rule_based_v1", "rule_based_v2"],
        items: [
          buildSnapshotItem("search-1", "Keyword Match Jacket", 1, 19, ["Keyword overlap with the search intent"], {
            categoryScore: 0,
            textScore: 12,
            popularityScore: 3,
            freshnessScore: 1,
            ratingScore: 1,
            stockScore: 1,
            shopScore: 1,
            penaltyScore: 0,
          }),
          buildSnapshotItem("search-3", "New Search Result", 2, 15, ["Keyword overlap with the search intent", "Currently in stock"], {
            categoryScore: 0,
            textScore: 11,
            popularityScore: 1,
            freshnessScore: 1,
            ratingScore: 1,
            stockScore: 1,
            shopScore: 0,
            penaltyScore: 0,
          }),
          buildSnapshotItem("search-2", "Popular Black Jacket", 3, 13, ["Keyword overlap with the search intent"], {
            categoryScore: 0,
            textScore: 9,
            popularityScore: 2,
            freshnessScore: 1,
            ratingScore: 1,
            stockScore: 0,
            shopScore: 0,
            penaltyScore: 0,
          }),
        ],
      },
      expectedSummaryThresholds: {
        maxAddedCount: 1,
        maxRemovedCount: 0,
        maxMovedDownCount: 1,
        maxTotalChangedCount: 2,
      },
    },
  },
  {
    id: "similar-products-stability",
    label: "Similar products stability",
    scenario: "Safe mock similar-products pack focused on rank movement and removals.",
    pack: {
      packName: "Sample similar-products QA pack",
      description:
        "Safe mock QA pack for repeatable similar-products audits with sample productId metadata.",
      scenarioType: "similar",
      query: null,
      productId: "public-source-product",
      limit: 4,
      baselineSnapshot: {
        scenarioType: "similar",
        placement: "product_detail",
        productId: "public-source-product",
        query: null,
        limit: 4,
        generatedAt: "2026-06-06T15:00:00.000Z",
        comparedAlgorithms: ["rule_based_v1", "rule_based_v2"],
        items: [
          buildSnapshotItem("similar-1", "Same Category Jacket", 1, 16, ["Matched source product category"], {
            categoryScore: 9,
            textScore: 1,
            popularityScore: 2,
            freshnessScore: 1,
            ratingScore: 1,
            stockScore: 1,
            shopScore: 1,
            penaltyScore: 0,
          }),
          buildSnapshotItem("similar-2", "Brand Match Jacket", 2, 13, ["Shares the source brand"], {
            categoryScore: 6,
            textScore: 0,
            popularityScore: 2,
            freshnessScore: 1,
            ratingScore: 1,
            stockScore: 1,
            shopScore: 1,
            penaltyScore: 0,
          }),
        ],
      },
      candidateSnapshot: {
        scenarioType: "similar",
        placement: "product_detail",
        productId: "public-source-product",
        query: null,
        limit: 4,
        generatedAt: "2026-06-06T15:15:00.000Z",
        comparedAlgorithms: ["rule_based_v1", "rule_based_v2"],
        items: [
          buildSnapshotItem("similar-2", "Brand Match Jacket", 1, 15, ["Shares the source brand", "Currently in stock"], {
            categoryScore: 6,
            textScore: 0,
            popularityScore: 3,
            freshnessScore: 1,
            ratingScore: 1,
            stockScore: 2,
            shopScore: 1,
            penaltyScore: 0,
          }),
          buildSnapshotItem("similar-3", "Category Fallback Jacket", 2, 12, ["Matched source product category"], {
            categoryScore: 7,
            textScore: 0,
            popularityScore: 1,
            freshnessScore: 1,
            ratingScore: 1,
            stockScore: 1,
            shopScore: 1,
            penaltyScore: 0,
          }),
        ],
      },
      expectedSummaryThresholds: {
        maxRemovedCount: 1,
        maxMovedUpCount: 1,
        maxAbsoluteRankMovement: 1,
        maxScoreDelta: 3,
      },
    },
  },
];

export const RECOMMENDATION_QA_BASELINE_FIXTURES = RECOMMENDATION_QA_SAMPLE_PACKS.map(
  ({ id, label, scenario, pack }) => ({
    id,
    label,
    scenario,
    scenarioType: pack.scenarioType,
    query: pack.query ?? null,
    productId: pack.productId ?? null,
    limit: pack.limit,
  }),
);
