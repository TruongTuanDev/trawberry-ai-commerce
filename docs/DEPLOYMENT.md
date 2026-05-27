# Deployment

Production deployment for the active stack uses [infra/docker-compose.prod.yml](/c:/Users/admin/trawberry-ai-commerce/infra/docker-compose.prod.yml) and a real `infra/.env.production` file that is never committed.

## VPS sizing

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
- Deploy script: [infra/scripts/deploy.sh](/c:/Users/admin/trawberry-ai-commerce/infra/scripts/deploy.sh)

## Server setup

1. Install Docker Engine.
2. Install the Docker Compose plugin.
3. Open firewall ports `22`, `80`, and `443`.
4. Keep PostgreSQL, Redis, MinIO, and `ai-service` closed to the public internet.
5. Clone the repo on the VPS.
6. Copy `infra/.env.example` to `infra/.env.production`.
7. Replace every `change-me-*` value with a real secret.
8. Start the stack:

```bash
cd /opt/trawberry-ai-commerce
./infra/scripts/deploy.sh
```

## Domain setup

Create these A records:

- `@` -> `VPS_IP`
- `api` -> `VPS_IP`
- `storage` -> `VPS_IP`

Default nginx host mapping:

- `yourdomain.ru` -> `frontend-next`
- `api.yourdomain.ru` -> `backend-nest`
- `storage.yourdomain.ru` -> `minio`

## HTTPS

Two supported approaches:

1. Nginx + Certbot
   - Keep the included nginx config.
   - Obtain certificates with Certbot on the VPS.
   - Add `listen 443 ssl;` and certificate paths to the server blocks.
2. Caddy
   - Replace nginx with Caddy if you want automatic certificate management.
   - Keep the same upstream targets:
     - `frontend-next:3000`
     - `backend-nest:3001`
     - `minio:9000`

## Database and Prisma

- PostgreSQL init already enables `uuid-ossp` through [infra/postgres-init/01-extensions.sql](/c:/Users/admin/trawberry-ai-commerce/infra/postgres-init/01-extensions.sql).
- Before first production release, run:

```bash
cd /opt/trawberry-ai-commerce/backend-nest
npm run prisma:generate
npx prisma db push
```

- Seed or bootstrap admin only with controlled production-safe data.
- Do not import demo data into a real marketplace by default.

## Storage

- Production default is `STORAGE_DRIVER=s3` backed by MinIO.
- Create or verify bucket `S3_BUCKET`.
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

## Local dev compose

The existing [infra/docker-compose.yml](/c:/Users/admin/trawberry-ai-commerce/infra/docker-compose.yml) remains the local development compose file and is unchanged by the production deployment foundation.
