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

## Rollout

1. Deploy backend and frontend with the new additive code.
2. Keep `RECOMMENDATION_SMART_RANKING_ENABLED=false` for first deploy if you want a dark launch.
3. Verify:
   - `GET /api/public/recommendations/home`
   - `GET /api/public/recommendations/products/:id/similar`
   - `GET /api/public/recommendations/search?q=...`
4. Enable `RECOMMENDATION_SMART_RANKING_ENABLED=true`.
5. Monitor recommendation event volume and storefront render behavior.

## Phase 3 Direction

Future Phase 3 topics:

- sponsored ranking
- ads campaign inventory
- budget-aware placement rules
- richer session intent modeling
