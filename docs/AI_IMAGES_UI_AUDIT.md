# AI Images UI Audit

Audit date: `2026-05-19`

## Phase Addendum: AI Service Mock Runtime

- verified runtime target for seller AI is now `AI_SERVICE_MOCK`
- expected compose/runtime shape:
  - backend `AI_WORKER_MODE=ai-service`
  - ai-service `AI_IMAGE_PROVIDER=mock`
  - ai-service `STORAGE_DRIVER=mock` or `local`
- seller runtime badge must show `AI service mock mode`
- OpenAI real remains pending and is not part of default pass for this phase

## Executive Result

- `backend-nest` already had real seller AI task orchestration, credits, attach flow, and tests.
- `ai-service` already had real internal HTTP endpoints and both `mock` and `openai` providers.
- the main gap was frontend discovery: `/seller/ai-images` was placeholder-only while the real flow lived under `/seller/products/[id]/images`.
- `/seller/ai-images` is now connected to the real seller AI flow and is no longer placeholder-only.
- virtual try-on is still not a verified end-to-end flow and stays explicitly non-interactive in the seller UI.

## Backend Endpoints Present

- `POST /api/shops/:shopId/products/:productId/ai-images/tasks`
  - create AI image task
- `GET /api/shops/:shopId/ai-images/tasks`
  - list AI tasks for one shop
- `GET /api/shops/:shopId/ai-images/tasks/:taskId`
  - get one AI task detail
- `POST /api/shops/:shopId/ai-images/tasks/:taskId/retry`
  - retry failed task
- `POST /api/shops/:shopId/products/:productId/ai-images/:imageId/attach`
  - attach generated image into product gallery
- `GET /api/shops/:shopId/ai-credits`
  - get AI credit summary
- `GET /api/shops/:shopId/ai-images/runtime`
  - get seller-safe runtime diagnostics for UI mode badges

Backward-compatible alias:
- `POST /api/shops/:shopId/products/:productId/images/:imageId/attach`

Try-on:
- no verified seller/customer try-on execution flow is exposed as ready today
- `TRY_ON` exists in the task domain, but not as a production-ready UI flow

## AI Service Endpoints Present

- `GET /health`
  - safe runtime metadata:
    - `aiImageProvider`
    - `storageDriver`
    - `openaiConfigured`
    - `tryOnReady`
- `POST /internal/ai-images/generate`
  - internal token required
  - used by `backend-nest` when `AI_WORKER_MODE=ai-service`

Providers:
- `mock`
- `openai`

Storage:
- `mock`
- `local`
- `s3`

Try-on:
- no dedicated try-on endpoint exists in `ai-service`
- current service exposes only the shared generate contract

## Worker Mode

- `AI_WORKER_MODE=internal-mock`
  - NestJS worker uses internal mock provider path
- `AI_WORKER_MODE=ai-service`
  - NestJS worker calls `ai-service`
- `AI_IMAGE_PROVIDER=mock|openai`
  - selected inside `ai-service`

Credit refund path:
- present in `backend-nest/src/modules/ai-images/ai-images.worker.ts`
- failed provider calls can refund credits once

Current verified target after this phase:
- `GET /api/shops/:shopId/ai-images/runtime`
  - `workerMode=ai-service`
  - `sellerFlowEffectiveMode=AI_SERVICE_MOCK`
  - `aiServiceReachable=true`
  - `aiServiceProvider=mock`
  - `openAiRealEnabled=false`
- `GET http://localhost:8000/health`
  - `aiImageProvider=mock`
  - `storageDriver=mock` or `local`
  - `openaiConfigured=false`

## Frontend Status

Before this phase:
- `/seller/ai-images`
  - placeholder cards only
  - no form
  - no task list
  - no API calls
- real seller AI flow already existed at:
  - `/seller/products/[id]/images`
  - `AiImageGenerateModal`
  - `AiTaskPanel`

After this phase:
- `/seller/ai-images`
  - real shop-scoped AI workspace
  - product search + selector
  - inline generation form
  - runtime mode badge
  - recent task list
  - result gallery
  - attach-to-product flow
  - explicit non-interactive try-on card

## Classification

- Seller AI image generation: `REAL_WORKING`
- Customer virtual try-on: `UI_ONLY`
- OpenAI real provider: `REAL_PARTIAL`
- UI route `/seller/ai-images`: `REAL_WORKING`

## Current Verified Seller Flow

1. seller opens `/seller/ai-images`
2. seller selects one product with at least one image
3. seller creates an AI task
4. backend creates shop-scoped task and deducts credits
5. worker completes task through internal mock or `ai-service`
6. task list and result gallery show status and generated images
7. seller attaches one generated image into the product gallery
8. seller product gallery shows `AI_GENERATED`

## Known Limitations

- default verified path is now `ai-service mock`, not real OpenAI
- `/seller/ai-images` does not expose a verified try-on execution flow
- runtime can report:
  - `AI_SERVICE_OPENAI_READY`
  - `AI_SERVICE_OPENAI_BLOCKED`
  - `AI_SERVICE_MOCK`
  - `INTERNAL_MOCK`
  - `OFFLINE`

## Verification References

- backend test: `backend-nest/test/ai-images.e2e-spec.ts`
- backend smoke: `backend-nest/scripts/smoke-ai-images.ps1`
- frontend E2E: `frontend-next/tests/e2e/seller-ai-images.spec.ts`
- ai-service tests: `ai-service/tests/test_ai_service.py`
