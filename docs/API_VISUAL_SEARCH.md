# Visual Search API

## Phase 3 Scope

- Public visual product search is isolated from checkout, cart, orders, payments, shipping, WB sync, and AI Try-On.
- An optional OpenAI vision step converts the uploaded image into structured catalog attributes.
- Local CLIP creates direct image embeddings and pgvector performs cosine nearest-neighbor retrieval.
- Semantic attributes remain an optional reranking and fallback layer.
- Provider failures safely fall back to the optional `categoryHint`.

## Runtime Configuration

- `VISUAL_SEARCH_ENABLED=false`
- `PUBLIC_VISUAL_SEARCH_ENABLED=false`
- `VISUAL_SEARCH_TRACKING_ENABLED=false`
- `VISUAL_SEARCH_AI_PROVIDER=rule_based_ai_v1`
- `VISUAL_SEARCH_OPENAI_MODEL=gpt-4.1-mini`
- `VISUAL_SEARCH_OPENAI_TIMEOUT_MS=15000`
- `VISUAL_SEARCH_VECTOR_ENABLED=false`
- `VISUAL_SEARCH_VECTOR_CANDIDATE_LIMIT=500`
- `VISUAL_SEARCH_VECTOR_MIN_SCORE=0.15`
- `VISUAL_EMBEDDING_PROVIDER=mock|open_clip`
- `VISUAL_EMBEDDING_MODEL=ViT-B-32`
- `VISUAL_EMBEDDING_PRETRAINED=laion2b_s34b_b79k`
- `OPENAI_API_KEY` is required only when the provider is `openai`.

All visual-search flags remain off by default. Enable core, public exposure, and tracking separately after quality review.

## POST `/api/public/visual-search`

Request is `multipart/form-data`:

- `image`: required JPEG, PNG, or WEBP; maximum 8 MB
- `categoryHint`: optional
- `cropX`, `cropY`, `cropWidth`, `cropHeight`: optional crop metadata
- `guestSessionId`: optional; the request header is preferred

Example response:

```json
{
  "analysis": {
    "productDetected": true,
    "category": "Shorts",
    "color": "Blue",
    "gender": "female",
    "material": "polyester",
    "pattern": "solid",
    "style": "sport",
    "keywords": ["sport", "running"],
    "confidence": 0.94
  },
  "products": [],
  "matches": [
    {
      "product": {},
      "score": 94.8,
      "reasons": ["category", "color", "style", "keywords", "in_stock"]
    }
  ],
  "algorithm": "visual_search_clip_pgvector_hybrid_v3",
  "provider": "openai",
  "fallbackUsed": false,
  "vectorUsed": true,
  "visualSearchLogId": "optional-uuid"
}
```

`products` remains for backward compatibility. `matches` provides the corresponding score and match reasons.

When public visual search is disabled, the API returns empty `products` and `matches`, plus `disabled: true`. Raw image bytes and base64 are never logged or persisted by this flow.

## Matching and Safety

- Only `PUBLISHED`, active, public-ready products from active shops and approved sellers are considered.
- Vector mode compares the shopper image directly with pre-indexed product-image vectors.
- Semantic fallback uses category, color, gender, material, pattern, style, and keywords.
- Candidate limit is 500; result limit is 24.
- Ranking also considers stock, rating, and feedback, but visual/category signals carry the main weight.
- If no shoppable product is detected and no category hint exists, the API returns no candidates.

## POST `/api/public/visual-search/events`

```json
{
  "type": "impression",
  "visualSearchLogId": "optional-uuid",
  "productId": "product-uuid",
  "rank": 1,
  "score": 94.8
}
```

Tracking is best-effort and becomes a safe no-op when disabled.

## Persistence

- `VisualSearchLog` stores safe detected metadata and provider information.
- `VisualSearchEvent` stores impression/click rank and score.
- `product_image_embeddings` stores one current vector per product image with source/model fingerprints.

## POST `/api/admin/visual-search/reindex`

- Admin authentication is required.
- Optional body: `{ "limit": 100, "offset": 0 }`, maximum batch size 500.
- Use the returned `nextOffset` while `hasMore=true` to walk the full catalog deterministically.
- Downloads public-ready product image URLs through the internal embedding service.
- Skips unchanged source/update/model fingerprints and reports indexed, skipped, and failed counts.
- Invalid, missing, or unreachable source images are reported per image without aborting the batch.
- With the OpenCLIP provider, the AI service preloads model weights before its healthcheck becomes ready. `VISUAL_EMBEDDING_REQUEST_TIMEOUT_MS` controls the backend request timeout after startup.
