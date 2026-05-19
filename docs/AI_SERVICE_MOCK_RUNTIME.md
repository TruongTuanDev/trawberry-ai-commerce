# AI Service Mock Runtime

Audit date: `2026-05-19`

## Verified Phase

- seller AI generation is now verified through:
  - `frontend-next -> backend-nest -> ai-service -> backend-nest persistence`
- the verified runtime target for this phase is:
  - `AI_WORKER_MODE=ai-service`
  - `AI_IMAGE_PROVIDER=mock`
  - `STORAGE_DRIVER=mock` or `local`
- default tests still do not call OpenAI.

## Runtime Modes

- `INTERNAL_MOCK`
  - backend worker stays inside `backend-nest`
- `AI_SERVICE_MOCK`
  - backend calls `ai-service`
  - `ai-service` uses `MockImageProvider`
  - no OpenAI billing is used
- `OPENAI_REAL`
  - backend calls `ai-service`
  - `ai-service` uses `OpenAIImageProvider`
  - this remains opt-in and not part of default verification

## Required Env

Backend:
- `AI_WORKER_MODE=ai-service`
- `AI_SERVICE_BASE_URL=http://ai-service:8000`
- `AI_SERVICE_INTERNAL_TOKEN=...`

AI service:
- `AI_IMAGE_PROVIDER=mock`
- `STORAGE_DRIVER=mock` or `local`
- `OPENAI_API_KEY=`
- `RUN_OPENAI_SMOKE=false`

## Runtime Diagnostics

`GET /api/shops/:shopId/ai-images/runtime` now exposes seller-safe diagnostics:

```json
{
  "workerMode": "ai-service",
  "aiServiceReachable": true,
  "aiServiceProvider": "mock",
  "aiServiceStorageDriver": "mock",
  "openAiRealEnabled": false,
  "sellerFlowEffectiveMode": "AI_SERVICE_MOCK"
}
```

No secrets are returned.

## Verification

- backend:
  - `npm run smoke:ai-service-mock-images`
  - `npm run smoke:ai-images-ui-flow`
- frontend:
  - `npm run test:e2e:seller-ai-images`
- ai-service:
  - `python -m pytest -q`

## Current Limits

- OpenAI real remains pending and must be verified separately.
- virtual try-on remains `Coming soon`.
