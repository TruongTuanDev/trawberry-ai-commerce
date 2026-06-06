# API Recommendations

## Phase 2 Scope

This document covers the Phase 2 smart ranking rollout for public product recommendations.

Safety guarantees:

- checkout, cart, order, payment, shipping, WB sync, and AI Try-On flows stay unchanged
- recommendation APIs remain public-read/public-track only
- tracking remains best-effort and never blocks navigation or rendering
- when recommendation flags are off, the storefront hides the blocks and the backend returns safe empty payloads

Feature flags:

- `RECOMMENDATIONS_ENABLED`
- `PUBLIC_RECOMMENDATIONS_ENABLED`
- `RECOMMENDATION_TRACKING_ENABLED`
- `RECOMMENDATION_SMART_RANKING_ENABLED`
- `RECOMMENDATION_EXPLAINABILITY_ENABLED`
- `NEXT_PUBLIC_RECOMMENDATION_EXPLAINABILITY_ENABLED`
- `RECOMMENDATION_QA_TOOLS_ENABLED`
- `NEXT_PUBLIC_RECOMMENDATION_QA_TOOLS_ENABLED`

If `RECOMMENDATION_SMART_RANKING_ENABLED=false`:

- homepage and similar-product endpoints fall back to `rule_based_v1`
- search recommendations return `[]`
- UI remains stable because blocks already hide on empty/error

## Ranking

Phase 2 algorithm name:

- `rule_based_v2`

Core formula:

```text
finalScore =
  categoryScore
  + textScore
  + popularityScore
  + freshnessScore
  + ratingScore
  + stockScore
  + shopScore
  - penaltyScore
```

Initial weights:

- `categoryScore`: up to `35`
- `textScore`: up to `20`
- `popularityScore`: up to `15`
- `freshnessScore`: up to `10`
- `ratingScore`: up to `10`
- `stockScore`: up to `5`
- `shopScore`: up to `5`

Reason codes currently returned:

- `same_category`
- `matching_category_name`
- `based_on_viewed_category`
- `same_color`
- `same_brand`
- `keyword_match`
- `popular`
- `fresh`
- `high_rating`
- `in_stock`
- `same_shop`
- `has_image`

Explainability mode:

- internal explainability is disabled by default
- to include per-item score explanations, both of these must be true:
  - request query includes `debug=true`
  - backend runtime sets `RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
- explainability never returns customer IDs, guest session IDs, raw search queries, or raw view history

Internal QA comparison mode:

- ranking comparison is disabled by default
- to enable comparison tooling locally:
  - set `RECOMMENDATION_QA_TOOLS_ENABLED=true`
  - set `NEXT_PUBLIC_RECOMMENDATION_QA_TOOLS_ENABLED=true`
- comparison can optionally include explainability only when:
  - `debug=true`
  - `RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
- comparison response never returns:
  - `customerId`
  - `guestSessionId`
  - raw search history
  - raw viewed-product history
- snapshot export also never returns:
  - `userId`
  - cookies
  - private tracking payloads
  - private shop/internal-only fields
- snapshot diffing also never returns:
  - session ids
  - cookies
  - private tracking payloads
  - private shop/internal-only fields
- QA pack evaluation also never returns:
  - user ids
  - session ids
  - cookies
  - private tracking payloads
  - private shop/internal-only fields
- QA preset and baseline catalog endpoints also never return:
  - user ids
  - session ids
  - cookies
  - private tracking payloads
  - private shop/internal-only fields
  - real production snapshots
- QA packs committed to the repo must contain only safe mock/sample snapshot data

## Read APIs

### `GET /api/public/recommendations/home?limit=12`

Behavior:

- personalizes for the current customer session when available
- personalizes for the current guest via `guestSessionId` query or `x-guest-session-id`
- uses recent `ProductViewLog` and `SearchLog` signals when present
- falls back to newer, rated, public-ready products when no history exists

Response:

```json
{
  "algorithm": "rule_based_v2",
  "placement": "home",
  "items": [
    {
      "product": {
        "id": "uuid",
        "name": "Product title"
      },
      "rank": 1,
      "score": 82.5,
      "reasonCodes": ["based_on_viewed_category", "popular", "in_stock"]
    }
  ],
  "products": [
    {
      "id": "uuid",
      "name": "Product title"
    }
  ]
}
```

Backward compatibility:

- `products` is included as a flat list for legacy consumers
- frontend now reads the richer `items[].product` contract safely
- when explainability mode is off, no extra explainability fields are returned

Internal explainability example:

```json
{
  "algorithm": "rule_based_v2",
  "placement": "home",
  "items": [
    {
      "product": {
        "id": "uuid",
        "name": "Product title"
      },
      "rank": 1,
      "score": 82.5,
      "reasonCodes": ["based_on_viewed_category", "popular", "in_stock"],
      "scoreExplanation": {
        "algorithm": "rule_based_v2",
        "finalScore": 82.5,
        "reasons": [
          "Aligned with recent viewed category interest",
          "Strong feedback volume popularity signal",
          "Currently in stock"
        ],
        "scoreBreakdown": {
          "categoryScore": 24,
          "textScore": 10,
          "popularityScore": 15,
          "freshnessScore": 8.5,
          "ratingScore": 9.4,
          "stockScore": 4,
          "shopScore": 2,
          "penaltyScore": 0
        }
      }
    }
  ],
  "products": [
    {
      "id": "uuid",
      "name": "Product title"
    }
  ]
}
```

### `GET /api/public/recommendations/products/:productId/similar?limit=12`

Behavior:

- excludes the source product
- prioritizes same `categoryId`
- falls back to `categoryName` / `sourceCategoryName`
- boosts same `brand` and `color`
- boosts rated, fresh, in-stock, image-backed products
- excludes archived, unpublished, deleted, and non-public-ready products
- falls back to broader public products if the strict category pool is too small

### `GET /api/public/recommendations/search?q=...&limit=12`

Behavior:

- returns `[]` when `q` is empty
- matches `title`, `description`, `category`, `color`, and `brand`
- ranks results with `rule_based_v2`
- intended for an additive storefront suggestion block, not for replacing the main catalog search API

## Tracking APIs

### `POST /api/public/tracking/product-view`

Body:

```json
{
  "productId": "uuid",
  "source": "product_page",
  "referrer": "https://example.com/products",
  "guestSessionId": "uuid-or-stable-client-id"
}
```

Behavior:

- stores additive view analytics only
- hashes IP before storage
- never blocks the page

### `POST /api/public/tracking/search`

Body:

```json
{
  "query": "jacket",
  "resultCount": 12,
  "locale": "ru",
  "guestSessionId": "uuid-or-stable-client-id"
}
```

### `POST /api/public/recommendations/events`

Body:

```json
{
  "type": "impression",
  "placement": "product_detail",
  "productId": "uuid",
  "sourceProductId": "uuid",
  "algorithm": "rule_based_v2",
  "rank": 1,
  "score": 82.5,
  "guestSessionId": "uuid-or-stable-client-id"
}
```

Supported placements:

- `home`
- `product_detail`
- `search`
- `cart_later_reserved`

Supported types:

- `impression`
- `click`

Notes:

- tracking failures are swallowed
- rank/score are optional and safe to omit

## Internal QA API

### `GET /api/internal/recommendations/compare`

Purpose:

- compare ranking output between `rule_based_v1` and `rule_based_v2`
- support internal QA without changing the public recommendation contract

Query params:

- `placement=home|product_detail|search`
- `limit=1..24`
- `productId` required when `placement=product_detail`
- `q` required when `placement=search`
- `debug=true` optional for explainability
- `export=true` optional for snapshot export
- `format=json` optional when `export=true`

Behavior:

- returns `404` when `RECOMMENDATION_QA_TOOLS_ENABLED` is off
- compares both algorithms side by side for:
  - `home`
  - `product_detail`
- for `search`, `rule_based_v1` intentionally acts as the legacy empty baseline and `rule_based_v2` shows ranked results
- rank movement is calculated as:
  - `rule_based_v1.rank - rule_based_v2.rank`
  - positive value means the product moved up in `rule_based_v2`
- when `export=true`, the same internal workflow returns a QA snapshot payload instead of the default compare response
- exported snapshots only include public product summary fields plus ranking metadata needed for QA review

Response example:

```json
{
  "placement": "home",
  "items": [
    {
      "productId": "uuid",
      "productName": "Product title",
      "rankMovement": 2,
      "ruleBasedV1": {
        "algorithm": "rule_based_v1",
        "rank": 3,
        "finalScore": 104.5,
        "reasons": [],
        "scoreBreakdown": null
      },
      "ruleBasedV2": {
        "algorithm": "rule_based_v2",
        "rank": 1,
        "finalScore": 62.2,
        "reasons": [
          "Aligned with recent viewed category interest",
          "Recently published or updated item"
        ],
        "scoreBreakdown": {
          "categoryScore": 24,
          "textScore": 0,
          "popularityScore": 0,
          "freshnessScore": 9.33,
          "ratingScore": 8,
          "stockScore": 2.8,
          "shopScore": 2,
          "penaltyScore": 0
        }
      }
    }
  ]
}
```

Snapshot export example:

```json
{
  "scenarioType": "search",
  "placement": "search",
  "productId": null,
  "query": "jacket",
  "limit": 8,
  "generatedAt": "2026-06-06T13:15:00.000Z",
  "comparedAlgorithms": ["rule_based_v1", "rule_based_v2"],
  "items": [
    {
      "product": {
        "id": "uuid",
        "name": "Product title",
        "seoSlug": "product-title",
        "categoryName": "Jackets",
        "brand": "North Berry",
        "color": "Black",
        "price": "1499",
        "inStock": true,
        "imageUrl": "https://example.com/image.jpg",
        "shopName": "Ready Shop",
        "shopSlug": "ready-shop"
      },
      "rankMovement": null,
      "ruleBasedV1": null,
      "ruleBasedV2": {
        "algorithm": "rule_based_v2",
        "rank": 1,
        "finalScore": 62.2,
        "reasons": [
          "Keyword overlap with the search intent",
          "Currently in stock"
        ],
        "scoreBreakdown": {
          "categoryScore": 0,
          "textScore": 20,
          "popularityScore": 10,
          "freshnessScore": 8,
          "ratingScore": 8,
          "stockScore": 4,
          "shopScore": 2,
          "penaltyScore": 0
        }
      }
    }
  ]
}
```

Local QA UI:

- frontend internal page: `/admin/recommendations-qa`
- this page only renders when `NEXT_PUBLIC_RECOMMENDATION_QA_TOOLS_ENABLED=true`
- recommended local workflow:
  - start backend on `127.0.0.1:3001`
  - start frontend on `127.0.0.1:3000`
  - enable QA and explainability flags
  - open `/admin/recommendations-qa`
  - run saved scenarios for:
    - `home`
    - `search`
    - `similar products`
  - compare custom `home`, `search`, and `product_detail` scenarios
  - export the current comparison as JSON when you want a repeatable audit artifact
  - load the sample QA pack or import a QA pack JSON
  - validate the QA pack before diffing
  - copy a Markdown summary or print the visual diff review

QA snapshot guide:

1. Enable internal QA flags:
   - `RECOMMENDATION_QA_TOOLS_ENABLED=true`
   - `NEXT_PUBLIC_RECOMMENDATION_QA_TOOLS_ENABLED=true`
2. Optional explainability:
   - `RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
   - `NEXT_PUBLIC_RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
3. Open `/admin/recommendations-qa`.
4. Run a saved scenario or enter custom inputs for:
   - `home`
   - `search` with `q`
   - `product_detail` with a public `productId`
5. Review side-by-side `rule_based_v1` vs `rule_based_v2` rank movement.
6. Click `Export JSON snapshot`.
7. Change or tune ranking weights in the recommendation scoring service.
8. Export snapshot B from the same scenario after the change.
9. Build a QA pack with:
   - pack name
   - description
   - scenario metadata
   - baseline snapshot
   - candidate snapshot
   - optional thresholds
10. Load the sample QA pack or paste/import your QA pack JSON into `/admin/recommendations-qa`.
11. Validate the QA pack.
12. Run snapshot diff from the pack-loaded baseline and candidate snapshots.
13. Export the visual summary using Markdown copy or print.
14. Interpret the diff output and thresholds:
   - `moved_up`: candidate rank improved
   - `moved_down`: candidate rank dropped
   - `added`: candidate introduced a new result
   - `removed`: candidate lost a prior result
   - `unchanged`: item rank stayed stable
   - thresholds help QA decide whether moved-down count or score deltas exceed the acceptable audit envelope

### `POST /api/internal/recommendations/diff`

Purpose:

- compare two exported QA snapshot payloads
- support before/after ranking audits after weight tuning
- keep diffing internal-only without changing public recommendation contracts

Behavior:

- returns `404` when `RECOMMENDATION_QA_TOOLS_ENABLED` is off
- accepts:
  - `baseline` snapshot JSON
  - `candidate` snapshot JSON
- returns safe diff output only:
  - scenario metadata
  - summary counts
  - `productId`
  - `productName`
  - `oldRank`
  - `newRank`
  - `rankMovement`
  - `oldScore`
  - `newScore`
  - `scoreDelta`
  - `status`
  - optional `reasonDelta`
  - optional `scoreBreakdownDelta`

Status interpretation:

- `unchanged`: item exists in both snapshots and rank stayed the same
- `moved_up`: item exists in both snapshots and rank improved
- `moved_down`: item exists in both snapshots and rank dropped
- `added`: item exists only in the candidate snapshot
- `removed`: item exists only in the baseline snapshot

Diff response example:

```json
{
  "summary": {
    "totalItemsCompared": 5,
    "movedUpCount": 1,
    "movedDownCount": 1,
    "addedCount": 1,
    "removedCount": 1,
    "unchangedCount": 1
  },
  "items": [
    {
      "productId": "uuid",
      "productName": "Product title",
      "status": "moved_up",
      "oldRank": 4,
      "newRank": 2,
      "rankMovement": 2,
      "oldScore": 7,
      "newScore": 9,
      "scoreDelta": 2,
      "reasonDelta": {
        "added": ["Currently in stock"],
        "removed": []
      },
      "scoreBreakdownDelta": {
        "categoryScore": 0,
        "textScore": 0,
        "popularityScore": 0,
        "freshnessScore": 0,
        "ratingScore": 0,
        "stockScore": 1,
        "shopScore": 0,
        "penaltyScore": 0
      }
    }
  ]
}
```

### `POST /api/internal/recommendations/packs/validate`

Purpose:

- validate an internal recommendation QA pack structure
- support repeatable baseline/candidate audits with safe mock or imported snapshot bundles

Behavior:

- returns `404` when `RECOMMENDATION_QA_TOOLS_ENABLED` is off
- rejects malformed QA pack payloads with `400`
- returns normalized notices when scenario metadata and snapshot metadata drift
- QA packs committed to the repository must use safe mock/sample data only

QA pack structure:

- `packName`
- `description`
- `scenarioType`
- `query` or `productId` when applicable
- optional `catalogId`
- optional `thresholdPresetId`
- `limit`
- `baselineSnapshot`
- `candidateSnapshot`
- optional `expectedSummaryThresholds`

Supported threshold keys:

- `maxMovedDownCount`
- `maxMovedUpCount`
- `maxAddedCount`
- `maxRemovedCount`
- `maxScoreDelta`
- `maxAbsoluteRankMovement`
- `minUnchangedCount`
- `maxTotalChangedCount`

Preset behavior:

- `thresholdPresetId` is optional
- if present, the backend expands the selected preset into concrete thresholds
- `expectedSummaryThresholds` can still override or extend the preset values
- validation response includes:
  - `appliedThresholdPreset`
  - `resolvedThresholds`

QA pack example:

```json
{
  "packName": "Sample home QA pack",
  "description": "Safe mock QA pack for repeatable home ranking audits.",
  "scenarioType": "home",
  "query": null,
  "productId": null,
  "limit": 5,
  "baselineSnapshot": {
    "scenarioType": "home",
    "placement": "home",
    "productId": null,
    "query": null,
    "limit": 5,
    "generatedAt": "2026-06-06T13:00:00.000Z",
    "comparedAlgorithms": ["rule_based_v1", "rule_based_v2"],
    "items": []
  },
  "candidateSnapshot": {
    "scenarioType": "home",
    "placement": "home",
    "productId": null,
    "query": null,
    "limit": 5,
    "generatedAt": "2026-06-06T13:30:00.000Z",
    "comparedAlgorithms": ["rule_based_v1", "rule_based_v2"],
    "items": []
  },
  "expectedSummaryThresholds": {
    "maxMovedDownCount": 2,
    "maxRemovedCount": 1,
    "maxScoreDelta": 5,
    "minUnchangedCount": 1
  }
}
```

QA pack validation response now also includes:

- `evaluation.overallStatus`
  - `pass`
  - `fail`
  - `not_evaluated`
- `evaluation.summary`
  - `totalItemsCompared`
  - `movedUpCount`
  - `movedDownCount`
  - `addedCount`
  - `removedCount`
  - `unchangedCount`
  - `totalChangedCount`
  - `maxScoreDelta`
  - `maxAbsoluteRankMovement`
- `evaluation.thresholds[]`
  - `key`
  - `status`
  - `operator`
  - `actualValue`
  - `expectedValue`
  - `message`

Threshold interpretation:

- `max*` thresholds pass when the actual value is `<= expectedValue`
- `minUnchangedCount` passes when the actual value is `>= expectedValue`
- if no thresholds are provided, `overallStatus` becomes `not_evaluated`

### `GET /api/internal/recommendations/presets`

Purpose:

- return safe reusable QA threshold preset definitions for internal recommendation audits

Behavior:

- returns `404` when `RECOMMENDATION_QA_TOOLS_ENABLED` is off
- returns safe preset metadata only:
  - `id`
  - `name`
  - `description`
  - `thresholds`

Current preset ids:

- `strict`
- `balanced`
- `lenient`
- `search-intent-sensitive`
- `similar-products-sensitive`

### `GET /api/internal/recommendations/baseline-catalog`

Purpose:

- return a safe internal baseline catalog of reusable recommendation QA scenarios

Behavior:

- returns `404` when `RECOMMENDATION_QA_TOOLS_ENABLED` is off
- returns allowlisted catalog metadata only:
  - `id`
  - `name`
  - `description`
  - `scenarioType`
  - `query`
  - `productId`
  - `defaultLimit`
  - `recommendedThresholdPresetId`
  - optional `mockPack`
- `mockPack` can contain only safe mock/sample snapshots, never real exported production data

Catalog example:

```json
{
  "catalog": [
    {
      "id": "search-intent-stability",
      "name": "Search intent stability",
      "description": "Safe mock search audit scenario for tracking intent drift and added results.",
      "scenarioType": "search",
      "query": "jacket",
      "productId": null,
      "defaultLimit": 4,
      "recommendedThresholdPresetId": "search-intent-sensitive",
      "mockPack": {
        "packName": "Sample search QA pack",
        "description": "Safe mock QA pack for repeatable search ranking audits with sample search intent data.",
        "thresholdPresetId": "search-intent-sensitive"
      }
    }
  ]
}
```

Local QA threshold workflow:

1. Enable internal QA flags:
   - `RECOMMENDATION_QA_TOOLS_ENABLED=true`
   - `NEXT_PUBLIC_RECOMMENDATION_QA_TOOLS_ENABLED=true`
2. Optional explainability:
   - `RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
   - `NEXT_PUBLIC_RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
3. Start backend and frontend locally.
4. Open `/admin/recommendations-qa`.
5. Choose a threshold preset:
   - `strict`
   - `balanced`
   - `lenient`
   - `search-intent-sensitive`
   - `similar-products-sensitive`
6. Load one of the safe baseline catalog entries:
   - home ranking stability
   - search intent stability
   - similar products stability
7. Review the validation result:
   - `overallStatus`
   - per-threshold `actualValue`
   - per-threshold `expectedValue`
   - per-threshold `message`
8. Run the snapshot diff using the hydrated baseline/candidate snapshots.
9. Export the Markdown summary or print view for internal review.
10. When creating a new safe catalog entry:
   - keep only allowlisted scenario metadata
   - use only safe mock/sample snapshots
   - never commit real exported storefront snapshots
11. After future weight changes, repeat the same catalog entry or pack and compare whether thresholds still pass.

## Rollout

1. Deploy backend and frontend with the new additive code.
2. Keep `RECOMMENDATION_SMART_RANKING_ENABLED=false` for first deploy if you want a dark launch.
3. Verify:
   - `GET /api/public/recommendations/home`
   - `GET /api/public/recommendations/products/:id/similar`
   - `GET /api/public/recommendations/search?q=...`
   - optional internal QA: repeat the same calls with `debug=true` after enabling `RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
   - optional QA comparison: call `GET /api/internal/recommendations/compare` after enabling `RECOMMENDATION_QA_TOOLS_ENABLED=true`
   - optional QA snapshot export: call `GET /api/internal/recommendations/compare?export=true&format=json` after enabling `RECOMMENDATION_QA_TOOLS_ENABLED=true`
   - optional QA snapshot diff: call `POST /api/internal/recommendations/diff` with two safe snapshot payloads after enabling `RECOMMENDATION_QA_TOOLS_ENABLED=true`
   - optional QA threshold preset list: call `GET /api/internal/recommendations/presets` after enabling `RECOMMENDATION_QA_TOOLS_ENABLED=true`
   - optional QA baseline catalog list: call `GET /api/internal/recommendations/baseline-catalog` after enabling `RECOMMENDATION_QA_TOOLS_ENABLED=true`
   - optional QA pack validation: call `POST /api/internal/recommendations/packs/validate` with a safe QA pack payload after enabling `RECOMMENDATION_QA_TOOLS_ENABLED=true`
   - optional QA threshold evaluation: inspect `evaluation.overallStatus` and `evaluation.thresholds[]` from the same QA pack validation response
4. Enable `RECOMMENDATION_SMART_RANKING_ENABLED=true`.
5. Monitor recommendation event volume and storefront render behavior.

## Phase 3 Direction

Future Phase 3 topics:

- sponsored ranking
- ads campaign inventory
- budget-aware placement rules
- richer session intent modeling
