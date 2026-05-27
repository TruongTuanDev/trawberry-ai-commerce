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
cp infra/.env.example infra/.env.production
vi infra/.env.production
./infra/scripts/deploy.sh
```

## Standard release

```bash
cd /opt/trawberry-ai-commerce
git pull origin main
./infra/scripts/deploy.sh
```

## Health checks

- Public:
  - `curl -I https://yourdomain.ru/`
  - `curl -I https://yourdomain.ru/products`
  - `curl https://api.yourdomain.ru/api/health`
- Internal:
  - `docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production exec -T ai-service python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"`

## Logs

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production logs -f nginx
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production logs -f backend-nest frontend-next ai-service
```

## Database operations

- `uuid-ossp` is enabled by container init script.
- Run Prisma generate and db push before the first production bootstrap if the schema changed.
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
   - add certificate directives after issuing certs
2. Caddy
   - replace nginx if automatic TLS is preferred
   - keep the same backend targets

## Rollback

1. Inspect current git revision and image tags.
2. Check `docker compose ... ps` and logs.
3. Revert the repo to the last known-good commit.
4. Re-run `./infra/scripts/deploy.sh`.

## Incident notes

- If backend health fails, inspect Prisma migration state, database connectivity, and JWT/config secrets first.
- If frontend health fails, inspect `NEXT_PUBLIC_API_URL` and backend reachability.
- If ai-service health fails, inspect storage variables and internal token alignment.
- If storage uploads fail, inspect MinIO credentials, bucket policy, and `S3_PUBLIC_BASE_URL`.
