# AI Service

## Scope
`ai-service` is the dedicated FastAPI service behind AI image generation and try-on orchestration.

Current state:
- `MockImageProvider` is still the default safe provider
- `OpenAIImageProvider` is now implemented
- `backend-nest` can keep using the same HTTP contract
- no frontend calls `ai-service` directly
- current default verified runtime is `AI_SERVICE_MOCK`

## Internal Contract

### `GET /health`

```json
{
  "status": "OK",
  "ok": true,
  "service": "strawberry-ai-service",
  "aiImageProvider": "mock",
  "storageDriver": "mock",
  "openaiConfigured": false,
  "tryOnReady": false
}
```

### `POST /internal/ai-images/generate`
Required header:
- `X-Internal-Token`

Request body:
- `taskId`
- `shopId`
- `productId`
- `quantity`
- `taskType`
- `stylePreset`
- `prompt`
- `inputImages.frontImageUrl`
- `inputImages.backImageUrl`
- `inputImages.modelImageUrl`
- `callbackUrl` optional

Response body:
- `taskId`
- `status`
- `images[].url`
- `images[].storageKey`
- `images[].provider`
- `images[].width`
- `images[].height`

## Provider Selection

### `AI_IMAGE_PROVIDER=mock`
- default local/dev path
- never calls OpenAI
- keeps all current smoke flows green
- used by the verified seller runtime phase with `AI_WORKER_MODE=ai-service`

### `AI_IMAGE_PROVIDER=openai`
- requires `OPENAI_API_KEY`
- uses OpenAI Images API
- uses:
  - `images.edit` when reference images are present
  - `images.generate` when no input image is present
- automatically adjusts parameters based on whether the model is a GPT Image model (default) or DALL-E 2 (legacy fallback).
- runs a quality guard on returned binaries before responding to `backend-nest`

## OpenAI Configuration
- `OPENAI_IMAGE_MODEL`
- `OPENAI_IMAGE_SIZE`
- `OPENAI_IMAGE_QUALITY`
- `OPENAI_IMAGE_OUTPUT_FORMAT`
- `OPENAI_IMAGE_TIMEOUT_SECONDS`
- `OPENAI_IMAGE_MAX_RETRIES`
- `OPENAI_INPUT_IMAGE_MAX_BYTES`
- `OPENAI_INPUT_IMAGE_TIMEOUT_SECONDS`

## Error Behavior
`ai-service` returns clear HTTP errors to `backend-nest`:
- invalid internal token: `401`
- invalid input image download/content type/size: `400`
- generated image quality guard failure: `502`
- OpenAI bad request or moderation-style rejection: `422`
- OpenAI authentication/config issue: `502`
- OpenAI rate limit / connection / timeout: `503` or `504`

This lets `backend-nest` keep its existing task failure and credit refund behavior.

`/health` is also used by `backend-nest` to power seller-safe runtime badges for `/seller/ai-images`.

## Storage Drivers
- `mock`
- `local`
- `s3`

Notes:
- `mock` is acceptable for metadata-only test output
- `local` and `s3` are the intended storage modes for real OpenAI image bytes

## Verification

### `ai-service`
- `python -m compileall app`: pass
- `python -m pytest -q`: pass
- `GET /health`: `200`
- `POST /internal/ai-images/generate` with `AI_IMAGE_PROVIDER=mock`: `200`
- quality guard tests: pass

### `backend-nest` integration
- `npm run smoke:ai-service-integration`: pass
- `npm run smoke:ai-service-mock-images`: required for the seller runtime phase
- verified:
  - `backend-nest` uses `ai-service` instead of internal mock when configured
  - `backend-nest` still stores generated images from `ai-service`
  - task moves `PENDING -> PROCESSING -> COMPLETED`
  - attach flow still works
  - credit decreases correctly

## Optional OpenAI Smoke
Use:
- `RUN_OPENAI_SMOKE=true`
- `AI_IMAGE_PROVIDER=openai`
- `OPENAI_API_KEY=...`

Then run:
- `python scripts/smoke_openai_provider.py`

If the key is missing, the script skips instead of failing local/CI.

## Docker Note
Dockerfile remains present. If Docker daemon is not running locally, Docker runtime verification is blocked by environment, not by application code.

## Sources
- OpenAI image generation guide: https://platform.openai.com/docs/guides/image-generation/image-generation
- OpenAI Images API reference: https://platform.openai.com/docs/api-reference/images?lang=python
