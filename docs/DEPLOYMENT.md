# Deployment

Production deployment for the active stack uses [infra/docker-compose.prod.yml](/c:/Users/admin/trawberry-ai-commerce/infra/docker-compose.prod.yml) and a real `infra/.env.production` file that is never committed.

For first-time server preparation, start with [docs/VPS_SETUP.md](/c:/Users/admin/trawberry-ai-commerce/docs/VPS_SETUP.md).

## VPS sizing

The production stack uses the `pgvector/pgvector:pg16` image and a persistent `ai_model_cache` volume. When OpenCLIP is enabled, allow up to five minutes for AI-service cold-start before it becomes healthy; backend startup runs `prisma migrate deploy` automatically.

GitHub Actions launches the long pull/deploy sequence as a detached VPS process and polls its status over short SSH connections. A dropped SSH session does not terminate the remote Docker pull, migration, OpenCLIP preload, or smoke checks.

- Recommended: `8 vCPU`, `16 GB RAM`, `200 GB NVMe`
- Minimum: `4 vCPU`, `8 GB RAM`, `100 GB`

## Production topology

- Public:
  - `nginx` on port `80`
  - optional HTTPS via Nginx + Certbot or Caddy
- Internal only:
  - `frontend-next:3000`
  - `backend-nest:3001`
  - `ai-service:8000`
  - `postgres:5432`
  - `redis:6379`
  - `minio:9000`
- Named volumes:
  - `postgres_data`
  - `redis_data`
  - `minio_data`

## Required files

- Compose: [infra/docker-compose.prod.yml](/c:/Users/admin/trawberry-ai-commerce/infra/docker-compose.prod.yml)
- Reverse proxy: [infra/nginx/nginx.conf](/c:/Users/admin/trawberry-ai-commerce/infra/nginx/nginx.conf)
- Env template: [infra/.env.example](/c:/Users/admin/trawberry-ai-commerce/infra/.env.example)
- Production env template: [infra/.env.production.example](/c:/Users/admin/trawberry-ai-commerce/infra/.env.production.example)
- Deploy script: [infra/scripts/deploy.sh](/c:/Users/admin/trawberry-ai-commerce/infra/scripts/deploy.sh)
- CD workflow: [.github/workflows/deploy.yml](/c:/Users/admin/trawberry-ai-commerce/.github/workflows/deploy.yml)

## Server setup

1. Create a dedicated deploy user.
2. Add the deploy SSH key.
3. Disable SSH password login when key access is verified.
4. Install Docker Engine and the Docker Compose plugin.
5. Open firewall ports `22`, `80`, and `443`.
6. Keep PostgreSQL, Redis, MinIO, backend, and `ai-service` off public ports.
7. Clone the repo into `/opt/trawberry-ai-commerce`.
8. Copy `infra/.env.production.example` to `infra/.env.production`.
9. Replace every `change-me-*` value with a real secret.
10. Start the stack:

```bash
cd /opt/trawberry-ai-commerce
./infra/scripts/deploy.sh
```

## GitHub Actions CD

Production CD is separated from CI and lives in `.github/workflows/deploy.yml`.

Behavior:

- trigger:
  - `push` to `main`
  - `workflow_dispatch`
- waits for the `CI` workflow to succeed on the same commit before deploy
- builds and pushes these GHCR images:
  - `ghcr.io/<owner>/<repo>/backend-nest:<sha>`
  - `ghcr.io/<owner>/<repo>/frontend-next:<sha>`
  - `ghcr.io/<owner>/<repo>/ai-service:<sha>`
  - `ghcr.io/<owner>/<repo>/nginx:<sha>`
- also publishes `latest` tags on the default branch

Required GitHub secrets:

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`
- `VPS_APP_DIR`
- `VPS_PORT` optional, default `22`
- `VPS_KNOWN_HOSTS` optional but recommended for strict host verification
- `GHCR_PAT` optional if `GITHUB_TOKEN` cannot read/write GHCR in your org

Recommended GitHub repository variable:

- `DEPLOY_NEXT_PUBLIC_API_URL`
  - used as the frontend Docker build arg
  - example: `https://api.yourdomain.ru`

VPS assumptions:

- repo already cloned at `$VPS_APP_DIR`
- `infra/.env.production` already exists on the VPS
- Docker Engine and Docker Compose plugin are installed
- persistent named volumes already hold live data

The deploy workflow does not overwrite `infra/.env.production`. It writes image-tag overrides into `infra/.env.deploy` on the VPS and runs compose with both env files.

GitHub UI path:

1. Repository
2. `Settings`
3. `Secrets and variables`
4. `Actions`
5. `New repository secret` or `New repository variable`

If GitHub account restrictions still block checkout or workflow execution, GitHub Actions CD remains blocked until GitHub restores account access.

## First deploy checklist

1. SSH to the VPS as the deploy user.
2. Clone the repo:

```bash
git clone https://github.com/TruongTuanDev/trawberry-ai-commerce.git /opt/trawberry-ai-commerce
```

3. Enter the repo:

```bash
cd /opt/trawberry-ai-commerce
```

4. Create the production env:

```bash
cp infra/.env.production.example infra/.env.production
nano infra/.env.production
```

5. Log in to GHCR if private images are used:

```bash
echo TOKEN | docker login ghcr.io -u USER --password-stdin
```

6. Validate the compose file:

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production config
```

7. Start the stack:

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production up -d
```

8. Initialize Prisma:

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production exec backend-nest npm run prisma:generate
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production exec backend-nest npm run prisma:db:push
```

9. Run production smoke:

```bash
./infra/scripts/smoke-production.sh infra/.env.production
```

## Domain setup

Create these A records:

- `@` -> `VPS_IP`
- `www` -> `VPS_IP` optional
- `api` -> `VPS_IP`
- `storage` -> `VPS_IP`

Verify propagation:

```bash
nslookup yourdomain.ru
nslookup api.yourdomain.ru
nslookup storage.yourdomain.ru
```

Default nginx host mapping:

- `yourdomain.ru` -> `frontend-next`
- `api.yourdomain.ru` -> `backend-nest`
- `storage.yourdomain.ru` -> `minio`

## HTTPS

Two supported approaches:

1. Nginx + Certbot
   - Keep the included nginx config for HTTP routing.
   - Obtain certificates with Certbot on the VPS.
   - Add HTTPS termination before public launch.
   - Mount or copy certificate material into the nginx deployment path as part of operator setup.
2. Caddy
   - Replace nginx with Caddy if you want automatic certificate management.
   - Keep the same upstream targets:
     - `frontend-next:3000`
     - `backend-nest:3001`
     - `minio:9000`
3. Cloudflare proxy + origin cert
   - Optional if you already standardize TLS through Cloudflare.

Current state:

- the repo ships HTTP nginx routing
- HTTPS termination still must be completed before real public production traffic

## Database and Prisma

- PostgreSQL init already enables `uuid-ossp` through [infra/postgres-init/01-extensions.sql](/c:/Users/admin/trawberry-ai-commerce/infra/postgres-init/01-extensions.sql).
- Before first production release, run:

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production exec backend-nest npm run prisma:generate
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production exec backend-nest npm run prisma:db:push
```

- Seed or bootstrap admin only with controlled production-safe data.
- Do not import demo data into a real marketplace by default.

## Storage

- Production default is `STORAGE_DRIVER=s3` backed by MinIO.
- `minio-init` now bootstraps:
  - `MINIO_BUCKET` with the existing public policy
  - `S3_BUCKET` if it differs from `MINIO_BUCKET`
  - `AI_TRY_ON_BUCKET` with anonymous download enabled
- If AI Try-On images are stored in a dedicated bucket, set `AI_TRY_ON_BUCKET=ai-try-on` and keep it aligned with the bucket used by production AI Try-On writes.
- Public image URLs should resolve through `https://storage.yourdomain.ru/<bucket>/<key>`.
- Back up both PostgreSQL dumps and the `minio_data` volume.

## AI Try-On production note

- Default:
  - `AI_TRY_ON_ENABLED=false`
  - `AI_TRY_ON_PROVIDER=demo`
- `OPENAI_API_KEY` is optional and server-side only.
- Never expose the OpenAI key to frontend code or commit it into git.

## Smoke verification

```bash
./infra/scripts/smoke-production.sh
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production ps
```

The smoke script supports:

- `SITE_URL`
- `API_URL`
- optional HEAD checks for admin routes
- internal `ai-service` health via `docker exec`

This keeps the production smoke path login-free and OpenAI-free.

## Rollback

Image-based rollback is the default production recovery path:

1. Find the previous known-good image SHA tags in GHCR.
2. Update `infra/.env.deploy` on the VPS:

```bash
FRONTEND_IMAGE=ghcr.io/<owner>/<repo>/frontend-next:<previous-sha>
BACKEND_IMAGE=ghcr.io/<owner>/<repo>/backend-nest:<previous-sha>
AI_SERVICE_IMAGE=ghcr.io/<owner>/<repo>/ai-service:<previous-sha>
NGINX_IMAGE=ghcr.io/<owner>/<repo>/nginx:<previous-sha>
```

3. Re-run:

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production --env-file infra/.env.deploy up -d
```

4. Re-run smoke checks.
5. If the release included schema changes, restore from backup only if rollback cannot be made safe at the application layer.

## Operator commands

Status:

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production ps
```

Logs:

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production logs -f backend-nest
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production logs -f frontend-next
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production logs -f ai-service
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production logs -f nginx
```

Restart one service:

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production restart backend-nest
```

Manual update:

```bash
git pull
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production pull
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production up -d
```

Backup:

```bash
./infra/scripts/backup-postgres.sh infra/.env.production
```

Restore:

```bash
./infra/scripts/restore-postgres.sh infra/.env.production backups/file.sql
```

## Local dev compose

The existing [infra/docker-compose.yml](/c:/Users/admin/trawberry-ai-commerce/infra/docker-compose.yml) remains the local development compose file and is unchanged by the production deployment foundation.
