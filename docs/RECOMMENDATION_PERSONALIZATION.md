# Recommendation Personalization

## Phase 5.1 scope

Phase 5.1 adds a lightweight behavior-personalization foundation for the active `backend-nest` and `frontend-next` recommendation stack.

It is intentionally:

- rule-based, not ML-driven
- additive, not a replacement for organic relevance
- bounded, so it cannot dominate core ranking quality
- internal and privacy-safe
- disabled by default

Out of scope:

- model training
- embeddings or vector search
- collaborative filtering
- user profile marketing exports
- payment, checkout, order, shipping, or WB sync changes

## Flags

Backend:

- `RECOMMENDATION_PERSONALIZATION_ENABLED=true`
- `RECOMMENDATION_EXPLAINABILITY_ENABLED=true` for internal score debugging

Frontend:

- no new public flag is required for customers
- internal explainability still depends on existing recommendation debug flag wiring

If `RECOMMENDATION_PERSONALIZATION_ENABLED=false`:

- public recommendation APIs still work normally
- existing rule-based ranking remains active
- personalization breakdown scores stay `0`
- sponsored safety, CPC charging, wallet checks, and budget checks remain unchanged

## Behavior signals

Phase 5.1 reuses existing safe tracking primitives instead of introducing sensitive profile storage.

Tracked or reused behavior events:

- `product_view` via `POST /api/public/tracking/product-view`
- `search_query` via `POST /api/public/tracking/search`
- `recommendation_impression` via `POST /api/public/recommendations/events`
- `recommendation_click` via `POST /api/public/recommendations/events`

Derived signal:

- `category_interest`
  - not stored as a raw separate public payload
  - derived internally from recent product views, clicked recommendation products, and public search terms

Stored behavior remains limited to safe fields already used by the app, such as:

- `productId`
- safe public search text
- `algorithm`
- `placement` / `scenarioType`
- timestamps
- authenticated `customerId` or anonymous `guestSessionId`

The system must not expose:

- raw user ids in recommendation responses
- guest session ids in recommendation responses
- cookies
- payment or billing internals
- private seller-only metadata

## Scoring model

Base ranking remains `rule_based_v2`.

Phase 5.1 adds a bounded additive personalization layer:

```text
finalScore =
  categoryScore
  + textScore
  + popularityScore
  + freshnessScore
  + ratingScore
  + stockScore
  + shopScore
  + personalizationScore
  + sponsoredBoostScore
  + businessBoostScore
  - penaltyScore
```

Personalization sub-scores:

- `recentViewScore`
  - derived from recent viewed-product affinity
  - considers exact-product revisit plus lightweight brand/color carryover
- `categoryAffinityScore`
  - derived from repeated viewed or clicked category signals
- `searchIntentScore`
  - derived from recent normalized public search tokens
- `clickAffinityScore`
  - derived from previously clicked recommendation products/categories/brand/color

Safety rules:

- all sub-scores are bounded
- total `personalizationScore` is capped internally
- time decay reduces the impact of older behavior
- no-behavior sessions safely fall back to non-personalized ranking
- sponsored campaign eligibility and charging protections still run separately

## Explainability

Internal explainability can now include:

- `personalizationScore`
- `recentViewScore`
- `categoryAffinityScore`
- `searchIntentScore`
- `clickAffinityScore`

These are available only when:

- the request uses `debug=true`
- the backend has `RECOMMENDATION_EXPLAINABILITY_ENABLED=true`

Explainability remains safe because it exposes only score components and generic reasons, not raw actor history.

## Sponsored interaction

Personalization does not bypass sponsored safety rules.

Still enforced:

- sponsored ranking can remain disabled independently
- out-of-stock or inactive products cannot be boosted
- CPC charging still depends on valid sponsored tracking tokens
- budget exhaustion still blocks further chargeable serving
- insufficient wallet still blocks charging
- idempotent click charging still prevents double billing

## Local QA

1. Set backend flags:
   - `RECOMMENDATION_PERSONALIZATION_ENABLED=true`
   - `RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
   - optionally `RECOMMENDATION_QA_TOOLS_ENABLED=true`
2. Open a public page and generate behavior:
   - visit a few product detail pages
   - run a few product searches
   - click recommendation items
3. Re-open:
   - `/`
   - `/products?q=...`
   - a product detail page with similar recommendations
4. Confirm internal explainability shows non-zero personalization components only when debug/internal flags are enabled.
5. If QA tools are enabled, open `/admin/recommendations-qa` and compare ranking output before and after behavior generation.

## Remaining gaps

Phase 5.1 does not include:

- analytics dashboards
- seller-facing recommendation reports
- persisted user-profile management
- cross-device identity stitching
- model-based ranking
