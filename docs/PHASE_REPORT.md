# Phase Report

## Public Buying UX Phase

- Added quick add vs select-size product cards on `/products`.
- Added marketplace-style public product detail layout on `/products/[id]`.
- Added variant pills with disabled out-of-stock state.
- Added quantity stepper with cart-aware selected variant quantity.
- Added sticky desktop purchase card and header cart badge updates.
- Added dedicated browser verification at `npm run test:e2e:product-buying-ux`.

## Seller Bulk Product Editing

- Added `POST /api/shops/:shopId/products/bulk-update` for category, price, stock, and track-inventory updates.
- Added variant scope support: `ALL_VARIANTS`, `MISSING_ONLY`, `FIRST_VARIANT_ONLY`.
- Added optional `publishIfReady` flow that publishes only products that pass readiness checks after bulk edit.
- Updated seller products UI with multi-select toolbar, bulk edit panel, and per-product readiness results.
- Added verification:
  - `npm run smoke:bulk-product-edit`
  - `npm run test:e2e:bulk-product-edit`

## Seller Product Curation + Publishing

- Added seller-catalog lifecycle fields and readiness checks for `IMPORTED`, `DRAFT`, `READY`, `PUBLISHED`, `UNPUBLISHED`, and `ARCHIVED`.
- WB Excel import and WB API sync now create private seller-catalog products first instead of auto-publishing them.
- Added seller publish, unpublish, archive, readiness, and bulk action APIs.
- Updated public marketplace and checkout to allow only `PUBLISHED` and readiness-passing products.
- Updated seller UI with catalog tabs, warning badges, bulk actions, and publish controls.
- Added dedicated verification targets:
  - `npm run smoke:product-curation`
  - `npm run test:e2e:product-curation`

## Category Mapping + Marketplace Search/Filter/Sort

- Added internal categories, source category mappings, and keyword fallback mapping.
- Integrated category mapping into WB Excel import and WB API product sync.
- Enhanced public `/products` with search, filters, sort, facets, and product detail category metadata.
- Enhanced seller product creation/listing with internal category selector and source category display.
- Added `smoke:marketplace-search` and `test:e2e:marketplace-search-filter-sort`.

## Parent-Level Payment + Support Workflow

- Added backend support models:
  - `support_cases`
  - `support_case_messages`
  - `support_case_events`
- Added customer support APIs on top of parent receipt `checkoutCode`
- Added admin support queue endpoints and UI
- Added seller shop-scoped support queue endpoints and UI
- Added support case summary to customer receipt detail and seller order detail
- Preserved payment and delivery flows per child shop order
- Enforced that internal admin messages are hidden from customer and seller views
- Added verification:
  - `backend-nest/test/support-cases.e2e-spec.ts`
  - `npm run smoke:support-cases`
  - `npm run test:e2e:support-cases`

## Wildberries Import To Checkout Verification

- Scope:
  - verify approved seller Wildberries Excel import through customer checkout
  - keep legacy `strawberry-frontend` and `strawberry-backend` untouched
  - avoid real OpenAI, Yandex, and CDEK calls
- Result:
  - added `backend-nest/scripts/smoke-wb-import-checkout.ps1`
  - added `npm run smoke:wb-import-checkout`
  - added `frontend-next/tests/e2e/wb-import-checkout-flow.spec.ts`
  - added `npm run test:e2e:wb-import-checkout`
  - seller product detail can update variant price as well as stock
  - public products and checkout now require approved seller, active shop/product, image, price `> 0`, and stock
- Flow covered:
  - WB import preview/confirm with sanitized fixture and `REMOTE_URL` images
  - seller price update to `1990` and stock update to `5`
  - public product listing/detail
  - customer checkout quantity `2`, backend total `3980`, pending payment/order
  - stock deduction to `3`
  - insufficient stock rejection
  - customer tracking and seller order/payment visibility
  - re-import idempotency for products, variants, and images

## Scope
Review the current Docker Compose runtime for `C:\Users\admin\trawberry-ai-commerce`, verify commit safety, and prepare a clean commit checklist without changing business logic.

Constraints followed:
- no changes in `strawberry-frontend`
- no changes in `strawberry-backend`
- no OpenAI real calls
- no `.env` real files committed

## Docker Setup Review Result

### Compose wiring
Verified current Docker runtime wiring:
- `backend-nest -> ai-service`: `http://ai-service:8000`
- `backend-nest -> postgres`: `postgres:5432`
- `backend-nest -> redis`: `redis:6379`
- `ai-service -> minio`: `http://minio:9000`
- browser -> `frontend-next`: `http://localhost:3000`
- browser -> `backend-nest`: `http://localhost:3001`
- host -> PostgreSQL: `localhost:5433`

### PostgreSQL
- `infra/postgres-init/01-extensions.sql` contains:
  - `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`
- Docker mapping is correct:
  - host port: `5433`
  - container port: `5432`
- `DATABASE_URL` inside Docker uses `postgres:5432`, not `localhost`

### AI Service
- `ai-service` runs on port `8000`
- default Docker provider is `AI_IMAGE_PROVIDER=mock`
- default Docker setup does not call OpenAI
- `AI_SERVICE_INTERNAL_TOKEN` is shared between `backend-nest` and `ai-service` through `infra/.env`

### MinIO / S3
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`
- Docker-internal S3 endpoint: `http://minio:9000`
- public base URL in the local stack is `http://localhost:9000/<bucket>`
- bucket bootstrap is handled automatically by the `minio-init` service

### Healthchecks
Verified configured healthchecks use commands that exist in the target images:
- `postgres`: `pg_isready`
- `redis`: `redis-cli ping`
- `minio`: `curl`
- `ai-service`: `python`
- `backend-nest`: `wget`
- `frontend-next`: `wget`

## Containers Status

`docker compose -f infra/docker-compose.yml --env-file infra/.env ps` showed:
- `postgres`: healthy
- `redis`: healthy
- `minio`: healthy
- `ai-service`: healthy
- `backend-nest`: healthy
- `frontend-next`: healthy

Current result: `6/6` containers healthy.

## Smoke Integration Result

Verified:
- backend health: pass
- ai-service health: pass
- frontend login page reachable: pass
- MinIO console reachable: pass
- `npm run smoke:ai-service-integration`: pass

Smoke flow confirmed:
- create user
- approve seller local
- create shop
- create product
- upload image
- AI mock generate image
- attach generated image
- credit decreases correctly

## Verification Run

### Docker
- `docker compose -f infra/docker-compose.yml --env-file infra/.env config`: pass
- `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: pass

### Health endpoints
- `GET http://localhost:3001/api/health`: pass
- `GET http://localhost:8000/health`: pass
- `GET http://localhost:3000/login`: pass
- `GET http://localhost:9001`: pass

### backend-nest
- `npm run smoke:ai-service-integration`: pass
- `npm run lint`: pass
- `npm test -- --runInBand`: pass
- `npm run build`: pass

### frontend-next
- `npm run lint`: pass
- `npm run build`: pass

### ai-service
- `python -m compileall app`: pass
- `python -m pytest -q`: pass

## Git Safety Review

### Git status summary before this doc update
- working tree was clean
- no pending code changes were found before the documentation refresh

### Tracked env files
`git ls-files | Select-String "\.env"` returned only:
- `ai-service/.env.example`
- `backend-nest/.env.example`
- `frontend-next/.env.example`
- `infra/.env.example`

Conclusion:
- no real `.env` files are tracked by Git

### Root and service ignore rules
Reviewed:
- `.gitignore`
- `backend-nest/.gitignore`
- `ai-service/.gitignore`
- `frontend-next/.gitignore`

Current ignore rules correctly exclude:
- `.env`
- `.env.local`
- `*.env`
while allowing:
- `.env.example`

## Legacy Apps Review
- no changes detected in `strawberry-frontend`
- no changes detected in `strawberry-backend`

## Files Changed In This Review
- `docs/DEPLOYMENT.md`
- `docs/CONFIG_AUDIT.md`
- `docs/PROJECT_STATUS.md`
- `docs/RUNTIME_ENV.md`
- `docs/PHASE_REPORT.md`
- `ai-service/README.md`
- `backend-nest/README.md`

## Documentation Cleanup Result
- cleaned remaining references to the old repo path `C:\Users\admin\trawberry`
- removed remaining `ai-service` port `8010` references in reviewed runtime docs
- aligned Docker documentation to:
  - host PostgreSQL `localhost:5433`
  - container PostgreSQL `postgres:5432`
  - Docker `AI_SERVICE_BASE_URL=http://ai-service:8000`
  - local non-Docker `AI_SERVICE_BASE_URL=http://localhost:8000`
- confirmed OpenAI docs still describe `AI_IMAGE_PROVIDER=mock` as the default and real OpenAI only when:
  - `AI_IMAGE_PROVIDER=openai`
  - `RUN_OPENAI_SMOKE=true`
  - `OPENAI_API_KEY` is present

## Files Reviewed
- `docs/*.md`
- `ai-service/README.md`
- `backend-nest/README.md`
- `frontend-next/README.md`
- `infra/docker-compose.yml`
- `infra/.env.example`
- `infra/postgres-init/01-extensions.sql`

## Remaining Outdated References
- No outdated path/port/runtime-env references remain in the reviewed runtime docs set.
- Legacy app names `strawberry-frontend` and `strawberry-backend` still appear where they are part of migration context. Those are intentional and were not changed.

## Project Status Audit
- Created:
  - `docs/PROJECT_STATUS.md`
- Purpose:
  - provide a consolidated repo-wide status report
  - distinguish runtime-verified features from code-only or partial features
  - summarize APIs, pages, AI pipeline, Docker runtime, risks, and roadmap
- Verification recorded for this audit:
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `ai-service python -m compileall app`: pass
  - `ai-service python -m pytest -q`: pass
  - `docker compose ... config`: pass
  - `docker compose ... ps`: pass
  - `backend-nest npm run smoke:ai-service-integration`: pass
- Suggested next steps:
  - verify real OpenAI runtime in a controlled environment
  - close frontend auth/cookie messaging drift
  - deepen orders/payment/customer-side verification

## Cookie Auth UX Hardening

- Scope:
  - complete cookie-first auth UX in `frontend-next`
  - keep `Authorization: Bearer` fallback in `backend-nest`
  - add logout endpoint coverage and cookie assertions
- Files changed:
  - `backend-nest/src/modules/auth/auth.controller.ts`
  - `backend-nest/test/auth.e2e-spec.ts`
  - `frontend-next/src/lib/auth-api.ts`
  - `frontend-next/src/lib/seller-api.ts`
  - `frontend-next/src/stores/auth-store.ts`
  - `frontend-next/src/stores/seller-workspace-store.ts`
  - `frontend-next/src/components/auth/login-form.tsx`
  - `frontend-next/src/components/auth/protected-shell.tsx`
  - `frontend-next/src/components/seller/seller-shell.tsx`
  - `frontend-next/src/app/login/page.tsx`
  - `frontend-next/src/app/page.tsx`
  - `frontend-next/src/app/seller/products/[id]/page.tsx`
  - `frontend-next/src/app/seller/products/[id]/images/page.tsx`
  - `docs/SECURITY.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/FRONTEND_PRODUCTS.md`
  - `docs/PHASE_REPORT.md`
- Result:
  - login remains compatible with response-body tokens for scripts, but frontend runtime no longer stores raw JWTs
  - protected routes re-hydrate the real session via `GET /api/auth/me`
  - logout now clears cookie on the backend and clears local auth/shop hydration state on the frontend
  - auth e2e now covers `Set-Cookie`, cookie-backed `/api/auth/me`, logout cookie clearing, and bearer fallback
- Verification for this pass:
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `docker compose ... ps`: pass (`6/6` healthy)
  - `GET http://localhost:3001/api/health`: pass
  - `GET http://localhost:3000/login`: pass
- Manual auth smoke:
  - backend HTTP cookie smoke passed:
    - register: `201`
    - login: `200`
    - cookie stored in session: yes
    - `GET /api/auth/me` with cookie: `200`
    - `POST /api/auth/logout`: `200`
    - `GET /api/auth/me` after logout: `401`
  - browser-only refresh/redirect behavior was not replayed with a headless browser in this pass

## Browser Auth E2E Smoke

- Scope:
  - add Playwright browser smoke coverage for cookie-based auth UX
  - verify login, reload persistence, logout, protected-route redirect, and no raw JWT in `localStorage`
- Files changed:
  - `frontend-next/package.json`
  - `frontend-next/playwright.config.ts`
  - `frontend-next/tests/e2e/auth-cookie.spec.ts`
  - `frontend-next/src/components/auth/login-form.tsx`
  - `frontend-next/src/components/seller/seller-shell.tsx`
  - `frontend-next/README.md`
  - `docs/SECURITY.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PHASE_REPORT.md`
- Result:
  - browser smoke now creates a seller via backend API, signs in through the real login form, reloads `/seller/dashboard`, logs out, and confirms protected-route redirect
  - test explicitly checks that `localStorage` does not contain raw JWT-like values
- Verification for this pass:
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:auth`: pass
  - `docker compose ... ps`: pass
  - `GET http://localhost:3001/api/health`: pass
  - `GET http://localhost:3000/login`: pass
- Notes:
  - Playwright initially failed because browser binaries were not installed yet
  - `npx playwright install chromium` was run successfully before the passing E2E execution

## Orders / Payments Audit

- Scope:
  - audit current Orders and Payments implementation status across `backend-nest`, `frontend-next`, Prisma schema, tests, smoke scripts, and docs
  - add minimal runtime smoke for seller Orders if basic APIs existed
- Files changed:
  - `backend-nest/package.json`
  - `backend-nest/scripts/smoke-orders.ps1`
  - `docs/API_ORDERS.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PHASE_REPORT.md`
- Result:
  - Orders are implemented for seller-side operations in NestJS:
    - list orders
    - get order detail
    - update fulfillment status
  - Orders are connected in Next.js:
    - `/seller/orders`
    - `/seller/orders/[id]`
  - Orders now have dedicated runtime smoke coverage via `npm run smoke:orders`
  - Payments are not migrated as a standalone NestJS module
  - Current payment support in the new stack is limited to:
    - `paymentStatus` on orders
    - `paymentInstructions` on shops
  - No NestJS payment provider integration, approval/rejection endpoints, webhook handlers, or Next.js payment review pages exist yet
- Verification for this pass:
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `backend-nest npm run smoke:orders`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:auth`: pass
  - `docker compose ... ps`: pass (`6/6` healthy)
  - `GET http://localhost:3001/api/health`: pass
  - `GET http://localhost:3000/login`: pass

## Customer Checkout / Create Order MVP

- Scope:
  - add public product browsing endpoints in `backend-nest`
  - add `POST /api/checkout/orders`
  - allow anonymous checkout while preserving seller order visibility
  - add minimal public customer pages in `frontend-next`
- Files changed:
  - `backend-nest/src/modules/public-products/*`
  - `backend-nest/src/modules/checkout/*`
  - `backend-nest/src/modules/orders/*`
  - `backend-nest/src/common/guards/optional-jwt-auth.guard.ts`
  - `backend-nest/test/checkout.e2e-spec.ts`
  - `backend-nest/scripts/smoke-checkout.ps1`
  - `frontend-next/src/lib/public-api.ts`
  - `frontend-next/src/app/products/*`
  - `frontend-next/src/app/checkout/page.tsx`
  - `frontend-next/src/components/public/checkout-page-client.tsx`
  - `frontend-next/src/components/orders/*`
  - `docs/API_CHECKOUT.md`
  - `docs/API_ORDERS.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PHASE_REPORT.md`
- Result:
  - customer can browse public products in the new stack
  - customer can create an anonymous order through `POST /api/checkout/orders`
  - checkout defaults order `status=PENDING`
  - checkout defaults `paymentStatus=PENDING` for manual transfer and `UNPAID` for COD
  - backend computes `totalAmount` and rejects mismatched shop/product/inactive product/invalid quantity
  - seller orders list/detail can see the new order without changing the seller API contract
  - seller UI now renders `PENDING` order status safely alongside legacy `NEW`
- Verification for this pass:
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env config`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: pass (`6/6` healthy)
  - `GET http://localhost:3001/api/health`: pass
  - `GET http://localhost:3000/login`: pass
  - `GET http://localhost:8000/health`: pass
  - `backend-nest npm run smoke:orders`: pass
  - `backend-nest npm run smoke:checkout`: pass
  - `frontend-next npm run test:e2e:auth`: pass
- Runtime notes:
  - PowerShell alias `curl` on this machine returned `NullReferenceException` from `Invoke-WebRequest`
  - runtime endpoints were verified successfully with explicit `Invoke-WebRequest -UseBasicParsing`
  - no business-logic fix was required after Docker came up; runtime failures from the previous pass were environment-only

## Manual Payment Review MVP

- Scope:
  - add seller-side manual payment review APIs in `backend-nest`
  - add additive audit logging via `payment_review_logs`
  - add seller payment review pages in `frontend-next`
  - preserve checkout, orders, and auth flows
- Files changed:
  - `backend-nest/prisma/schema.prisma`
  - `backend-nest/prisma/migrations/20260512_add_payment_review_logs/migration.sql`
  - `backend-nest/src/modules/payments/*`
  - `backend-nest/src/modules/orders/orders.service.ts`
  - `backend-nest/test/payments.e2e-spec.ts`
  - `backend-nest/scripts/smoke-payments.ps1`
  - `frontend-next/src/lib/seller-api.ts`
  - `frontend-next/src/components/payments/*`
  - `frontend-next/src/app/seller/payments/*`
  - `frontend-next/src/components/seller/seller-shell.tsx`
  - `docs/API_PAYMENTS.md`
  - `docs/API_ORDERS.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PHASE_REPORT.md`
- Result:
  - seller can list pending/unpaid payment review items
  - seller can open payment detail with customer snapshot, item snapshot, payment method, and payment instructions
  - seller can add note, mark paid, and reject when the transition is valid
  - every action creates an audit record in `payment_review_logs`
  - seller order detail reflects the new `paymentStatus`
  - seller fulfillment can continue after `paymentStatus=PAID`
- Verification for this pass:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `backend-nest npm run smoke:orders`: pass
  - `backend-nest npm run smoke:checkout`: pass
  - `backend-nest npm run smoke:payments`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:auth`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env config`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: pass (`6/6` healthy)
  - `GET http://localhost:3001/api/health`: pass
  - `GET http://localhost:3000/login`: pass
  - `GET http://localhost:8000/health`: pass
- Runtime notes:
  - Playwright auth initially failed because the browser runtime hit `localhost:3001` while the host stack was reliably reachable at `127.0.0.1:3001`
  - fixed by normalizing frontend and Playwright API defaults to `127.0.0.1`, and by allowing both `localhost` and `127.0.0.1` in backend CORS
  - no payment business logic changes were required after runtime validation

## Customer Order Tracking / Payment Proof Upload MVP

- Scope:
  - add public order tracking APIs in `backend-nest`
  - add public customer payment proof upload backed by the existing storage service
  - expose payment proof inside seller payment detail
  - preserve checkout, payments, orders, and auth flows
- Files changed:
  - `backend-nest/prisma/schema.prisma`
  - `backend-nest/prisma/migrations/20260512_add_order_payment_proof_fields/migration.sql`
  - `backend-nest/src/modules/order-tracking/*`
  - `backend-nest/src/modules/files/files.service.ts`
  - `backend-nest/src/modules/checkout/*`
  - `backend-nest/src/modules/payments/*`
  - `backend-nest/test/order-tracking.e2e-spec.ts`
  - `backend-nest/scripts/smoke-order-tracking.ps1`
  - `frontend-next/src/lib/public-api.ts`
  - `frontend-next/src/lib/seller-api.ts`
  - `frontend-next/src/app/orders/*`
  - `frontend-next/src/components/public/*`
  - `frontend-next/src/components/payments/*`
  - `docs/API_ORDER_TRACKING.md`
  - `docs/API_CHECKOUT.md`
  - `docs/API_PAYMENTS.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PHASE_REPORT.md`
- Result:
  - customer can track by `orderCode + phone` or `orderId + phone`
  - customer can upload payment proof without a customer account
  - proof is stored through the shared storage service and linked on `orders`
  - proof upload writes `PaymentReviewLog.action = UPLOAD_PROOF`
  - seller payment detail shows proof metadata and proof link
  - seller can still mark paid after proof upload
  - customer tracking reflects `paymentStatus=PAID` after seller review
- Verification for this pass:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `backend-nest npm run smoke:orders`: pass
  - `backend-nest npm run smoke:checkout`: pass
  - `backend-nest npm run smoke:payments`: pass
  - `backend-nest npm run smoke:order-tracking`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:auth`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: pass (`6/6` healthy)
  - `GET http://localhost:3001/api/health`: pass
  - `GET http://localhost:3000/login`: pass
  - `GET http://localhost:8000/health`: pass

## Public Marketplace UI Polish

- Scope:
  - polish the customer-facing pages in `frontend-next`
  - add shared public navigation and footer without touching seller shell
  - improve loading, empty, error, and confirmation states for public flows
  - add lightweight Playwright smoke for public routes
- Files changed:
  - `frontend-next/src/app/page.tsx`
  - `frontend-next/src/app/products/*`
  - `frontend-next/src/components/public/*`
  - `frontend-next/src/app/layout.tsx`
  - `frontend-next/src/app/globals.css`
  - `frontend-next/tests/e2e/public-smoke.spec.ts`
  - `frontend-next/package.json`
  - `frontend-next/README.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PHASE_REPORT.md`
- Result:
  - home page now behaves like a storefront landing page
  - `/products` is more responsive and resilient for demo use
  - product detail uses a gallery and clearer checkout CTA
  - checkout presents a clearer multi-step narrative and stronger confirmation state
  - tracking pages are easier to use and proof upload feedback is clearer
  - seller pages remain untouched in structure and behavior
- Verification for this pass:
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - runtime verification recorded in the final verification section for this phase

## Seeded Public Demo Data + Full Customer E2E

- Scope:
  - add stable idempotent demo seed data for the public marketplace
  - add Playwright full customer coverage from browse to proof upload
  - preserve existing auth, checkout, tracking, payment, and seller flows
- Files changed:
  - `backend-nest/package.json`
  - `backend-nest/scripts/seed-demo.js`
  - `frontend-next/package.json`
  - `frontend-next/src/app/products/[id]/page.tsx`
  - `frontend-next/src/components/public/public-product-detail-page-client.tsx`
  - `frontend-next/public/demo/*`
  - `frontend-next/tests/e2e/public-full.spec.ts`
  - `frontend-next/src/components/public/product-card.tsx`
  - `frontend-next/src/components/public/checkout-page-client.tsx`
  - `frontend-next/src/components/public/order-track-detail-page-client.tsx`
  - `frontend-next/README.md`
  - `docs/DEMO_DATA.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PHASE_REPORT.md`
- Result:
  - `npm run seed:demo` now creates a stable approved seller, active shop, payment instructions, and 3 active public products
  - demo seed is idempotent and blocked in production unless `DEMO_SEED_CONFIRM=true`
  - seeded product images are served from local static SVG assets in `frontend-next/public/demo`
  - `/products/[id]` now follows the same async server-wrapper pattern already used by `/checkout` and `/orders/[id]`, which fixed the production navigation error on the product detail route
  - public full Playwright flow now covers:
    - home
    - products
    - product detail
    - checkout
    - order confirmation
    - tracking by phone
    - payment proof upload
  - public pages now expose stable test selectors for critical customer actions without changing API contracts
- Verification for this pass:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run seed:demo`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `backend-nest npm run smoke:checkout`: pass
  - `backend-nest npm run smoke:order-tracking`: pass
  - `backend-nest npm run smoke:payments`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:auth`: pass
  - `frontend-next npm run test:e2e:public`: pass
  - `frontend-next npm run test:e2e:public-full`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: pass (`6/6` healthy)
  - `GET http://localhost:3001/api/health`: pass
  - `GET http://localhost:3000/products`: pass
  - `GET http://localhost:8000/health`: pass
- Runtime notes:
  - the first seed implementation used inline `data:` URLs for product images, but `product_images.wb_url/local_url` length limits rejected them
  - replaced that approach with local static SVG assets under `frontend-next/public/demo`
  - `public-full` initially failed because it clicked the first public product card, which was unstable in a mixed demo + smoke dataset
  - the test now targets a seeded product by name and uses stricter route assertions

## Full E2E Seller Payment Review After Customer Proof

- Scope:
  - extend Playwright coverage to include seller review after customer payment proof upload
  - keep the flow browser-level where practical and reuse the demo seed account
  - preserve existing auth, public, checkout, tracking, and payments smoke coverage
- Files changed:
  - `frontend-next/package.json`
  - `frontend-next/tests/e2e/public-payment-review.spec.ts`
  - `frontend-next/src/components/payments/payment-status-badge.tsx`
  - `frontend-next/src/components/payments/seller-payment-detail-page-client.tsx`
  - `frontend-next/src/components/public/order-track-detail-page-client.tsx`
  - `frontend-next/README.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PHASE_REPORT.md`
- Result:
  - a full browser E2E now covers:
    - customer checkout with unique phone
    - customer tracking lookup
    - customer payment proof upload
    - seller login with seeded demo seller
    - seller payment proof visibility
    - seller mark paid
    - customer re-check showing `paymentStatus=PAID`
  - seller review uses direct detail route `/seller/payments/[orderId]` instead of list search to keep the test deterministic without expanding seller UI scope
- Verification for this pass:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run seed:demo`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `backend-nest npm run smoke:checkout`: pass
  - `backend-nest npm run smoke:order-tracking`: pass
  - `backend-nest npm run smoke:payments`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:auth`: pass
  - `frontend-next npm run test:e2e:public`: pass
  - `frontend-next npm run test:e2e:public-full`: pass
  - `frontend-next npm run test:e2e:public-payment-review`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: pass (`6/6` healthy)
  - `curl.exe --ipv4 http://localhost:3001/api/health`: pass
  - `curl.exe --ipv4 -I http://localhost:3000/products`: pass
  - `curl.exe --ipv4 http://localhost:8000/health`: pass
- Runtime notes:
  - the new flow required a frontend container rebuild before Playwright could see newly added `data-testid` hooks on tracking and seller payment detail pages
  - no backend API or status transition changes were required for this phase

## Inventory / Stock Management MVP

- Scope:
  - add seller inventory read/update endpoints in `backend-nest`
  - expose public product availability for marketplace pages
  - enforce inventory checks inside checkout and deduct stock on success
  - keep existing checkout, order tracking, payments, and auth flows passing
- Files changed:
  - `backend-nest/src/modules/products/products.controller.ts`
  - `backend-nest/src/modules/products/products.service.ts`
  - `backend-nest/src/modules/products/dto/product-inventory-response.dto.ts`
  - `backend-nest/src/modules/products/dto/update-product-inventory.dto.ts`
  - `backend-nest/src/modules/public-products/*`
  - `backend-nest/src/modules/checkout/checkout.service.ts`
  - `backend-nest/test/product.e2e-spec.ts`
  - `backend-nest/test/checkout.e2e-spec.ts`
  - `backend-nest/scripts/smoke-inventory.ps1`
  - `frontend-next/src/app/seller/products/[id]/page.tsx`
  - `frontend-next/src/components/public/product-card.tsx`
  - `frontend-next/src/components/public/public-product-detail-page-client.tsx`
  - `frontend-next/src/components/public/checkout-page-client.tsx`
  - `frontend-next/src/lib/public-api.ts`
  - `frontend-next/src/lib/seller-api.ts`
  - `docs/API_INVENTORY.md`
  - `docs/API_PRODUCTS.md`
  - `docs/API_CHECKOUT.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PHASE_REPORT.md`
- Result:
  - seller can read and update stock per product from the new stack
  - public product listing/detail now show availability and disable checkout when out of stock
  - checkout validates stock, deducts available quantity immediately, and keeps reservation bookkeeping in the same transaction
  - insufficient stock returns a clear `400` instead of overselling
  - existing cancellation and delivered flows continue to release or restore inventory through the seller order lifecycle
- Verification for this pass:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run seed:demo`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `backend-nest npm run smoke:checkout`: pass
  - `backend-nest npm run smoke:order-tracking`: pass
  - `backend-nest npm run smoke:payments`: pass
  - `backend-nest npm run smoke:inventory`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:auth`: pass
  - `frontend-next npm run test:e2e:public`: pass
  - `frontend-next npm run test:e2e:public-full`: pass
  - `frontend-next npm run test:e2e:public-payment-review`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: pass (`6/6` healthy)
  - `curl.exe --ipv4 http://localhost:3001/api/health`: pass
  - `curl.exe --ipv4 -I http://localhost:3000/products`: pass
  - `curl.exe --ipv4 http://localhost:8000/health`: pass
- Runtime notes:
  - inventory reuses existing `product_variants.stockQuantity` and `reservedStock` rather than adding a new schema field
  - public availability uses current sellable stock directly, while reservation counts remain visible to sellers for operational context

## Low Stock Alerts / Seller Inventory UX

- Scope:
  - add seller low-stock and out-of-stock status metadata to product list responses
  - add stock-status filters and quick stock update in the seller product list
  - improve seller product detail inventory visibility
  - preserve checkout, public marketplace, payments, and auth flows
- Files changed:
  - `backend-nest/prisma/schema.prisma`
  - `backend-nest/prisma/migrations/20260513_add_product_variant_inventory_flags/migration.sql`
  - `backend-nest/src/modules/products/*`
  - `backend-nest/test/product.e2e-spec.ts`
  - `backend-nest/test/checkout.e2e-spec.ts`
  - `backend-nest/scripts/smoke-inventory-alerts.ps1`
  - `backend-nest/package.json`
  - `frontend-next/src/components/products/*`
  - `frontend-next/src/app/seller/products/[id]/page.tsx`
  - `frontend-next/src/lib/seller-api.ts`
  - `docs/API_INVENTORY.md`
  - `docs/API_PRODUCTS.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PHASE_REPORT.md`
- Result:
  - seller product list now shows `IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`, and `NOT_TRACKED` states
  - seller can filter products by `IN_STOCK`, `LOW_STOCK`, and `OUT_OF_STOCK`
  - seller can quick-update stock from the list for single-variant products
  - product detail inventory view now shows threshold-aware status more clearly
  - backend product list and inventory responses now expose threshold/tracking metadata required by the UX
- Verification for this pass:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run seed:demo`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `backend-nest npm run smoke:checkout`: pass
  - `backend-nest npm run smoke:order-tracking`: pass
  - `backend-nest npm run smoke:payments`: pass
  - `backend-nest npm run smoke:inventory`: pass
  - `backend-nest npm run smoke:inventory-alerts`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:auth`: pass
  - `frontend-next npm run test:e2e:public`: pass
  - `frontend-next npm run test:e2e:public-full`: pass
  - `frontend-next npm run test:e2e:public-payment-review`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: pass (`6/6` healthy)
  - `curl.exe --ipv4 http://localhost:3001/api/health`: pass
  - `curl.exe --ipv4 -I http://localhost:3000/products`: pass
  - `curl.exe --ipv4 http://localhost:8000/health`: pass

## Multi-Carrier Delivery Foundation / Yandex-first MVP

- Scope:
  - replace the earlier single-provider delivery direction with a generic multi-carrier foundation
  - introduce seller delivery settings, generic delivery offers, shipments, and events
  - keep mock mode as the default verified runtime for CI and local smoke coverage
  - prioritize Yandex for same-city express and CDEK for fallback, pickup, and inter-city delivery
- Files changed:
  - `backend-nest/prisma/schema.prisma`
  - `backend-nest/prisma/migrations/20260513_add_yandex_delivery_tables/migration.sql`
  - `backend-nest/src/modules/delivery/*`
  - `backend-nest/src/modules/orders/*`
  - `backend-nest/src/modules/order-tracking/*`
  - `backend-nest/test/delivery.e2e-spec.ts`
  - `backend-nest/scripts/smoke-delivery.ps1`
  - `backend-nest/package.json`
  - `backend-nest/.env.example`
  - `infra/.env.example`
  - `infra/docker-compose.yml`
  - `frontend-next/src/lib/seller-api.ts`
  - `frontend-next/src/lib/public-api.ts`
  - `frontend-next/src/app/seller/settings/page.tsx`
  - `frontend-next/src/components/seller/seller-delivery-settings-page-client.tsx`
  - `frontend-next/src/components/orders/seller-order-detail-page-client.tsx`
  - `frontend-next/src/components/public/order-track-detail-page-client.tsx`
  - `docs/DELIVERY_PROVIDERS.md`
  - `docs/API_DELIVERY.md`
  - `docs/API_DELIVERY_CDEK.md`
  - `docs/API_ORDERS.md`
  - `docs/API_ORDER_TRACKING.md`
  - `docs/RUNTIME_ENV.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PHASE_REPORT.md`
- Result:
  - a generic delivery module now exists in `backend-nest` with a provider abstraction instead of carrier-specific controller design
  - shops can store pickup address, pickup contact, enabled carriers, and default package dimensions
  - sellers can calculate offers, create shipments, refresh shipments, and cancel shipments in mock mode
  - customer order tracking now shows delivery provider, status, tracking number, and tracking URL from the latest shipment
  - `Yandex` has a real-mode skeleton and is positioned as the same-city express carrier
  - `CDEK` has a real-mode skeleton and is positioned as the fallback, pickup-point, and inter-city carrier
- Verification for this pass:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run seed:demo`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `backend-nest npm run smoke:checkout`: pass
  - `backend-nest npm run smoke:order-tracking`: pass
  - `backend-nest npm run smoke:payments`: pass
  - `backend-nest npm run smoke:inventory`: pass
  - `backend-nest npm run smoke:inventory-alerts`: pass
  - `backend-nest npm run smoke:delivery`: pass
- Runtime notes:
  - same-city mock offers recommend `YANDEX_EXPRESS`; inter-city mock offers recommend `CDEK_COURIER`
  - default verification continues to avoid real carrier calls; mock mode remains the required safe baseline for CI and local demo stability

## Multi-Carrier Delivery Foundation / Yandex-first Update

- Scope:
  - align the generic delivery foundation with the current business priority: intra-city delivery first
  - add carrier priority fields to `shop_delivery_settings`
  - add `isRecommended` and minute ETA fields to `delivery_offers`
  - update mock selection to recommend Yandex for same-city and CDEK for inter-city
- Result:
  - sellers can configure `defaultCarrier`, `sameCityPreferredCarrier`, `interCityPreferredCarrier`, and `fallbackCarrier`
  - `npm run smoke:delivery` verifies Yandex recommended for Moscow same-city orders
  - CDEK remains available for fallback and inter-city/pickup flows
  - default env examples use mock mode and do not call real Yandex/CDEK APIs

## Yandex Delivery Real Mode

- Scope:
  - implement real Yandex Delivery client methods behind the existing provider abstraction
  - add seller accept endpoint for Yandex claims
  - keep mock mode as the default CI/local path
- Result:
  - Yandex client calls `offers/calculate`, `claims/create`, `claims/accept`, `claims/info`, `claims/tracking-links`, `claims/cancel-info`, and `claims/cancel`
  - provider maps claim id/status/price/tracking link into generic delivery shipments
  - seller order detail can create, accept, refresh, and cancel a Yandex claim
  - `npm run smoke:delivery-yandex-real` skips without real env and does not print tokens
- Notes:
  - real Yandex calls require `DELIVERY_PROVIDER_MODE=yandex`, `YANDEX_DELIVERY_ENABLED=true`, and `YANDEX_DELIVERY_TOKEN`
  - common real failures include invalid token, inactive billing/account, address validation, no courier, expired offer, and invalid claim status transitions

## Suggested Commit Message
```text
chore: finalize docker compose runtime review and commit checklist
```

## Safe Git Commands
```powershell
cd C:\Users\admin\trawberry-ai-commerce

# Check current status
git status
git diff --stat
git diff --name-only

# Confirm no real env file is tracked
git ls-files | Select-String "\.env"

# Review the key docs before staging
git diff docs/RUNTIME_ENV.md
git diff docs/PHASE_REPORT.md

# Stage only the reviewed files
git add docs/RUNTIME_ENV.md docs/PHASE_REPORT.md

# Final pre-commit checks
git status
git diff --cached --stat
git diff --cached --name-only
git diff --cached --check

# Commit
git commit -m "chore: finalize docker compose runtime review and commit checklist"

# Push
git push origin HEAD
```

## Warning If Real Env Files Ever Become Tracked
Do not commit. Remove them from the index first, for example:

```powershell
git rm --cached infra\.env
git rm --cached backend-nest\.env
git rm --cached ai-service\.env
git rm --cached frontend-next\.env
git rm --cached frontend-next\.env.local
```

## Full Seller-to-Customer Commerce Flow Audit

- Scope:
  - audit docs, backend modules, frontend routes, Docker runtime, smoke scripts, and browser E2E coverage for the complete marketplace MVP
  - verify seller/customer flow from public product browse through checkout, proof upload, seller payment review, delivery mock shipment, seller fulfillment status, and customer tracking update
  - keep `strawberry-frontend` and `strawberry-backend` untouched
- Result:
  - `docs/FULL_FLOW_AUDIT.md` added with executive summary, full flow table, API coverage table, frontend route coverage, existing smoke/E2E coverage, gaps/risks, and next steps
  - added `frontend-next/tests/e2e/full-commerce-flow.spec.ts`
  - added `frontend-next` script `npm run test:e2e:full-commerce`
  - full MVP flow is demo-ready with seeded demo data, manual payment review, and mock delivery
  - production readiness remains partial because admin seller approval UI/API, full seller create-product browser path, real payment providers, real Yandex/CDEK, and real OpenAI verification are not complete
- Verification for this pass:
  - `docker version`: pass
  - `docker compose version`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env config`: pass, output suppressed to avoid secret exposure
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: pass, all core services healthy
  - `curl.exe --ipv4 http://localhost:3001/api/health`: pass
  - `curl.exe --ipv4 -I http://localhost:3000/products`: pass
  - `curl.exe --ipv4 http://localhost:8000/health`: pass
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run seed:demo`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass, 13 suites / 73 tests
  - `backend-nest npm run build`: pass
  - `backend-nest npm run smoke:checkout`: pass
  - `backend-nest npm run smoke:order-tracking`: pass
  - `backend-nest npm run smoke:payments`: pass
  - `backend-nest npm run smoke:inventory`: pass
  - `backend-nest npm run smoke:inventory-alerts`: pass
  - `backend-nest npm run smoke:delivery`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:auth`: pass
  - `frontend-next npm run test:e2e:public`: pass
  - `frontend-next npm run test:e2e:public-full`: pass
  - `frontend-next npm run test:e2e:public-payment-review`: pass
  - `frontend-next npm run test:e2e:full-commerce`: pass
- Files changed:
  - `docs/FULL_FLOW_AUDIT.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PHASE_REPORT.md`
  - `frontend-next/README.md`
  - `frontend-next/package.json`
  - `frontend-next/tests/e2e/full-commerce-flow.spec.ts`
- Remaining gaps:
  - no browser E2E for seller shop/product/image creation from blank state
  - seller approval lacks admin workflow
  - delivery real Yandex/CDEK mode not verified
  - payment provider integration not implemented
  - OpenAI real mode intentionally not called
- Commit info:
  - pending commit message: `test: audit full seller to customer commerce flow`

## Seller Approval Workflow

- Scope:
  - add production-ready seller approval workflow for the multi-seller marketplace MVP
  - keep seller registration pending by default
  - add admin-only seller review API and minimal admin UI
  - preserve existing checkout/payment/inventory/delivery/auth flows
- Result:
  - added `backend-nest/src/modules/admin` with seller list/detail/approve/reject endpoints
  - added `AdminOnlyGuard` on `/api/admin/sellers`
  - added additive seller profile fields: `approved_at`, `rejected_at`, `rejection_reason`
  - seller shop creation remains blocked unless `approvalStatus=APPROVED`
  - seed demo now creates `demo-admin@trawberry.local` and keeps the demo seller approved
  - added `/admin/sellers` in `frontend-next`
  - seller shell now displays pending/rejected approval messaging
  - added `npm run smoke:seller-approval`
  - added `npm run test:e2e:admin-seller-approval`
- Verification for this pass:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass, 14 suites / 75 tests
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - full verification command set pending below this section before commit
- Files changed:
  - `backend-nest/prisma/schema.prisma`
  - `backend-nest/src/app.module.ts`
  - `backend-nest/src/common/guards/admin-only.guard.ts`
  - `backend-nest/src/modules/admin/*`
  - `backend-nest/src/modules/auth/auth.service.ts`
  - `backend-nest/src/modules/users/*`
  - `backend-nest/scripts/seed-demo.js`
  - `backend-nest/scripts/smoke-seller-approval.ps1`
  - `backend-nest/test/admin-sellers.e2e-spec.ts`
  - `frontend-next/src/app/admin/*`
  - `frontend-next/src/components/admin/admin-shell.tsx`
  - `frontend-next/src/components/seller/seller-shell.tsx`
  - `frontend-next/src/lib/admin-api.ts`
  - `frontend-next/tests/e2e/admin-seller-approval.spec.ts`
  - `docs/SELLER_APPROVAL.md`
- Remaining gaps:
  - no document upload/KYC review workflow
  - no seller approval notification email
  - no admin audit trail beyond timestamp/reason fields
- Commit info:
  - pending commit message: `feat: add seller approval workflow`

## Seller Onboarding + KYC Documents + Admin Audit Trail

- Scope:
  - add seller legal onboarding profile and KYC document upload workflow
  - add admin document review and seller onboarding detail UI
  - add admin audit logs for seller/document approve and reject actions
  - preserve seller approval, checkout, payment, inventory, delivery, auth, and public flows
- Result:
  - added `seller_profiles` legal/contact/bank fields
  - added `seller_documents` for KYC uploads and review status
  - added `admin_audit_logs` for admin review actions
  - added `/api/seller/onboarding/profile` and `/api/seller/onboarding/documents`
  - extended `/api/admin/sellers` with onboarding, document review, and audit-log endpoints
  - seller approval now requires at least one approved KYC document
  - added `/seller/onboarding`
  - added `/admin/sellers/[id]`
  - updated `/admin/sellers` with detail review links
  - added `npm run smoke:seller-onboarding`
  - added `npm run test:e2e:seller-onboarding`
- Verification for this pass:
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: pass
  - `curl.exe --ipv4 http://localhost:3001/api/health`: pass
  - `curl.exe --ipv4 -I http://localhost:3000/products`: pass
  - `curl.exe --ipv4 http://localhost:8000/health`: pass
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run seed:demo`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass, 15 suites / 79 tests
  - `backend-nest npm run build`: pass
  - `backend-nest npm run smoke:seller-approval`: pass
  - `backend-nest npm run smoke:seller-onboarding`: pass
  - `backend-nest npm run smoke:checkout`: pass
  - `backend-nest npm run smoke:order-tracking`: pass
  - `backend-nest npm run smoke:payments`: pass
  - `backend-nest npm run smoke:inventory`: pass
  - `backend-nest npm run smoke:inventory-alerts`: pass
  - `backend-nest npm run smoke:delivery`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:admin-seller-approval`: pass
  - `frontend-next npm run test:e2e:seller-onboarding`: pass
  - `frontend-next npm run test:e2e:auth`: pass
  - `frontend-next npm run test:e2e:public`: pass
  - `frontend-next npm run test:e2e:public-full`: pass
  - `frontend-next npm run test:e2e:public-payment-review`: pass
  - `frontend-next npm run test:e2e:full-commerce`: pass
- Files changed:
  - `backend-nest/prisma/schema.prisma`
  - `backend-nest/src/modules/seller-onboarding/*`
  - `backend-nest/src/modules/admin/*`
  - `backend-nest/src/modules/files/files.service.ts`
  - `backend-nest/scripts/smoke-seller-approval.ps1`
  - `backend-nest/scripts/smoke-seller-onboarding.ps1`
  - `backend-nest/test/admin-sellers.e2e-spec.ts`
  - `backend-nest/test/seller-onboarding.e2e-spec.ts`
  - `frontend-next/src/app/seller/onboarding/page.tsx`
  - `frontend-next/src/app/admin/sellers/[id]/page.tsx`
  - `frontend-next/src/components/admin/admin-seller-detail-client.tsx`
  - `frontend-next/src/lib/admin-api.ts`
  - `frontend-next/src/lib/seller-onboarding-api.ts`
  - `frontend-next/tests/e2e/admin-seller-approval.spec.ts`
  - `frontend-next/tests/e2e/seller-onboarding.spec.ts`
  - `docs/SELLER_ONBOARDING.md`
- Remaining gaps:
  - KYC retention/access/encryption policy remains production work
  - document reject UI path has backend coverage but not browser E2E
  - no seller approval notification email
  - audit trail covers seller/document review actions, not every admin action
- Commit info:
  - pending commit message: `feat: add seller onboarding and audit trail`

## Seller Create Shop/Product/Image Browser E2E

- Scope:
  - add browser-level coverage for seller-created shop/product/image flow from blank seller state
  - keep seller approval/onboarding setup deterministic through API setup
  - verify seller-created product appears publicly, can be checked out, and appears in seller orders
- Result:
  - added `frontend-next/tests/e2e/seller-product-lifecycle.spec.ts`
  - added `frontend-next` script `npm run test:e2e:seller-product-lifecycle`
  - added first-shop creation UI on `/seller/products`
  - added product creation UI on `/seller/products`
  - added product creation API client functions
  - extended product create DTO/service with optional variants so UI-created products can be public and checkout-ready
  - added stable `data-testid` selectors for product detail, image upload/gallery, product rows, and seller order cards
  - fixed seller product dynamic client pages to read route params through `useParams()`
- Verification for this pass:
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: pass
  - `curl.exe --ipv4 http://localhost:3001/api/health`: pass
  - `curl.exe --ipv4 -I http://localhost:3000/products`: pass
  - `curl.exe --ipv4 http://localhost:8000/health`: pass
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run seed:demo`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass, 15 suites / 79 tests
  - `backend-nest npm run build`: pass
  - `backend-nest npm run smoke:seller-approval`: pass
  - `backend-nest npm run smoke:seller-onboarding`: pass
  - `backend-nest npm run smoke:checkout`: pass
  - `backend-nest npm run smoke:order-tracking`: pass
  - `backend-nest npm run smoke:payments`: pass
  - `backend-nest npm run smoke:inventory`: pass
  - `backend-nest npm run smoke:inventory-alerts`: pass
  - `backend-nest npm run smoke:delivery`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:admin-seller-approval`: pass
  - `frontend-next npm run test:e2e:seller-onboarding`: pass
  - `frontend-next npm run test:e2e:auth`: pass
  - `frontend-next npm run test:e2e:public`: pass
  - `frontend-next npm run test:e2e:public-full`: pass
  - `frontend-next npm run test:e2e:public-payment-review`: pass after rerun with isolated seed; first parallel run collided on seeded product stock with `public-full`
  - `frontend-next npm run test:e2e:full-commerce`: pass
  - `frontend-next npm run test:e2e:seller-product-lifecycle`: pass
- Files changed:
  - `backend-nest/src/modules/products/dto/create-product.dto.ts`
  - `backend-nest/src/modules/products/products.service.ts`
  - `frontend-next/package.json`
  - `frontend-next/src/components/products/seller-products-page-client.tsx`
  - `frontend-next/src/components/products/product-form.tsx`
  - `frontend-next/src/components/products/product-image-gallery.tsx`
  - `frontend-next/src/components/products/product-table.tsx`
  - `frontend-next/src/app/seller/products/[id]/page.tsx`
  - `frontend-next/src/app/seller/products/[id]/images/page.tsx`
  - `frontend-next/src/components/orders/seller-orders-page-client.tsx`
  - `frontend-next/src/lib/seller-api.ts`
  - `frontend-next/tests/e2e/seller-product-lifecycle.spec.ts`
  - `frontend-next/README.md`
  - `docs/FULL_FLOW_AUDIT.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PHASE_REPORT.md`
- Remaining gaps:
  - seller approval/KYC setup in this lifecycle test is API-driven; browser onboarding/admin approval remain covered by `test:e2e:seller-onboarding`
  - delivery settings browser E2E is covered by the subsequent `Seller Delivery Settings Browser E2E` phase
  - AI image generation remains out of scope and was not called
- Commit info:
  - pending commit message: `test: add seller product lifecycle browser e2e`

## Seller Delivery Settings Browser E2E

- Scope:
  - add browser-level coverage for seller delivery settings and mock shipment operations
  - keep seller approval/onboarding/shop/product/paid-order setup deterministic through API setup
  - verify same-city Yandex-first recommendation and customer tracking delivery projection without calling real Yandex/CDEK
- Result:
  - added `frontend-next/tests/e2e/seller-delivery-settings.spec.ts`
  - added `frontend-next` script `npm run test:e2e:seller-delivery-settings`
  - added stable `data-testid` selectors for `/seller/settings`, seller order delivery actions, and customer tracking delivery fields
  - seller settings UI saves pickup address/city/postal/contact, enabled `YANDEX` and `CDEK`, carrier priority, and package defaults
  - seller order detail now selects the recommended offer after calculation, so same-city Yandex-first settings create a Yandex mock shipment
  - customer tracking shows delivery provider, `IN_TRANSIT` status, and tracking link after seller refresh
- Verification for this pass:
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build`: pass
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run seed:demo`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:seller-delivery-settings`: pass
- Files changed:
  - `frontend-next/package.json`
  - `frontend-next/tests/e2e/seller-delivery-settings.spec.ts`
  - `frontend-next/src/components/seller/seller-delivery-settings-page-client.tsx`
  - `frontend-next/src/components/orders/seller-order-detail-page-client.tsx`
  - `frontend-next/src/components/public/order-track-detail-page-client.tsx`
  - `frontend-next/README.md`
  - `docs/API_DELIVERY.md`
  - `docs/FULL_FLOW_AUDIT.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PHASE_REPORT.md`
- Remaining gaps:
  - seller approval/KYC setup remains API-driven in this focused delivery test; browser onboarding/admin approval remain covered by `test:e2e:seller-onboarding`
  - real Yandex/CDEK provider calls remain intentionally unverified in this phase
  - broader delivery edge cases such as cancellation, failed provider states, and webhook ingestion remain future production hardening
- Commit info:
  - pending commit message: `test: add seller delivery settings browser e2e`

## Delivery / Demo Workflow Finalization

- Scope:
  - review the remaining delivery/demo source and browser E2E changes after worktree artifact cleanup
  - keep legacy `strawberry-frontend` and `strawberry-backend` untouched
  - commit only source/docs/tests after verification, with no local env, Excel, or Playwright artifacts
- Result:
  - `seed-demo.js` now includes a demo customer account for the three-role workflow
  - delivery settings/order/tracking pages have stable test hooks for browser E2E assertions
  - seller order delivery flow selects the recommended offer after calculation and avoids overwriting active shipment pickup data
  - `seller-delivery-settings.spec.ts` covers mock delivery settings, offer recommendation, shipment creation, and public tracking projection
  - `three-role-demo-workflow.spec.ts` covers admin, seller, and customer demo playback with video enabled
  - `test:e2e:seller-delivery-settings` and `test:e2e:three-role-demo` are declared in `frontend-next/package.json`
- Verification for this pass:
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass, 16 suites / 84 tests
  - `backend-nest npm run build`: pass
  - `backend-nest npm run smoke:delivery`: pass
  - `backend-nest npm run smoke:checkout`: pass
  - `backend-nest npm run smoke:wb-import-checkout`: pass
  - `backend-nest npm run seed:demo`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:full-commerce`: pass
  - `frontend-next npm run test:e2e:seller-delivery-settings`: pass
  - `frontend-next npm run test:e2e:three-role-demo`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: pass, services healthy
  - `curl.exe --ipv4 http://localhost:3001/api/health`: pass
  - `curl.exe --ipv4 -I http://localhost:3000/products`: pass
  - `curl.exe --ipv4 http://localhost:8000/health`: pass
- Files changed:
  - `backend-nest/scripts/seed-demo.js`
  - `docs/API_DELIVERY.md`
  - `docs/WORKTREE_AUDIT.md`
  - `docs/PHASE_REPORT.md`
  - `frontend-next/package.json`
  - `frontend-next/src/components/orders/seller-order-detail-page-client.tsx`
  - `frontend-next/src/components/public/order-track-detail-page-client.tsx`
  - `frontend-next/src/components/seller/seller-delivery-settings-page-client.tsx`
  - `frontend-next/tests/e2e/full-commerce-flow.spec.ts`
  - `frontend-next/tests/e2e/seller-delivery-settings.spec.ts`
  - `frontend-next/tests/e2e/three-role-demo-workflow.spec.ts`
- Remaining gaps:
  - real Yandex/CDEK provider calls remain intentionally unverified
  - demo workflow video artifacts are generated locally by Playwright and remain ignored, not committed
- Commit info:
  - pending commit message: `test: finalize delivery and demo workflow coverage`

## Seller-Managed Manual Delivery + Admin Supervision

- Scope:
  - implement seller-managed delivery because Yandex/CDEK legal/API credentials are not available yet
  - let sellers paste carrier tracking data after creating shipments outside the marketplace
  - give admins a supervision view for paid orders without delivery and delivery status override
- Result:
  - added manual delivery statuses: `NOT_CREATED`, `CREATED_MANUALLY`, `IN_TRANSIT`, `DELIVERED`, `CANCELLED`, `FAILED`
  - added seller manual delivery create/update/status endpoints under shop-scoped order delivery routes
  - added `/api/admin/deliveries` supervision APIs and `/admin/deliveries` Next.js page
  - delivery events now store actor user, role, action, old status, and new status
  - customer tracking shows status label/message, provider status, courier phone, ETA, and delivery note
  - added `smoke:manual-delivery`, `smoke:admin-delivery-supervision`, `test:e2e:manual-delivery`, and `test:e2e:admin-delivery-supervision`
- Verification for this pass:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run seed:demo`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass, 16 suites / 89 tests
  - `backend-nest npm run build`: pass
  - `backend-nest npm run smoke:manual-delivery`: pass
  - `backend-nest npm run smoke:admin-delivery-supervision`: pass
  - `backend-nest npm run smoke:delivery`: pass
  - `backend-nest npm run smoke:checkout`: pass
  - `backend-nest npm run smoke:payments`: pass
  - `backend-nest npm run smoke:order-tracking`: pass
  - `backend-nest npm run smoke:inventory`: pass
  - `backend-nest npm run smoke:inventory-alerts`: pass
  - `backend-nest npm run smoke:wb-import-checkout`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:manual-delivery`: pass
  - `frontend-next npm run test:e2e:admin-delivery-supervision`: pass
  - `frontend-next npm run test:e2e:full-commerce`: pass after isolated rerun; first parallel run hit a Playwright artifact `ENOENT` during trace handling
  - `frontend-next npm run test:e2e:seller-delivery-settings`: pass
  - `frontend-next npm run test:e2e:three-role-demo`: pass
  - `frontend-next npm run test:e2e:wb-import-checkout`: pass
  - Docker compose `ps`: pass, services healthy
  - backend, frontend `/products`, and ai-service health checks: pass
- Files changed:
  - `backend-nest/prisma/schema.prisma`
  - `backend-nest/prisma/migrations/20260514_add_manual_delivery_supervision/migration.sql`
  - `backend-nest/src/modules/delivery/*`
  - `backend-nest/src/modules/order-tracking/*`
  - `backend-nest/scripts/smoke-manual-delivery.ps1`
  - `backend-nest/scripts/smoke-admin-delivery-supervision.ps1`
  - `backend-nest/test/delivery.e2e-spec.ts`
  - `frontend-next/src/app/admin/deliveries/page.tsx`
  - `frontend-next/src/components/admin/admin-deliveries-page-client.tsx`
  - `frontend-next/src/components/orders/seller-order-detail-page-client.tsx`
  - `frontend-next/tests/e2e/manual-delivery.spec.ts`
  - `frontend-next/tests/e2e/admin-delivery-supervision.spec.ts`
  - `docs/MANUAL_DELIVERY_WORKFLOW.md`
  - `docs/SELLER_OPERATIONS.md`
- Remaining gaps:
  - real Yandex/CDEK API creation remains future work
  - webhooks/provider polling remain future work
- Commit info:
  - pending commit message: `feat: add seller managed delivery with admin supervision`

## Wildberries Excel Product Import

- Scope:
  - approved sellers import Wildberries `.xlsx` exports into their own shop
  - preview parses sheet `Товары`, header row `3`, and auto-detects product data after the Wildberries help row
  - rows are grouped by `Артикул продавца` into products with variants
  - photos are split by `;` and stored as remote URLs for MVP
- Result:
  - added `backend-nest/src/modules/wb-imports`
  - added import session persistence in `product_import_sessions`
  - added additive product and variant external metadata fields
  - added `/seller/import/wildberries`
  - added `npm run smoke:wb-import`
  - added sanitized fixture `backend-nest/test/fixtures/wb-products-sample.xlsx`
- Remaining gaps:
  - `DOWNLOAD_TO_STORAGE` is not implemented in MVP; remote URL mode is used

## Wildberries Real Export Audit

- Local private reference: `data.xlsx` in the repo root; this file is ignored and must not be committed.
- Audited layout:
  - sheets: `Товары`, `Инструкция`
  - product sheet range: `A1:CT42`
  - header row: `3`
  - help/instruction row: `4`
  - first product data row: `5`
- Parser updates:
  - auto-detects the first product data row instead of assuming row `6`
  - normalizes header text by trim/lowercase/space collapse and `ё` to `е`
  - supports aliases for `Артикул ВБ`, `Баркод`, and `Фотографии`
  - handles `КИЗ` values such as `Нужен` and `Не нужен`
  - stores the first barcode when a barcode cell contains multiple values

## Wildberries Remote Image Strategy

- Decision:
  - keep `REMOTE_URL` as the default and recommended MVP image mode
  - do not download Wildberries images to storage in this phase
- Backend behavior:
  - trims and dedupes URLs from `Фото`
  - accepts only `http` and `https` URLs
  - emits `INVALID_IMAGE_URL` warnings and skips invalid URLs
  - stores remote URLs on product images with no storage download requirement
  - keeps first valid image as main and preserves valid URL sort order
  - treats `DOWNLOAD_TO_STORAGE` as not implemented and continues with a warning
- Frontend behavior:
  - import UI presents Wildberries image links as the fixed MVP image mode
  - product cards, public gallery, and seller image gallery use fallback rendering when a remote image fails
- Remaining gap:
  - object storage download, retry, and broken-link monitoring remain future work
  - no real WB API calls are made
  - broader admin import audit UI is future work
# Phase Report: Delivery Exceptions

Added delivery exception workflow for seller-managed manual delivery and admin supervision.

Delivered:

- Backend exception fields and `delivery_comments`.
- Seller/admin failed-delivery APIs with required reason codes.
- Internal vs customer-visible comment handling.
- Public tracking safe exception response.
- Admin exception filters and customer-message override.
- Smoke script `smoke:delivery-exceptions`.
- Frontend seller/admin/customer exception UI.
- Playwright script `test:e2e:delivery-exceptions`.

Non-goals retained: no real OpenAI calls, no real Yandex/CDEK API calls, and no changes to legacy `strawberry-frontend` or `strawberry-backend`.
# Phase Report: Admin Operational Queues + SLA Timers

Implemented admin-only operational queues for daily marketplace supervision.

- Added `GET /api/admin/queues/sellers`, `/payments`, `/deliveries`, and `/inventory`.
- Queue items include seller/shop/order/product context, age, `slaStatus`, and action links.
- Added `/admin/queues` with tabs, filters, status/SLA badges, and queue summary counts.
- Updated `/admin/dashboard` cards and needs-attention tiles to open queue filters.
- Added `smoke:admin-queues` and `test:e2e:admin-queues`.
- Admin assignment ownership is now handled by the Admin Task Ownership phase below.

# Phase Report: Admin Task Ownership + Escalation Workflow

Implemented admin-only task ownership for operational queues.

- Added `admin_queue_tasks` and `admin_queue_task_events`.
- Added `/api/admin/queue-tasks` create/list/assign/unassign/status/escalate/events APIs.
- Queue responses now include task id, task status, priority, assignee, and task timestamps.
- `/admin/queues` supports Claim, In progress, Escalate, and Resolve actions.
- Added task event and admin audit writes for ownership mutations.
- Added `smoke:admin-task-ownership` and `test:e2e:admin-task-ownership`.

Non-goals retained: no notification email, no ops export/reporting, no real Yandex/CDEK API calls, and no changes to legacy `strawberry-frontend` or `strawberry-backend`.

# Phase Report: Admin Ops Reporting + Export

Implemented admin-only operational reporting and CSV export.

- Added `/api/admin/reports/ops-summary`.
- Added SLA breach, workload, delivery exception, and payment aging report APIs.
- Added CSV exports for SLA breaches, workload, delivery exceptions, and payment aging.
- CSV exports use UTF-8 BOM, safe escaping, allowlisted columns, and a 5000 row cap.
- Added `/admin/reports` with date filters, summary cards, tabs, tables, and export buttons.
- Added `smoke:admin-reports` and `test:e2e:admin-reports`.

Non-goals retained: no notification email, no scheduled report delivery, no real Yandex/CDEK API calls, and no changes to legacy `strawberry-frontend` or `strawberry-backend`.

# Phase Report: Wildberries API Product Sync

Implemented WB Content API product sync foundation.

- Audited legacy WB integration code and documented endpoint/DTO/mapping.
- Added `backend-nest/src/modules/wb-sync`.
- Added mock/real WB API client foundation.
- Added seller APIs for credentials status, sync all, sync by article, and sync run lookup.
- Added `wb_sync_runs` and `shop_wb_credentials`.
- Added idempotent upsert for products, variants, and remote images.
- Added `/seller/import/wildberries-api`.
- Added `smoke:wb-api-sync` and `test:e2e:wb-api-sync`.

Non-goals retained: no real WB API call in default tests, no price/stock WB API integration, no image download-to-storage, and no changes to legacy apps.

# Phase Report: Admin Operations Dashboard

Added admin-only marketplace operations dashboard.

Delivered:

- `GET /api/admin/dashboard/summary` with date/shop/seller filters.
- Aggregated counts for orders, payments, deliveries, inventory, and sellers.
- Recent orders, payment reviews, delivery exceptions, and audit actions.
- `/admin/dashboard` page with operational cards, needs-attention queue, recent activity, and quick links.
- Smoke script `smoke:admin-dashboard`.
- Playwright script `test:e2e:admin-dashboard`.

Non-goals retained: no real OpenAI calls, no real Yandex/CDEK API calls, and no changes to legacy `strawberry-frontend` or `strawberry-backend`.
# Phase Report: Cart + Multi-item Checkout

Implemented:

- LocalStorage cart store.
- Product variant selector and add-to-cart action.
- Cart page.
- Cart-backed checkout page with legacy single-product route compatibility.
- Multi-item backend checkout validation, trusted totals, item snapshots, and stock deduction.
- Seller/customer/payment order item rendering.
- `smoke:cart-checkout` and `test:e2e:cart-checkout` scripts.

Deferred:

- Multi-shop checkout split.
- Server-persisted customer carts.

# Phase Report: Multi-shop Checkout Split Orders

Implemented:

- Backend checkout groups validated cart items by `product.shopId`.
- One checkout request can create multiple shop orders in one transaction.
- Response keeps legacy first-order fields and adds `orders[]`, `orderCodes[]`, and `grandTotal`.
- Frontend cart and checkout summaries group items by shop and show grand total.
- Checkout confirmation shows one order card and tracking link per shop order.
- Seller order visibility remains shop-scoped.
- Payment proof and delivery remain per order/shop.
- Added `smoke:multi-shop-checkout` and `test:e2e:multi-shop-checkout` scripts.

Deferred:

- Combined multi-shop payment orchestration.
- Combined customer tracking page.

# Phase Report: Customer Account + Order History + Parent Checkout Receipt

Implemented:

- Added `marketplace_checkouts` parent receipt model and optional order relation.
- Checkout now creates a parent receipt for single-shop and multi-shop orders.
- Checkout response returns `checkoutId`, `checkoutCode`, `orders[]`, `orderCodes[]`, `grandTotal`, and legacy first-order fields.
- Logged-in customer checkout attaches `customerUserId`.
- Added logged-in customer receipt APIs under `/api/customer/orders`.
- Added public anonymous receipt lookup under `/api/public/checkouts/:checkoutCode?phone=...`.
- Added customer register/login pages, order history, order detail, and public receipt page.
- Added `smoke:customer-order-history` and `test:e2e:customer-order-history`.

Deferred:

- Combined payment capture across shops.
- Refund/dispute flows at parent receipt level.
- Marketplace support case workflow attached to parent receipts.

# Phase Report: Wildberries Real API Sync Hardening

Implemented:

- audited the working legacy WB integration and documented it in `docs/WB_LEGACY_SUCCESSFUL_FLOW_AUDIT.md`
- explicit real-mode credential save, status, verify, and delete APIs
- added `GET /api/shops/:shopId/wb-sync/diagnostics` for seller-safe runtime checks
- persisted WB credential verification metadata on `shop_wb_credentials`
- AES-GCM credential encryption via `WB_CREDENTIAL_ENCRYPTION_KEY`
- real runtime uses the selected shop's stored credential from DB, not a global `WB_REAL_API_KEY`
- real-mode `POST /content/v2/get/cards/list` client with cursor pagination
- real-mode verify retries once with a fallback request body when WB rejects the minimal body with `400`
- no silent mock fallback when `WB_SYNC_MODE=real`
- mock mode verify now fails explicitly with `WB_MOCK_MODE_ACTIVE` instead of pretending to verify WB
- seller UI connection card with mode, key last4, verify status, and sanitized error
- seller UI now refreshes status after save, verify, and delete, and clears the raw key input after save
- seller UI now blocks real-mode sync actions early when the selected shop has no saved WB credential
- real-mode sync result reporting with `sourceMode`
- optional `smoke:wb-api-sync-real`
- added `npm run debug:wb-credential` for stored-credential diagnostics without using `WB_REAL_API_KEY`
- backend WB sync tests for credential lifecycle, verify failure sanitization, request body, and pagination
- aligned default real WB request body to the legacy successful `cards/list` shape with `sort.ascending=true`

Retained non-goals:

- no WB price sync
- no WB stock sync
- no real WB calls in default CI smoke/E2E
- no legacy app changes

Runtime audit note on 2026-05-17:

- local Docker backend was running with `WB_SYNC_MODE=mock`
- local Docker backend inherited a hidden fallback `WB_CREDENTIAL_ENCRYPTION_KEY=dev-wb-credential-key`
- after removing that fallback from compose, the same local runtime exposed the true missing-config state until a local non-committed test key was injected for verification

# Phase Report: Public Marketplace Contract Hardening

Implemented:

- added `backend-nest/test/public-products.e2e-spec.ts`
- verified public list/detail contract for published, readiness-passing products only
- verified mixed-stock detail shape and disabled out-of-stock variants
- verified checkout rejects out-of-stock, unpublished, archived, invalid-variant, missing-price, and over-stock requests
- added mobile sticky CTA to `frontend-next` public product detail without changing desktop sticky purchase card
- added `frontend-next/tests/e2e/public-marketplace-contract.spec.ts`
- hardened public header search and cart badge regression coverage
- documented contract in `docs/PUBLIC_MARKETPLACE_CONTRACT.md`

Retained non-goals:

- no legacy app changes
- no real external provider calls in default tests
- no change to server-side checkout authority
