# backend-nest

## Return / Refund / Dispute Foundation

- Manual return/refund/dispute APIs now exist for customer, seller, and admin.
- Key docs:
  - `docs/RETURN_REFUND_DISPUTE.md`
  - `docs/API_RETURNS.md`
- Verification entry:

```bash
npm run smoke:return-refund-dispute
```

## Seller Finance

- Direct-to-seller payment now has a ledger-based fee model.
- Admin finance endpoints:
  - `GET /api/admin/finance/seller-fees`
  - `PATCH /api/admin/finance/shops/:shopId/commission`
  - `POST /api/admin/finance/shops/:shopId/invoices/generate`
  - `POST /api/admin/finance/invoices/:invoiceId/mark-paid`
  - `GET /api/admin/finance/invoices`
- Seller finance endpoints:
  - `GET /api/seller/shops/:shopId/dashboard-metrics`
  - `GET /api/seller/shops/:shopId/finance-ledger`
  - `GET /api/seller/shops/:shopId/invoices`
- Verification entry:

```bash
npm run smoke:seller-fee-dashboard
```

## Payment Method Strategy For Yandex Delivery

- Checkout payment method choices are now:
  - `PREPAID_SELLER_QR`
  - `PAY_ON_DELIVERY_SELLER_QR`
  - `DEPOSIT_THEN_DELIVERY_PAYMENT`
- `YANDEX_CARD_ON_DELIVERY` remains future-only.
- `CASH_COURIER_COLLECTION` remains unavailable.
- Verification entry:

```bash
npm run smoke:payment-method-choice
```

## Multi-Role Sessions

- Role-specific auth cookies:
  - `admin_access_token`
  - `seller_access_token`
  - `customer_access_token`
- Role-specific current-user endpoints:
  - `GET /api/auth/admin/me`
  - `GET /api/auth/seller/me`
  - `GET /api/auth/customer/me`
- Role-specific logout endpoints:
  - `POST /api/auth/admin/logout`
  - `POST /api/auth/seller/logout`
  - `POST /api/auth/customer/logout`
  - `POST /api/auth/logout-all`
- Bearer token fallback remains available for automation and smoke scripts.

## Auth Role Separation

- Preferred public auth endpoints:
  - `POST /api/auth/customer/register`
  - `POST /api/auth/customer/login`
  - `POST /api/auth/seller/register`
  - `POST /api/auth/seller/login`
  - `POST /api/auth/admin/login`
- Compatibility endpoints remain available:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
- Login supports email/password and phone/password.
- Public registration never creates admin accounts.

## Auth Hardening 2

- Auth login/register endpoints are throttled.
- Cookie auth expects explicit `CORS_ALLOWED_ORIGINS` when credentials are enabled.
- Phone identifiers normalize to a stable canonical form.
- Seller auth/session payloads now expose pending vs onboarding vs approved next-step state.

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
- `GET /api/shops/:shopId/ai-images/runtime`
- `POST /api/shops/:shopId/ai-images/tasks/:taskId/retry`
- `POST /api/shops/:shopId/products/:productId/images/:imageId/attach`
- `POST /api/shops/:shopId/imports/wildberries/preview`
- `POST /api/shops/:shopId/imports/wildberries/confirm`
- `GET /api/shops/:shopId/imports/wildberries/:importId`
- `GET /api/admin/dashboard/summary`
- `GET /api/customer/profile`
- `PATCH /api/customer/profile`
- `POST /api/customer/change-password`
- `GET /api/customer/addresses`
- `POST /api/customer/addresses`
- `PATCH /api/customer/addresses/:addressId`
- `DELETE /api/customer/addresses/:addressId`
- `POST /api/customer/addresses/:addressId/default`
- `GET /api/shops/:shopId/delivery/settings`
- `PATCH /api/shops/:shopId/delivery/settings`
- `GET /api/shops/:shopId/orders/:orderId/delivery`
- `POST /api/shops/:shopId/orders/:orderId/delivery/manual`
- `PATCH /api/shops/:shopId/orders/:orderId/delivery/shipments/:shipmentId/manual`
- `POST /api/shops/:shopId/orders/:orderId/delivery/shipments/:shipmentId/mark-courier-assigned`
- `POST /api/shops/:shopId/orders/:orderId/delivery/shipments/:shipmentId/mark-picked-up`
- `POST /api/shops/:shopId/orders/:orderId/delivery/shipments/:shipmentId/mark-in-transit`
- `POST /api/shops/:shopId/orders/:orderId/delivery/shipments/:shipmentId/mark-delivered`
- `GET /api/admin/deliveries`

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
- Host-side smoke scripts can use `AI_SERVICE_BASE_URL_HOST=http://127.0.0.1:8000`.
- Docker runtime that sends product images to `ai-service` should also set:
  - `BACKEND_PUBLIC_BASE_URL=http://127.0.0.1:3001`
  - `BACKEND_INTERNAL_BASE_URL=http://backend-nest:3001`
- Prisma maps existing legacy tables and does not change Spring Boot business logic.

## AI Service Runtime Notes

- `AI_WORKER_MODE=internal-mock`
  - stays fully local to `backend-nest`
- `AI_WORKER_MODE=ai-service`
  - calls `POST /internal/ai-images/generate`
  - rewrites local product image URLs for Docker-internal reachability before sending them to `ai-service`
- real OpenAI verification is opt-in only and must never be part of default test runs

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
- Manual Yandex workbench smoke: `npm run smoke:manual-yandex-workbench`.

## Manual Yandex delivery workbench

- Seller-managed no-provider Yandex flow is implemented on top of the delivery module.
- Yandex-preferred orders can move into `READY_TO_CREATE_YANDEX` after payment confirmation.
- Delivery shipment records now store manual Yandex placeholders for future real integration:
  - `manualYandexOrderId`
  - `yandexClaimId`
  - `yandexStatus`
  - `yandexPrice`
  - `yandexTrackingLink`
- Optional shipping and pickup coordinates are stored for map handoff and future carrier automation.

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

## Public Marketplace Contract

- Public list/detail remain limited to `PUBLISHED`, `ACTIVE`, readiness-passing products.
- Readiness still requires at least one sellable in-stock variant for tracked inventory products.
- Mixed-stock products can expose disabled out-of-stock variants in public detail.
- Fully out-of-stock tracked products are hidden from public list/detail.
- Checkout remains the source of truth and rejects unpublished, archived, invalid-variant, missing-price, and over-stock requests.
- Contract test: `npm test -- --runInBand public-products.e2e-spec.ts`.
- Runtime smoke: `npm run smoke:public-marketplace-contract`.

## Cart Validation Preflight

- Public cart preflight endpoint: `POST /api/public/cart/validate`.
- Shared backend validation service now powers both:
  - cart preflight
  - final checkout validation
- Customer-facing statuses include:
  - `PRODUCT_NOT_PUBLIC`
  - `PRODUCT_ARCHIVED`
  - `VARIANT_NOT_FOUND`
  - `OUT_OF_STOCK`
  - `QUANTITY_EXCEEDS_STOCK`
  - `MISSING_PRICE`
  - `PRICE_CHANGED`
- Smoke: `npm run smoke:cart-validation`.

## Customer Account Management

- Customer-only account APIs live under `/api/customer`.
- Profile:
  - `GET /api/customer/profile`
  - `PATCH /api/customer/profile`
- Password:
  - `POST /api/customer/change-password`
- Saved addresses:
  - `GET /api/customer/addresses`
  - `POST /api/customer/addresses`
  - `PATCH /api/customer/addresses/:addressId`
  - `DELETE /api/customer/addresses/:addressId`
  - `POST /api/customer/addresses/:addressId/default`
- Checkout supports optional `addressId` for authenticated customers while keeping manual address entry for guest/manual flows.

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
- Seller-safe runtime diagnostics are exposed through `GET /api/shops/:shopId/ai-images/runtime`.
- The dedicated seller UI route `/seller/ai-images` consumes this runtime endpoint to label mock, ai-service, OpenAI, or offline state without exposing secrets.
- Default verified seller runtime for this repo is:
  - `AI_WORKER_MODE=ai-service`
  - downstream `ai-service` with `AI_IMAGE_PROVIDER=mock`
  - `npm run smoke:ai-service-mock-images`
- Opt-in real OpenAI verification:
  - `npm run smoke:ai-service-openai-real`
  - requires `RUN_OPENAI_SMOKE=true`
  - must not be part of default CI or default local verification
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

## Docker Build Reliability

- Docker image builds use `npm ci`, not `npm install`.
- npm fetch retry settings are configured in the Dockerfile to reduce transient `ECONNRESET` failures.
- The backend Docker build now separates build dependencies, build output, production dependencies, and final runtime layers.
- Supported rebuild flow:

```bash
cd ..
docker compose -f infra/docker-compose.yml --env-file infra/.env build backend-nest
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d backend-nest
```

- Do not use host `dist` copy as a primary runtime fix path.

## Yandex Address Readiness

Useful scripts:

```bash
npm run smoke:yandex-address-readiness
npm run smoke:yandex-address-flow
```

The readiness smoke verifies:

- structured address without coordinates stays manual-ready
- manual lat/lng can promote the address to API-ready
- current manual checkout flow is not blocked by missing coordinates
