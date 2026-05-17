# backend-nest

NestJS backend runs in parallel with the legacy `strawberry-backend` Spring Boot service.

## Stack
- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- Redis
- BullMQ
- JWT auth
- Swagger/OpenAPI
- class-validator

## Core modules
- `auth`
- `users`
- `shops`
- `products`
- `product-images`
- `wb-imports`
- `files`
- `ai-images`

## Available APIs
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `GET /api/users/me`
- `GET /api/shops`
- `GET /api/shops/:shopId`
- `GET /api/shops/:shopId/products`
- `POST /api/shops/:shopId/products`
- `GET /api/shops/:shopId/products/:productId`
- `GET /api/shops/:shopId/products/:productId/readiness`
- `PATCH /api/shops/:shopId/products/:productId`
- `POST /api/shops/:shopId/products/:productId/publish`
- `POST /api/shops/:shopId/products/:productId/unpublish`
- `POST /api/shops/:shopId/products/:productId/archive`
- `POST /api/shops/:shopId/products/bulk`
- `POST /api/shops/:shopId/products/bulk-update`
- `DELETE /api/shops/:shopId/products/:productId`
- `GET /api/shops/:shopId/products/:productId/images`
- `POST /api/shops/:shopId/products/:productId/images`
- `DELETE /api/shops/:shopId/products/:productId/images/:imageId`
- `POST /api/files/upload-url`
- `POST /api/ai-images/generate`
- `POST /api/ai-images/try-on`
- `POST /api/shops/:shopId/products/:productId/ai-images/tasks`
- `GET /api/shops/:shopId/ai-images/tasks`
- `GET /api/shops/:shopId/ai-images/tasks/:taskId`
- `POST /api/shops/:shopId/ai-images/tasks/:taskId/retry`
- `POST /api/shops/:shopId/products/:productId/images/:imageId/attach`
- `POST /api/shops/:shopId/imports/wildberries/preview`
- `POST /api/shops/:shopId/imports/wildberries/confirm`
- `GET /api/shops/:shopId/imports/wildberries/:importId`
- `GET /api/admin/dashboard/summary`

## Seller Catalog Lifecycle

- WB Excel import and WB API sync create seller-catalog products first.
- Public marketplace and checkout require `catalogStatus=PUBLISHED`.
- Use readiness, publish, unpublish, archive, and bulk endpoints to curate imported products before they become public.
- Seller bulk editing supports category, price, stock, and inventory tracking updates across multiple selected products.
- `publishIfReady=true` can be used with `POST /api/shops/:shopId/products/bulk-update`, but only readiness-passing products are published.

## Local run

### 1. Install
```bash
npm install
```

### 2. Configure env
Create `.env` if needed:

```env
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/strawberry?schema=public
JWT_SECRET=change-me-local-secret
JWT_EXPIRES_IN=7d
REDIS_HOST=localhost
REDIS_PORT=6379
AI_WORKER_MODE=ai-service
AI_SERVICE_BASE_URL=http://localhost:8000
AI_SERVICE_INTERNAL_TOKEN=local-internal-token
AI_SERVICE_TIMEOUT_MS=120000
STORAGE_DRIVER=local
MAX_IMAGE_SIZE_MB=10
```

Notes:
- Default port is `3001` so it does not conflict with Spring Boot on `8080`.
- If you are using the Docker PostgreSQL from `infra/docker-compose.yml`, the host port is `5433`.
- Inside Docker, `DATABASE_URL` must use `postgres:5432`, not `localhost`.
- `STORAGE_DRIVER=local` is the bootstrap default for product image upload.
- Local uploaded files are served from `/uploads/*`.
- AI image task tables are defined in `prisma/migrations/20260510_add_ai_image_tables/migration.sql`.
- Local non-Docker runtime should use `AI_SERVICE_BASE_URL=http://localhost:8000`.
- Docker runtime should use `AI_SERVICE_BASE_URL=http://ai-service:8000`.
- Prisma maps existing legacy tables and does not change Spring Boot business logic.

### 3. Generate Prisma client
```bash
npm run prisma:generate
```

### 4. Start dev server
```bash
npm run start:dev
```

## Swagger
- `http://localhost:3001/api/docs`

## Product image upload
- Uses `JwtAuthGuard + ShopAccessGuard`
- Persists metadata into legacy `product_images`
- Stores files locally by default under `uploads/products/:shopId/:productId`
- Keeps legacy Spring Boot repo untouched

## Wildberries Excel import
- Seller endpoint for WB `.xlsx` exports from sheet `Товары`.
- Header row is `3`; product data rows are auto-detected after the Wildberries help row. The audited real export starts product rows at `5`.
- Preview groups rows by seller SKU into products and variants.
- Confirm import upserts products, variants, and remote image URLs. `REMOTE_URL` is the default MVP image mode; `DOWNLOAD_TO_STORAGE` is reserved for a future phase.
- Smoke: `npm run smoke:wb-import`.
- Full import-to-checkout smoke: `npm run smoke:wb-import-checkout`.
- Bulk edit smoke: `npm run smoke:bulk-product-edit`.

## Wildberries API sync
- Legacy reference audit: `docs/WB_LEGACY_SUCCESSFUL_FLOW_AUDIT.md`.
- Seller endpoints under `POST /api/shops/:shopId/wb-sync/*`.
- Supports sync all products and sync by article/vendorCode.
- Default `WB_SYNC_MODE=mock` does not call WB.
- Real mode requires:
  - `WB_SYNC_MODE=real`
  - `WB_API_BASE_URL=https://content-api.wildberries.ru`
  - `WB_CREDENTIAL_ENCRYPTION_KEY=...`
- Runtime seller flow never reads `WB_REAL_API_KEY`.
- Seller enters the API key in `/seller/import/wildberries-api`; backend stores it encrypted per `shopId`.
- Runtime sync uses the selected shop's encrypted credential from DB.
- `WB_REAL_API_KEY` is only a local smoke helper used to save a credential into a test shop.
- Credential APIs:
  - `POST /api/shops/:shopId/wb-sync/credentials`
  - `GET /api/shops/:shopId/wb-sync/credentials/status`
  - `GET /api/shops/:shopId/wb-sync/diagnostics`
  - `POST /api/shops/:shopId/wb-sync/credentials/verify`
  - `DELETE /api/shops/:shopId/wb-sync/credentials`
- Real mode never silently falls back to mock after an error.
- Mock mode never pretends to verify the real WB API. Verify returns `WB_MOCK_MODE_ACTIVE`.
- Safe verify errors include `WB_CREDENTIAL_MISSING`, `WB_CREDENTIAL_DECRYPT_FAILED`, `WB_UNAUTHORIZED_401`, `WB_FORBIDDEN_403`, `WB_RATE_LIMIT_429`, `WB_BAD_REQUEST_400`, `WB_EMPTY_RESPONSE`, and `WB_NETWORK_TIMEOUT`.
- Docker should not hide missing crypto config with a default fallback key.
- Default real request is aligned with the legacy successful call:
  - `Authorization: <apiKey>`
  - `Content-Type: application/json`
  - `settings.sort.ascending=true`
  - `settings.filter.withPhoto=-1`
- Smoke: `npm run smoke:wb-api-sync`.
- Optional real smoke:

```bash
WB_SYNC_MODE=real
WB_REAL_API_KEY=...
WB_REAL_TEST_ARTICLE=...
npm run smoke:wb-api-sync-real
```

- Stored-credential debug helper:

```bash
SHOP_ID=...
npm run debug:wb-credential
```

If Docker runtime picked up old env, rebuild:

```bash
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build backend-nest frontend-next
```

For manual real UI validation, do not set `WB_REAL_API_KEY`. Set only:

```bash
WB_SYNC_MODE=real
WB_CREDENTIAL_ENCRYPTION_KEY=<local secret>
```

Then rebuild, login seller, open `/seller/import/wildberries-api`, select the target shop, save the key, and run Verify.

## Category Mapping And Marketplace Search
- `npm run seed:demo` seeds internal marketplace categories and baseline WB mappings.
- Public category tree: `GET /api/categories`.
- Public catalog: `GET /api/public/products?q=&categorySlug=&brand=&color=&gender=&inStock=&sort=`.
- Smoke: `npm run smoke:marketplace-search`.
- WB Excel/API imports map categories but do not sync WB price or stock.

## Admin operations dashboard
- Admin-only summary endpoint: `GET /api/admin/dashboard/summary`.
- Supports optional `dateFrom`, `dateTo`, `shopId`, and `sellerId` filters.
- Smoke: `npm run smoke:admin-dashboard`.

## Admin operational queues
- Admin-only queue endpoints: `GET /api/admin/queues/sellers`, `/payments`, `/deliveries`, and `/inventory`.
- Queue items include age, SLA status, and task ownership fields when an admin task exists.
- Smoke: `npm run smoke:admin-queues`.

## Admin queue task ownership
- Admin-only task endpoints: `GET/POST /api/admin/queue-tasks`.
- Supported mutations: assign, unassign, status update, escalate, and list task events.
- Only admin users can be assigned to queue tasks.
- Smoke: `npm run smoke:admin-task-ownership`.

## Admin ops reporting
- Admin-only report endpoints under `GET /api/admin/reports/*`.
- Reports: ops summary, SLA breaches, workload, delivery exceptions, and payment aging.
- CSV exports: `sla-breaches.csv`, `workload.csv`, `delivery-exceptions.csv`, and `payment-aging.csv`.
- Smoke: `npm run smoke:admin-reports`.

## AI image tasks
- NestJS only creates tasks, checks credits, and enqueues BullMQ jobs.
- Worker calls the separate `ai-service` over `POST /internal/ai-images/generate`.
- Built-in retry and timeout handling are applied for the AI service call.
- If `BULLMQ_DISABLED=true`, the task is still created and local asynchronous processing is triggered inside NestJS for bootstrap testing.
# Cart Checkout Smoke

Useful script:

```bash
npm run smoke:cart-checkout
npm run smoke:multi-shop-checkout
npm run smoke:customer-order-history
npm run smoke:support-cases
```

The smoke creates one product with two variants, checks out both variants in one order, verifies seller/tracking item counts, verifies stock deduction, and confirms over-stock checkout fails.

The multi-shop smoke creates two approved sellers, two shops, and two products, then submits one cart checkout that creates one order per shop. It verifies grand total, per-shop totals, stock deduction for both variants, seller isolation, tracking for both order codes, payment queue isolation, and atomic failure on insufficient stock.

The customer history smoke creates a logged-in customer checkout, verifies the parent `checkoutCode`, customer history/detail, public receipt lookup by phone, wrong-phone rejection, and individual order tracking.

The support cases smoke creates checkout-level and order-level support cases, verifies admin public/internal messaging, verifies customer cannot see internal notes, verifies seller can reply on linked order cases, and verifies another seller is blocked.
