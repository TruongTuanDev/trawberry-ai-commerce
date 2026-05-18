# Reality Audit: Real vs Mock vs Demo

Audit date: 2026-05-18

Scope audited:
- `backend-nest`
- `frontend-next`
- `ai-service`
- `infra`
- `docs`
- `backend-nest/scripts`
- `backend-nest/test`
- `frontend-next/tests/e2e`

Out of scope for modification:
- `strawberry-backend`
- `strawberry-frontend`

## Executive Summary
- Audited sub-feature count: `95`
- `REAL_WORKING`: `61`
- `REAL_PARTIAL`: `21`
- `MOCK_ONLY`: `2`
- `UI_ONLY`: `1`
- `DOC_ONLY`: `0`
- `BROKEN_OR_UNVERIFIED`: `3`
- `MANUAL_OPERATION`: `1`
- `FUTURE_GAP`: `6`

Overall verdict:
- Core marketplace MVP on the new stack is real and broad: auth, seller onboarding, seller catalog, public browse, cart, checkout, parent receipts, customer order history, support cases, manual payment review, admin ops, and seller-managed delivery all have real backend/frontend paths with meaningful Jest, smoke, and Playwright coverage.
- External-provider readiness is still partial: Wildberries real mode is coded but not runtime-verified in this audit; Yandex real mode is coded but not called; CDEK real mode is explicitly skeleton-only; payment provider integration does not exist.
- Some surfaces are misleading if read only from UI navigation:
  - seller AI actually works from product image gallery, while `/seller/ai-images` is only a placeholder route
  - seller dashboard is still a static shell
  - category management has backend admin APIs but no equivalent admin UI in `frontend-next`
- Infrastructure and release posture are not production-ready yet:
  - no GitHub Actions
  - Docker compose could not be re-verified on this machine because Docker daemon was unavailable during this audit
  - `ai-service` local pytest currently fails under local config contamination around storage endpoint handling
- Sensitive repo hygiene issue found:
  - root `data.xlsx` exists and must be treated as a release blocker if tracked by Git

### Top 10 Production Blockers
1. No real payment provider, webhook, capture, reconciliation, refund, or dispute execution flow.
2. `CDEK` real provider is explicitly skeleton-only in backend code.
3. `Yandex` real provider code exists but was not runtime-verified in this audit and still depends on real credentials/billing/addresses.
4. `ai-service` local pytest currently fails because storage config can resolve to invalid S3 endpoint state.
5. Seller dashboard remains static placeholder KPI UI.
6. `/seller/ai-images` is placeholder-only and does not represent the real AI workflow.
7. No admin UI for category/category-mapping operations although backend APIs exist.
8. No CI pipeline or GitHub Actions.
9. CSRF posture is still cookie `SameSite` + trusted-origin based; no synchronizer CSRF token exists.
10. Docker runtime could not be re-verified on 2026-05-18 because local Docker daemon was unavailable.

### Top 10 Quick Wins
1. Remove or untrack `data.xlsx` if Git still tracks it.
2. Fix `ai-service` test env isolation so pytest always forces `STORAGE_DRIVER=mock`.
3. Replace seller dashboard static metrics with live APIs.
4. Replace `/seller/ai-images` placeholder with redirect or real task list based on existing AI backend.
5. Add admin category management UI on top of existing `/api/admin/categories` and `/api/admin/category-mappings`.
6. Add explicit “manual only” badges in payment and delivery UI to reduce false production-readiness signals.
7. Add CI to run backend Jest, frontend build/lint, and selected Playwright smoke.
8. Add deployment/readiness checklist for real envs, secret injection, and prod-safe storage settings.
9. Add CSRF hardening beyond `SameSite`.
10. Add health verification script that fails fast when Docker daemon is unavailable.

## Classification Legend
- `REAL_WORKING`: backend + frontend + DB/business logic are implemented and there is meaningful automated verification in current local/mock-safe runtime.
- `REAL_PARTIAL`: real implementation exists, but important production gaps remain or only part of the flow is verified.
- `MOCK_ONLY`: behavior works only via mock provider/fixture and is not a real external integration.
- `UI_ONLY`: UI exists but business action is placeholder or not wired to real backend logic.
- `DOC_ONLY`: only documentation exists.
- `BROKEN_OR_UNVERIFIED`: code exists, but current audit could not verify it cleanly or found failure signals.
- `MANUAL_OPERATION`: the system supports the workflow, but the real-world operation happens outside the platform.
- `FUTURE_GAP`: important capability is still missing.

## Feature Matrix
| Area | Feature | Status | Evidence | Risk | Next Action |
|---|---|---|---|---|---|
| Auth | Customer login/register | REAL_WORKING | `backend-nest/src/modules/auth/*`, `frontend-next/src/app/customer/login/page.tsx`, `frontend-next/src/app/customer/register/page.tsx`, `backend-nest/test/auth.e2e-spec.ts`, `frontend-next/tests/e2e/auth-role-separation.spec.ts` | LOW | Keep regression coverage. |
| Auth | Seller login/register | REAL_WORKING | `backend-nest/src/modules/auth/*`, `frontend-next/src/app/seller/login/page.tsx`, `frontend-next/src/app/seller/register/page.tsx`, `backend-nest/test/auth.e2e-spec.ts`, `frontend-next/tests/e2e/auth-cookie.spec.ts` | LOW | Keep approval/onboarding checks. |
| Auth | Admin login | REAL_WORKING | `POST /api/auth/admin/login`, `frontend-next/src/app/admin-login/page.tsx`, `frontend-next/tests/e2e/auth-hardening.spec.ts` | LOW | Keep hidden operational route. |
| Auth | Multi-role session cookies | REAL_WORKING | `backend-nest/src/modules/auth/auth-cookie.service.ts`, `docs/MULTI_ROLE_SESSIONS.md`, `backend-nest/test/auth.e2e-spec.ts`, `frontend-next/tests/e2e/multi-role-sessions.spec.ts` | LOW | Keep role-isolated cookies. |
| Auth | Role guards | REAL_WORKING | `backend-nest/src/common/guards/*.ts`, module controllers, backend e2e coverage | LOW | Keep authz regression tests. |
| Auth | Logout per role / logout-all | REAL_WORKING | `POST /api/auth/customer|seller|admin/logout`, `POST /api/auth/logout-all`, `backend-nest/test/auth.e2e-spec.ts` | LOW | None beyond regression coverage. |
| Auth | Phone/email identifier login | REAL_WORKING | `backend-nest/src/modules/auth/auth.service.ts`, `backend-nest/src/common/utils/phone.util.ts`, `frontend-next/src/components/auth/role-login-form.tsx` | LOW | Keep normalization tests. |
| Auth | Rate limit | REAL_WORKING | `backend-nest/src/modules/auth/auth-rate-limit.guard.ts`, `backend-nest/test/auth.e2e-spec.ts` | MEDIUM | Add persistent lockout if needed. |
| Auth | Cookie/CORS/CSRF posture | REAL_PARTIAL | `backend-nest/src/main.ts`, `backend-nest/src/modules/auth/auth-cookie.service.ts`, `docs/SECURITY.md` | HIGH | Add explicit CSRF token strategy. |
| Seller onboarding | Seller pending profile creation | REAL_WORKING | `backend-nest/src/modules/auth/auth.service.ts`, `backend-nest/test/auth.e2e-spec.ts` | LOW | None. |
| Seller onboarding | Legal onboarding profile | REAL_WORKING | `backend-nest/src/modules/seller-onboarding/*`, `frontend-next/src/app/seller/onboarding/page.tsx`, `backend-nest/scripts/smoke-seller-onboarding.ps1`, `frontend-next/tests/e2e/seller-onboarding.spec.ts` | MEDIUM | Add notification workflow. |
| Seller onboarding | KYC document upload | REAL_WORKING | `SellerOnboardingController`, `FilesService.storeSellerDocument`, `seller-onboarding.e2e-spec.ts` | MEDIUM | Add retention/access/deletion policy. |
| Seller onboarding | Admin approval + doc review | REAL_WORKING | `backend-nest/src/modules/admin/admin-sellers.controller.ts`, `frontend-next/src/app/admin/sellers/[id]`, `smoke-seller-approval`, `test:e2e:admin-seller-approval` | MEDIUM | Expand audit coverage to more admin mutations. |
| Seller onboarding | Pending/rejected UX | REAL_WORKING | `frontend-next/src/app/seller/pending/page.tsx`, auth/onboarding flows, `auth-hardening` Playwright | MEDIUM | Add notification/email. |
| Wildberries | Excel import | REAL_WORKING | `backend-nest/src/modules/wb-imports/*`, `frontend-next/src/app/seller/import/wildberries/page.tsx`, `backend-nest/test/wb-import.e2e-spec.ts`, `smoke-wb-import.ps1`, `test:e2e/wb-import.spec.ts` | MEDIUM | Add object-storage download mode or remove misleading option. |
| Wildberries | WB credential save/status/delete/verify lifecycle | REAL_PARTIAL | `backend-nest/src/modules/wb-sync/*`, `frontend-next/src/app/seller/import/wildberries-api/page.tsx`, `backend-nest/test/wb-sync.e2e-spec.ts` | MEDIUM | Re-verify with safe real credential in isolated env. |
| Wildberries | WB API mock mode | MOCK_ONLY | `WbApiClientService` mock response, `WB_SYNC_MODE=mock`, `smoke-wb-api-sync.ps1`, `frontend-next/tests/e2e/wb-api-sync.spec.ts` | LOW | Keep for local/demo only. |
| Wildberries | WB API real mode | REAL_PARTIAL | `backend-nest/src/modules/wb-sync/wb-api-client.service.ts`, `smoke-wb-api-sync-real.ps1`, `docs/WB_REAL_API_SYNC_AUDIT.md` | HIGH | Run controlled real verification outside this audit. |
| Wildberries | Sync all / sync by article | REAL_PARTIAL | `POST /api/shops/:shopId/wb-sync/products`, `.../by-article`, `backend-nest/test/wb-product-sync.e2e-spec.ts`, frontend WB API sync page | HIGH | Real-mode runtime verification still needed. |
| Wildberries | Category mapping | REAL_WORKING | `backend-nest/src/modules/categories/*`, `backend-nest/test/category-mapping.e2e-spec.ts`, `docs/CATEGORY_MAPPING.md` | MEDIUM | Add admin UI. |
| Wildberries | Image URL behavior | REAL_PARTIAL | `wildberries-excel-parser.service.ts`, `WbProductSyncService`, `docs/WILDBERRIES_EXCEL_IMPORT.md` | MEDIUM | Either implement download mode or remove “coming soon” option. |
| Wildberries | Price/stock behavior | REAL_PARTIAL | `wb-product-mapper.service.ts`, docs explicitly state local price/stock preserved and WB price/stock sync absent | HIGH | Decide whether local-only is acceptable or implement WB price/stock sync. |
| Wildberries | Per-shop credential isolation | REAL_WORKING | `shop_wb_credentials`, shop-scoped routes, `ShopAccessGuard`, WB sync tests | LOW | None. |
| Seller catalog | Product list/detail | REAL_WORKING | `backend-nest/src/modules/products/*`, `frontend-next/src/app/seller/products*`, `backend-nest/test/product.e2e-spec.ts`, `test:e2e/seller-product-lifecycle.spec.ts` | LOW | None. |
| Seller catalog | Product curation/publish workflow | REAL_WORKING | `catalogStatus`, publish/unpublish/archive endpoints, `smoke-product-curation.ps1`, `test:e2e/product-curation.spec.ts` | MEDIUM | Keep readiness rules strict. |
| Seller catalog | Readiness rules | REAL_WORKING | `public-products` gating, product curation docs/tests | LOW | None. |
| Seller catalog | Bulk category/price/stock edit | REAL_WORKING | `POST /api/shops/:shopId/products/bulk-update`, `smoke-bulk-product-edit.ps1`, `test:e2e/bulk-product-edit.spec.ts` | MEDIUM | Add audit/export if needed. |
| Seller catalog | Bulk publish/unpublish/archive | REAL_WORKING | `POST /api/shops/:shopId/products/bulk`, product curation UI/tests | MEDIUM | None. |
| Seller catalog | Dedicated catalog workbench | FUTURE_GAP | No separate workbench beyond `/seller/products` tabs/filters | MEDIUM | Implement only if seller ops demand it. |
| Public marketplace | Public products list/detail | REAL_WORKING | `backend-nest/src/modules/public-products/*`, `frontend-next/src/app/products/*`, `public-products.e2e-spec.ts`, `public-full` and `public-marketplace-contract` E2E | LOW | None. |
| Public marketplace | Search/filter/sort | REAL_WORKING | `/api/public/products` query support, `smoke-marketplace-search.ps1`, `test:e2e/marketplace-search-filter-sort.spec.ts` | LOW | None. |
| Public marketplace | Image fallback / empty states / mobile CTA / cart badge | REAL_WORKING | `frontend-next/src/components/public/*`, `public-empty-fallbacks`, `public-marketplace-contract`, `product-buying-ux` E2E | LOW | None. |
| Public marketplace | Add to cart / buy now | REAL_WORKING | `cart-store.ts`, product cards/detail, `cart-checkout` and `product-buying-ux` E2E | LOW | None. |
| Cart/checkout | Cart localStorage + anonymous/session behavior | REAL_WORKING | `frontend-next/src/stores/cart-store.ts`, cart page/client, cart E2E | LOW | None. |
| Cart/checkout | Cart validation + checkout preflight | REAL_WORKING | `POST /api/public/cart/validate`, `smoke-cart-validation.ps1`, `test:e2e/cart-validation.spec.ts` | LOW | None. |
| Cart/checkout | Single-shop + multi-shop checkout split orders | REAL_WORKING | `backend-nest/src/modules/checkout/*`, `smoke-cart-checkout.ps1`, `smoke-multi-shop-checkout.ps1`, `test:e2e/multi-shop-checkout.spec.ts` | MEDIUM | Add payment orchestration if needed. |
| Cart/checkout | Parent checkout receipt + customer order history | REAL_WORKING | `customer-orders` module, `/customer/orders`, `/orders/receipt/[checkoutCode]`, `smoke-customer-order-history.ps1`, `test:e2e/customer-order-history.spec.ts` | MEDIUM | Add combined post-payment/refund orchestration. |
| Cart/checkout | Stock deduction + price validation | REAL_WORKING | checkout/public-products/orders services, Jest checkout/public-products tests, full-commerce E2E | LOW | Add stronger idempotency/concurrency hardening later. |
| Cart/checkout | Stale cart handling | REAL_PARTIAL | stale warning + reconciliation exist, but not fully proactive before every market state change | MEDIUM | Improve proactive server-sync UX. |
| Cart/checkout | Anonymous tracking | REAL_WORKING | `order-tracking` + `public-checkouts` modules, order tracking smoke/E2E | LOW | None. |
| Payment | Manual transfer order path + proof upload | REAL_WORKING | `order-tracking` payment proof upload, `payments` module, `smoke-order-tracking.ps1`, `public-payment-review.spec.ts` | MEDIUM | Add moderation rules. |
| Payment | Seller review queue/detail/mark paid/reject/note | REAL_WORKING | `backend-nest/src/modules/payments/*`, `frontend-next/src/components/payments/*`, `smoke-payments.ps1`, `payments.e2e-spec.ts` | MEDIUM | Add stronger audit retention. |
| Payment | Admin visibility of payment queue | REAL_PARTIAL | admin dashboard/queues/reports expose payment ops, but there is no dedicated admin payment review UI | MEDIUM | Decide whether admin needs direct payment action UI. |
| Payment | Real payment provider | FUTURE_GAP | No provider SDK/webhook/capture code found in backend/frontend | BLOCKER | Define provider and payment state machine. |
| Payment | Refund/dispute execution | FUTURE_GAP | Support cases can request refund, but no refund workflow exists in payments module | BLOCKER | Implement refund domain before production. |
| Delivery | Seller-managed manual delivery | MANUAL_OPERATION | `POST /api/shops/:shopId/orders/:orderId/delivery/manual`, `/seller/orders/[id]`, `smoke-manual-delivery.ps1`, `test:e2e/manual-delivery.spec.ts` | MEDIUM | Keep explicit manual-operation labeling in UI/docs. |
| Delivery | Seller delivery settings + shipment handling | REAL_WORKING | `delivery` module, `/seller/settings`, `/seller/orders/[id]`, `smoke-delivery.ps1`, `test:e2e/seller-delivery-settings.spec.ts` | MEDIUM | Add stronger validation for provider-specific data. |
| Delivery | Admin delivery supervision + exceptions | REAL_WORKING | `AdminDeliveriesController`, `/admin/deliveries`, `smoke-admin-delivery-supervision.ps1`, `smoke-delivery-exceptions.ps1`, E2E coverage | MEDIUM | Add webhook/provider event ingestion later. |
| Delivery | Yandex/CDEK real/mock state | REAL_PARTIAL | `yandex-delivery.provider.ts` real client path exists; `cdek-delivery.provider.ts` is skeleton; mock provider is default verified path | HIGH | Verify Yandex real safely; implement real CDEK fully. |
| Delivery | Customer tracking | REAL_WORKING | `order-tracking` delivery projection, public order detail, delivery smoke and full-commerce E2E | LOW | None. |
| Support | Customer/seller/admin support cases + messages | REAL_WORKING | `support-cases` module, customer/seller/admin controllers, `/customer/orders/[checkoutCode]`, `/seller/support-cases`, `/admin/support-cases`, smoke + E2E coverage | MEDIUM | Add SLA/ownership deeper into support if needed. |
| Support | Internal notes hiding | REAL_WORKING | admin message `isInternal`, service/controller filtering, `docs/SUPPORT_CASES.md` | LOW | None. |
| Support | Refund/dispute through support domain | REAL_PARTIAL | issue types exist, but no linked refund execution | HIGH | Connect support -> payments/refund workflows. |
| Support | Escalation/SLA | REAL_PARTIAL | admin ops queues/tasks/reports exist, but not support-specific SLA engine | MEDIUM | Add support queue SLA if operationally needed. |
| Admin | Dashboard / queues / task ownership / reports | REAL_WORKING | `admin-dashboard*`, `admin-queues*`, `admin-queue-tasks*`, `admin-reports*`, smoke + Playwright suites | MEDIUM | Add notification/escalation delivery. |
| Admin | Seller approval | REAL_WORKING | admin sellers controller/service, seller onboarding doc review, smoke + E2E | MEDIUM | Expand audit logging scope. |
| Admin | Support / deliveries | REAL_WORKING | `/api/admin/support-cases`, `/api/admin/deliveries`, matching UI routes/tests | LOW | None. |
| Admin | Payments/refunds operations | REAL_PARTIAL | payment queue visible in admin ops, but no refund tooling and no direct admin payment action page | HIGH | Decide admin payment authority model. |
| Admin | Category management UI/API | REAL_PARTIAL | backend admin category APIs exist; no frontend admin route/component found | HIGH | Build admin category UI or document API-only ops mode. |
| AI | Seller AI image generation from product gallery | REAL_WORKING | `/seller/products/[id]/images`, `AiImageGenerateModal`, `AiTaskPanel`, backend ai-images module, `ai-images.e2e-spec.ts`, `smoke-ai-service-integration.ps1` | MEDIUM | Add dedicated UI discovery so users do not miss real flow. |
| AI | `/seller/ai-images` route | UI_ONLY | `frontend-next/src/app/seller/ai-images/page.tsx` says reserved/future and does not call backend | MEDIUM | Replace with redirect or real task hub. |
| AI | Mock provider | MOCK_ONLY | `ai-service/app/services/mock_image_provider.py`, `backend-nest/src/modules/ai-images/ai-image-provider.mock.ts` | LOW | Keep for local-only verification. |
| AI | OpenAI real provider | REAL_PARTIAL | `ai-service/app/services/openai_image_provider.py`, `ai-service/tests/test_openai_provider.py`, optional smoke script only | HIGH | Verify with real credentials/quota in isolated env. |
| AI | Credit deduction/refund | REAL_WORKING | `AiImagesService`, `AiImagesWorkerService`, backend tests, smoke ai-service integration docs/tests | MEDIUM | Add admin visibility/reporting if needed. |
| AI | ai-service runtime reliability | BROKEN_OR_UNVERIFIED | `python -m pytest -q` failed on 2026-05-18 due invalid S3 endpoint state; service compile passed | HIGH | Fix env isolation/defaults in tests. |
| AI | Customer try-on | FUTURE_GAP | no real customer-facing flow; only task type/domain hints and placeholder wording | MEDIUM | Design end-to-end try-on product flow explicitly. |
| Infrastructure | Docker compose / healthchecks | BROKEN_OR_UNVERIFIED | `infra/docker-compose.yml` defines healthy stack, but `docker compose ... ps` failed on 2026-05-18 because Docker daemon was unavailable locally | HIGH | Re-run when Docker daemon is up. |
| Infrastructure | Dockerfiles / app builds | REAL_PARTIAL | app builds passed (`backend-nest` build, `frontend-next` build), Dockerfiles present, but compose runtime not re-verified now | MEDIUM | Re-verify image build/run path with Docker available. |
| Infrastructure | Prisma migrations/schema + seed demo | REAL_WORKING | `backend-nest/prisma/*`, `seed-demo.js`, backend tests/build | LOW | None. |
| Infrastructure | Smoke scripts / E2E suite inventory | REAL_PARTIAL | extensive script inventory exists in `backend-nest/package.json` and `frontend-next/package.json`; not all rerun in this audit | MEDIUM | Define smaller CI smoke subset and nightly full suite. |
| Infrastructure | `.env.example` completeness | REAL_PARTIAL | examples exist in `infra`, `backend-nest`, `frontend-next`, `ai-service`; real-mode production guidance still incomplete | MEDIUM | Add prod-safe example matrix and secret docs. |
| Infrastructure | CI / real deploy readiness | FUTURE_GAP | no GitHub Actions found; `docs/DEPLOYMENT.md` still pre-production | BLOCKER | Add CI and deployment pipeline before release. |

## Detailed Findings

### Auth
- Status:
  - customer login/register: `REAL_WORKING`
  - seller login/register: `REAL_WORKING`
  - admin login: `REAL_WORKING`
  - multi-role session cookies: `REAL_WORKING`
  - role guards: `REAL_WORKING`
  - logout per role: `REAL_WORKING`
  - email/phone identifier login: `REAL_WORKING`
  - auth throttling: `REAL_WORKING`
  - cookie/CORS/CSRF posture: `REAL_PARTIAL`
- Evidence:
  - backend: `backend-nest/src/modules/auth/auth.controller.ts`, `auth.service.ts`, `auth-cookie.service.ts`, `auth-rate-limit.guard.ts`, `backend-nest/src/main.ts`
  - frontend: `frontend-next/src/lib/auth-api.ts`, `frontend-next/src/components/auth/role-login-form.tsx`
  - tests: `backend-nest/test/auth.e2e-spec.ts`, `frontend-next/tests/e2e/auth-cookie.spec.ts`, `auth-hardening.spec.ts`, `auth-role-separation.spec.ts`, `multi-role-sessions.spec.ts`
  - docs: `docs/SECURITY.md`, `docs/MULTI_ROLE_SESSIONS.md`, `docs/AUTH_ROLE_SEPARATION.md`, `docs/AUTH_HARDENING.md`
- Runtime proof:
  - endpoints: `POST /api/auth/customer|seller|admin/login`, `POST /api/auth/customer|seller/register`, `GET /api/auth/customer|seller|admin/me`, `POST /api/auth/customer|seller|admin/logout`, `POST /api/auth/logout-all`
- What works:
  - phone or email login
  - synthetic email fallback for phone-only registration
  - role-isolated cookies
  - per-role `me` endpoints
  - per-role logout and logout-all
  - login/register rate limiting
- What is mock/demo:
  - none in core auth flow
- What is UI-only:
  - none
- Missing for production:
  - no synchronizer CSRF token
  - no persistent account lockout or more advanced fraud controls
- Risk: `HIGH`
- Recommended next action:
  - add CSRF token strategy and document trusted-origin deployment posture clearly.

### Seller Onboarding
- Status: `REAL_WORKING`
- Evidence:
  - backend: `backend-nest/src/modules/seller-onboarding/*`, `backend-nest/src/modules/admin/admin-sellers.controller.ts`, `FilesService.storeSellerDocument`
  - frontend: `frontend-next/src/app/seller/onboarding/page.tsx`, `frontend-next/src/app/seller/pending/page.tsx`, `frontend-next/src/app/admin/sellers/[id]`
  - tests/smoke: `backend-nest/test/seller-onboarding.e2e-spec.ts`, `backend-nest/test/admin-sellers.e2e-spec.ts`, `smoke-seller-onboarding.ps1`, `smoke-seller-approval.ps1`, `frontend-next/tests/e2e/seller-onboarding.spec.ts`, `admin-seller-approval.spec.ts`
  - docs: `docs/SELLER_ONBOARDING.md`, `docs/SELLER_APPROVAL.md`
- Runtime proof:
  - endpoints: `/api/seller/onboarding/profile`, `/api/seller/onboarding/documents`, `/api/admin/sellers/:userId/onboarding`, `/api/admin/sellers/:userId/documents/:documentId/approve`
- What works:
  - seller stays `PENDING`
  - legal profile save/update
  - KYC doc upload
  - admin doc approve/reject
  - seller approve/reject and pending UX
- What is mock/demo:
  - no external KYC provider; documents are platform-stored uploads only
- What is UI-only:
  - none
- Missing for production:
  - retention policy
  - document access policy and deletion workflow
  - notification workflow
- Risk: `MEDIUM`
- Recommended next action:
  - define compliance and storage policy before real KYC operations.

### WB Import / Sync
- Status:
  - Excel import: `REAL_WORKING`
  - WB API mock mode: `MOCK_ONLY`
  - WB API real mode: `REAL_PARTIAL`
- Evidence:
  - backend: `backend-nest/src/modules/wb-imports/*`, `backend-nest/src/modules/wb-sync/*`, `backend-nest/src/modules/categories/*`
  - frontend: `frontend-next/src/app/seller/import/wildberries/page.tsx`, `frontend-next/src/app/seller/import/wildberries-api/page.tsx`
  - tests/smoke: `backend-nest/test/wb-import.e2e-spec.ts`, `wb-sync.e2e-spec.ts`, `wb-product-sync.e2e-spec.ts`, `category-mapping.e2e-spec.ts`, `smoke-wb-import.ps1`, `smoke-wb-api-sync.ps1`, `smoke-wb-api-sync-real.ps1`, `frontend-next/tests/e2e/wb-import.spec.ts`, `wb-api-sync.spec.ts`, `wb-import-checkout-flow.spec.ts`
  - docs: `docs/WILDBERRIES_EXCEL_IMPORT.md`, `docs/WB_API_SYNC.md`, `docs/WB_REAL_API_SYNC_AUDIT.md`, `docs/CATEGORY_MAPPING.md`
- Runtime proof:
  - endpoints: `/api/shops/:shopId/imports/wildberries/preview`, `/confirm`, `/api/shops/:shopId/wb-sync/credentials*`, `/api/shops/:shopId/wb-sync/products`, `/by-article`
- What works:
  - preview/confirm import from `.xlsx`
  - seller-scoped import sessions
  - remote image URL ingestion
  - category mapping
  - idempotent upsert
  - saved encrypted per-shop credentials and diagnostics
- What is mock/demo:
  - default WB API sync verification is mock-only
  - verify in mock mode intentionally fails with `WB_MOCK_MODE_ACTIVE`
- What is UI-only:
  - `DOWNLOAD_TO_STORAGE` option is present in UI but backend explicitly warns it is not implemented
- Missing for production:
  - real runtime verification with safe credential
  - real price/stock sync
  - image download-to-storage mode
- Risk: `HIGH`
- Recommended next action:
  - treat real WB sync as partial until one controlled real-mode end-to-end pass succeeds without fallback.

### Product Catalog
- Status: `REAL_WORKING` with one `FUTURE_GAP`
- Evidence:
  - backend: `backend-nest/src/modules/products/*`
  - frontend: `frontend-next/src/app/seller/products*`, `frontend-next/src/components/products/*`
  - tests/smoke: `backend-nest/test/product.e2e-spec.ts`, `smoke-product-curation.ps1`, `smoke-bulk-product-edit.ps1`, `frontend-next/tests/e2e/product-curation.spec.ts`, `bulk-product-edit.spec.ts`, `seller-product-lifecycle.spec.ts`
  - docs: `docs/API_PRODUCTS.md`, `docs/PRODUCT_CURATION_PUBLISHING.md`, `docs/SELLER_BULK_PRODUCT_EDITING.md`
- What works:
  - real product CRUD
  - curation statuses
  - readiness rules
  - bulk updates
  - publish/unpublish/archive
- What is mock/demo:
  - none in core catalog flow
- What is UI-only:
  - no separate “catalog workbench”; only seller products list/tabs
- Missing for production:
  - if a richer workbench is required, it does not exist yet
- Risk: `MEDIUM`
- Recommended next action:
  - keep current seller products page unless operations prove a dedicated workbench is necessary.

### Public Marketplace
- Status: `REAL_WORKING`
- Evidence:
  - backend: `backend-nest/src/modules/public-products/*`
  - frontend: `frontend-next/src/app/products/*`, `frontend-next/src/components/public/*`
  - tests/smoke: `backend-nest/test/public-products.e2e-spec.ts`, `smoke-marketplace-search.ps1`, `smoke-public-marketplace-contract.ps1`, `frontend-next/tests/e2e/public-smoke.spec.ts`, `public-full.spec.ts`, `public-marketplace-contract.spec.ts`, `public-empty-fallbacks.spec.ts`, `product-buying-ux.spec.ts`
  - docs: `docs/PUBLIC_MARKETPLACE_CONTRACT.md`, `docs/MARKETPLACE_SEARCH_FILTER_SORT.md`, `docs/PUBLIC_MARKETPLACE_EMPTY_STATES.md`, `docs/PUBLIC_PRODUCT_BUYING_UX.md`
- What works:
  - public list/detail
  - search/filter/sort
  - fallback images
  - empty/error states
  - sticky mobile CTA
  - cart badge
  - add to cart and buy now
- What is mock/demo:
  - public demo seed exists, but the flow itself is real on the new stack
- What is UI-only:
  - none
- Missing for production:
  - richer merchandising and analytics, not MVP blockers
- Risk: `LOW`
- Recommended next action:
  - preserve current gating rules for `PUBLISHED` + readiness.

### Cart / Checkout / Orders
- Status: mostly `REAL_WORKING`, stale-cart UX `REAL_PARTIAL`
- Evidence:
  - backend: `backend-nest/src/modules/checkout/*`, `order-tracking/*`, `customer-orders/*`, `orders/*`
  - frontend: `frontend-next/src/stores/cart-store.ts`, `src/components/public/cart-page-client.tsx`, `checkout-page-client.tsx`, `src/components/customer/*`
  - tests/smoke: `backend-nest/test/checkout.e2e-spec.ts`, `orders.e2e-spec.ts`, `order-tracking.e2e-spec.ts`, `smoke-cart-checkout.ps1`, `smoke-cart-validation.ps1`, `smoke-multi-shop-checkout.ps1`, `smoke-customer-order-history.ps1`, `frontend-next/tests/e2e/cart-checkout.spec.ts`, `cart-validation.spec.ts`, `multi-shop-checkout.spec.ts`, `customer-order-history.spec.ts`, `full-commerce-flow.spec.ts`
  - docs: `docs/API_CHECKOUT.md`, `docs/CART_VALIDATION_PREFLIGHT.md`, `docs/MULTI_SHOP_CHECKOUT.md`, `docs/CUSTOMER_ACCOUNTS_ORDER_HISTORY.md`
- What works:
  - local cart persistence
  - server-side preflight
  - single-shop and multi-shop checkout
  - parent receipts
  - stock deduction and price validation
  - customer order history
  - anonymous tracking by order/checkout code + phone
- What is mock/demo:
  - none in core checkout path
- What is UI-only:
  - none
- Missing for production:
  - better stale-cart handling before final submit
  - deeper idempotency and concurrency hardening
  - no combined multi-shop payment/refund orchestration
- Risk: `MEDIUM`
- Recommended next action:
  - add idempotency keys and harden stale-cart reconciliation.

### Payment
- Status:
  - manual payment review path: `REAL_WORKING`
  - real provider/refund execution: `FUTURE_GAP`
- Evidence:
  - backend: `backend-nest/src/modules/payments/*`, `order-tracking/*`
  - frontend: `frontend-next/src/components/payments/*`, `frontend-next/src/app/seller/payments*`
  - tests/smoke: `backend-nest/test/payments.e2e-spec.ts`, `smoke-payments.ps1`, `smoke-order-tracking.ps1`, `frontend-next/tests/e2e/public-payment-review.spec.ts`, `full-commerce-flow.spec.ts`
  - docs: `docs/API_PAYMENTS.md`, `docs/API_ORDER_TRACKING.md`
- What works:
  - manual transfer order
  - customer proof upload
  - seller review queue/detail
  - mark paid / reject / note
  - admin dashboards/queues can observe payment ops
- What is mock/demo:
  - no external provider to mock because provider integration does not exist yet
- What is UI-only:
  - none
- Missing for production:
  - payment provider
  - webhook handling
  - capture/reconciliation
  - refunds and disputes
- Risk: `BLOCKER`
- Recommended next action:
  - choose provider and implement real payment state machine before any production launch.

### Delivery
- Status:
  - seller-managed manual flow: `MANUAL_OPERATION`
  - seller/admin delivery operations: `REAL_WORKING`
  - provider integration readiness: `REAL_PARTIAL`
- Evidence:
  - backend: `backend-nest/src/modules/delivery/*`
  - frontend: `frontend-next/src/components/seller/seller-delivery-settings-page-client.tsx`, `src/components/orders/seller-order-detail-page-client.tsx`, `src/components/admin/admin-deliveries-page-client.tsx`
  - tests/smoke: `backend-nest/test/delivery.e2e-spec.ts`, `yandex-delivery.client.e2e-spec.ts`, `yandex-delivery.provider.e2e-spec.ts`, `smoke-delivery.ps1`, `smoke-manual-delivery.ps1`, `smoke-admin-delivery-supervision.ps1`, `smoke-delivery-exceptions.ps1`, `frontend-next/tests/e2e/seller-delivery-settings.spec.ts`, `manual-delivery.spec.ts`, `admin-delivery-supervision.spec.ts`, `delivery-exceptions.spec.ts`
  - docs: `docs/API_DELIVERY.md`, `docs/MANUAL_DELIVERY_WORKFLOW.md`, `docs/DELIVERY_EXCEPTIONS.md`, `docs/DELIVERY_PROVIDERS.md`
- What works:
  - seller settings
  - offer calculation in verified mock path
  - shipment create/refresh/accept/cancel in supported paths
  - manual tracking data capture
  - exception handling
  - admin supervision
  - customer-facing tracking projection
- What is mock/demo:
  - default verified carrier path is mock mode
- What is UI-only:
  - none
- Missing for production:
  - real CDEK implementation
  - safe real Yandex verification
  - webhook/polling ingestion
- Risk: `HIGH`
- Recommended next action:
  - finish real-provider implementation before marketing delivery as an in-platform carrier integration.

### Support / Refund / Dispute
- Status: `REAL_WORKING` for support messaging, `REAL_PARTIAL` for refund/dispute execution
- Evidence:
  - backend: `backend-nest/src/modules/support-cases/*`
  - frontend: `frontend-next/src/components/customer/customer-support-section.tsx`, `src/components/seller/seller-support-cases-page-client.tsx`, `src/components/admin/admin-support-cases-page-client.tsx`
  - tests/smoke: `backend-nest/test/support-cases.e2e-spec.ts`, `smoke-support-cases.ps1`, `frontend-next/tests/e2e/support-cases.spec.ts`
  - docs: `docs/SUPPORT_CASES.md`
- What works:
  - checkout-level and order-level cases
  - customer, seller, and admin messages
  - internal admin note isolation
- What is mock/demo:
  - none
- What is UI-only:
  - none
- Missing for production:
  - dispute/refund execution workflow
  - dedicated support SLA engine
- Risk: `HIGH`
- Recommended next action:
  - link support-case outcomes to payment/refund domain changes.

### Admin
- Status: mostly `REAL_WORKING`, category/payment-refund areas `REAL_PARTIAL`
- Evidence:
  - backend: `backend-nest/src/modules/admin/*`, `categories/*`, `support-cases/admin-support-cases.controller.ts`
  - frontend: `frontend-next/src/app/admin/*`, `frontend-next/src/components/admin/*`
  - tests/smoke: `backend-nest/test/admin-dashboard.e2e-spec.ts`, `admin-queue-tasks.e2e-spec.ts`, `admin-queues.e2e-spec.ts`, `admin-reports.e2e-spec.ts`, `admin-sellers.e2e-spec.ts`, `backend-nest/scripts/smoke-admin-*.ps1`, `frontend-next/tests/e2e/admin-*.spec.ts`
  - docs: `docs/ADMIN_DASHBOARD.md`, `docs/ADMIN_OPERATIONAL_QUEUES.md`, `docs/ADMIN_TASK_OWNERSHIP.md`, `docs/ADMIN_REPORTING.md`
- What works:
  - dashboard
  - seller approval
  - ops queues
  - task ownership/escalation
  - reporting/export
  - support queue
  - delivery supervision
- What is mock/demo:
  - none in admin ops UI itself
- What is UI-only:
  - category management UI is absent even though API exists
- Missing for production:
  - refund tooling
  - direct admin payment action surface if required
  - admin category UI
- Risk: `HIGH`
- Recommended next action:
  - add admin category UI and define whether admins must act directly on payments/refunds.

### AI
- Status:
  - seller AI generation flow: `REAL_WORKING`
  - mock provider: `MOCK_ONLY`
  - OpenAI real mode: `REAL_PARTIAL`
  - ai-service runtime reliability: `BROKEN_OR_UNVERIFIED`
  - `/seller/ai-images`: `UI_ONLY`
- Evidence:
  - backend: `backend-nest/src/modules/ai-images/*`
  - frontend: `frontend-next/src/app/seller/products/[id]/images/page.tsx`, `src/components/products/ai-image-generate-modal.tsx`, `ai-task-panel.tsx`, `src/app/seller/ai-images/page.tsx`
  - ai-service: `ai-service/app/services/openai_image_provider.py`, `mock_image_provider.py`, `storage_service.py`, `app/dependencies.py`
  - tests/smoke: `backend-nest/test/ai-images.e2e-spec.ts`, `ai-images.worker.spec.ts`, `ai-service-client.spec.ts`, `ai-service/tests/test_openai_provider.py`, `test_quality_guard.py`, `test_ai_service.py`, `smoke-ai-service-integration.ps1`, `ai-service/scripts/smoke_openai_provider.py`
  - docs: `docs/API_AI_IMAGES.md`, `docs/AI_IMAGE_FLOW.md`, `docs/AI_SERVICE.md`, `docs/OPENAI_IMAGE_PROVIDER.md`
- Runtime proof:
  - endpoints: `POST /api/shops/:shopId/products/:productId/ai-images/tasks`, `GET /api/shops/:shopId/ai-images/tasks/:taskId`, `POST /api/shops/:shopId/products/:productId/ai-images/:imageId/attach`, `POST /internal/ai-images/generate`
- What works:
  - create AI task from product gallery
  - poll task status
  - credit deduction and refund
  - attach generated asset to product gallery
  - mock/local-safe pipeline
- What is mock/demo:
  - default provider is mock
  - mock provider produces metadata-only/mock URLs
- What is UI-only:
  - `/seller/ai-images` route
- Missing for production:
  - stable ai-service test isolation
  - real OpenAI runtime verification
  - customer try-on flow
- Risk: `HIGH`
- Recommended next action:
  - fix ai-service test env isolation, then run one real OpenAI verification in a controlled environment.

### Infrastructure / CI / CD
- Status:
  - Prisma/seed: `REAL_WORKING`
  - Docker/runtime/healthchecks: `BROKEN_OR_UNVERIFIED`
  - CI/deploy readiness: `FUTURE_GAP`
- Evidence:
  - files: `infra/docker-compose.yml`, `infra/.env.example`, `backend-nest/prisma/*`, `backend-nest/scripts/seed-demo.js`, service Dockerfiles
  - tests/scripts: package script inventories in `backend-nest/package.json` and `frontend-next/package.json`
  - docs: `docs/DEPLOYMENT.md`, `docs/RUNTIME_ENV.md`, `docs/DOCKER_BUILD_RELIABILITY.md`
- Verification in this audit:
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `ai-service python -m compileall app`: pass
  - `ai-service python -m pytest -q`: failed, `3` failures caused by invalid storage endpoint state
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: failed because Docker daemon was unavailable
- What works:
  - repo has broad smoke and Playwright coverage
  - app source builds pass for backend/frontend
  - Prisma/schema/migrations/seed are present
- What is mock/demo:
  - default infra examples intentionally point AI/WB/delivery to mock-safe modes
- What is UI-only:
  - none
- Missing for production:
  - CI
  - deployment pipeline
  - reproducible Docker verification on fresh machine
  - cleaner env isolation for ai-service tests
- Risk: `BLOCKER`
- Recommended next action:
  - add CI first, then restore Docker verification and prod deployment pipeline.

## Mock / Demo Inventory
| File | Mock/Demo usage | Impact | Keep/Replace |
|---|---|---|---|
| `ai-service/app/services/mock_image_provider.py` | AI output is mock/generated metadata only | real AI not proven by default | Keep for local; replace as release path |
| `backend-nest/src/modules/ai-images/ai-image-provider.mock.ts` | Nest internal mock image provider | same as above | Keep for tests/local |
| `backend-nest/src/modules/wb-sync/wb-api-client.service.ts` | hardcoded mock WB cards when `WB_SYNC_MODE=mock` | WB API sync demo path can look “real” unless labeled | Keep for local only |
| `backend-nest/src/modules/delivery/providers/mock-delivery.provider.ts` | fake Yandex/CDEK offers/tracking URLs | verified delivery path is not real carrier integration | Keep for local only |
| `backend-nest/scripts/seed-demo.js` | demo admin/seller/products/payment instructions | useful for E2E and demo, not prod data | Keep for local/demo only |
| `frontend-next/public/demo/*` | demo product media | harmless demo asset dependency | Keep for demo only |
| `infra/.env.example` | defaults AI/WB/delivery to mock-safe modes | can mislead if copied to “production” without review | Keep, but document loudly |

## UI-only Inventory
| Page/Component | Button/Flow | Missing backend/action | Priority |
|---|---|---|---|
| `frontend-next/src/app/seller/dashboard/page.tsx` | whole dashboard metrics | static metrics, no live KPI API calls | HIGH |
| `frontend-next/src/app/seller/ai-images/page.tsx` | whole route | placeholder description only; no task list/create flow | HIGH |
| `frontend-next/src/app/seller/import/wildberries/page.tsx` | `DOWNLOAD_TO_STORAGE` option | backend explicitly says not implemented, falls back to remote URLs | MEDIUM |
| Admin category management in `frontend-next` | entire UI absent | backend APIs exist, frontend admin route/component absent | HIGH |
| `backend-nest/src/modules/files/files.controller.ts` consumer surface | placeholder upload descriptor path | descriptor exists, but primary app flows use direct upload handlers instead | LOW |

## Real External Integrations
| Integration | Current Mode | Real Ready? | Required Env/Credentials | Notes |
|---|---|---|---|---|
| Wildberries | default `mock`; real mode coded | Partial | `WB_SYNC_MODE=real`, saved per-shop key, `WB_CREDENTIAL_ENCRYPTION_KEY` | real runtime not exercised in this audit |
| OpenAI image | default `mock`; real provider coded | Partial | `AI_IMAGE_PROVIDER=openai`, `OPENAI_API_KEY`, storage config | optional smoke only; no real call made here |
| Yandex Delivery | mock verified; real provider coded | Partial | `DELIVERY_PROVIDER_MODE=yandex`, `YANDEX_DELIVERY_TOKEN`, `YANDEX_DELIVERY_CLIENT_ID` | no real call in this audit |
| CDEK | mock verified; real provider skeleton | No | `DELIVERY_PROVIDER_MODE=cdek`, `CDEK_ACCOUNT`, `CDEK_SECURE_PASSWORD`, base URL | refresh/cancel explicitly not implemented |
| Payment provider | not implemented | No | n/a | manual transfer only |
| Email/SMS notifications | not implemented in active new stack | No | provider-specific | docs mention future notifications only |
| Object storage | local/S3/MinIO paths exist | Partial | `STORAGE_DRIVER`, `S3_*` or local upload root | ai-service test env sensitivity needs fix |

## Production Readiness Score
- Auth: `3.5/5`
- Seller onboarding: `3/5`
- Catalog: `4/5`
- Marketplace buying: `4/5`
- Payment: `1/5`
- Delivery: `2/5`
- Admin ops: `3.5/5`
- AI: `2.5/5`
- DevOps: `2/5`

## Recommended Roadmap

### Phase 1 - Fix blockers
- remove or untrack sensitive `data.xlsx` if Git tracks it
- fix `ai-service` pytest/storage-env instability
- add CI for backend/frontend/selected smoke
- define real payment provider and payment state machine

### Phase 2 - Replace mocks
- run controlled real WB verification
- run controlled real OpenAI verification
- finish real Yandex verification
- replace or hide `DOWNLOAD_TO_STORAGE` until implemented

### Phase 3 - Production hardening
- CSRF hardening
- idempotency and concurrency hardening for checkout/payment
- KYC retention/access/deletion policy
- stronger admin audit retention and reporting

### Phase 4 - Real external integrations
- payment provider/webhooks
- real CDEK implementation
- delivery webhook/status ingestion
- notification provider integration

### Phase 5 - Scale / monitoring
- deployment pipeline
- runtime observability
- alerting for failed jobs/provider errors
- nightly smoke/E2E split from CI-fast suite

## Commands / Files Reviewed

Commands run in this audit:
- `git status --short --branch`
- `rg` scans across `backend-nest`, `frontend-next`, `ai-service`, `infra`, `docs`
- `backend-nest npm run lint`
- `backend-nest npm test -- --runInBand`
- `backend-nest npm run build`
- `frontend-next npm run lint`
- `frontend-next npm run build`
- `ai-service python -m compileall app`
- `ai-service python -m pytest -q`
- `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`

Key files reviewed:
- `README.md`
- `backend-nest/package.json`
- `frontend-next/package.json`
- `infra/docker-compose.yml`
- `infra/.env.example`
- `ai-service/README.md`
- `docs/PROJECT_STATUS.md`
- `docs/FULL_FLOW_AUDIT.md`
- `docs/PHASE_REPORT.md`
- `backend-nest/src/modules/auth/*`
- `backend-nest/src/modules/seller-onboarding/*`
- `backend-nest/src/modules/wb-imports/*`
- `backend-nest/src/modules/wb-sync/*`
- `backend-nest/src/modules/products/*`
- `backend-nest/src/modules/public-products/*`
- `backend-nest/src/modules/checkout/*`
- `backend-nest/src/modules/payments/*`
- `backend-nest/src/modules/delivery/*`
- `backend-nest/src/modules/support-cases/*`
- `backend-nest/src/modules/admin/*`
- `backend-nest/src/modules/ai-images/*`
- `backend-nest/src/modules/categories/*`
- `backend-nest/src/modules/files/*`
- `frontend-next/src/app/*`
- `frontend-next/src/components/*`
- `frontend-next/src/stores/cart-store.ts`
- `frontend-next/tests/e2e/*`
- `backend-nest/test/*`
