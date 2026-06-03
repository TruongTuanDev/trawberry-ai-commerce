# API Recommendations

## Phase 1 Scope

This document covers the additive Smart Product Discovery / Recommendation Phase 1 foundation.

Safety guarantees:

- checkout, cart, order, payment, shipping, seller orders, WB sync, and AI Try-On flows are unchanged
- all recommendation APIs are public-read/public-track only
- tracking endpoints are fail-safe and return `204` even when disabled or when logging fails
- recommendation responses fall back to empty arrays instead of surfacing `500` errors to the storefront

Feature flags:

- `RECOMMENDATIONS_ENABLED`
- `PUBLIC_RECOMMENDATIONS_ENABLED`
- `RECOMMENDATION_TRACKING_ENABLED`

If the relevant flag is off:

- public recommendation sections stay hidden
- storefront tracking requests are skipped
- backend tracking endpoints no-op safely
- recommendation read endpoints return empty lists

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

- validates DTO input
- logs hashed IP only, never raw IP
- attaches `customerId` when the customer session is present
- stores additive analytics rows in `product_view_logs`
- returns `204`

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

Behavior:

- validates DTO input
- normalizes the query for later analytics
- stores additive analytics rows in `search_logs`
- returns `204`

### `POST /api/public/recommendations/events`

Body:

```json
{
  "type": "impression",
  "placement": "product_detail",
  "productId": "uuid",
  "sourceProductId": "uuid",
  "algorithm": "rule_based_v1",
  "rank": 0,
  "score": 12.5,
  "guestSessionId": "uuid-or-stable-client-id"
}
```

Behavior:

- supports `impression` and `click`
- stores additive analytics rows in `recommendation_events`
- returns `204`

## Recommendation Read APIs

### `GET /api/public/recommendations/home?limit=12`

Response:

```json
{
  "algorithm": "rule_based_v1",
  "items": [
    {
      "id": "uuid",
      "name": "Product title"
    }
  ]
}
```

Selection rules:

- only public-ready products already valid for the storefront
- prefers in-stock products
- prefers newly published or recently updated products
- boosts rating and feedback count when present
- returns `[]` on query failure

### `GET /api/public/recommendations/products/:productId/similar?limit=12`

Response shape matches the home API.

Selection rules:

- excludes the source product
- only returns public-ready products
- prioritizes same `categoryId`
- then `categoryName`
- then `sourceCategoryName`
- then matching `brand` / `color`
- boosts in-stock and fresher products
- returns `[]` on query failure or missing source product

## Persistence

New additive Prisma models:

- `ProductViewLog`
- `SearchLog`
- `RecommendationEvent`

Deployment notes:

- the migration is additive only
- no existing checkout/order/cart tables are modified
- production should run the new migration or equivalent additive schema apply before enabling the flags
