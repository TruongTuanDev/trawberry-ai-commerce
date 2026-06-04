# Production Runbook

## Scope

This runbook covers the active production Docker stack:

- `frontend-next`
- `backend-nest`
- `ai-service`
- `postgres`
- `redis`
- `minio`
- `nginx`

## Minimum operator baseline

- SSH key only access
- Docker Engine installed
- Docker Compose plugin installed
- firewall configured for `22`, `80`, and `443`
- repo cloned on the VPS
- `infra/.env.production` created locally on the server and never committed

## First deploy

```bash
cd /opt/trawberry-ai-commerce
cp infra/.env.production.example infra/.env.production
nano infra/.env.production
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production config
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production up -d
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production exec backend-nest npm run prisma:generate
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production exec backend-nest npx prisma migrate deploy
./infra/scripts/smoke-production.sh infra/.env.production
```

## Standard release

```bash
cd /opt/trawberry-ai-commerce
git pull origin main
./infra/scripts/deploy.sh
```

## GitHub Actions deploy path

Automated CD uses `.github/workflows/deploy.yml`.

Release flow:

1. CI must pass on the same commit.
2. GitHub Actions builds and pushes SHA-tagged images to GHCR.
3. The workflow SSHes into the VPS.
4. The VPS repo is updated to `origin/main`.
5. The workflow writes `infra/.env.deploy` with image overrides only.
6. Compose pulls the new images and runs `up -d`.
7. Production smoke checks run on the VPS.

Required GitHub secrets:

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`
- `VPS_APP_DIR`
- `VPS_PORT` optional
- `VPS_KNOWN_HOSTS` optional but recommended
- `GHCR_PAT` optional fallback if `GITHUB_TOKEN` is insufficient

Recommended GitHub variable:

- `DEPLOY_NEXT_PUBLIC_API_URL=https://api.yourdomain.ru`

## Health checks

- Public:
  - `curl -I https://yourdomain.ru/`
  - `curl -I https://yourdomain.ru/products`
  - `curl https://api.yourdomain.ru/api/health`
- Internal:
  - `docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production exec -T ai-service python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"`

## Storage bucket checks

- After deploy, verify the MinIO init job completed and the AI Try-On bucket is anonymously readable:

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production ps minio-init
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production run --rm minio-init mc anonymous get local/${AI_TRY_ON_BUCKET:-ai-try-on}
```

- Expected result for the AI Try-On bucket is anonymous download or equivalent public read.
- If a real generated image exists, verify the public URL no longer returns `AccessDenied`:

```bash
curl -I https://storage.yourdomain.ru/${AI_TRY_ON_BUCKET:-ai-try-on}/openai/<taskId>/1.png
```

## DNS checks

```bash
nslookup yourdomain.ru
nslookup api.yourdomain.ru
nslookup storage.yourdomain.ru
```

## Logs

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production logs -f nginx
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production logs -f backend-nest frontend-next ai-service
```

If image overrides are active, include `infra/.env.deploy`:

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production --env-file infra/.env.deploy ps
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production --env-file infra/.env.deploy logs -f backend-nest
```

## Database operations

- `uuid-ossp` is enabled by container init script.
- Run Prisma generate and migrate deploy on the running container if the schema changed:
  ```bash
  docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production exec backend-nest npx prisma migrate deploy
  ```
- > [!WARNING]
  > Never use `npx prisma db push --accept-data-loss` in production without a verified database backup. It can result in irreversible data loss.
- Keep seed/admin bootstrap explicit and controlled.

## Backups

```bash
./infra/scripts/backup-postgres.sh
```

MinIO volume backup should be scheduled separately at the volume or filesystem level.

## Restore warning

- Restore is destructive to live data state.
- Run only inside a maintenance window.
- Confirm application downtime expectations before starting.

## HTTPS options

1. Nginx + Certbot
   - keep the provided nginx topology
   - the current repo nginx config is HTTP-only
   - add certificate directives and HTTPS termination before public launch
2. Caddy
   - replace nginx if automatic TLS is preferred
   - keep the same backend targets
3. Cloudflare proxy + origin cert
   - optional if you already standardize DNS and TLS there

## GitHub secrets and variables

GitHub UI path:

1. Repository
2. `Settings`
3. `Secrets and variables`
4. `Actions`

Secrets:

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`
- `VPS_APP_DIR`
- `VPS_PORT` optional
- `VPS_KNOWN_HOSTS` optional
- `GHCR_PAT` optional

Variable:

- `DEPLOY_NEXT_PUBLIC_API_URL=https://api.yourdomain.ru`

If GitHub account restrictions still block checkout or Actions runner usage, the deploy workflow cannot execute until GitHub resolves the account state.

## Rollback

1. Inspect current GHCR image tags and the last known-good SHA.
2. Update `infra/.env.deploy` with the previous image tags.
3. Re-run:

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production --env-file infra/.env.deploy pull nginx backend-nest frontend-next ai-service
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production --env-file infra/.env.deploy up -d
```

4. Run [infra/scripts/smoke-production.sh](/c:/Users/admin/trawberry-ai-commerce/infra/scripts/smoke-production.sh) again.
5. If schema drift makes rollback unsafe, restore PostgreSQL from backup during a maintenance window.

## Restart one service

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production --env-file infra/.env.deploy restart backend-nest
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production --env-file infra/.env.deploy up -d frontend-next
```

## Manual first-deploy GHCR login

If GHCR images are private:

```bash
echo TOKEN | docker login ghcr.io -u USER --password-stdin
```

## GHCR image tag lookup

- GitHub UI:
  - `Packages` under the repository or owner namespace
- CLI/API:
  - inspect package versions in GHCR before updating `infra/.env.deploy`

## Incident notes

- If backend health fails, inspect Prisma migration state, database connectivity, and JWT/config secrets first.
- If frontend health fails, inspect `NEXT_PUBLIC_API_URL` and backend reachability.
- If ai-service health fails, inspect storage variables and internal token alignment.
- If storage uploads fail, inspect MinIO credentials, bucket policy, and `S3_PUBLIC_BASE_URL`.
