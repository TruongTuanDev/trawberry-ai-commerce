# Visual Search API

## Phase 1 Scope

- Public visual product search is additive and isolated from checkout, cart, order, payment, shipping, WB sync, and AI Try-On flows.
- Phase 1 uses rule-based product matching with an optional OpenAI vision analysis step.
- If AI analysis is disabled or fails, the API falls back safely to `categoryHint` plus empty keywords.

## Feature Flags

- `VISUAL_SEARCH_ENABLED`
- `PUBLIC_VISUAL_SEARCH_ENABLED`
- `VISUAL_SEARCH_TRACKING_ENABLED`
- `NEXT_PUBLIC_VISUAL_SEARCH_ENABLED`

Recommended rollout:

1. Deploy with every visual-search flag off.
2. Enable `VISUAL_SEARCH_ENABLED=true`.
3. Enable `PUBLIC_VISUAL_SEARCH_ENABLED=true` for storefront exposure.
4. Enable `VISUAL_SEARCH_TRACKING_ENABLED=true` after response quality is confirmed.

## Architecture

- Frontend public header camera button is hidden unless visual search is enabled.
- Frontend modal uploads one cropped image region plus an optional category hint.
- Backend validates image mime and size, analyzes the image through a safe provider abstraction, and never blocks the shopper with a provider-originated `500`.
- Backend searches only public-ready products already visible in the marketplace.
- Tracking writes are best-effort and degrade safely.

## POST `/api/public/visual-search`

Request:

- `multipart/form-data`
- `image` required
- `categoryHint` optional
- `cropX` optional
- `cropY` optional
- `cropWidth` optional
- `cropHeight` optional
- `guestSessionId` optional

Response:

```json
{
  "analysis": {
    "category": "Шорты",
    "color": "Blue",
    "gender": "female",
    "keywords": ["спорт", "running"]
  },
  "products": [],
  "algorithm": "visual_search_rule_based_v1",
  "visualSearchLogId": "optional-uuid"
}
```

Disabled response behavior:

- Returns a safe payload with `products: []`
- Can include `disabled: true`
- Never changes normal text search behavior

Validation:

- supported mime types: `image/jpeg`, `image/png`, `image/webp`
- max file size: `8MB`
- uploaded bytes are processed in memory in Phase 1
- raw image bytes/base64 are never logged

## POST `/api/public/visual-search/events`

Request body:

```json
{
  "type": "impression",
  "visualSearchLogId": "optional-uuid",
  "productId": "product-uuid",
  "rank": 1,
  "score": 88.5
}
```

Behavior:

- best-effort tracking only
- safe no-op when tracking is disabled

## Matching Rules

- only `PUBLISHED`, active, public-ready products are considered
- archived, unpublished, and non-visible products are excluded
- score inputs include category, category hint, color, keywords, and stock availability
- max result count: `24`

## Persistence

Phase 1 additive Prisma models:

- `VisualSearchLog`
- `VisualSearchEvent`

## Future Phase 2

- image embeddings
- vector search
- stronger product-region detection
- hybrid ranking between semantic similarity and catalog/business signals
