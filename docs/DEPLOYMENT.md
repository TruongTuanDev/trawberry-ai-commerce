# Deployment

This document describes the current Docker Compose deployment flow for the repository at `C:\Users\admin\trawberry-ai-commerce`.

## Services
- `frontend-next`: `http://localhost:3000`
- `backend-nest`: `http://localhost:3001`
- `ai-service`: `http://localhost:8000`
- `postgres`: `localhost:5433`
- `redis`: `localhost:6379`
- `minio api`: `http://localhost:9000`
- `minio console`: `http://localhost:9001`

## Files
- Compose file: [infra/docker-compose.yml](C:/Users/admin/trawberry-ai-commerce/infra/docker-compose.yml)
- Compose env example: [infra/.env.example](C:/Users/admin/trawberry-ai-commerce/infra/.env.example)
- Backend env example: [backend-nest/.env.example](C:/Users/admin/trawberry-ai-commerce/backend-nest/.env.example)
- Frontend env example: [frontend-next/.env.example](C:/Users/admin/trawberry-ai-commerce/frontend-next/.env.example)
- AI service env example: [ai-service/.env.example](C:/Users/admin/trawberry-ai-commerce/ai-service/.env.example)

## Prerequisites
- Docker Desktop or Docker Engine with `docker compose`
- Free host ports:
  - `3000`
  - `3001`
  - `5433`
  - `6379`
  - `8000`
  - `9000`
  - `9001`

## Quick Start
```powershell
cd C:\Users\admin\trawberry-ai-commerce
Copy-Item infra\.env.example infra\.env
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build
```

## Runtime Notes
- Browser traffic uses:
  - frontend: `http://localhost:3000`
  - backend: `http://localhost:3001`
- Docker-internal service traffic uses:
  - `backend-nest -> ai-service`: `http://ai-service:8000`
  - `backend-nest -> postgres`: `postgres:5432`
  - `backend-nest -> redis`: `redis:6379`
  - `ai-service -> minio`: `http://minio:9000`
- Host PostgreSQL port is `5433`
- Container PostgreSQL port is still `5432`
- `minio-init` creates the bucket automatically and makes it public for browser-usable local URLs

## Access URLs
- Frontend login: `http://localhost:3000/login`
- Backend health: `http://localhost:3001/api/health`
- Backend Swagger: `http://localhost:3001/api/docs`
- AI service health: `http://localhost:8000/health`
- MinIO Console: `http://localhost:9001`

## Health Checks
- `frontend-next`: `GET /login`
- `backend-nest`: `GET /api/health`
- `ai-service`: `GET /health`
- `postgres`: `pg_isready`
- `redis`: `redis-cli ping`
- `minio`: `GET /minio/health/live`

## Common Commands
Start:

```powershell
cd C:\Users\admin\trawberry-ai-commerce
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build
```

Inspect:

```powershell
cd C:\Users\admin\trawberry-ai-commerce
docker compose -f infra/docker-compose.yml --env-file infra/.env config
docker compose -f infra/docker-compose.yml --env-file infra/.env ps
```

Logs:

```powershell
cd C:\Users\admin\trawberry-ai-commerce
docker compose -f infra/docker-compose.yml --env-file infra/.env logs -f backend-nest frontend-next ai-service
```

Stop:

```powershell
cd C:\Users\admin\trawberry-ai-commerce
docker compose -f infra/docker-compose.yml --env-file infra/.env down
```

Stop and remove volumes:

```powershell
cd C:\Users\admin\trawberry-ai-commerce
docker compose -f infra/docker-compose.yml --env-file infra/.env down -v
```

## Smoke Integration
```powershell
cd C:\Users\admin\trawberry-ai-commerce\backend-nest
npm run smoke:ai-service-integration
```

## Git Safety
- Do not commit `infra/.env`
- Do not commit real service `.env` files
- Commit only `.env.example` files
