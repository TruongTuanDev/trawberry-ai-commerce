# Docker Build Reliability

This phase hardens the local Docker build path so `backend-nest` and `frontend-next` can be rebuilt without copying host `dist` or `.next` artifacts into running containers.

## What changed

- Both app Dockerfiles now use deterministic `npm ci`.
- Both app Dockerfiles configure npm fetch retries before install:
  - `fetch-retries=5`
  - `fetch-retry-factor=2`
  - `fetch-retry-mintimeout=20000`
  - `fetch-retry-maxtimeout=120000`
  - `registry=https://registry.npmjs.org/`
- Dependency install layers now copy `package*.json` before app source, which makes Docker layer caching effective when source changes but lockfiles do not.
- `backend-nest` now separates build dependencies, build output, production dependencies, and final runtime.
- `frontend-next` now builds a Next standalone runtime and starts from `server.js` inside the image.
- `.dockerignore` files now exclude local artifacts such as `node_modules`, `.next`, `dist`, Playwright reports, coverage, logs, `.env`, and `data.xlsx`.

## Why the npm retry config exists

The repository previously hit transient `npm ci` failures during image build with `ECONNRESET`. This phase does not bypass `npm ci`; it makes the install path more tolerant of short-lived registry/network interruptions.

## Verified build flow

```powershell
cd C:\Users\admin\trawberry-ai-commerce
docker compose -f infra/docker-compose.yml --env-file infra/.env build backend-nest frontend-next
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d backend-nest frontend-next
docker compose -f infra/docker-compose.yml --env-file infra/.env ps
curl.exe --ipv4 http://localhost:3001/api/health
curl.exe --ipv4 -I http://localhost:3000/products
```

No manual `docker cp` of `dist` or `.next` is part of the supported path anymore.

## Troubleshooting `ECONNRESET`

If `docker compose build` still fails:

1. Retry once before changing code.
2. Confirm Docker Desktop has network access to `https://registry.npmjs.org/`.
3. Run `docker builder prune -f`.
4. Re-run `docker compose -f infra/docker-compose.yml --env-file infra/.env build backend-nest frontend-next`.
5. Inspect `docker compose ... logs backend-nest frontend-next` if the failure persists.

Manual artifact copy is not an accepted release fix path.

## Post-rebuild smoke

```powershell
cd C:\Users\admin\trawberry-ai-commerce\backend-nest
npm run smoke:cart-validation
npm run smoke:public-marketplace-contract
npm run smoke:cart-checkout
npm run smoke:multi-shop-checkout
```

```powershell
cd C:\Users\admin\trawberry-ai-commerce\frontend-next
npm run test:e2e:cart-validation
npm run test:e2e:public-marketplace-contract
npm run test:e2e:product-buying-ux
```

## CI readiness notes

- Deterministic `npm ci` plus lockfiles make these Docker builds suitable for GitHub Actions.
- The images do not rely on host-generated build artifacts.
- Compose commands in docs can be reused later inside CI jobs or release workflows.
- Real `.env` files remain local-only and must not be committed.
