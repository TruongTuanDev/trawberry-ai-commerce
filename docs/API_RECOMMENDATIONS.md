# API Recommendations

## Phase 6.2 sponsored click validity

`POST /api/public/recommendations/events` keeps its safe `204` response and now validates sponsored CPC clicks before charging.

Signed sponsored tracking tokens now contain an internal random click id and issued timestamp. The token remains opaque to clients, is never persisted raw, and is verified against product, placement, algorithm, campaign, shop, and active campaign target mapping.

Backend charge order:

1. Verify token and resolve campaign/product/shop mapping.
2. Require active, in-schedule, CPC, moderation-approved campaign.
3. Require a public-ready, in-stock product owned by the campaign shop.
4. Recheck campaign budget and seller wallet availability.
5. Reject duplicate-token, rapid session, rapid IP/user-agent, seller self-click, and admin click attempts.
6. Persist event validity.
7. Debit wallet and write one ledger row only for a valid click.
8. Mark charged only after the ledger mutation succeeds.

`RecommendationEvent` fraud metadata is private:

- `tokenHash`, `sessionHash`, `ipHash`, and `userAgentHash` are HMAC-SHA256 values
- `validityStatus` is `valid`, `invalid`, `ineligible`, `not_applicable`, or transiently `pending_validation`
- `invalidReason` and `chargeStatus` identify safe operational classifications
- raw IP, raw user-agent, and raw tracking token are not stored or returned

Campaign responses and performance responses add aggregate `totalClicks` and `invalidClicks` alongside existing `chargedClicks`, spend, and remaining budget. They do not return buyer identity or fraud hashes.

Flags and defaults:

- `ADS_INVALID_CLICK_PROTECTION_ENABLED=true`
- `ADS_SELF_CLICK_BLOCK_ENABLED=true`
- `ADS_RAPID_REPEAT_CLICK_WINDOW_SECONDS=30`
- `ADS_IP_REPEAT_CLICK_WINDOW_SECONDS=10`
- `ADS_CLICK_HASH_SALT` must be a dedicated production secret; local development has a safe documented fallback chain

The recommendation core ranking formula and CPC amount/formula are unchanged.

## Phase 6.1 campaign moderation eligibility

Live sponsored campaign targets are eligible for recommendation serving only when `moderationStatus=approved` while `ADS_MODERATION_REQUIRED_FOR_SERVING=true`.

This is an additional guard only. The core recommendation scoring formula, bounded sponsored boost calculation, organic relevance limits, target checks, schedule checks, wallet checks, and budget checks are unchanged.

The CPC click path repeats the moderation check immediately before billing. If a previously served campaign is no longer approved, tracking remains safe but the event receives `chargeStatus=campaign_not_approved`; no wallet debit or billing ledger row is created.

`ADS_MODERATION_REQUIRED_FOR_SERVING=false` is an explicit demo/development bypass. Its production-safe default is `true`.

## Phase 5.4 controlled tuning preset workflow

Phase 5.4 adds an admin-only, feature-flagged workflow for previewing and explicitly activating bounded ranking multipliers on top of `rule_based_v2`.

Feature flags, all default off:

- `RECOMMENDATION_TUNING_WORKFLOW_ENABLED`
- `RECOMMENDATION_TUNING_PRESETS_ENABLED`
- `RECOMMENDATION_TUNING_ACTIVE_PRESET_ENABLED`

Admin APIs:

- `GET /api/admin/recommendations/tuning-presets`
- `POST /api/admin/recommendations/tuning-presets`
- `GET /api/admin/recommendations/tuning-presets/:id`
- `PATCH /api/admin/recommendations/tuning-presets/:id`
- `POST /api/admin/recommendations/tuning-presets/:id/preview`
- `POST /api/admin/recommendations/tuning-presets/:id/activate`
- `POST /api/admin/recommendations/tuning-presets/:id/rollback`
- `POST /api/admin/recommendations/tuning-presets/:id/archive`

Lifecycle behavior:

- create always produces a draft version
- patch creates a new draft version instead of mutating active history
- activation is explicit and archives the previously active version
- rollback is allowed only from the active version and restores an earlier version from the same preset family
- archive removes a version from activation eligibility
- all preset mutations write their safe admin audit log in the same transaction
- detail responses include recent audit actions across the complete preset version family

Preview body:

```json
{
  "placement": "home",
  "limit": 8
}
```

For search preview, provide `q`. For similar-product preview, use `placement=product_detail` and provide `productId`.

Preview response includes current-vs-tuned ranks, scores, sponsored marker changes, safe explanations, and guardrail violations. Preview never writes recommendation events, campaign spend, CPC charges, or billing ledger entries.

Runtime safety:

- an active preset affects public recommendations only when all three tuning flags are enabled
- normal public payloads do not expose preset ids, versions, weights, guardrails, or audit data
- existing public-readiness filtering and sponsored campaign wallet/budget checks remain unchanged

## Phase 5.3 analytics-based ranking tuning

Phase 5.3 adds a bounded internal tuning layer for `rule_based_v2` while keeping public recommendation APIs backward compatible.

New backend flag:

- `RECOMMENDATION_ANALYTICS_TUNING_ENABLED`

Optional tuning bounds:

- `RECOMMENDATION_ANALYTICS_MIN_EVENTS_FOR_CTR_BOOST`
- `RECOMMENDATION_ANALYTICS_MIN_CLICKS_FOR_ENGAGEMENT_BOOST`
- `RECOMMENDATION_ANALYTICS_MAX_BOOST`
- `RECOMMENDATION_ANALYTICS_MAX_CTR_BOOST`
- `RECOMMENDATION_ANALYTICS_LOW_CTR_PENALTY`
- `RECOMMENDATION_ANALYTICS_MAX_ENGAGEMENT_BOOST`

Internal-only explainability additions:

- `scoreExplanation.analyticsSignalsUsed`
- `scoreExplanation.analyticsTuningEnabled`
- `scoreBreakdown.analyticsPerformanceScore`
- `scoreBreakdown.ctrScore`
- `scoreBreakdown.productEngagementScore`
- `scoreBreakdown.engagementScore`
- `scoreBreakdown.algorithmPerformanceHint`
- `scoreBreakdown.scenarioPerformanceHint`

Visibility rules:

- normal public recommendation responses still do not expose analytics tuning fields
- these fields appear only when:
  - request uses `debug=true`
  - backend runtime sets `RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
- internal QA comparison and snapshot tooling may also show the same safe fields

Safety guarantees:

- no raw user ids, guest session ids, cookies, or private tracking payloads are exposed
- analytics tuning is additive and bounded
- sparse or low-data products are not heavily penalized
- sponsored ranking, CPC charging, wallet checks, budget checks, and personalization all remain intact

## Phase 5.2 recommendation analytics dashboard

Phase 5.2 adds internal marketplace analytics for existing recommendation behavior while keeping public recommendation APIs backward compatible.

Analytics data source:

- existing `RecommendationEvent` records

Supported metrics:

- impressions
- clicks
- CTR
- sponsored impressions/clicks/CTR
- sponsored charged amount
- algorithm breakdown
- scenario breakdown
- top recommended products
- top clicked products
- tracked personalized vs non-personalized performance

Privacy guarantees:

- no raw user ids
- no guest session ids
- no cookies
- no raw private tracking payloads

### `GET /api/admin/recommendations/analytics/overview`

Purpose:

- platform-level summary metrics for recommendation performance

Query params:

- `range=today|last7d|last30d|custom`
- `from=<iso-date>` when `range=custom`
- `to=<iso-date>` when `range=custom`

Response fields:

- `range`
- `summary.overall`
- `summary.sponsored`
- `summary.personalization`

### `GET /api/admin/recommendations/analytics/algorithms`

Purpose:

- aggregate recommendation performance by algorithm

Response fields:

- `range`
- `items[]`
  - `algorithm`
  - `impressions`
  - `clicks`
  - `ctr`
  - `sponsoredImpressions`
  - `sponsoredClicks`
  - `sponsoredCtr`
  - `chargedAmount`
  - `trackedPersonalizedImpressions`
  - `trackedPersonalizedClicks`
  - `trackedPersonalizedCtr`

### `GET /api/admin/recommendations/analytics/scenarios`

Purpose:

- aggregate recommendation performance by scenario

Response fields:

- `range`
- `items[]`
  - `scenarioType`
  - `impressions`
  - `clicks`
  - `ctr`
  - `sponsoredImpressions`
  - `sponsoredClicks`
  - `sponsoredCtr`
  - `chargedAmount`

### `GET /api/admin/recommendations/analytics/products`

Purpose:

- show top recommended and top clicked products for the selected range

Query params:

- same range filters as overview
- `limit=1..25`

Response fields:

- `range`
- `topRecommendedProducts[]`
- `topClickedProducts[]`

Each product row includes only safe public summary fields plus aggregate metrics:

- `productId`
- `productName`
- `shopId`
- `shopName`
- `impressions`
- `clicks`
- `ctr`
- `sponsoredImpressions`
- `sponsoredClicks`
- `sponsoredCtr`
- `chargedAmount`

### `GET /api/seller/shops/:shopId/recommendations/analytics/overview`

Purpose:

- seller-safe shop-scoped recommendation analytics

Behavior:

- protected by existing seller auth plus shop ownership access
- only events for products owned by the requested shop are included

Response fields:

- `shopId`
- `shopName`
- `range`
- `summary`
- `algorithms`
- `scenarios`
- `topRecommendedProducts`
- `topClickedProducts`

## Phase 5.1 behavior personalization foundation

Phase 5.1 adds a safe lightweight personalization layer to `rule_based_v2` while keeping the public recommendation contract backward compatible.

New backend flag:

- `RECOMMENDATION_PERSONALIZATION_ENABLED`

Behavior signals reused by the recommendation stack:

- `POST /api/public/tracking/product-view`
- `POST /api/public/tracking/search`
- `POST /api/public/recommendations/events` for:
  - `impression`
  - `click`

Personalization behavior:

- supports authenticated `customerId` or anonymous `guestSessionId`
- uses time-decayed recent views, search intent, and recommendation click affinity
- remains additive and bounded
- falls back safely when no usable behavior exists

Internal-only explainability additions:

- `scoreBreakdown.personalizationScore`
- `scoreBreakdown.recentViewScore`
- `scoreBreakdown.categoryAffinityScore`
- `scoreBreakdown.searchIntentScore`
- `scoreBreakdown.clickAffinityScore`

These fields are visible only when:

- request query includes `debug=true`
- backend runtime sets `RECOMMENDATION_EXPLAINABILITY_ENABLED=true`

Privacy and safety:

- no raw user ids, guest session ids, cookies, or private history payloads are returned in public recommendation responses
- personalization does not bypass sponsored eligibility, wallet checks, CPC charging, budget checks, or idempotency protection
- `category_interest` is treated as an internal derived signal, not a new public payload surface

Anonymous personalization:

- public recommendation `GET` requests now safely accept the existing `x-guest-session-id` header
- frontend uses that header when available so behavior can improve later requests for anonymous sessions

Out of scope for Phase 5.1:

- machine-learning ranking
- vector search
- collaborative filtering
- recommendation analytics dashboards
- checkout, payment, shipping, or WB sync changes

## Phase 4.3 recommendation attribution update

Recommendation tracking now supports the V1 sponsored campaign billing loop while keeping public read APIs backward compatible.

Public response additions:

- recommendation items may include `sponsored: true`
- sponsored items may also include a safe opaque `trackingToken`

Public tracking additions:

- `POST /api/public/recommendations/events` now accepts optional:
  - `idempotencyKey`
  - `sponsored`
  - `trackingToken`

Safety rules:

- public payloads still do not expose wallet balances, campaign budget details, or seller billing internals
- the backend never trusts client-supplied cost data
- CPC cost is calculated on the backend only
- idempotency is enforced via `idempotencyKey`

## Phase 2 and Phase 3.3 Scope

This document covers the Phase 2 smart ranking rollout plus the Phase 3 sponsored ranking foundation through Phase 3.3 campaign-readiness contract finalization for public product recommendations.

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
- `RECOMMENDATION_SPONSORED_RANKING_ENABLED`
- `RECOMMENDATION_SPONSORED_PRESET_ID`

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
  + sponsoredBoostScore
  + businessBoostScore
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
- `sponsoredBoostScore`: rollout-safe additive boost, capped internally
- `businessBoostScore`: rollout-safe additive boost, capped internally

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

Internal-only sponsored diagnostics:

- `scoreBreakdown.sponsoredBoostScore`
- `scoreBreakdown.businessBoostScore`
- `scoreBreakdown.maxSponsoredBoost`
- `scoreExplanation.sponsoredReason`

These fields are only visible through internal explainability and QA tooling. They are not part of the normal public recommendation payload.

Explainability mode:

- internal explainability is disabled by default
- to include per-item score explanations, both of these must be true:
  - request query includes `debug=true`
  - backend runtime sets `RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
- explainability never returns customer IDs, guest session IDs, raw search queries, or raw view history

Sponsored ranking foundation:

- sponsored/business-aware ranking stays disabled by default
- to enable the Phase 3.1 foundation locally:
  - set `RECOMMENDATION_SPONSORED_RANKING_ENABLED=true`
- optional rollout-safe env configuration:
  - `RECOMMENDATION_SPONSORED_PRODUCT_IDS`
  - `RECOMMENDATION_BUSINESS_BOOST_SHOP_IDS`
  - `RECOMMENDATION_SPONSORED_PRODUCT_BOOST`
  - `RECOMMENDATION_BUSINESS_SHOP_BOOST`
  - `RECOMMENDATION_SPONSORED_MAX_BOOST`
- boost behavior is intentionally limited:
  - additive only
  - bounded by `RECOMMENDATION_SPONSORED_MAX_BOOST`
  - further capped relative to the product's organic relevance score
  - cannot fully replace core relevance signals
- out-of-stock, inactive, unpublished, archived, or otherwise not public-safe products are not eligible for sponsored/business boost
- public recommendation payloads do not expose raw sponsored config, env values, or internal target lists
- internal explainability can show safe sponsored diagnostics only when:
  - `debug=true`
  - `RECOMMENDATION_EXPLAINABILITY_ENABLED=true`

Managed sponsored rollout presets:

- sponsored ranking still stays disabled by default
- preset metadata is code-managed and internal-only, not seller-managed and not database-managed
- current preset ids:
  - `conservative`
  - `balanced`
  - `aggressive-internal-only`
  - `stock-safe`
  - `search-safe`
- select the active preset with:
  - `RECOMMENDATION_SPONSORED_PRESET_ID=<preset-id>`
- if the preset id is invalid, the backend safely falls back to `balanced`
- each preset defines safe metadata:
  - `id`
  - `name`
  - `description`
  - `version`
  - `stability`
  - `maxSponsoredBoost`
  - `maxBusinessBoost`
  - `allowedScenarioTypes`
  - `notes`
- each preset also defines bounded internal default boost values that are still clamped by:
  - preset-level max caps
  - the global configured max cap
  - organic relevance ratio limits already enforced by Phase 3.1
- scenario restrictions are enforced:
  - a preset can be selected globally
  - but it only becomes active for the scenarios listed in `allowedScenarioTypes`
  - for example, `search-safe` is intended for `search` only
- public recommendation payloads never expose:
  - internal preset ids
  - sponsored target product ids
  - business target shop ids
  - raw env var names or values
- internal explainability and QA can show safe preset metadata only when internal flags allow it

Campaign and billing readiness contract:

- Phase 3.3 does not add campaign CRUD, billing ledgers, budget deduction, or seller ads UI
- instead, it stabilizes the internal recommendation-side contract that future campaign and billing modules can plug into
- internal-only sponsored contract fields now include placeholders such as:
  - `campaignId`
  - `sponsorType`
  - `scenarioType`
  - `billingMode`
  - `rolloutMode`
  - `maxBoost`
- internal-only campaign-readiness fields now include:
  - `sponsoredEligible`
  - `sponsoredBoostApplied`
  - `sponsoredBoostScore`
  - `sponsoredReason`
  - `sponsoredPresetId`
  - `campaignReadinessStatus`
  - `billingMode`
  - `rolloutMode`
- these fields are placeholders for future integration only:
  - no billing charges are created
  - no wallet or ledger rows are created
  - no impression pricing or click pricing is enforced yet
  - no budget throttling is enforced yet
- normal public recommendation payloads still do not expose campaign or billing internals

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
- QA preset and baseline catalog metadata is now versioned for safer handoff:
  - `version`
  - `updatedAt`
  - `owner`
  - `notes`
  - `stability`
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
          "penaltyScore": 0,
          "sponsoredBoostScore": 0,
          "businessBoostScore": 0,
          "maxSponsoredBoost": 0
        },
        "sponsoredReason": null,
        "sponsoredPreset": {
          "id": "balanced",
          "name": "Balanced",
          "description": "Default internal rollout preset with moderate boosts and bounded scenario coverage.",
          "version": "1.0.0",
          "stability": "stable",
          "maxSponsoredBoost": 5,
          "maxBusinessBoost": 2,
          "allowedScenarioTypes": ["home", "similar", "search"],
          "notes": "Recommended preset for most QA comparisons and initial staged rollout checks."
        },
        "campaignReadiness": {
          "sponsoredEligible": true,
          "sponsoredBoostApplied": false,
          "sponsoredBoostScore": 0,
          "sponsoredReason": null,
          "sponsoredPresetId": "balanced",
          "campaignReadinessStatus": "eligible",
          "billingMode": "none",
          "rolloutMode": "internal"
        },
        "sponsoredCampaign": {
          "campaignId": null,
          "sponsorType": "campaign",
          "maxBoost": 5,
          "scenarioType": "home",
          "billingMode": "none",
          "rolloutMode": "internal"
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
- compare and snapshot responses can include safe root-level sponsored ranking metadata for QA:
      - `sponsoredRankingEnabled`
      - `activePreset`
- item-level explainability can also include campaign-readiness placeholders only in internal mode:
  - `campaignReadiness`
  - `sponsoredCampaign`

Response example:

```json
{
  "placement": "home",
  "sponsoredRanking": {
    "sponsoredRankingEnabled": true,
    "activePreset": {
      "id": "balanced",
      "name": "Balanced",
      "description": "Default internal rollout preset with moderate boosts and bounded scenario coverage.",
      "version": "1.0.0",
      "stability": "stable",
      "maxSponsoredBoost": 5,
      "maxBusinessBoost": 2,
      "allowedScenarioTypes": ["home", "similar", "search"],
      "notes": "Recommended preset for most QA comparisons and initial staged rollout checks."
    }
  },
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
          "penaltyScore": 0,
          "sponsoredBoostScore": 0,
          "businessBoostScore": 0,
          "maxSponsoredBoost": 0
        },
        "sponsoredReason": null,
        "sponsoredPreset": {
          "id": "balanced",
          "name": "Balanced",
          "description": "Default internal rollout preset with moderate boosts and bounded scenario coverage.",
          "version": "1.0.0",
          "stability": "stable",
          "maxSponsoredBoost": 5,
          "maxBusinessBoost": 2,
          "allowedScenarioTypes": ["home", "similar", "search"],
          "notes": "Recommended preset for most QA comparisons and initial staged rollout checks."
        },
        "campaignReadiness": {
          "sponsoredEligible": true,
          "sponsoredBoostApplied": false,
          "sponsoredBoostScore": 0,
          "sponsoredReason": null,
          "sponsoredPresetId": "balanced",
          "campaignReadinessStatus": "eligible",
          "billingMode": "none",
          "rolloutMode": "internal"
        },
        "sponsoredCampaign": {
          "campaignId": null,
          "sponsorType": "campaign",
          "maxBoost": 5,
          "scenarioType": "home",
          "billingMode": "none",
          "rolloutMode": "internal"
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
  "sponsoredRanking": {
    "sponsoredRankingEnabled": true,
    "activePreset": {
      "id": "search-safe",
      "name": "Search safe",
      "description": "Search-focused preset with tighter caps to avoid overwhelming keyword relevance.",
      "version": "1.0.0",
      "stability": "stable",
      "maxSponsoredBoost": 3,
      "maxBusinessBoost": 1,
      "allowedScenarioTypes": ["search"],
      "notes": "Use for keyword-driven recommendation audits where intent stability matters most."
    }
  },
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
          "penaltyScore": 0,
          "sponsoredBoostScore": 0,
          "businessBoostScore": 0,
          "maxSponsoredBoost": 0
        },
        "sponsoredReason": null,
        "sponsoredPreset": {
          "id": "search-safe",
          "name": "Search safe",
          "description": "Search-focused preset with tighter caps to avoid overwhelming keyword relevance.",
          "version": "1.0.0",
          "stability": "stable",
          "maxSponsoredBoost": 3,
          "maxBusinessBoost": 1,
          "allowedScenarioTypes": ["search"],
          "notes": "Use for keyword-driven recommendation audits where intent stability matters most."
        },
        "campaignReadiness": {
          "sponsoredEligible": true,
          "sponsoredBoostApplied": false,
          "sponsoredBoostScore": 0,
          "sponsoredReason": null,
          "sponsoredPresetId": "search-safe",
          "campaignReadinessStatus": "eligible",
          "billingMode": "none",
          "rolloutMode": "internal"
        },
        "sponsoredCampaign": {
          "campaignId": null,
          "sponsorType": "campaign",
          "maxBoost": 3,
          "scenarioType": "search",
          "billingMode": "none",
          "rolloutMode": "internal"
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
        "penaltyScore": 0,
        "sponsoredBoostScore": 0,
        "businessBoostScore": 0,
        "maxSponsoredBoost": 0
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
  - `version`
  - `updatedAt`
  - `owner`
  - `notes`
  - `stability`
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
  - `version`
  - `updatedAt`
  - `owner`
  - `notes`
  - `stability`
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

### `GET /api/internal/recommendations/sponsored-presets`

Purpose:

- return the safe internal sponsored rollout preset catalog used by Phase 3.2
- help QA inspect preset caps and scenario coverage before enabling sponsored ranking locally

Behavior:

- returns `404` when `RECOMMENDATION_QA_TOOLS_ENABLED` is off
- returns allowlisted metadata only:
  - `sponsoredRankingEnabled`
  - `activePreset`
  - `presets[]`
- does not return:
  - sponsored target product ids
  - business target shop ids
  - raw env vars
  - cookies
  - session ids
  - user ids
  - private tracking payloads

Local sponsored preset QA workflow:

1. Keep `RECOMMENDATION_QA_TOOLS_ENABLED=true`.
2. Keep `NEXT_PUBLIC_RECOMMENDATION_QA_TOOLS_ENABLED=true`.
3. Optional explainability:
   - `RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
   - `NEXT_PUBLIC_RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
4. Enable sponsored ranking only when you are actively auditing it:
   - `RECOMMENDATION_SPONSORED_RANKING_ENABLED=true`
5. Choose a preset:
   - `RECOMMENDATION_SPONSORED_PRESET_ID=conservative`
   - `RECOMMENDATION_SPONSORED_PRESET_ID=balanced`
   - `RECOMMENDATION_SPONSORED_PRESET_ID=aggressive-internal-only`
   - `RECOMMENDATION_SPONSORED_PRESET_ID=stock-safe`
   - `RECOMMENDATION_SPONSORED_PRESET_ID=search-safe`
6. Open `/admin/recommendations-qa`.
7. Review the active preset metadata and allowed scenarios.
8. Run the same saved scenario before and after the sponsored flag/preset change.
9. Export snapshots and diff them with the existing Phase 2 QA workflow.
10. Never expose preset/catalog metadata on public storefront pages or seller-facing tooling.

Campaign and billing integration handoff:

- Recommendation is now ready for future Campaign/Billing integration on the recommendation side.
- Implemented now:
  - bounded sponsored ranking hooks
  - internal sponsored preset contract
  - internal campaign-readiness placeholder contract
  - internal explainability and QA visibility for those placeholders
  - continued public response backward compatibility
- Intentionally not implemented yet:
  - campaign CRUD
  - seller ads UI
  - wallet or billing ledger
  - impression/click charging
  - budget enforcement
  - billing reconciliation
- Backward-compatible APIs that must stay stable:
  - `GET /api/public/recommendations/home`
  - `GET /api/public/recommendations/products/:productId/similar`
  - `GET /api/public/recommendations/search?q=...&limit=12`

Phase 2.8 readiness notes:

- treat preset and catalog `version` fields as the lightweight audit handle when sharing internal QA results
- prefer `stability=stable` presets/catalog entries for signoff and rollout-readiness checks
- keep `experimental` entries for exploratory tuning only
- when updating a preset or catalog entry:
  - bump `version`
  - refresh `updatedAt`
  - leave clear `notes` about the intended QA use
  - do not replace committed mock snapshots with real storefront exports

Sponsored ranking QA workflow:

1. Keep `RECOMMENDATION_SPONSORED_RANKING_ENABLED=false` for the default deploy path.
2. Use Phase 2 internal QA flags first:
   - `RECOMMENDATION_QA_TOOLS_ENABLED=true`
   - `NEXT_PUBLIC_RECOMMENDATION_QA_TOOLS_ENABLED=true`
3. Optional internal explainability:
   - `RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
   - `NEXT_PUBLIC_RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
4. Export a baseline snapshot with sponsored ranking still off.
5. Enable sponsored ranking and set a small bounded local config.
6. Export the same scenario again.
7. Use snapshot diff and QA pack validation before rollout:
   - compare rank movement
   - inspect `sponsoredBoostScore` and `businessBoostScore`
   - confirm moved-down counts and score deltas stay within the chosen preset thresholds
8. Only use stable preset/catalog combinations for rollout-readiness signoff.
9. Never commit real exported production snapshots or raw sponsored target lists.

Phase 2 final local QA checklist:

1. Enable internal flags:
   - `RECOMMENDATION_QA_TOOLS_ENABLED=true`
   - `NEXT_PUBLIC_RECOMMENDATION_QA_TOOLS_ENABLED=true`
2. Optional explainability:
   - `RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
   - `NEXT_PUBLIC_RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
3. Start backend and frontend locally.
4. Open `/admin/recommendations-qa`.
5. Choose a stable preset and review its version/stability metadata.
6. Load a baseline catalog entry and review its version/stability metadata.
7. Validate the pack and confirm threshold evaluation stays within the expected audit envelope.
8. Run the snapshot diff and export the Markdown summary for internal review.
9. If tuning weights again, repeat the same preset/catalog combination so comparisons stay consistent.

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

- ads campaign inventory
- budget-aware placement rules
- richer session intent modeling
- rollout-safe ranking configuration management beyond code-managed internal presets

Phase 3.3 out of scope:

- no full ads management dashboard
- no billing, budget pacing, campaign scheduling, or auction logic
- no seller self-serve ads UI
- no public disclosure of sponsored configuration internals
- no checkout, order, cart, payment, shipping, WB sync, AI Try-On, or legacy app changes

Recommended Phase 4 roadmap:

- Phase 4.1: Campaign Management Foundation
- Phase 4.2: Seller Wallet / Billing Ledger
- Phase 4.3: Sponsored Impression/Click Attribution
- Phase 4.4: Budget Enforcement
- Phase 4.5: Campaign Analytics Dashboard

## Ads wallet top-up integration note

Ads Phase 6.4 adds manual seller wallet top-up outside the recommendation ranking path. Only admin-confirmed requests increase the existing spendable wallet balance. Pending, rejected, and cancelled requests do not affect sponsored eligibility. Recommendation core ranking, sponsored boost calculation, CPC pricing, and invalid-click protection are unchanged.
