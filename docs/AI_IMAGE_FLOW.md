# AI Image Flow

## End-to-End Path
The AI image pipeline now spans:
- `frontend-next`
- `backend-nest`
- `ai-service`

Flow:
1. seller creates a task from `frontend-next`
   - `/seller/ai-images`
   - or `/seller/products/[id]/images`
2. `frontend-next` calls `backend-nest`
3. `backend-nest` validates shop access, product ownership, image ownership, and credits
4. `backend-nest` stores the task as `PENDING`
5. worker moves task to `PROCESSING`
6. worker calls `ai-service`
7. `ai-service` chooses a provider:
   - `MockImageProvider`
   - `OpenAIImageProvider`
8. `ai-service` returns generated image metadata
9. `backend-nest` stores results in `ai_generated_images`
10. task becomes `COMPLETED` or `FAILED`
11. `frontend-next` polls task status and renders generated images
12. seller can attach a generated image back into `product_images` as `AI_GENERATED`

## Default Verified Runtime

- compose/runtime default for verification:
  - `backend-nest`: `AI_WORKER_MODE=ai-service`
  - `ai-service`: `AI_IMAGE_PROVIDER=mock`
  - `ai-service`: `STORAGE_DRIVER=mock`
- this proves the seller task path goes through `ai-service` without using OpenAI billing

## Optional OpenAI Runtime

Real OpenAI remains opt-in only:
- enable `RUN_OPENAI_SMOKE=true`
- set `AI_IMAGE_PROVIDER=openai`
- provide `OPENAI_API_KEY`
- run dedicated smoke only

If billing, quota, auth, or storage fails:
- the smoke must fail
- default mock-safe verification remains unchanged

## AI Service Provider Branches

### `AI_IMAGE_PROVIDER=mock`
- never calls OpenAI
- used by default local/dev flows
- keeps smoke tests deterministic

### `AI_IMAGE_PROVIDER=openai`
- requires `OPENAI_API_KEY`
- if reference images exist:
  - `ai-service` downloads them with timeout and size guard
  - provider calls OpenAI `images.edit`
- if no reference image exists:
  - provider calls OpenAI `images.generate`
- output bytes are stored via:
  - `STORAGE_DRIVER=local`
  - `STORAGE_DRIVER=s3`
  - or metadata-only `mock`

## Internal Asset URL Rewriting

When `backend-nest` sends seller product images to `ai-service`, it rewrites URLs only for internal provider calls:
- `http://localhost:3001/uploads/...`
  -> `http://backend-nest:3001/uploads/...`
- relative `/uploads/...`
  -> resolved against `BACKEND_INTERNAL_BASE_URL`
- remote WB/CDN URLs remain unchanged

This prevents the old Docker-network failure where `ai-service` could not download a backend product image because `localhost` inside the container pointed to itself.

## Prompt Behavior
The prompt builder now reinforces:
- preserve the original product exactly
- do not alter color, silhouette, logo, pockets, waistband, zipper, distressing, trims, or stitching
- no text, watermark, or unrelated props
- product remains central
- style guidance depends on:
  - `MAIN_COVER`
  - `STUDIO`
  - `LIFESTYLE`
  - `WALKING`
  - `BACK_VIEW`
  - `DETAIL`
  - `TRY_ON`

## Error Handling
- invalid internal token:
  - `401`
- invalid input image URL / content type / download size:
  - `400`
- OpenAI bad request / moderation-style rejection:
  - `422`
- OpenAI authentication/config issue:
  - `502`
- OpenAI timeout / connection / rate limit:
  - `503` or `504`

`backend-nest` keeps responsibility for:
- task final status
- retry behavior
- credit refund

## Verified Runtime States
- `PENDING -> PROCESSING -> COMPLETED` via `MockImageProvider`
- `backend-nest` integration smoke still passes
- `backend-nest` now has dedicated `smoke:ai-service-mock-images`
- generated image attach back into product gallery still works
- credits still decrease correctly under the existing backend flow
- `/seller/ai-images` is now a real seller task hub, not placeholder-only

## Opt-In Real Runtime Status

On `2026-05-19`, controlled real verification showed:
- `ai-service /health` in OpenAI mode was healthy
- provider request contract was accepted by OpenAI after the fix
- internal image URL download reached the backend successfully after the rewrite fix
- current remaining real blocker is `OPENAI_BILLING_HARD_LIMIT`

So the current classification is:
- seller AI via `ai-service` mock: verified
- seller AI via `ai-service` OpenAI real: implemented, blocked by account billing limit

## Try-on Status
- `TRY_ON` still exists as a task/domain hint
- no verified end-to-end seller/customer try-on flow is exposed in the current UI
- `/seller/ai-images` intentionally labels try-on as `Coming soon`
