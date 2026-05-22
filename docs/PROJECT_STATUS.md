# Project Status

## Manual Yandex Operational Polish - 2026-05-23

- Status: implemented in `backend-nest` and `frontend-next`
- Seller order detail now has a clearer `Yandex Delivery Handoff` block with copy-ready operational data
- Customer saved addresses now require explicit entrance / floor / apartment decisions for current manual Yandex readiness
- Customer tracking now shows `manualYandexOrderId` once the seller enters it
- Admin deliveries now support:
  - `MISSING_YANDEX_ORDER_ID`
  - `CREATED_WITH_YANDEX_ID`
  - internal seller reminder action for delayed manual Yandex creation
- Reminder behavior is internal only in this MVP:
  - no SMS
  - no email
  - stored as an audit/reminder event in the platform

## Yandex-Compatible Customer Address Flow - 2026-05-22

- Status: implemented in `backend-nest` and `frontend-next`
- Customer saved addresses now use a more structured Yandex-compatible shape:
  - city
  - district
  - street
  - building
  - entrance
  - intercom
  - floor
  - apartment
  - comment
  - latitude / longitude
  - geo precision / provider metadata
- Customer UI now supports:
  - structured Moscow-first address entry
  - mock/manual address suggestions
  - geocode/verification status
- Checkout now snapshots structured dropoff fields into orders while preserving the legacy shipping address string.
- Seller manual Yandex workbench now shows clearer dropoff data and can determine Yandex-readiness before shipment creation when pickup and dropoff coordinates are known.
- Current limitation remains intentional:
  - no real Yandex geocoder
  - no real Yandex Delivery API call
  - coordinates can still be entered manually in MVP mode

## Return / Refund / Dispute Foundation - 2026-05-22

- Status: implemented in `backend-nest` and `frontend-next`
- Customer now has:
  - `/customer/returns`
  - `/customer/returns/[caseId]`
  - order-detail action to open a return/refund/dispute case
- Seller now has:
  - `/seller/returns`
  - `/seller/returns/[caseId]`
  - response, evidence follow-up, and manual refund-sent actions
- Admin now has:
  - `/admin/returns`
  - `/admin/returns/[caseId]`
  - approve/reject/request-evidence/override actions
- Finance behavior now includes:
  - manual refund confirmation
  - negative commission adjustment rows instead of deleting historical fee rows
- Current limitation remains intentional:
  - no automatic bank refund
  - no automatic chargeback
  - no provider-backed return shipment

## Three Role Order Sync Audit + Fixes - 2026-05-22

- Status: implemented in `backend-nest` and `frontend-next`
- customer, seller, and admin order operations are now more explicitly synchronized
- seller orders now show:
  - role-specific display status
  - next action
  - finance summary
  - richer delivery summary
- admin seller management now includes:
  - `PENDING` / `APPROVED` / `REJECTED` / `ALL`
  - search by seller or shop
  - status counts
  - finance and recent order summary in seller detail
- admin payments supervision now includes ledger sync visibility:
  - ledger status
  - fee amount
  - invoice status
- new verification targets:
  - `backend-nest npm run smoke:three-role-order-sync`
  - `frontend-next npm run test:e2e:three-role-order-sync`
  - `frontend-next npm run test:e2e:admin-seller-management`
- known remaining gaps:
  - no seller suspension workflow yet
  - no automated refund/dispute finance reversals beyond current manual adjustment foundation

## Admin Seller Fee Settings + Seller Revenue Dashboard - 2026-05-22

- Status: implemented in `backend-nest` and `frontend-next`
- Marketplace direct-to-seller payment now has a manual fee-accounting layer.
- Admin finance operations now include:
  - `/admin/finance/seller-fees`
  - per-shop commission percent
  - monthly invoice generation
  - manual invoice paid marking
- Seller finance visibility now includes:
  - `/seller/dashboard` live revenue/fee cards
  - `/seller/finance` ledger and invoice history
- Fee engine behavior:
  - only final confirmed seller-paid orders count
  - product revenue excludes separate delivery fee
  - commission percent is snapshotted into each ledger row
  - historical billing periods are retained
- Current limitation remains intentional:
  - no automatic payout
  - no automatic seller bank debit
  - manual invoice workflow only
  - refund reconciliation is still a future phase

## Payment Method Strategy For Yandex Delivery - 2026-05-22

- Status: implemented in `backend-nest` and `frontend-next`
- Buyer-facing payment method choice is now explicit:
  - `PREPAID_SELLER_QR`
  - `PAY_ON_DELIVERY_SELLER_QR`
  - `DEPOSIT_THEN_DELIVERY_PAYMENT`
- `YANDEX_CARD_ON_DELIVERY` is modeled as future capability only and stays unavailable unless a shop is explicitly marked `AVAILABLE`.
- `CASH_COURIER_COLLECTION` remains unavailable and is not exposed as a buyer option.
- The currently safe Yandex-related COD flow is:
  - buyer selects pay on delivery via seller QR
  - seller accepts the order
  - seller creates manual Yandex delivery
  - buyer pays seller directly after delivery
  - seller confirms or rejects final payment
- This phase does not claim Yandex courier money collection support.

## Seller Manual Yandex Delivery Workbench - 2026-05-22

- Status: implemented in `backend-nest` and `frontend-next`
- Seller delivery operations now support a no-provider manual Yandex path on `/seller/orders/[id]`.
- Direct-seller payment confirmation can now move Yandex-preferred orders into `READY_TO_CREATE_YANDEX`.
- Seller workbench capabilities now include:
  - pickup/dropoff/package summary
  - copy sender / recipient / all shipment brief
  - optional Yandex Maps linkout when coordinates exist
  - manual Yandex order id / claim id / tracking / courier / ETA / note entry
  - transitions to `YANDEX_MANUAL_CREATED`, `COURIER_ASSIGNED`, `PICKED_UP`, `ON_THE_WAY`, `DELIVERED`, `FAILED`, or `CANCELLED`
- Admin delivery supervision now includes:
  - `READY_TO_CREATE_YANDEX`
  - `OVERDUE`
  - manual Yandex shipment status filters
  - override status actions
- Customer-visible tracking now renders a clearer manual Yandex delivery timeline.
- Current limitation remains intentional:
  - no real Yandex API calls
  - no shipment webhook or polling integration
  - no automatic courier creation from the marketplace
  - this is an operational workbench for seller-entered manual fulfillment

## Direct Seller QR Payment Foundation - 2026-05-22

- Status: implemented in `backend-nest` and `frontend-next`
- Marketplace payment posture remains manual, but it now supports direct-to-seller SBP/bank QR flows without routing funds through the platform.
- Seller payment setup now includes:
  - per-shop static QR upload
  - bank / recipient / SBP metadata
  - readiness status
- Buyer payment UX now includes:
  - seller QR and payment instructions during checkout confirmation
  - buyer proof upload and buyer note
  - seller-confirmed proof state instead of auto-paid on upload
- Seller payment operations now include:
  - `/seller/payment-settings`
  - `/seller/payments-to-confirm`
  - confirm / reject proof actions
- Admin operations now include:
  - `/admin/payments-supervision`
  - marketplace-wide payment queue/detail
  - admin confirm / reject override
- Current limitation remains intentional:
  - no real bank API
  - no provider webhook
  - no automatic reconciliation
  - no platform-held funds

## Professional Marketplace Gap Audit - 2026-05-22

- Status: documented
- Added `docs/MARKETPLACE_PROFESSIONAL_GAP_AUDIT.md` as the current professional-gap benchmark for the active stack.
- Current high-level verdict:
  - demo-ready: yes
  - internal manual operations: yes
  - production-ready professional marketplace: no
- Primary blockers remain:
  - real payments
  - refunds/disputes/returns
  - seller finance, fees, and payouts
  - real delivery automation
  - production security and DevOps hardening

## Public Marketplace Visual Layout Copy Refresh - 2026-05-21

- Status: implemented in `frontend-next` only
- `/` now uses clearer shopper-facing English copy for hero, quick links, and featured product preview blocks
- `/products` keeps the same API/filter behavior but now uses cleaner catalog-first messaging in the hero, filters, and empty/error states
- `promo-slider` and `public-footer` now match the current marketplace merchandising tone
- `public-smoke` and `public-full` E2E selectors were updated to the new public CTA labels
- Guardrails preserved:
  - no backend/API/database changes
  - no changes to checkout contract
  - no legacy app edits

## Customer Account Management - 2026-05-21

- Status: implemented in `backend-nest` and `frontend-next`
- Added customer-only account APIs for:
  - profile read/update
  - password change
  - saved-address CRUD
  - default address selection
- Added new customer account routes:
  - `/customer/account`
  - `/customer/account/profile`
  - `/customer/account/addresses`
  - `/customer/account/security`
  - `/customer/account/support`
- Existing `/customer/orders` history and receipt detail remain active and now live inside the same customer account shell.
- Public header now routes authenticated customers into `/customer/account`.
- Checkout now supports optional saved-address selection through `addressId` while preserving guest/manual checkout behavior.

## Public Marketplace Header / Promo Refresh - 2026-05-20

- `/` and `/products` now follow a stronger marketplace-first composition closer to Wildberries:
  - gradient pink-purple public header
  - large search-first navigation
  - promo slider directly below header
  - product grid immediately after hero content
- Public home is no longer just a generic landing page; it now previews real public products from the backend.
- `/products` keeps the same public API and search/filter logic, but the layout is now merchandising-first instead of tool-first.
- Public product cards now emphasize:
  - larger imagery
  - stronger price hierarchy
  - clearer add-to-cart CTA
  - improved hover polish
- Scope guardrails preserved:
  - no backend/API/database changes
  - no fake products
  - no admin login in public header
  - no cart/auth/session contract changes

## Visual Identity & Next.js Migration Complete - 2026-05-19
- The frontend Next.js platform has been completely overhauled visually.
- The `Public Marketplace` now uses a Wildberries-inspired pink/purple gradient theme (`#CB11AB` to `#A100FF`).
- The `Seller Center` is now a professional, bright dashboard (`var(--panel)`). All legacy "Migration" text has been removed.
- The `Admin Ops` dashboard is now a neutral/dark serious environment (`bg-slate-900`, `indigo-600`) to separate ops from public/seller themes.
- Validated via automated E2E tests (`test:e2e:public-marketplace-contract`, `test:e2e:product-buying-ux`, `test:e2e:cart-checkout`) ensuring zero logic or contract breakages.## AI Service Mock Runtime Snapshot - 2026-05-19

- seller AI runtime verification target is now `AI_SERVICE_MOCK`
- expected compose/runtime shape:
  - `backend-nest`: `AI_WORKER_MODE=ai-service`
  - `ai-service`: `AI_IMAGE_PROVIDER=mock`
  - `ai-service`: `STORAGE_DRIVER=mock`
- seller runtime badge should show `AI service mock mode`
- verification entry points:
  - `backend-nest npm run smoke:ai-service-mock-images`
  - `backend-nest npm run smoke:ai-images-ui-flow`
  - `frontend-next npm run test:e2e:seller-ai-images`
  - `ai-service python -m pytest -q`
- OpenAI real remains pending and must not be treated as passed by default

## OpenAI Real Verification Snapshot - 2026-05-19

- OpenAI real verification is opt-in only
- default CI and default local verification remain mock-safe
- new manual entry points:
  - `backend-nest npm run smoke:ai-service-openai-real`
  - `ai-service python scripts/smoke_openai_provider.py`
- runtime states now distinguish:
  - `AI_SERVICE_MOCK`
  - `AI_SERVICE_OPENAI_READY`
  - `AI_SERVICE_OPENAI_BLOCKED`
  - `INTERNAL_MOCK`
  - `OFFLINE`
- current real provider debug result:
  - request contract fixed
  - Docker-internal backend image URL rewrite fixed
  - remaining blocker is `OPENAI_BILLING_HARD_LIMIT`

## Seller AI Images UI Snapshot - 2026-05-19

- `/seller/ai-images` is now connected to the real seller AI task flow.
- The dedicated seller AI page now supports:
  - current shop context
  - runtime mode badge
  - product search/selection
  - AI task creation
  - recent task list
  - result gallery
  - attach generated image back into product gallery
- Virtual try-on is explicitly shown as `Coming soon` until a verified backend flow exists.
- Current verified defaults on `2026-05-19`:
  - seller UI and seller task path work with `AI_SERVICE_MOCK`
  - opt-in OpenAI real path now reaches the provider layer
  - real pass is still blocked by account billing limit
- Verification entry points:
  - `backend-nest npm run smoke:ai-images-ui-flow`
  - `frontend-next npm run test:e2e:seller-ai-images`
  - `ai-service python -m pytest -q`

## CI Postgres Extension Fix Snapshot - 2026-05-19

- GitHub Actions `backend` job was hardened for Prisma schema UUID defaults.
- `.github/workflows/ci.yml` now enables PostgreSQL extension `uuid-ossp` before `npx prisma db push`.
- `pgcrypto` was intentionally not added because the current schema does not use `gen_random_uuid()`.

## CI + AI Service Isolation Snapshot - 2026-05-18

- `ai-service` local pytest isolation is fixed for mock-safe mode.
- Added GitHub Actions CI at `.github/workflows/ci.yml`.
- CI scope:
  - `backend-nest`: lint, test, build
  - `frontend-next`: lint, build
  - `ai-service`: compileall, pytest
  - Docker build validation for `backend-nest` and `frontend-next`
- Local verification results for this phase:
  - `ai-service python -m compileall app`: pass
  - `ai-service python -m pytest -q`: pass (`18` tests)
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env config`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: pass (`6/6` healthy)
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env build backend-nest frontend-next`: pass
- Local safety finding:
  - the current local `infra/.env` points `ai-service` at real `OpenAI` runtime mode; keep it untracked, rotate the key if it was real, and normalize local shared setup back to mock-safe defaults

## Reality Audit Snapshot - 2026-05-18

- Primary new-stack commerce flows remain real and broadly verified.
- External-provider readiness is still partial:
  - Wildberries real mode: coded, not verified in this audit
  - OpenAI real mode: coded, not called in this audit
  - Yandex real mode: coded, not called in this audit
  - CDEK real mode: skeleton only
  - payment provider: not implemented
- Placeholder/UI-only surfaces still present:
  - `frontend-next/src/app/seller/dashboard/page.tsx`
  - `frontend-next/src/app/seller/ai-images/page.tsx`
- Verification results from this audit:
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass (`25` suites, `185` tests)
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `ai-service python -m compileall app`: pass
  - `ai-service python -m pytest -q`: pass after test env isolation hardening (`18` tests)
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: failed because Docker daemon was unavailable locally

## Multi-Role Session Isolation

- Status: implemented
- Scope:
  - role-specific cookies for admin, seller, customer
  - role-specific `/api/auth/*/me`
  - role-specific `/api/auth/*/logout`
  - shared browser support for admin + seller + customer at once
  - public header limited to customer auth state
- Verification entry points:
  - `backend-nest/test/auth.e2e-spec.ts`
  - `npm run test:e2e:multi-role-sessions`

## Auth Role Separation

- Status: implemented
- Scope:
  - customer login/register separated
  - seller login/register separated
  - hidden admin login preserved at `/admin-login`
  - public header/footer/home no longer advertise admin auth
  - identifier login supports email or phone
  - existing cookie auth flow preserved
- Compatibility kept:
  - `/api/auth/register`
  - `/api/auth/login`
  - `/login`
  - `/seller-login`

## Auth Hardening 2

- Status: implemented
- Scope:
  - auth throttling for login/register
  - stricter cookie/CORS configuration posture
  - phone normalization for auth and seller contact phone
  - seller pending/rejected next-step UX
- Known limits:
  - no persistent lockout yet
  - `/admin-login` remains fixed operational path
  - phone-only accounts still persist with internal synthetic email

## Cart Validation + Checkout Preflight

- Status: Done for the current public marketplace/cart reliability phase
- Scope:
  - backend cart validation endpoint
  - stale cart warnings on `/cart`
  - checkout preflight before submit
  - customer actions for remove/set-max/accept-price
- Verification entry points:
  - `npm run smoke:cart-validation`
  - `npm run test:e2e:cart-validation`

## Public Product Buying UX

- Status: Done for current marketplace MVP
- Scope:
  - upgraded public product cards
  - upgraded public product detail page
  - clearer variant/size selection
  - quantity stepper and in-cart state
  - header cart badge and search-centric marketplace header
- Guardrails preserved:
  - only `PUBLISHED` + readiness-pass products remain public
  - cart and multi-shop checkout logic remain intact
  - backend still validates stock and price on checkout
- Verification entry points:
  - `npm run test:e2e:product-buying-ux`
  - `npm run test:e2e:cart-checkout`
  - `npm run test:e2e:multi-shop-checkout`
  - `npm run test:e2e:marketplace-search-filter-sort`

## Seller Product Curation + Publishing

- WB Excel import and WB API sync now create seller-catalog products as `IMPORTED` instead of auto-publishing them.
- Seller catalog and public marketplace are now split by `catalogStatus`.
- Seller products page supports tabs and filters for imported, needs review, ready, published, unpublished, archived, missing price, missing stock, and missing category.
- Seller product detail now shows readiness and supports publish, unpublish, and archive actions.
- Public marketplace and checkout now require `catalogStatus=PUBLISHED` plus checkout readiness.
- Verification entry points:
  - `npm run smoke:product-curation`
  - `npm run test:e2e:product-curation`

## Seller Bulk Product Editing

- `/seller/products` now supports bulk category, price, and stock updates for selected products.
- Backend exposes `POST /api/shops/:shopId/products/bulk-update` with variant scope and optional `publishIfReady`.
- Bulk editing recalculates readiness per product and keeps public marketplace rules unchanged.
- Verification entry points:
  - `npm run smoke:bulk-product-edit`
  - `npm run test:e2e:bulk-product-edit`

## Category Mapping + Marketplace Search

- Internal marketplace categories and category mappings are implemented in `backend-nest`.
- WB Excel import and WB API sync preserve source category and map to internal category when possible.
- `/products` supports search, category/brand/color/gender/stock/price filters, URL persistence, facets, and sorting.
- WB price/stock sync is intentionally not implemented; sellers manage local price and inventory.

## Latest Verification Addendum

- WB import to checkout has dedicated backend and browser coverage through `smoke:wb-import-checkout` and `test:e2e:wb-import-checkout`.
- Public products require approved seller, active shop/product, at least one image, positive active variant price, and available stock.
- WB import image handling remains `REMOTE_URL`; same-file re-import is expected to be idempotent.
- Delivery operating model is now seller-managed with admin supervision: sellers paste Yandex/CDEK/manual tracking details, admins monitor paid orders without delivery, and customer tracking shows delivery status/message.
- WB API sync real mode now has encrypted shop credentials, explicit verify/delete endpoints, cursor pagination for `POST /content/v2/get/cards/list`, and no silent mock fallback when `WB_SYNC_MODE=real`.

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
| `frontend-next` | Next.js 16, React 19, TS, Zustand, RHF, Zod | Partial | Yes | Seller routes exist; customer `/products`, `/checkout`, `/orders/track`, and `/orders/[id]` MVP now exist; seller `/payments` and `/seller/orders/[id]` manual delivery exist; admin `/admin/deliveries` supervision exists; dashboard/settings/AI route still partly placeholder. |
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

### Seller Approval Workflow
- Status: Done for MVP admin review
- Evidence:
  - `backend-nest/src/modules/admin`
  - `backend-nest/src/common/guards/admin-only.guard.ts`
  - `backend-nest/test/admin-sellers.e2e-spec.ts`
  - `backend-nest/scripts/smoke-seller-approval.ps1`
  - `frontend-next/src/app/admin/sellers/page.tsx`
  - `frontend-next/tests/e2e/admin-seller-approval.spec.ts`
  - `docs/SELLER_APPROVAL.md`
- Notes:
  - seller registration creates `PENDING` seller profiles
  - only admins can list/approve/reject sellers
  - pending and rejected sellers cannot create shops
  - approved sellers can create shops
  - demo seed now creates a demo admin and approved demo seller

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
  - public catalog now exposes availability via `inStock` and `availableQuantity`
  - checkout allows anonymous order creation
  - backend computes `totalAmount` and defaults order status to `PENDING`
  - checkout now enforces stock and deducts inventory atomically during order creation
  - seller order list/detail can read the new orders without changing the seller API surface
  - Docker runtime verification passed with `smoke:checkout`, `smoke:orders`, backend/frontend health checks, and Playwright auth E2E

### Inventory / Stock Management
- Status: MVP done
- Evidence:
  - `backend-nest/src/modules/products/products.controller.ts`
  - `backend-nest/src/modules/products/products.service.ts`
  - `backend-nest/test/product.e2e-spec.ts`
  - `backend-nest/test/checkout.e2e-spec.ts`
  - `backend-nest/scripts/smoke-inventory.ps1`
  - `frontend-next/src/app/seller/products/[id]/page.tsx`
  - `docs/API_INVENTORY.md`
- Notes:
  - seller can view and update product inventory from the new stack
  - public marketplace pages now reflect `inStock` and available quantity
  - checkout rejects insufficient stock and deducts stock on success
  - stock restore for cancelled orders remains in the seller order lifecycle

### Low Stock Alerts / Seller Inventory UX
- Status: MVP done
- Evidence:
  - `backend-nest/prisma/schema.prisma`
  - `backend-nest/src/modules/products/dto/list-shop-products-query.dto.ts`
  - `backend-nest/test/product.e2e-spec.ts`
  - `backend-nest/scripts/smoke-inventory-alerts.ps1`
  - `frontend-next/src/components/products/product-table.tsx`
  - `frontend-next/src/components/products/seller-products-page-client.tsx`
- Notes:
  - seller products list now shows stock badges and low-stock/out-of-stock filters
  - seller can quick-update single-variant stock directly from the list
  - product detail inventory view is clearer about threshold and status

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

### Full E2E Seller Payment Review After Customer Proof
- Status: Done
- Evidence:
  - `frontend-next/tests/e2e/public-payment-review.spec.ts`
  - `frontend-next/src/components/payments/seller-payment-detail-page-client.tsx`
  - `frontend-next/src/components/public/order-track-detail-page-client.tsx`
- Notes:
  - browser-level E2E now covers customer proof upload, seller review, seller mark paid, and customer re-check of `paymentStatus=PAID`
  - seller phase uses the seeded demo seller account and navigates directly to `/seller/payments/[orderId]` for stability

### Full Seller-to-Customer Commerce Audit
- Status: MVP pass / production readiness partial
- Evidence:
  - `docs/FULL_FLOW_AUDIT.md`
  - `frontend-next/tests/e2e/full-commerce-flow.spec.ts`
  - `frontend-next/package.json` script `test:e2e:full-commerce`
- Notes:
  - browser-level E2E now covers public product listing/detail, checkout, stock deduction assertion, order tracking, payment proof upload, seller orders list/detail, seller payment proof review, mark paid, mock delivery create/refresh, seller order status update, and customer tracking re-check
  - audited runtime passed Docker health checks, backend tests/build/smoke scripts, frontend lint/build, and all Playwright suites
  - seller approval admin workflow, full browser seller product creation/image upload, and browser delivery settings coverage are now implemented; real payment providers, real Yandex/CDEK, and real OpenAI remain outside the verified MVP path

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
| `GET` | `/api/shops/:shopId/products/:productId/inventory` | products | MVP done | Yes | Yes |
| `PATCH` | `/api/shops/:shopId/products/:productId/inventory` | products | MVP done | Yes | Yes |
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
| `GET` | `/api/shops/:shopId/delivery/settings` | delivery | MVP done | Yes | Yes |
| `PATCH` | `/api/shops/:shopId/delivery/settings` | delivery | MVP done | Yes | Yes |
| `POST` | `/api/shops/:shopId/orders/:orderId/delivery/offers` | delivery | MVP done | Yes | Yes |
| `POST` | `/api/shops/:shopId/orders/:orderId/delivery/shipments` | delivery | MVP done | Yes | Yes |
| `GET` | `/api/shops/:shopId/orders/:orderId/delivery` | delivery | MVP done | Yes | Yes |
| `POST` | `/api/shops/:shopId/orders/:orderId/delivery/shipments/:shipmentId/refresh` | delivery | MVP done | Yes | Yes |
| `POST` | `/api/shops/:shopId/orders/:orderId/delivery/shipments/:shipmentId/cancel` | delivery | MVP done | Yes | Yes |
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
| `/seller/products` | Product list | Done | Yes | Search/pagination UI connected, with stock badges, low-stock filters, and single-variant quick stock update. |
| `/seller/products/[id]` | Product detail/edit | Done | Yes | Product metadata connected; variant inventory status and stock update are visible. |
| `/seller/products/[id]/images` | Product gallery + AI generate | Done | Yes | Upload, gallery, set main, delete, AI task create/poll/attach connected. |
| `/seller/ai-images` | Future AI center / try-on area | Partial | No | Placeholder route only. |
| `/seller/orders` | Seller order list | Done | Yes | Connected to NestJS orders API. |
| `/seller/orders/[id]` | Seller order detail | Done | Yes | Connected to NestJS orders API. |
| `/seller/payments` | Seller payment review list | MVP done | Yes | Pending queue, filters, and links into detail. |
| `/seller/payments/[orderId]` | Seller payment review detail | MVP done | Yes | Mark paid, reject, add note, audit log view. |
| `/seller/settings` | Seller delivery settings area | MVP done | Yes | Pickup address, carriers, carrier priority, and default package dimensions are connected and browser-E2E verified. |

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
| backend-nest | `npm run smoke:inventory` | Pass | Seller stock update + checkout deduction + insufficient stock flow pass. |
| backend-nest | `npm run smoke:inventory-alerts` | Pass | Seller low-stock filters and quick-update flow pass. |
| backend-nest | `npm run smoke:delivery` | Pass | Seller configures delivery settings, calculates a same-city Yandex recommended offer, creates a mock Yandex shipment, refreshes shipment, and customer tracking sees delivery info. |
| backend-nest | `npm run smoke:product-images` | Exists | Not re-run in this audit. |
| backend-nest | `npm run smoke:ai-images` | Exists | Not re-run in this audit. |
| backend-nest | `npm run smoke:ai-service-integration` | Pass | Re-run in this audit against Docker runtime. |
| backend-nest | `npm run smoke:ai-service-openai` | Exists | Not run in this audit. |
| frontend-next | `npm run lint` | Pass | Re-run in this audit. |
| frontend-next | `npm run build` | Pass | Re-run in this audit. |
| frontend-next | `npm run test:e2e:auth` | Pass | Playwright browser smoke for cookie auth flow. |
| frontend-next | `npm run test:e2e:public` | Pass | Playwright smoke for public home, products, and order tracking routes. |
| frontend-next | `npm run test:e2e:public-full` | Pass | Playwright full customer flow with seeded demo data. |
| frontend-next | `npm run test:e2e:public-payment-review` | Pass | Browser E2E for customer proof upload -> seller mark paid -> customer sees `PAID`. |
| frontend-next | `npm run test:e2e:full-commerce` | Pass | Browser E2E for public checkout, stock deduction, seller payment review, delivery, fulfillment, and customer tracking. |
| frontend-next | `npm run test:e2e:seller-product-lifecycle` | Pass | Browser E2E for seller first-shop creation, product creation, stock update, image upload, public checkout, tracking, and seller order visibility. |
| frontend-next | `npm run test:e2e:seller-delivery-settings` | Pass | Browser E2E for delivery settings save/reload, same-city Yandex recommendation, mock shipment create/refresh, and customer delivery tracking projection. |
| ai-service | `python -m compileall app` | Pass | Re-run in this audit. |
| ai-service | `python -m pytest -q` | Pass | `18` tests. |
| infra | `docker compose ... config` | Pass | Re-run in this audit. |
| infra | `docker compose ... ps` | Pass | `6/6` healthy. |
| runtime | `GET http://localhost:3001/api/health` | Pass | Re-run in this audit. |
| runtime | `GET http://localhost:8000/health` | Pass | Re-run in this audit. |
| runtime | `GET http://localhost:3000/login` | Pass | Re-run in this audit. |
| runtime | `GET http://localhost:9001` | Pass | Re-run in this audit. |

## Seller Onboarding + KYC + Audit Trail Update

Status: implemented in `backend-nest` and `frontend-next`.

- New sellers still register as `PENDING`.
- Pending/rejected sellers can submit legal onboarding profile data and upload KYC documents.
- Admins can view seller onboarding detail at `/admin/sellers/[id]`.
- Admins can approve/reject individual documents.
- Admin seller approval now requires at least one approved KYC document.
- Seller approve/reject and document approve/reject actions write `admin_audit_logs`.
- New scripts:
  - backend: `npm run smoke:seller-onboarding`
  - frontend: `npm run test:e2e:seller-onboarding`

## Seller Product Lifecycle Browser E2E Update

Status: implemented in `frontend-next`.

- Added `npm run test:e2e:seller-product-lifecycle`.
- The test uses API setup only for seller registration/onboarding/KYC/admin approval, then verifies seller operations through browser UI:
  - seller login
  - first shop creation from `/seller/products`
  - product creation with initial price/stock variant
  - stock update from `/seller/products/[id]`
  - product image upload from `/seller/products/[id]/images`
  - public product search/detail
  - customer checkout and order tracking
  - seller order queue visibility
- Backend product creation now accepts optional variants so UI-created products can be public and checkout-ready without seed data.

## Seller Delivery Settings Browser E2E Update

Status: implemented in `frontend-next`.

- Added `npm run test:e2e:seller-delivery-settings`.
- The test uses API setup for seller approval, shop/product creation, and paid same-city order setup, then verifies delivery operations through browser UI:
  - seller login
  - `/seller/settings` delivery settings save
  - persisted pickup address, contact, enabled carriers, carrier priorities, and package defaults after reload
  - `/seller/orders/[id]` delivery offer calculation
  - same-city Yandex recommended offer selection
  - mock shipment create and refresh from UI
  - customer `/orders/[id]` tracking shows provider, delivery status, and tracking link
- Seller order detail now selects the recommended delivery offer after calculation, so same-city Yandex-first settings drive the shipment creation path.

## I. Known Issues / Risks

- Real OpenAI runtime is not treated as fully proven in this audit.
- Previous project notes mention an OpenAI billing hard-limit failure; if billing is still unresolved, real OpenAI smoke can fail even though code paths exist.
- Cookie-based auth now has API-level and browser-level smoke coverage, but a final human cross-browser pass is still advisable before production.
- `ai-service` tree still contains `__pycache__` artifacts in the working tree; they are ignored/noise, not functional code.
- `backend-nest` AI service client still defaults to `http://localhost:8010` if env is missing; runtime envs override this, but the fallback is stale versus current `8000` standard.
- `seller/dashboard` and `/seller/ai-images` are still placeholder-level UI.
- Payments are now partially migrated for manual seller review, but provider-backed settlement is still missing.
- Customer checkout, public tracking, and manual transfer proof upload are now in the new stack, but customer order history is still incomplete.
- Public marketplace is now demo-ready, but richer merchandising, sorting, and customer account history are still incomplete.
- Inventory is now single-location and variant-local only; no warehouse or ledger model exists yet.
- Low-stock alerts are seller-facing only in this phase; no notification channel or cron alerting exists yet.
- Multi-carrier delivery foundation now exists. Yandex real-mode client/provider is implemented for create/accept/refresh/cancel/tracking, but real Yandex smoke is optional and only runs with real env.
- Delivery currently supports one active shipment per order and no webhook ingestion yet.
- Seeded demo data now supports stable public demos, but there is still no automatic database reset/isolation between repeated end-to-end runs.
- Local/demo credentials in Docker/env examples are for development only and must not be used in production.
- KYC document storage is MVP local/S3 abstraction only; production still needs retention policy, access policy, encryption review, and operational deletion workflow.
- Admin audit trail is append-only MVP coverage for seller/document review actions; it does not yet cover every admin operation in the marketplace.

## J. Next Recommended Phases

## Wildberries Excel Import Phase

- Added seller-scoped WB Excel import preview/confirm/status endpoints in `backend-nest`.
- Added additive Prisma fields for product/variant external metadata and `product_import_sessions`.
- Added parser support for sheet `Товары`, header row `3`, auto-detected data rows, SKU grouping, variants, image URL split, warnings, and blocking errors.
- Audited local private `data.xlsx` against the parser; the real export has help text on row `4` and first product data on row `5`, so the parser no longer assumes data starts on row `6`.
- Wildberries images remain remote URLs by default for MVP. Parser skips invalid image URLs with warnings, dedupes duplicates, keeps the first valid image as main, and treats `DOWNLOAD_TO_STORAGE` as a future mode.
- Added `/seller/import/wildberries` in `frontend-next` with upload options, preview summary/table, confirm action, and result summary.
- Added sanitized fixture `backend-nest/test/fixtures/wb-products-sample.xlsx`.
- Added `npm run smoke:wb-import`.
- Legacy apps remain untouched.

1. Final project status verification on a fresh machine using only documented steps.
2. Implement customer order history and broader post-checkout lifecycle in NestJS/Next.js.
3. Add isolated test-data lifecycle or teardown for repeated public E2E runs.
4. Add stronger payment state modeling, proof moderation detail, and refund/cancel groundwork.
5. Expand the public marketplace beyond the single-product MVP checkout flow.
6. Implement true try-on online flow end-to-end.
7. Expand admin moderation and operational tooling beyond seller KYC approval.
8. Production hardening:
   - auth/cookie/session review
   - secret management
   - object storage strategy
   - logging and observability
9. Add CI/CD with GitHub Actions.
10. Prepare VPS / cloud deployment pipeline.
11. Verify Yandex real mode with production-like pickup/dropoff addresses and active billing.
12. Implement real CDEK provider calls and pickup-point selection flow.

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
- seller delivery settings and mock shipment creation
- create shop
- create product
- upload product image
- generate AI image with mock or OpenAI path
- attach generated image into product gallery
- view product gallery with AI-generated assets
- run the full stack through Docker Compose
- runtime docs ready and accurate
# Delivery Exception Phase Status

Implemented: seller-managed manual delivery exception workflow.

- Seller can report failed delivery with reason and customer-visible message.
- Seller/admin can add internal delivery comments.
- Admin delivery supervision supports `exceptionOnly=true` and status filters for `FAILED`/`CANCELLED`.
- Customer tracking shows failed/cancelled messaging and never exposes internal comments.
- Delivery event audit rows are written for exception actions.

Future: map real Yandex/CDEK status webhooks into this internal exception model when provider API integration is introduced.
# Admin Operations Dashboard Phase Status

Implemented: admin-only marketplace operations dashboard.

- Backend summary API at `GET /api/admin/dashboard/summary`.
- Frontend page at `/admin/dashboard`.
- Admin navigation includes Dashboard, Sellers, and Deliveries.
- Dashboard highlights pending sellers, pending payments, paid orders without delivery, delivery exceptions, and low/out-of-stock inventory.
- Recent activity includes latest orders, payment reviews, delivery exceptions, and admin audit logs.

# Admin Operational Queues Phase Status

Implemented: admin-only operational queues with SLA timers.

- Backend queue APIs under `GET /api/admin/queues/*`.
- Frontend page at `/admin/queues` with Sellers, Payments, Deliveries, and Inventory tabs.
- Queue rows include age, `slaStatus`, status badges, action links, and task ownership fields when present.
- Dashboard needs-attention cards now deep-link into queue filters.

# Admin Task Ownership Phase Status

Implemented: admin-only queue task ownership and escalation workflow.

- Backend task APIs under `GET/POST /api/admin/queue-tasks`.
- Task records support `OPEN`, `IN_PROGRESS`, `WAITING_SELLER`, `WAITING_CUSTOMER`, `RESOLVED`, and `ESCALATED`.
- Admins can claim, assign, unassign, set status, escalate, and resolve queue tasks.
- Assignment targets are validated as admin users only.
- Task events and admin audit logs are written for ownership mutations.
- `/admin/queues` shows assignee, task status, priority, Claim, In progress, Escalate, and Resolve actions.
- Notification email remains a future phase; ownership reporting/export is covered by Admin Ops Reporting.

# Admin Ops Reporting Phase Status

Implemented: admin-only operations reporting and CSV exports.

- Backend report APIs under `GET /api/admin/reports/*`.
- Reports include ops summary, SLA breaches, workload by admin, delivery exceptions, and payment aging.
- CSV exports are available for SLA breaches, workload, delivery exceptions, and payment aging.
- `/admin/reports` provides date filters, tabs, report tables, and CSV export buttons.
- Report reads and exports are read-only; notification email remains a future phase.

# Wildberries API Sync Phase Status

Implemented: seller-managed WB API product sync foundation.

- Legacy WB code was audited in read-only mode and documented in `docs/WB_LEGACY_API_AUDIT.md`.
- Backend sync APIs are under `POST /api/shops/:shopId/wb-sync/*`.
- Frontend page is `/seller/import/wildberries-api`.
- Sync all and sync by article/APT/vendorCode work in mock mode.
- Product, variant, and remote image upsert is idempotent.
- Excel import remains unchanged and continues to use `/seller/import/wildberries`.
- Real WB mode requires per-shop credentials and `WB_CREDENTIAL_ENCRYPTION_KEY`.

# Wildberries Real API Sync Hardening Status

Implemented:

- seller credential save/status/verify/delete flow
- stored verification metadata: `lastVerifiedAt`, `lastVerificationStatus`, `lastVerificationError`
- `WB_CREDENTIAL_ENCRYPTION_KEY` as the primary credential encryption env
- real-mode cursor pagination and article filtering from real fetched cards
- UI mode badge and connection diagnostics
- optional `npm run smoke:wb-api-sync-real`

Current limitation:

- default browser/API verification remains mock-only unless a local real token is supplied
# Project Status Update

Cart, multi-item checkout, multi-shop split orders, customer accounts, and parent receipts are in place:

- Customer cart in `frontend-next` localStorage.
- Variant selection on product detail.
- `/cart` page with quantity update, remove, shop grouping, shop subtotal, grand total, and checkout entry.
- `/checkout` creates one order per shop when the cart contains multiple shops.
- `/checkout` also creates a parent `checkoutCode` receipt for single-shop and multi-shop checkout.
- `/customer/register`, `/customer/login`, `/customer/orders`, and `/customer/orders/[checkoutCode]` provide customer account history.
- `/orders/receipt/[checkoutCode]` supports receipt lookup for anonymous checkout with phone.
- Backend validates current price/stock and deducts stock by variant transactionally.
- If any item is invalid or out of stock, the entire checkout fails without partial orders.
- Order/tracking/payment/seller detail views show all order items.
- Payment proof and delivery remain per split shop order.

Known gap: parent receipts do not yet orchestrate combined payment routing, refunds, or support case management.

# Support Cases Phase Status

Implemented:

- parent receipt support cases in backend NestJS
- customer support workflow on `/customer/orders/[checkoutCode]`
- admin support queue on `/admin/support-cases`
- seller support queue on `/seller/support-cases`
- internal admin message filtering for customer and seller responses

Verification:

- `backend-nest/test/support-cases.e2e-spec.ts`: pass
- `npm run smoke:support-cases`: pass
- `npm run test:e2e:support-cases`: pass

Updated gap:

- support case management is now covered
- parent-level combined payment routing and refund orchestration are still future work

# Public Marketplace Contract Hardening Status

Implemented:

- backend public-products contract E2E for list/detail/checkout guards
- explicit documentation of out-of-stock visibility rules
- mobile sticky CTA on public product detail
- header search persistence and cart badge regression coverage
- dedicated `test:e2e:public-marketplace-contract`

Current gap:

- the full unrelated smoke matrix still depends on runtime time budget and should continue to be run periodically outside this focused hardening phase

# Public Marketplace Empty / Fallback Hardening Status

Implemented:

- distinct empty and no-result states on `/products`
- retryable products load error state
- local image fallback for public cards, gallery, and cart
- explicit empty cart state
- explicit product unavailable state for no-longer-public detail pages
- optional backend smoke wrapper `smoke:public-marketplace-contract`

Current gap:

- stale cart item availability warning is still a future enhancement and is not yet resolved proactively before checkout

# Docker Build Reliability + CI Readiness Status

Implemented:

- hardened `backend-nest` and `frontend-next` Dockerfiles around deterministic `npm ci`
- added npm registry retry configuration during image builds
- separated backend build-time and production dependency stages
- moved frontend Docker runtime to Next standalone output
- tightened `.dockerignore` coverage for app build contexts
- documented a supported compose rebuild path with no manual artifact copy

Verification:

- `docker compose -f infra/docker-compose.yml --env-file infra/.env build backend-nest frontend-next`
- `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d backend-nest frontend-next`
- `curl.exe --ipv4 http://localhost:3001/api/health`
- `curl.exe --ipv4 -I http://localhost:3000/products`

Current gap:

- GitHub Actions workflow wiring is still a future phase; this pass prepares the Docker layer and docs for it.
# Yandex Address Readiness Status

Implemented:

- readiness split between saved, manual-ready, and API-ready address states
- customer address API and UI now expose missing Yandex fields
- checkout keeps current manual flow but warns when coordinates are missing
- seller manual Yandex workbench now shows pickup/dropoff readiness explicitly
- admin deliveries can filter missing-coordinate rows

Current gap:

- real Yandex geocoder is still future work
- no real map picker or map tiles in default runtime
- future real Yandex claim creation should tighten API-ready enforcement
