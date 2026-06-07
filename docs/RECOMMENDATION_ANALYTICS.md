# Recommendation Analytics

## Phase 5.3 ranking tuning bridge

Phase 5.3 reuses the Phase 5.2 analytics layer as a bounded tuning input for `rule_based_v2`.

New flag:

- `RECOMMENDATION_ANALYTICS_TUNING_ENABLED`

New internal-only tuning fields:

- `analyticsPerformanceScore`
- `ctrScore`
- `productEngagementScore`
- `algorithmPerformanceHint`
- `scenarioPerformanceHint`
- `analyticsSignalsUsed`
- `analyticsTuningEnabled`

Safety notes:

- public read APIs remain backward compatible
- normal public responses do not expose analytics tuning internals
- tuning fields appear only in internal explainability or QA/debug workflows
- analytics tuning stays additive, bounded, and subordinate to organic relevance
- sponsored CPC, wallet, and budget protections remain unchanged

## Phase 5.2 scope

Phase 5.2 adds a practical recommendation analytics layer for the active NestJS + Next.js stack only.

Included:

- admin analytics APIs and dashboard
- seller-safe shop-scoped analytics API and dashboard
- aggregation from existing `RecommendationEvent` tracking data
- metrics for impressions, clicks, CTR, sponsored behavior, charged CPC amount, and tracked personalization performance

Out of scope:

- BI tooling
- ML training
- vector search
- checkout, order, payment, shipping, WB sync, and AI Try-On changes

## Metrics

Overview metrics:

- total recommendation impressions
- total recommendation clicks
- CTR = `clicks / impressions * 100`
- sponsored impressions
- sponsored clicks
- sponsored CTR
- sponsored charged amount from successful sponsored CPC charges

Breakdown metrics:

- by algorithm
- by scenario type: `home`, `similar`, `search`
- top recommended products
- top clicked products

Tracked personalization metrics:

- tracked personalized impressions/clicks
- tracked non-personalized impressions/clicks
- personalized CTR
- non-personalized CTR

Limitation:

- personalization analytics is only as complete as the tracked `personalized` event marker
- no raw profile, user, or session history is exposed

## Privacy rules

Analytics responses never expose:

- raw `userId`
- raw `customerId`
- raw `guestSessionId`
- cookies
- private tracking payloads
- internal score breakdowns from public recommendation responses

Analytics uses aggregate event data only.

## API surface

Admin:

- `GET /api/admin/recommendations/analytics/overview`
- `GET /api/admin/recommendations/analytics/algorithms`
- `GET /api/admin/recommendations/analytics/scenarios`
- `GET /api/admin/recommendations/analytics/products`

Seller:

- `GET /api/seller/shops/:shopId/recommendations/analytics/overview`

Supported query params:

- `range=today|last7d|last30d|custom`
- `from=<iso-date>` when `range=custom`
- `to=<iso-date>` when `range=custom`
- `limit=1..25` for top product tables

## Visibility rules

Admin visibility:

- platform-wide aggregated analytics
- all products and campaigns represented through recommendation events

Seller visibility:

- only recommendation events tied to products from the requested seller shop
- only seller-owned sponsored charge totals for that shop

## Frontend routes

- `/admin/recommendations-analytics`
- `/seller/recommendations-analytics`

Both routes use simple cards and tables only. No raw tracking identifiers are rendered.

## Local QA guide

1. Start backend and frontend locally.
2. Generate recommendation traffic from the storefront:
   - open homepage recommendation sections
   - open similar products on a product detail page
   - use search recommendations
   - click a mix of organic and sponsored recommendation cards
3. Open `/admin/recommendations-analytics` to review platform-level metrics.
4. Open `/seller/recommendations-analytics` and switch shops to verify seller scoping.
5. Compare:
   - total impressions/clicks
   - algorithm CTR
   - scenario CTR
   - top recommended vs top clicked products
   - sponsored charged amount
   - tracked personalized vs non-personalized CTR

## QA checks

- empty ranges should return zero-safe summaries
- custom date ranges should exclude events outside the window
- seller analytics should not include another seller shop's products
- public recommendation read APIs must remain backward compatible
- sponsored billing protections still rely on the same event and charge safety rules from earlier phases
