# Config Audit

## Summary
This audit covered:
- `backend-nest`
- `ai-service`
- `frontend-next`
- `infra/docker-compose.yml`
- runtime docs and smoke scripts

Current conclusion:
- mock end-to-end flow is ready and verified
- `backend-nest` and `ai-service` share the same `AI_SERVICE_INTERNAL_TOKEN` in local runtime
- env examples are mostly aligned with code after this audit
- Docker Compose env wiring is now materially closer to the real code paths
- real OpenAI smoke is still blocked by missing runtime conditions, not by code structure

Verified in this audit:
- `ai-service` `python -m compileall app`: pass
- `ai-service` `python -m pytest -q`: pass
- `ai-service` `GET /health`: pass
- `ai-service` `POST /internal/ai-images/generate` with mock provider: pass
- `backend-nest` `npm run lint`: pass
- `backend-nest` `npm test -- --runInBand`: pass
- `backend-nest` `npm run build`: pass
- `backend-nest` `npm run smoke:ai-service-integration`: pass
- `frontend-next` `npm run lint`: pass
- `frontend-next` `npm run build`: pass
- `docker compose ... config`: pass

Not verified end-to-end in this audit:
- real OpenAI runtime
- `docker compose up` runtime boot, because Docker daemon is unavailable on this machine

## Cross-Service Findings

### Token alignment
- Local `.env` check: `backend-nest` and `ai-service` use matching `AI_SERVICE_INTERNAL_TOKEN`
- Docker Compose now passes the same `AI_SERVICE_INTERNAL_TOKEN` to both services
- No secret token value is logged by the worker or client code

### Base URL alignment
- Local non-Docker runtime:
  - `backend-nest` expects `AI_SERVICE_BASE_URL=http://localhost:8010`
  - this matches direct local `uvicorn` startup
- Docker runtime:
  - `backend-nest` uses `AI_SERVICE_BASE_URL=http://ai-service:8010`
  - this now matches the compose service name and internal network

### Generated image URL usability
- `ai-service` local storage mode:
  - serves files under `/generated`
  - returns URLs based on `STORAGE_PUBLIC_BASE_URL` or `PUBLIC_BASE_URL`
  - browser-usable when this base URL points to the host-visible service URL
- `ai-service` S3 mode:
  - returns URLs based on `S3_PUBLIC_BASE_URL`, else endpoint/bucket fallback
  - compose points this to `http://localhost:9000/<bucket>`
- `backend-nest` stores the returned URLs as-is
- `frontend-next` only reads those URLs from `backend-nest`; it does not call `ai-service` directly

### Name mismatch by design
- `backend-nest` does **not** use `JWT_SECRET` / `JWT_EXPIRES_IN`
- it intentionally uses:
  - `JWT_ACCESS_SECRET`
  - `JWT_REFRESH_SECRET`
  - `JWT_ACCESS_EXPIRES_IN`
  - `JWT_REFRESH_EXPIRES_IN`
- This is not a bug. It is a split access/refresh design.

## Backend Env Audit

Docs checked for backend env:
- [RUNTIME_ENV.md](C:/Users/admin/trawberry/docs/RUNTIME_ENV.md)
- [DEPLOYMENT.md](C:/Users/admin/trawberry/docs/DEPLOYMENT.md)

| Env | Used In Code | In `.env.example` | In Docs | Default / Fallback | Required | Notes |
|---|---|---:|---:|---|---|---|
| `PORT` | Yes | Yes | Yes | `3001` | Optional | Used by Nest bootstrap and local URL fallback. |
| `NODE_ENV` | Indirect | Yes | Partial | `development` or compose `production` | Optional | Mostly runtime labeling. |
| `DATABASE_URL` | Yes | Yes | Yes | None | Required | Local runtime already verified. |
| `JWT_ACCESS_SECRET` | Yes | Yes | Partial | `dev-access-secret` in examples/compose | Required | Canonical secret name. |
| `JWT_REFRESH_SECRET` | Yes | Yes | Partial | `dev-refresh-secret` in examples/compose | Required | Canonical refresh secret name. |
| `JWT_ACCESS_EXPIRES_IN` | Yes | Yes | Partial | `15m` | Optional | Split token expiry. |
| `JWT_REFRESH_EXPIRES_IN` | Yes | Yes | Partial | `7d` | Optional | Split refresh expiry. |
| `REDIS_HOST` | Yes | Yes | Partial | `127.0.0.1` | Optional | Queue/worker fallback is local Redis. |
| `REDIS_PORT` | Yes | Yes | Partial | `6379` | Optional | Used by Redis and BullMQ. |
| `REDIS_PASSWORD` | Yes | Yes | No | empty | Optional | Safe blank default for local. |
| `REDIS_DB` | Yes | Yes | No | `0` | Optional | Used by Redis and BullMQ. |
| `BULLMQ_DISABLED` | Yes | Yes | Partial | `true` | Optional | Keeps local mock path bootable without Redis. |
| `CORS_ORIGIN` | Yes | Yes | Partial | `http://localhost:3000,http://localhost:4200` | Optional | Needed for browser clients. |
| `STORAGE_DRIVER` | Yes | Yes | Partial | fallback to `FILE_STORAGE_DRIVER` | Optional | Canonical storage driver key. |
| `FILE_STORAGE_DRIVER` | Yes | Yes | Partial | `local` | Optional | Legacy-compatible fallback still used. |
| `UPLOAD_ROOT` | Yes | Yes | Partial | `uploads` | Optional | Local product-image file root. |
| `FILES_PUBLIC_BASE_URL` | Yes | Yes | Partial | `http://localhost:<PORT>` | Optional | Needed for browser-usable upload URLs. |
| `APP_PUBLIC_URL` | Yes | No | No | fallback only | Optional | Hidden alias used by file URL builder. |
| `MAX_IMAGE_SIZE_MB` | Yes | Yes | Partial | `10` | Optional | Product upload validation. |
| `S3_ENDPOINT` | Yes | Yes | Partial | `http://localhost:9000` | Optional | Important if backend storage flips to S3/MinIO. |
| `S3_REGION` | Yes | Yes | Partial | `us-east-1` | Optional | Used by S3 client. |
| `S3_ACCESS_KEY_ID` | Yes | Yes | Partial | `minioadmin` fallback in code | Optional | Dev default only; override in prod. |
| `S3_SECRET_ACCESS_KEY` | Yes | Yes | Partial | `minioadmin` fallback in code | Optional | Dev default only; override in prod. |
| `S3_BUCKET` | Yes | Yes | Partial | code fallback `strawberry-assets` | Optional | Example uses `strawberry-ai-assets`. |
| `S3_PUBLIC_BASE_URL` | Yes | Yes | Partial | fallback to `S3_ENDPOINT` | Optional | Needed for browser-usable S3 URLs. |
| `AI_SERVICE_BASE_URL` | Yes | Yes | Partial | `http://localhost:8010` | Required for ai-service mode | Local and Docker variants both documented now. |
| `AI_SERVICE_INTERNAL_TOKEN` | Yes | Yes | Partial | empty string fallback in client | Required for ai-service mode | Verified local token match with `ai-service`. |
| `AI_WORKER_MODE` | Yes | Yes | Partial | `internal-mock` | Optional | `internal-mock` keeps local flow runnable without `ai-service`. |
| `AI_SERVICE_TIMEOUT_MS` | Yes | Yes | Partial | `45000` | Optional | Used by HTTP client timeout. |
| `AI_SERVICE_RETRY_ATTEMPTS` | Yes | Yes | No | `3` | Optional | Used by ai-service HTTP retry. |
| `AI_SERVICE_RETRY_DELAY_MS` | Yes | Yes | No | `1000` | Optional | Used by ai-service HTTP retry. |

### Backend Notes
- `backend-nest/.env` exists locally and its variable names match `.env.example`
- local `.env` and example diverge on some values, for example bucket naming; not a code bug, but it should stay intentional
- `AI_SERVICE_INTERNAL_TOKEN` local values match `ai-service`
- `JWT_SECRET` and `JWT_EXPIRES_IN` are not missing; they are superseded by access/refresh-specific names

## AI Service Env Audit

Docs checked for ai-service env:
- [ai-service/README.md](C:/Users/admin/trawberry/ai-service/README.md)
- [AI_SERVICE.md](C:/Users/admin/trawberry/docs/AI_SERVICE.md)
- [OPENAI_IMAGE_PROVIDER.md](C:/Users/admin/trawberry/docs/OPENAI_IMAGE_PROVIDER.md)

| Env | Used In Code | In `.env.example` | In Docs | Default / Fallback | Required | Notes |
|---|---|---:|---:|---|---|---|
| `AI_SERVICE_HOST` | Yes | Yes | Partial | `0.0.0.0` | Optional | Uvicorn host binding. |
| `AI_SERVICE_PORT` | Yes | Yes | Partial | `8010` | Optional | Uvicorn port binding. |
| `AI_IMAGE_PROVIDER` | Yes | Yes | Yes | `mock` | Optional | Canonical provider selector. |
| `AI_PROVIDER` | Yes via alias | No | No | alias only | Optional | Backward-compatible alias accepted by code. |
| `OPENAI_API_KEY` | Yes | Yes | Yes | None | Required for real OpenAI only | Missing key is handled safely; mock flow does not depend on it. |
| `OPENAI_IMAGE_MODEL` | Yes | Yes | Yes | `gpt-image-1` | Optional | Used only in openai mode. |
| `OPENAI_IMAGE_SIZE` | Yes | Yes | Yes | `1024x1536` | Optional | Used only in openai mode. |
| `OPENAI_IMAGE_QUALITY` | Yes | Yes | Yes | `medium` | Optional | Used only in openai mode. |
| `OPENAI_IMAGE_OUTPUT_FORMAT` | Yes | Yes | Yes | `jpeg` | Optional | `jpeg/png/webp`. |
| `OPENAI_IMAGE_TIMEOUT_SECONDS` | Yes | Yes | Yes | `120` | Optional | OpenAI request timeout. |
| `OPENAI_IMAGE_MAX_RETRIES` | Yes | Yes | Yes | `1` | Optional | No infinite retries. |
| `OPENAI_INPUT_IMAGE_MAX_BYTES` | Yes | Yes | Yes | `15728640` | Optional | Canonical raw-byte limit. |
| `MAX_INPUT_IMAGE_BYTES` | Yes via alias | No | No | alias only | Optional | Backward-compatible alias accepted by code. |
| `MAX_INPUT_IMAGE_SIZE_MB` | Yes | Yes | No | `15` | Optional | Added in this audit; clearer doc-friendly size setting. |
| `OPENAI_INPUT_IMAGE_MAX_MB` | Yes via alias | No | No | alias only | Optional | Alias only. |
| `OPENAI_INPUT_IMAGE_TIMEOUT_SECONDS` | Yes | Yes | Yes | `20` | Optional | Canonical timeout name. |
| `INPUT_IMAGE_DOWNLOAD_TIMEOUT_SECONDS` | Yes via alias | No | No | alias only | Optional | Accepted alias now supported explicitly. |
| `RUN_OPENAI_SMOKE` | Yes | Yes | Yes | `false` | Optional | Optional real smoke gate. |
| `OPENAI_SMOKE_FRONT_IMAGE_URL` | Yes | Yes | No | built-in sample URL | Optional | Useful for controlled smoke input. |
| `AI_SERVICE_INTERNAL_TOKEN` | Yes | Yes | Yes | `dev-internal-token` example | Required | Internal auth header check. |
| `STORAGE_DRIVER` | Yes | Yes | Yes | `mock` | Optional | `mock|local|s3`. |
| `STORAGE_LOCAL_ROOT` | Yes | Yes | Yes | `generated` | Optional | Canonical local output directory. |
| `AI_OUTPUT_DIR` | Yes via alias | No | No | alias only | Optional | Alias accepted by code. |
| `STORAGE_PUBLIC_BASE_URL` | Yes | Yes | Yes | `http://localhost:8010/generated` | Optional | Canonical public local file URL base. |
| `PUBLIC_BASE_URL` | Yes via alias | No | No | alias only | Optional | Alias accepted by code. |
| `S3_BUCKET` | Yes | Yes | Partial | `strawberry-ai-assets` | Optional | Needed for S3/MinIO. |
| `S3_REGION` | Yes | Yes | Partial | `us-east-1` | Optional | Needed for S3/MinIO. |
| `S3_ENDPOINT_URL` | Yes | Yes | Partial | None | Optional | Canonical old/example name. |
| `S3_ENDPOINT` | Yes via alias | No | No | alias only | Optional | Compose now uses this alias; code supports it. |
| `S3_ACCESS_KEY_ID` | Yes | Yes | Partial | None | Optional | Required for S3/MinIO runtime. |
| `S3_SECRET_ACCESS_KEY` | Yes | Yes | Partial | None | Optional | Required for S3/MinIO runtime. |
| `S3_PUBLIC_BASE_URL` | Yes | Yes | Partial | endpoint/bucket fallback | Optional | Needed for browser-friendly URL control. |
| `NEST_CALLBACK_AUTH_TOKEN` | Yes | Yes | Partial | None | Optional | Prepared for callback path, not required in current polling flow. |

### AI Service Notes
- Local `ai-service/.env` exists
- It is currently missing three **optional** keys now present in `.env.example`:
  - `MAX_INPUT_IMAGE_SIZE_MB`
  - `RUN_OPENAI_SMOKE`
  - `OPENAI_SMOKE_FRONT_IMAGE_URL`
- These are not blocking because code defaults cover them
- `main.py` mounts `StaticFiles` at `/generated`, so local generated URLs are usable when `STORAGE_PUBLIC_BASE_URL` is host-visible
- Mock flow does not require `OPENAI_API_KEY`
- Real OpenAI flow still requires:
  - `AI_IMAGE_PROVIDER=openai`
  - `OPENAI_API_KEY`
  - outbound internet
  - storage driver suited for real bytes: `local` or `s3`

## Frontend Env Audit

Docs checked:
- [frontend-next/README.md](C:/Users/admin/trawberry/frontend-next/README.md)

| Env | Used In Code | In `.env.example` | In Docs | Default / Fallback | Required | Notes |
|---|---|---:|---:|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Yes | Yes | `http://localhost:3001` fallback in code | Required in non-localhost envs | Frontend only talks to `backend-nest`. |

### Frontend Notes
- `frontend-next` has no committed `.env`, only `.env.example`
- code fallback to `http://localhost:3001` is safe for local bootstrap, but explicit env is still recommended
- seller AI modal calls only `backend-nest`, not `ai-service`

## Infra / Docker Audit

Docs checked:
- [DEPLOYMENT.md](C:/Users/admin/trawberry/docs/DEPLOYMENT.md)

| Env | Used In Compose | In `infra/.env.example` | Required | Notes |
|---|---:|---:|---|---|
| `POSTGRES_DB` | Yes | Yes | Optional | Local default provided. |
| `POSTGRES_USER` | Yes | Yes | Optional | Local default provided. |
| `POSTGRES_PASSWORD` | Yes | Yes | Optional | Dev default only; rotate in prod. |
| `POSTGRES_PORT` | Yes | Yes | Optional | Host bind only. |
| `REDIS_PORT` | Yes | Yes | Optional | Host bind only. |
| `MINIO_ROOT_USER` | Yes | Yes | Optional | Dev default only; rotate in prod. |
| `MINIO_ROOT_PASSWORD` | Yes | Yes | Optional | Dev default only; rotate in prod. |
| `MINIO_API_PORT` | Yes | Yes | Optional | Host bind only. |
| `MINIO_CONSOLE_PORT` | Yes | Yes | Optional | Host bind only. |
| `MINIO_BUCKET` | Yes | Yes | Optional | Shared bucket name. |
| `FRONTEND_PORT` | Yes | Yes | Optional | Host bind only. |
| `BACKEND_PORT` | Yes | Yes | Optional | Host bind only. |
| `AI_SERVICE_PORT` | Yes | Yes | Optional | Host bind only. |
| `JWT_ACCESS_SECRET` | Yes | Yes | Optional | Dev default only; rotate in prod. |
| `JWT_REFRESH_SECRET` | Yes | Yes | Optional | Dev default only; rotate in prod. |
| `AI_SERVICE_INTERNAL_TOKEN` | Yes | Yes | Required for HTTP integration | Added and aligned in this audit. |
| `AI_IMAGE_PROVIDER` | Yes | Yes | Optional | Mock by default. |
| `AI_SERVICE_TIMEOUT_MS` | Yes | Yes | Optional | Passed to backend. |
| `AI_SERVICE_RETRY_ATTEMPTS` | Yes | Yes | Optional | Passed to backend. |
| `AI_SERVICE_RETRY_DELAY_MS` | Yes | Yes | Optional | Passed to backend. |
| `STORAGE_DRIVER` | Yes | Yes | Optional | Controls ai-service storage mode in compose. |
| `OPENAI_API_KEY` | Yes | Yes | Required only for real OpenAI smoke/runtime | Blank by default. |
| `OPENAI_IMAGE_MODEL` | Yes | Yes | Optional | Passed to ai-service. |
| `OPENAI_IMAGE_SIZE` | Yes | Yes | Optional | Passed to ai-service. |
| `OPENAI_IMAGE_QUALITY` | Yes | Yes | Optional | Passed to ai-service. |
| `OPENAI_IMAGE_OUTPUT_FORMAT` | Yes | Yes | Optional | Passed to ai-service. |
| `OPENAI_IMAGE_TIMEOUT_SECONDS` | Yes | Yes | Optional | Passed to ai-service. |
| `OPENAI_IMAGE_MAX_RETRIES` | Yes | Yes | Optional | Passed to ai-service. |
| `MAX_INPUT_IMAGE_SIZE_MB` | Yes | Yes | Optional | Passed to ai-service. |
| `RUN_OPENAI_SMOKE` | Yes | Yes | Optional | Useful for optional real smoke only. |

### Infra Notes
- `docker compose ... config` passes after this audit
- Docker daemon is not running on this machine, so `docker compose up` runtime was not verified here
- Compose now passes:
  - shared `AI_SERVICE_INTERNAL_TOKEN`
  - correct Docker-network `AI_SERVICE_BASE_URL=http://ai-service:8010`
  - backend S3/MinIO vars needed if storage mode is later switched to `s3`
- `frontend-next` is intentionally built with `NEXT_PUBLIC_API_URL=http://localhost:3001` so browser traffic from the host still reaches NestJS correctly

## Small Fixes Applied In This Audit
- `ai-service/app/core/config.py`
  - added aliases for `PUBLIC_BASE_URL`, `S3_ENDPOINT`, `MAX_INPUT_IMAGE_SIZE_MB`, `INPUT_IMAGE_DOWNLOAD_TIMEOUT_SECONDS`
- `ai-service/app/services/openai_image_provider.py`
  - now respects the normalized input-image size config path
- `ai-service/.env.example`
  - added `MAX_INPUT_IMAGE_SIZE_MB`
  - added `RUN_OPENAI_SMOKE`
  - added `OPENAI_SMOKE_FRONT_IMAGE_URL`
- `infra/.env.example`
  - added/normalized AI service and OpenAI env keys
- `infra/docker-compose.yml`
  - aligned `AI_IMAGE_PROVIDER`
  - aligned `AI_SERVICE_INTERNAL_TOKEN`
  - added backend S3/MinIO vars for Docker network correctness
- `frontend-next/README.md`
  - updated AI image page feature description to match the current UI
- `backend-nest/scripts/smoke-ai-service-integration.ps1`
  - removed hardcoded `provider=MOCK` assumption
  - smoke now validates provider presence instead of a brittle literal

## Remaining Issues
- `ai-service` contains stale older files under `app/providers/*` and `app/services/image_generation_service.py`
  - current runtime uses `app/services/*`
  - the older files appear unused but are a maintenance risk
  - recommended action: cleanup in a dedicated refactor pass, not during config audit
- `backend-nest` local `.env` and `.env.example` differ in some non-secret values
  - not a bug, but these should stay intentional and reviewed
- `frontend-next` still stores auth token in `localStorage`
  - not a config blocker for this phase
  - still a production hardening gap
- `smoke:ai-service-integration` verifies the mock integration path, not the real OpenAI path
  - this is expected
  - real OpenAI runtime still relies on the optional Python smoke and/or a separate full-stack runtime exercise

## Secret Exposure Audit
- No real OpenAI API key was found hardcoded in code, docs, or scripts
- No production-grade secrets were found hardcoded
- Development defaults do exist in examples/compose:
  - `dev-access-secret`
  - `dev-refresh-secret`
  - `dev-internal-token`
  - `minioadmin`
  - local PostgreSQL credentials
- These are acceptable for local bootstrap only and must be replaced in production

## Conditions Required Before Real OpenAI Smoke
- `ai-service` must run with:
  - `AI_IMAGE_PROVIDER=openai`
  - `OPENAI_API_KEY` set
  - `RUN_OPENAI_SMOKE=true`
  - `STORAGE_DRIVER=local` or `STORAGE_DRIVER=s3`
- network egress to OpenAI must be available
- if using local storage:
  - `STORAGE_PUBLIC_BASE_URL` or `PUBLIC_BASE_URL` must point to a host-visible `ai-service`
- if using S3/MinIO:
  - `S3_BUCKET`
  - `S3_REGION`
  - `S3_ENDPOINT` or `S3_ENDPOINT_URL`
  - `S3_ACCESS_KEY_ID`
  - `S3_SECRET_ACCESS_KEY`
  - optionally `S3_PUBLIC_BASE_URL`
- optional smoke input should be controlled with `OPENAI_SMOKE_FRONT_IMAGE_URL`
- For full backend-integrated OpenAI exercise:
  - `backend-nest` must use `AI_WORKER_MODE=ai-service`
  - `AI_SERVICE_BASE_URL` must target the running `ai-service`
  - `AI_SERVICE_INTERNAL_TOKEN` must match on both sides
  - PostgreSQL and Redis must be reachable

## Conditions Required Before Production Deploy
- replace all local/dev secrets and credentials
- move secrets to a real secret manager or deployment-time env injection
- remove any dependency on code fallbacks for security-sensitive values
- decide the production storage mode explicitly:
  - `backend-nest` product images
  - `ai-service` generated images
- verify browser-reachable public URLs for:
  - backend product uploads
  - ai-service generated outputs
  - MinIO/S3 public objects if used
- run a real OpenAI smoke in a controlled environment before enabling seller-facing production traffic
- harden frontend auth away from `localStorage`
- clean up stale unused ai-service code paths to reduce maintenance risk
