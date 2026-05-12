# Config Audit

## Summary
This audit covers the active repository at `C:\Users\admin\trawberry-ai-commerce`.

Current verified state:
- Docker Compose wiring is aligned with the current stack
- mock end-to-end flow is green
- `backend-nest` and `ai-service` share `AI_SERVICE_INTERNAL_TOKEN`
- browser-facing URLs and Docker-network URLs are separated correctly in docs
- no real `.env` files are tracked by Git

## Runtime Baseline

### Host-facing URLs
- frontend: `http://localhost:3000`
- backend: `http://localhost:3001`
- ai-service: `http://localhost:8000`
- MinIO console: `http://localhost:9001`
- PostgreSQL from host: `localhost:5433`

### Docker-network URLs
- `backend-nest -> ai-service`: `http://ai-service:8000`
- `backend-nest -> postgres`: `postgres:5432`
- `backend-nest -> redis`: `redis:6379`
- `ai-service -> minio`: `http://minio:9000`

## Cross-Service Findings

### Token alignment
- `backend-nest` and `ai-service` use the same `AI_SERVICE_INTERNAL_TOKEN`
- Docker Compose passes the same token to both services
- no secret token value is logged in docs or scripts

### Base URL alignment
- Local non-Docker runtime:
  - `backend-nest` should use `AI_SERVICE_BASE_URL=http://localhost:8000`
- Docker runtime:
  - `backend-nest` should use `AI_SERVICE_BASE_URL=http://ai-service:8000`

### Generated image URL usability
- local ai-service output can be exposed under `/generated`
- S3/MinIO public URLs are expected to use `http://localhost:9000/<bucket>`
- frontend reads generated image URLs only through `backend-nest`

## Backend Env Audit

Docs checked:
- [RUNTIME_ENV.md](C:/Users/admin/trawberry-ai-commerce/docs/RUNTIME_ENV.md)
- [DEPLOYMENT.md](C:/Users/admin/trawberry-ai-commerce/docs/DEPLOYMENT.md)
- [backend-nest/README.md](C:/Users/admin/trawberry-ai-commerce/backend-nest/README.md)

| Env | Used In Code | In `.env.example` | Default / Fallback | Required | Notes |
|---|---|---:|---|---|---|
| `PORT` | Yes | Yes | `3001` | Optional | Browser-facing backend port. |
| `DATABASE_URL` | Yes | Yes | none | Required | In Docker must target `postgres:5432`. |
| `JWT_SECRET` | Yes | Yes | fallback to `JWT_ACCESS_SECRET` | Optional | Supported for simplified config. |
| `JWT_EXPIRES_IN` | Yes | Yes | fallback to access/refresh values | Optional | Supported for simplified config. |
| `JWT_ACCESS_SECRET` | Yes | No | `dev-access-secret` fallback in code/compose | Optional | Still supported by code. |
| `JWT_REFRESH_SECRET` | Yes | No | `dev-refresh-secret` fallback in code/compose | Optional | Still supported by code. |
| `REDIS_HOST` | Yes | Yes | `127.0.0.1` | Optional | Docker uses `redis`. |
| `REDIS_PORT` | Yes | Yes | `6379` | Optional | Docker uses container port `6379`. |
| `AI_WORKER_MODE` | Yes | Yes | `internal-mock` or env value | Optional | Docker uses ai-service mode. |
| `AI_SERVICE_BASE_URL` | Yes | Yes | none | Required for ai-service mode | `localhost:8000` outside Docker, `ai-service:8000` in Docker. |
| `AI_SERVICE_INTERNAL_TOKEN` | Yes | Yes | none | Required | Must match `ai-service`. |
| `AI_SERVICE_TIMEOUT_MS` | Yes | Yes | `45000` or env value | Optional | HTTP timeout. |
| `STORAGE_DRIVER` | Yes | Yes | `local` | Optional | Backend currently uses local product uploads in Docker. |
| `MAX_IMAGE_SIZE_MB` | Yes | Yes | `10` | Optional | Product upload validation. |
| `AUTH_COOKIE_NAME` | Yes | Yes | `access_token` | Optional | Cookie-based auth support. |
| `AUTH_COOKIE_SECURE` | Yes | Yes | `false` | Optional | Must be `true` under HTTPS in prod. |
| `AUTH_COOKIE_SAME_SITE` | Yes | Yes | `lax` | Optional | Cookie policy. |
| `AUTH_COOKIE_MAX_AGE_SECONDS` | Yes | Yes | `86400` | Optional | Cookie max age. |

## AI Service Env Audit

Docs checked:
- [ai-service/README.md](C:/Users/admin/trawberry-ai-commerce/ai-service/README.md)
- [AI_SERVICE.md](C:/Users/admin/trawberry-ai-commerce/docs/AI_SERVICE.md)
- [OPENAI_IMAGE_PROVIDER.md](C:/Users/admin/trawberry-ai-commerce/docs/OPENAI_IMAGE_PROVIDER.md)

| Env | Used In Code | In `.env.example` | Default / Fallback | Required | Notes |
|---|---|---:|---|---|---|
| `AI_SERVICE_HOST` | Yes | No | `0.0.0.0` | Optional | Docker binds `0.0.0.0`. |
| `AI_SERVICE_PORT` | Yes | No | `8000` | Optional | Current runtime port. |
| `AI_IMAGE_PROVIDER` | Yes | Yes | `mock` | Optional | Default safe mode. |
| `OPENAI_API_KEY` | Yes | Yes | none | Required only for real OpenAI | Not required in mock mode. |
| `OPENAI_IMAGE_MODEL` | Yes | Yes | `gpt-image-1` | Optional | OpenAI mode only. |
| `OPENAI_IMAGE_SIZE` | Yes | Yes | `1024x1536` | Optional | OpenAI mode only. |
| `OPENAI_IMAGE_QUALITY` | Yes | Yes | `medium` | Optional | OpenAI mode only. |
| `OPENAI_IMAGE_OUTPUT_FORMAT` | Yes | Yes | `jpeg` | Optional | OpenAI mode only. |
| `OPENAI_IMAGE_TIMEOUT_SECONDS` | Yes | Yes | `120` | Optional | OpenAI timeout. |
| `OPENAI_IMAGE_MAX_RETRIES` | Yes | Yes | `1` | Optional | OpenAI retry count. |
| `RUN_OPENAI_SMOKE` | Yes | Yes | `false` | Optional | Real smoke gate. |
| `AI_SERVICE_INTERNAL_TOKEN` | Yes | Yes | none | Required | Must match backend. |
| `STORAGE_DRIVER` | Yes | Yes | `local` in example, `s3` in Docker | Optional | Mock/local/s3 supported. |
| `AI_OUTPUT_DIR` | Yes | Yes | `./storage/generated` | Optional | Local output directory alias. |
| `PUBLIC_BASE_URL` | Yes | Yes | `http://localhost:8000` | Optional | Local generated file URL base. |
| `MAX_INPUT_IMAGE_SIZE_MB` | Yes | Yes | `10` or env value | Optional | Input image download guard. |
| `INPUT_IMAGE_DOWNLOAD_TIMEOUT_SECONDS` | Yes | Yes | `15` or env value | Optional | Input image timeout. |
| `S3_ENDPOINT` | Yes | Yes | none | Optional | Docker uses `http://minio:9000`. |
| `S3_REGION` | Yes | Yes | `us-east-1` | Optional | S3/MinIO. |
| `S3_BUCKET` | Yes | Yes | none | Optional | S3/MinIO bucket. |
| `S3_ACCESS_KEY_ID` | Yes | Yes | none | Optional | S3/MinIO access key. |
| `S3_SECRET_ACCESS_KEY` | Yes | Yes | none | Optional | S3/MinIO secret key. |
| `S3_PUBLIC_BASE_URL` | Yes | Yes | none | Optional | Browser-facing S3 URL base. |

## Frontend Env Audit

Docs checked:
- [frontend-next/README.md](C:/Users/admin/trawberry-ai-commerce/frontend-next/README.md)

| Env | Used In Code | In `.env.example` | Default / Fallback | Required | Notes |
|---|---|---:|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Yes | `http://localhost:3001` fallback in code | Required outside local default | Frontend talks only to `backend-nest`. |

## Infra / Docker Audit

Docs checked:
- [DEPLOYMENT.md](C:/Users/admin/trawberry-ai-commerce/docs/DEPLOYMENT.md)

| Env | Used In Compose | In `infra/.env.example` | Required | Notes |
|---|---:|---:|---|---|
| `FRONTEND_PORT` | Yes | Yes | Optional | Host bind `3000`. |
| `BACKEND_PORT` | Yes | Yes | Optional | Host bind `3001`. |
| `AI_SERVICE_PORT` | Yes | Yes | Optional | Host bind `8000`. |
| `POSTGRES_PORT` | Yes | Yes | Optional | Host bind `5433`, container still `5432`. |
| `POSTGRES_USER` | Yes | Yes | Optional | Docker DB user. |
| `POSTGRES_PASSWORD` | Yes | Yes | Optional | Docker DB password. |
| `POSTGRES_DB` | Yes | Yes | Optional | Docker DB name. |
| `REDIS_PORT` | Yes | Yes | Optional | Host bind `6379`. |
| `MINIO_ROOT_USER` | Yes | Yes | Optional | Local MinIO credential. |
| `MINIO_ROOT_PASSWORD` | Yes | Yes | Optional | Local MinIO credential. |
| `MINIO_BUCKET` | Yes | Yes | Optional | Bucket created by `minio-init`. |
| `MINIO_API_PORT` | Yes | Yes | Optional | Host bind `9000`. |
| `MINIO_CONSOLE_PORT` | Yes | Yes | Optional | Host bind `9001`. |
| `AI_SERVICE_INTERNAL_TOKEN` | Yes | Yes | Required | Shared between backend and ai-service. |
| `AI_SERVICE_BASE_URL` | Yes | Yes | Required | In Docker should be `http://ai-service:8000`. |
| `AI_IMAGE_PROVIDER` | Yes | Yes | Optional | Defaults to `mock`. |
| `RUN_OPENAI_SMOKE` | Yes | Yes | Optional | Defaults to `false`. |
| `OPENAI_API_KEY` | Yes | Yes | Required only for real OpenAI | Blank by default. |
| `STORAGE_DRIVER` | Yes | Yes | Optional | Controls ai-service storage mode. |
| `S3_ENDPOINT` | Yes | Yes | Optional | In Docker should be `http://minio:9000`. |
| `S3_PUBLIC_BASE_URL` | Yes | Yes | Optional | Browser-facing MinIO URL base. |
| `NEXT_PUBLIC_API_URL` | Yes | Yes | Required | Browser-facing backend URL `http://localhost:3001`. |

## Remaining Outdated References
- None identified in the reviewed runtime docs after this cleanup pass.

## Conditions Before Real OpenAI Smoke
- `AI_IMAGE_PROVIDER=openai`
- `RUN_OPENAI_SMOKE=true`
- `OPENAI_API_KEY` must be set
- `AI_SERVICE_INTERNAL_TOKEN` must still match backend
- storage should be `local` or `s3`

## Production Reminder
- replace all local/dev credentials
- do not rely on dev defaults like `minioadmin` or `dev-access-secret`
- never commit real `.env` files
