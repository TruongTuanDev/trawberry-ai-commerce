# Runtime Environment

This document describes the current verified runtime setup for the repository at `C:\Users\admin\trawberry-ai-commerce`.

> [!WARNING]
> Do not commit real `.env` files such as `infra/.env`, `backend-nest/.env`, `ai-service/.env`, or `frontend-next/.env`.

## Services
- `frontend-next`: `http://localhost:3000`
- `backend-nest`: `http://localhost:3001`
- `ai-service`: `http://localhost:8000`
- `postgres` host port: `localhost:5433`
- `redis`: `localhost:6379`
- `minio api`: `http://localhost:9000`
- `minio console`: `http://localhost:9001`

## Important Port Rules
- Host PostgreSQL port is `5433`
- PostgreSQL container still listens on `5432`
- Inside Docker network:
  - `backend-nest -> postgres` uses `postgres:5432`
  - `backend-nest -> redis` uses `redis:6379`
  - `backend-nest -> ai-service` uses `http://ai-service:8000`
  - `ai-service -> minio` uses `http://minio:9000`
- From the browser:
  - `frontend-next -> backend-nest` uses `http://localhost:3001`

## Docker Compose

Create the runtime env file from the example:

```powershell
cd C:\Users\admin\trawberry-ai-commerce
Copy-Item infra\.env.example infra\.env
```

Start the stack:

```powershell
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build
```

Validate compose rendering:

```powershell
docker compose -f infra/docker-compose.yml --env-file infra/.env config
```

Check running containers:

```powershell
docker compose -f infra/docker-compose.yml --env-file infra/.env ps
```

## Current Verified Container Set
- `postgres`
- `redis`
- `minio`
- `ai-service`
- `backend-nest`
- `frontend-next`

The current verified state is `6/6` containers healthy.

## Health URLs
- Frontend login: `http://localhost:3000/login`
- Backend health: `http://localhost:3001/api/health`
- Backend Swagger: `http://localhost:3001/api/docs`
- AI service health: `http://localhost:8000/health`
- MinIO console: `http://localhost:9001`

Quick checks:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3001/api/health
Invoke-WebRequest -UseBasicParsing http://localhost:8000/health
Invoke-WebRequest -UseBasicParsing http://localhost:3000/login
Invoke-WebRequest -UseBasicParsing http://localhost:9001
```

## PostgreSQL Notes
- Host machine connects to PostgreSQL using `localhost:5433`
- Containers connect to PostgreSQL using `postgres:5432`
- `infra/postgres-init/01-extensions.sql` enables `uuid-ossp`
- `backend-nest` container uses Docker-safe `DATABASE_URL=postgresql://...@postgres:5432/...`

## MinIO / S3 Notes
- Docker S3 endpoint for containers: `http://minio:9000`
- Browser-facing public base URL: `http://localhost:9000/<bucket>`
- Bucket bootstrap is handled by the `minio-init` service in `docker-compose.yml`
- No manual bucket creation is required for the default local Docker setup

## AI Service Notes
- Default provider is `AI_IMAGE_PROVIDER=mock`
- Docker default does not call OpenAI
- `backend-nest` and `ai-service` must share the same `AI_SERVICE_INTERNAL_TOKEN`
- Current compose wiring already does this through `infra/.env`

## Delivery Provider Notes
- Verified default is `DELIVERY_PROVIDER_MODE=mock`
- Mock mode does not call CDEK or Yandex
- `DELIVERY_DEFAULT_PROVIDER=yandex` keeps same-city express as the default recommendation path
- `DELIVERY_SAME_CITY_PREFERRED_PROVIDER=yandex`
- `DELIVERY_INTER_CITY_PREFERRED_PROVIDER=cdek`
- `DELIVERY_FALLBACK_PROVIDER=cdek`
- Real carrier credentials must stay only in local secret env files

Carrier env shape:

```env
DELIVERY_PROVIDER_MODE=mock
DELIVERY_DEFAULT_PROVIDER=yandex
DELIVERY_SAME_CITY_PREFERRED_PROVIDER=yandex
DELIVERY_INTER_CITY_PREFERRED_PROVIDER=cdek
DELIVERY_FALLBACK_PROVIDER=cdek

CDEK_DELIVERY_ENABLED=false
CDEK_API_BASE_URL=
CDEK_ACCOUNT=
CDEK_SECURE_PASSWORD=
CDEK_TIMEOUT_MS=30000
CDEK_DEFAULT_CURRENCY=RUB
CDEK_DEFAULT_TARIFF_CODE=

YANDEX_DELIVERY_ENABLED=false
YANDEX_DELIVERY_BASE_URL=https://b2b.taxi.yandex.net
YANDEX_DELIVERY_TOKEN=
YANDEX_DELIVERY_CLIENT_ID=
YANDEX_DELIVERY_TIMEOUT_MS=30000
```

Real modes are intentionally not part of default smoke verification:
- `cdek` mode requires valid CDEK credentials and later-phase API implementation
- `yandex` mode is placeholder-only in this phase

## Smoke Integration
Run the integration smoke from the host:

```powershell
cd C:\Users\admin\trawberry-ai-commerce\backend-nest
npm run smoke:ai-service-integration
```

This verifies:
- seller registration
- local seller approval bootstrap
- login
- shop creation
- product creation
- product image upload
- AI mock image generation via `ai-service`
- generated image attach into product gallery
- credit decrease

## Optional Verification Commands

### backend-nest
```powershell
cd C:\Users\admin\trawberry-ai-commerce\backend-nest
npm run lint
npm test -- --runInBand
npm run build
```

### frontend-next
```powershell
cd C:\Users\admin\trawberry-ai-commerce\frontend-next
npm run lint
npm run build
```

### ai-service
```powershell
cd C:\Users\admin\trawberry-ai-commerce\ai-service
python -m compileall app
python -m pytest -q
```

## Stop Commands
Stop the stack:

```powershell
cd C:\Users\admin\trawberry-ai-commerce
docker compose -f infra/docker-compose.yml --env-file infra/.env down
```

Stop and remove volumes:

```powershell
cd C:\Users\admin\trawberry-ai-commerce
docker compose -f infra/docker-compose.yml --env-file infra/.env down -v
```

## Git Safety
- Commit only `.env.example` files
- Do not commit:
  - `infra/.env`
  - `backend-nest/.env`
  - `ai-service/.env`
  - `frontend-next/.env`
  - `frontend-next/.env.local`
