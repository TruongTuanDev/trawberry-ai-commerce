# Project Status

## A. Project Summary

- Project name: `Trawberry AI Commerce`
- Current architecture:
  - `frontend-next`: Next.js seller workspace
  - `backend-nest`: NestJS API and orchestration layer
  - `ai-service`: FastAPI AI image service
  - `infra`: Docker Compose with PostgreSQL, Redis, MinIO
  - legacy apps kept in parallel:
    - `strawberry-frontend`
    - `strawberry-backend`
- Active stack:
  - Next.js App Router
  - React + TypeScript + Zustand + React Hook Form + Zod
  - NestJS + Prisma + PostgreSQL + BullMQ + Redis
  - FastAPI + Pydantic + OpenAI SDK + Pillow + boto3
  - Docker Compose + MinIO
- Product goal:
  - migrate seller-side e-commerce workflows from Angular/Spring Boot to Next.js/NestJS
  - support product image management
  - support AI image generation pipeline
  - prepare for try-on and broader marketplace workflows

## B. Architecture Status

| Component | Tech stack | Status | Runtime verified? | Notes |
|---|---|---|---|---|
| `frontend-next` | Next.js 16, React 19, TS, Zustand, RHF, Zod | Partial | Yes | Seller routes exist; customer `/products`, `/checkout`, `/orders/track`, and `/orders/[id]` MVP now exist; seller `/payments` MVP now exists; dashboard/settings/AI route still partly placeholder. |
| `backend-nest` | NestJS 11, Prisma, PostgreSQL, BullMQ, Redis | Done / active | Yes | Auth, shops, products, public products, checkout, order tracking, payments, seller orders, images, AI tasks all present. |
| `ai-service` | FastAPI, Pydantic, OpenAI SDK, Pillow, boto3 | Partial | Yes | Mock provider verified; OpenAI provider implemented but real OpenAI runtime not fully confirmed in this audit. |
| `postgres` | PostgreSQL 16 | Done | Yes | Running in Docker; host `5433`, network `5432`. |
| `redis` | Redis 7 | Done | Yes | Running in Docker and used by BullMQ. |
| `minio` | MinIO | Done | Yes | Running in Docker; bucket bootstrap via `minio-init`. |
| `docker compose` | Docker Compose | Done | Yes | `config` pass, `ps` healthy, smoke integration pass. |
| `strawberry-frontend` | Angular | Legacy retained | Not re-verified in this audit | Kept untouched for parallel migration. |
| `strawberry-backend` | Spring Boot | Legacy retained | Not re-verified in this audit | Kept untouched for parallel migration. |

## C. Completed Features

### Auth / User / Shop
- Status: Done
- Evidence:
  - `backend-nest`: `npm run lint` pass
  - `backend-nest`: `npm test -- --runInBand` pass
  - `backend-nest`: `npm run build` pass
  - Docker backend health pass
- Main files/modules:
  - `backend-nest/src/modules/auth`
  - `backend-nest/src/modules/users`
  - `backend-nest/src/modules/shops`
  - `backend-nest/test/auth.e2e-spec.ts`
  - `backend-nest/test/users.e2e-spec.ts`
  - `backend-nest/test/shops.e2e-spec.ts`
- Notes:
  - `httpOnly` cookie support exists
  - Bearer fallback still exists for scripts and backward compatibility

### Product CRUD
- Status: Done
- Evidence:
  - `backend-nest` test suite pass
  - `npm run smoke:products` exists
  - Docker smoke integration indirectly exercises product create
- Main files/modules:
  - `backend-nest/src/modules/products`
  - `backend-nest/test/product.e2e-spec.ts`
  - `frontend-next/src/app/seller/products`
  - `frontend-next/src/components/products`
- Notes:
  - seller product list/detail/edit are connected
  - shop-scoped access enforced with `ShopAccessGuard`

### Product Image Upload
- Status: Done
- Evidence:
  - `backend-nest/test/product-images.e2e-spec.ts`
  - `npm run smoke:product-images` exists
  - Docker smoke integration uploads product images successfully
- Main files/modules:
  - `backend-nest/src/modules/product-images`
  - `backend-nest/src/modules/files`
  - `frontend-next/src/app/seller/products/[id]/images/page.tsx`
  - `frontend-next/src/components/products/product-image-gallery.tsx`
- Notes:
  - local storage path active in backend Docker runtime
  - metadata supports AI-related image types

### Orders
- Status: Done
- Evidence:
  - `backend-nest/test/orders.e2e-spec.ts`
  - `frontend-next/src/app/seller/orders`
  - `npm run smoke:orders`
- Main files/modules:
  - `backend-nest/src/modules/orders`
  - `frontend-next/src/components/orders`
  - `frontend-next/src/app/seller/orders`
  - `docs/API_ORDERS.md`
- Notes:
  - seller list/detail/status update are implemented
  - auth and shop isolation are enforced with `JwtAuthGuard` + `ShopAccessGuard`
  - seller APIs now surface orders created by the customer checkout MVP

### Customer Checkout / Public Catalog
- Status: MVP done
- Evidence:
  - `backend-nest/test/checkout.e2e-spec.ts`
  - `backend-nest/scripts/smoke-checkout.ps1`
  - `backend-nest/src/modules/public-products`
  - `backend-nest/src/modules/checkout`
  - `frontend-next/src/app/products`
  - `frontend-next/src/app/checkout`
  - `docs/API_CHECKOUT.md`
- Notes:
  - public catalog endpoints expose only safe product/shop data
  - checkout allows anonymous order creation
  - backend computes `totalAmount` and defaults order status to `PENDING`
  - seller order list/detail can read the new orders without changing the seller API surface
  - Docker runtime verification passed with `smoke:checkout`, `smoke:orders`, backend/frontend health checks, and Playwright auth E2E

### Customer Order Tracking / Payment Proof
- Status: MVP done
- Evidence:
  - `backend-nest/test/order-tracking.e2e-spec.ts`
  - `backend-nest/scripts/smoke-order-tracking.ps1`
  - `backend-nest/src/modules/order-tracking`
  - `frontend-next/src/app/orders/track`
  - `frontend-next/src/app/orders/[id]`
  - `docs/API_ORDER_TRACKING.md`
- Notes:
  - customer can track by `orderCode + phone` or `orderId + phone`
  - customer can upload payment proof without a customer account
  - seller payment detail now shows payment proof metadata and proof link
  - customer tracking reflects updated `paymentStatus` after seller review

### Public Marketplace UI Polish
- Status: MVP polish done
- Evidence:
  - `frontend-next/src/components/public/public-shell.tsx`
  - `frontend-next/src/components/public/public-header.tsx`
  - `frontend-next/src/components/public/public-footer.tsx`
  - `frontend-next/src/components/public/product-card.tsx`
  - `frontend-next/src/components/public/product-gallery.tsx`
  - `frontend-next/tests/e2e/public-smoke.spec.ts`
- Notes:
  - home page now presents a storefront-oriented hero and CTA flow
  - public pages share a dedicated customer navbar/footer without affecting seller shell
  - `/products`, `/products/[id]`, `/checkout`, `/orders/track`, and `/orders/[id]` now have stronger loading, empty, and error states
  - public Playwright smoke now verifies the main customer routes load

### Seeded Public Demo Data / Full Customer E2E
- Status: Done
- Evidence:
  - `backend-nest/scripts/seed-demo.js`
  - `backend-nest/package.json`
  - `frontend-next/tests/e2e/public-full.spec.ts`
  - `docs/DEMO_DATA.md`
- Notes:
  - demo seed is idempotent and guarded against accidental production execution
  - public catalog can now be bootstrapped with a stable approved seller, active shop, and 3 active products
  - Playwright full public E2E now covers browse, product detail, checkout, confirmation, tracking, and payment proof upload

### Payments
- Status: MVP done for manual review
- Evidence:
  - `backend-nest/src/modules/payments`
  - `backend-nest/test/payments.e2e-spec.ts`
  - `backend-nest/scripts/smoke-payments.ps1`
  - `frontend-next/src/app/seller/payments`
  - `docs/API_PAYMENTS.md`
- Main files/modules:
  - `backend-nest/prisma/schema.prisma`
  - `backend-nest/src/modules/payments`
  - `frontend-next/src/components/payments`
  - `frontend-next/src/app/seller/payments`
- Notes:
  - manual seller review now supports list/detail/mark paid/reject/add note
  - additive audit logging is stored in `payment_review_logs`
  - seller detail now surfaces customer-uploaded payment proof
  - there is still no payment provider integration, capture, refund, or webhook handling
  - legacy Spring Boot still contains broader payment workflow references per `docs/API_MAP_OLD.md`

### AI Image Task Backend
- Status: Done
- Evidence:
  - `backend-nest/test/ai-images.e2e-spec.ts`
  - `backend-nest/test/ai-images.worker.spec.ts`
  - `npm run smoke:ai-images` exists
  - Docker `smoke:ai-service-integration` pass
- Main files/modules:
  - `backend-nest/src/modules/ai-images`
  - Prisma AI task/image/credit models
- Notes:
  - includes credit deduction and refund
  - supports retry and attach

### AI Service FastAPI
- Status: Done
- Evidence:
  - `python -m compileall app` pass
  - `python -m pytest -q` pass
  - `GET /health` pass
  - `POST /internal/ai-images/generate` pass in mock mode
- Main files/modules:
  - `ai-service/app/api`
  - `ai-service/app/services`
  - `ai-service/tests`
- Notes:
  - internal-only service
  - token-protected

### backend-nest calling ai-service
- Status: Done
- Evidence:
  - `backend-nest/test/ai-service-client.spec.ts`
  - `npm run smoke:ai-service-integration` pass
- Main files/modules:
  - `backend-nest/src/modules/ai-images/ai-service-client.service.ts`
  - `backend-nest/src/modules/ai-images/ai-images.worker.ts`
- Notes:
  - timeout, retry, and response validation are implemented

### Generate AI Image Modal
- Status: Done
- Evidence:
  - `frontend-next` lint/build pass
  - Docker smoke integration proves backend task + attach flow
  - page code polls task and attaches image
- Main files/modules:
  - `frontend-next/src/components/products/ai-image-generate-modal.tsx`
  - `frontend-next/src/components/products/ai-task-panel.tsx`
  - `frontend-next/src/app/seller/products/[id]/images/page.tsx`
- Notes:
  - runtime UI path is connected through backend only

### OpenAIImageProvider
- Status: Partial
- Evidence:
  - provider code present
  - `ai-service/tests/test_openai_provider.py` pass
  - optional smoke script exists
- Main files/modules:
  - `ai-service/app/services/openai_image_provider.py`
  - `ai-service/scripts/smoke_openai_provider.py`
- Notes:
  - implemented in code
  - real OpenAI runtime remains conditionally available
  - not treated as fully verified in this audit

### Quality Guard
- Status: Done
- Evidence:
  - `ai-service/tests/test_quality_guard.py` pass
  - backend tests for malformed response / error mapping pass
- Main files/modules:
  - `ai-service/app/services/image_quality_guard.py`
  - `backend-nest/test/ai-service-client.spec.ts`
- Notes:
  - validates output image readability, MIME, width, and height

### Docker Compose Runtime
- Status: Done
- Evidence:
  - `docker compose ... config` pass
  - `docker compose ... ps` shows 6/6 healthy
  - backend/ai/frontend/minio URLs reachable
  - `npm run smoke:ai-service-integration` pass against running stack
- Main files/modules:
  - `infra/docker-compose.yml`
  - `infra/.env.example`
  - `infra/postgres-init/01-extensions.sql`
- Notes:
  - host Postgres port is `5433`
  - internal Postgres port remains `5432`

### Cookie auth security hardening
- Status: Done
- Evidence:
  - `AuthController` sets and clears `httpOnly` cookie with `path=/`
  - `JwtStrategy` reads cookie first, bearer fallback second
  - frontend API client uses `credentials: "include"`
  - auth e2e covers `Set-Cookie`, cookie-backed `/api/auth/me`, logout cookie clearing, and bearer fallback
  - Playwright smoke covers browser login, reload persistence, logout, redirect, and `localStorage` token absence
- Main files/modules:
  - `backend-nest/src/modules/auth/auth.controller.ts`
  - `backend-nest/src/modules/auth/strategies/jwt.strategy.ts`
  - `backend-nest/test/auth.e2e-spec.ts`
  - `frontend-next/src/lib/api.ts`
  - `frontend-next/src/stores/auth-store.ts`
  - `frontend-next/src/components/auth/protected-shell.tsx`
- Notes:
  - login/logout/session refresh are now cookie-first in the Next.js app
  - `localStorage` keeps only lightweight user/shop hydration state, not raw auth tokens
  - bearer fallback remains in place for smoke scripts and legacy-compatible API usage

### Docs / env standardization
- Status: Done
- Evidence:
  - reviewed docs updated to current repo path and port set
  - `.env.example` files are tracked, real `.env` files are not
- Main files/modules:
  - `docs/RUNTIME_ENV.md`
  - `docs/DEPLOYMENT.md`
  - `docs/CONFIG_AUDIT.md`
  - service README files
- Notes:
  - runtime docs now align with Docker stack using `ai-service:8000` and host PostgreSQL `5433`

## D. Backend API Status

| Method | Endpoint | Module | Status | Auth required? | Smoke tested? |
|---|---|---|---|---|---|
| `GET` | `/api/health` | app / health | Done | No | Yes |
| `GET` | `/api/docs` | swagger | Done | No | Yes |
| `POST` | `/api/auth/register` | auth | Done | No | Yes |
| `POST` | `/api/auth/login` | auth | Done | No | Yes |
| `POST` | `/api/auth/refresh` | auth | Done | No | Covered by tests |
| `POST` | `/api/auth/logout` | auth | Done | No | Covered by auth e2e |
| `GET` | `/api/auth/me` | auth | Done | Yes | Yes |
| `GET` | `/api/users/me` | users | Done | Yes | Covered by tests |
| `POST` | `/api/shops` | shops | Done | Yes | Yes |
| `GET` | `/api/shops` | shops | Done | Yes | Covered by smoke/tests |
| `GET` | `/api/shops/:shopId` | shops | Done | Yes | Covered by tests |
| `GET` | `/api/shops/:shopId/products` | products | Done | Yes | Yes |
| `POST` | `/api/shops/:shopId/products` | products | Done | Yes | Yes |
| `GET` | `/api/shops/:shopId/products/:productId` | products | Done | Yes | Yes |
| `PATCH` | `/api/shops/:shopId/products/:productId` | products | Done | Yes | Yes |
| `DELETE` | `/api/shops/:shopId/products/:productId` | products | Done | Yes | Yes |
| `GET` | `/api/shops/:shopId/products/:productId/images` | product-images | Done | Yes | Yes |
| `POST` | `/api/shops/:shopId/products/:productId/images` | product-images | Done | Yes | Yes |
| `PATCH` | `/api/shops/:shopId/products/:productId/images/:imageId` | product-images | Done | Yes | Yes |
| `DELETE` | `/api/shops/:shopId/products/:productId/images/:imageId` | product-images | Done | Yes | Yes |
| `POST` | `/api/shops/:shopId/products/:productId/ai-images/tasks` | ai-images | Done | Yes | Yes |
| `GET` | `/api/shops/:shopId/ai-images/tasks` | ai-images | Done | Yes | Covered by tests |
| `GET` | `/api/shops/:shopId/ai-images/tasks/:taskId` | ai-images | Done | Yes | Yes |
| `POST` | `/api/shops/:shopId/ai-images/tasks/:taskId/retry` | ai-images | Done | Yes | Covered by tests |
| `GET` | `/api/shops/:shopId/ai-credits` | ai-images | Done | Yes | Yes |
| `POST` | `/api/shops/:shopId/products/:productId/ai-images/:imageId/attach` | ai-images | Done | Yes | Yes |
| `POST` | `/api/shops/:shopId/products/:productId/images/:imageId/attach` | ai-images alias | Done | Yes | Covered indirectly |
| `GET` | `/api/shops/:shopId/orders` | orders | Done | Yes | Yes |
| `GET` | `/api/shops/:shopId/orders/:orderId` | orders | Done | Yes | Yes |
| `PATCH` | `/api/shops/:shopId/orders/:orderId/status` | orders | Done | Yes | Yes |
| `GET` | `/api/shops/:shopId/payments` | payments | MVP done | Yes | Yes |
| `GET` | `/api/shops/:shopId/payments/:orderId` | payments | MVP done | Yes | Yes |
| `POST` | `/api/shops/:shopId/payments/:orderId/mark-paid` | payments | MVP done | Yes | Yes |
| `POST` | `/api/shops/:shopId/payments/:orderId/reject` | payments | MVP done | Yes | Yes |
| `POST` | `/api/shops/:shopId/payments/:orderId/notes` | payments | MVP done | Yes | Yes |
| `GET` | `/api/public/products` | public-products | Done | No | Covered by build/manual flow |
| `GET` | `/api/public/products/:productId` | public-products | Done | No | Covered by build/manual flow |
| `POST` | `/api/checkout/orders` | checkout | MVP done | Optional auth | Yes |
| `GET` | `/api/public/orders/track` | order-tracking | MVP done | No | Yes |
| `GET` | `/api/public/orders/:orderId/track` | order-tracking | MVP done | No | Yes |
| `POST` | `/api/public/orders/:orderId/payment-proof` | order-tracking | MVP done | No | Yes |
| `POST` | `/api/files/upload-url` | files | Partial | Yes | No |

## E. Frontend Page Status

| Route | Purpose | Status | Backend connected? | Notes |
|---|---|---|---|---|
| `/login` | Seller login | Done | Yes | Cookie-based login flow active; redirects into seller center after success. |
| `/products` | Public marketplace list | MVP done | Yes | Uses public products API only. |
| `/products/[id]` | Public product detail | MVP done | Yes | Links into checkout. |
| `/checkout` | Customer checkout form | MVP done | Yes | Creates order through NestJS checkout API. |
| `/orders/track` | Public order tracking lookup | MVP done | Yes | Uses `orderCode + phone`. |
| `/orders/[id]` | Public order tracking detail | MVP done | Yes | Shows order state and uploads payment proof. |
| `/seller/dashboard` | Seller overview | Partial | No | Placeholder KPIs only. |
| `/seller/products` | Product list | Done | Yes | Search/pagination UI connected. |
| `/seller/products/[id]` | Product detail/edit | Done | Yes | Product metadata connected; variants read-only summary. |
| `/seller/products/[id]/images` | Product gallery + AI generate | Done | Yes | Upload, gallery, set main, delete, AI task create/poll/attach connected. |
| `/seller/ai-images` | Future AI center / try-on area | Partial | No | Placeholder route only. |
| `/seller/orders` | Seller order list | Done | Yes | Connected to NestJS orders API. |
| `/seller/orders/[id]` | Seller order detail | Done | Yes | Connected to NestJS orders API. |
| `/seller/payments` | Seller payment review list | MVP done | Yes | Pending queue, filters, and links into detail. |
| `/seller/payments/[orderId]` | Seller payment review detail | MVP done | Yes | Mark paid, reject, add note, audit log view. |
| `/seller/settings` | Seller settings area | Partial | No | Placeholder content only. |

## F. AI Pipeline Status

Current flow:
- `Next.js`
- `NestJS`
- `BullMQ / worker`
- `ai-service`
- `Mock / OpenAI provider`
- `Storage`
- `generated image`
- `attach into product_images`

| Capability | Status | Notes |
|---|---|---|
| Mock provider | Done | Runtime verified in Docker smoke integration. |
| OpenAI provider | Partial | Code and tests exist; real runtime still conditional. |
| Quality guard | Done | Unit-tested and integrated into error mapping. |
| Credit deduction | Done | Verified by AI smoke and Docker integration smoke. |
| Refund on failure | Done | Covered in backend worker logic and tests. |
| Attach generated image | Done | Runtime verified in Docker smoke integration. |
| Try-on online | Not started / partial design only | `taskType=TRY_ON` exists in API/domain, but no end-to-end user workflow verified. |

## G. Docker Runtime Status

- `docker compose -f infra/docker-compose.yml --env-file infra/.env config`: pass
- `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: pass
- Expected containers:
  - `postgres`
  - `redis`
  - `minio`
  - `ai-service`
  - `backend-nest`
  - `frontend-next`
- Ports:
  - frontend: `3000`
  - backend: `3001`
  - ai-service: `8000`
  - MinIO API / console: `9000 / 9001`
  - PostgreSQL host: `5433`
  - PostgreSQL Docker network: `5432`
- Smoke integration status:
  - pass

## H. Testing & Verification Status

| Area | Command | Last known result | Notes |
|---|---|---|---|
| backend-nest | `npm run lint` | Pass | Re-run in this audit. |
| backend-nest | `npm test -- --runInBand` | Pass | Includes auth cookie / logout / bearer fallback coverage. |
| backend-nest | `npm run build` | Pass | Re-run in this audit. |
| backend-nest | `npm run smoke:auth` | Exists | Not re-run in this audit. |
| backend-nest | `npm run smoke:products` | Exists | Not re-run in this audit. |
| backend-nest | `npm run smoke:orders` | Pass | Re-run in this audit; seller orders runtime smoke covers list, detail, status update, and cross-shop `403`. |
| backend-nest | `npm run smoke:checkout` | Pass | Re-run in this audit; anonymous checkout order is visible in seller list/detail. |
| backend-nest | `npm run smoke:payments` | Pass | Manual payment review runtime smoke covers note/mark-paid/audit/cross-shop `403`. |
| backend-nest | `npm run seed:demo` | Pass | Idempotent demo seed for public marketplace and E2E setup. |
| backend-nest | `npm run smoke:order-tracking` | Pass | Customer tracks, uploads proof, seller sees proof, seller marks paid, customer sees updated payment status. |
| backend-nest | `npm run smoke:product-images` | Exists | Not re-run in this audit. |
| backend-nest | `npm run smoke:ai-images` | Exists | Not re-run in this audit. |
| backend-nest | `npm run smoke:ai-service-integration` | Pass | Re-run in this audit against Docker runtime. |
| backend-nest | `npm run smoke:ai-service-openai` | Exists | Not run in this audit. |
| frontend-next | `npm run lint` | Pass | Re-run in this audit. |
| frontend-next | `npm run build` | Pass | Re-run in this audit. |
| frontend-next | `npm run test:e2e:auth` | Pass | Playwright browser smoke for cookie auth flow. |
| frontend-next | `npm run test:e2e:public` | Pass | Playwright smoke for public home, products, and order tracking routes. |
| frontend-next | `npm run test:e2e:public-full` | Pass | Playwright full customer flow with seeded demo data. |
| ai-service | `python -m compileall app` | Pass | Re-run in this audit. |
| ai-service | `python -m pytest -q` | Pass | `18` tests. |
| infra | `docker compose ... config` | Pass | Re-run in this audit. |
| infra | `docker compose ... ps` | Pass | `6/6` healthy. |
| runtime | `GET http://localhost:3001/api/health` | Pass | Re-run in this audit. |
| runtime | `GET http://localhost:8000/health` | Pass | Re-run in this audit. |
| runtime | `GET http://localhost:3000/login` | Pass | Re-run in this audit. |
| runtime | `GET http://localhost:9001` | Pass | Re-run in this audit. |

## I. Known Issues / Risks

- Real OpenAI runtime is not treated as fully proven in this audit.
- Previous project notes mention an OpenAI billing hard-limit failure; if billing is still unresolved, real OpenAI smoke can fail even though code paths exist.
- Cookie-based auth now has API-level and browser-level smoke coverage, but a final human cross-browser pass is still advisable before production.
- `ai-service` tree still contains `__pycache__` artifacts in the working tree; they are ignored/noise, not functional code.
- `backend-nest` AI service client still defaults to `http://localhost:8010` if env is missing; runtime envs override this, but the fallback is stale versus current `8000` standard.
- `seller/dashboard`, `seller/settings`, and `/seller/ai-images` are still placeholder-level UI.
- Payments are now partially migrated for manual seller review, but provider-backed settlement is still missing.
- Customer checkout, public tracking, and manual transfer proof upload are now in the new stack, but customer order history is still incomplete.
- Public marketplace is now demo-ready, but richer merchandising, sorting, and customer account history are still incomplete.
- Seeded demo data now supports stable public demos, but there is still no automatic database reset/isolation between repeated end-to-end runs.
- Local/demo credentials in Docker/env examples are for development only and must not be used in production.

## J. Next Recommended Phases

1. Final project status verification on a fresh machine using only documented steps.
2. Implement customer order history and broader post-checkout lifecycle in NestJS/Next.js.
3. Add isolated test-data lifecycle or teardown for repeated public E2E runs.
4. Add stronger payment state modeling, proof moderation detail, and refund/cancel groundwork.
5. Expand the public marketplace beyond the single-product MVP checkout flow.
6. Implement true try-on online flow end-to-end.
7. Add admin moderation and operational tooling.
8. Production hardening:
   - auth/cookie/session review
   - secret management
   - object storage strategy
   - logging and observability
9. Add CI/CD with GitHub Actions.
10. Prepare VPS / cloud deployment pipeline.

## K. Definition of Done for MVP

To demo the MVP cleanly, the following should be available:
- seller login
- public product browse
- demo seed bootstrap for public product browse
- customer checkout create-order
- customer order tracking
- customer payment proof upload
- full public customer Playwright E2E
- seller manual payment review
- create shop
- create product
- upload product image
- generate AI image with mock or OpenAI path
- attach generated image into product gallery
- view product gallery with AI-generated assets
- run the full stack through Docker Compose
- runtime docs ready and accurate
