# Full Commerce Flow Audit

## Seller Printable Shipping Label Addendum

- seller order detail now supports an internal printable shipping label flow for manual Yandex operations
- verified route:
  - `/seller/orders/[id]/shipping-label`
- verified print behavior:
  - label preview centered on screen
  - seller shell/sidebar/header hidden from the print page output
  - print stylesheet targets `100mm x 150mm`
- verified label payload sources:
  - existing seller order detail API
  - existing seller delivery detail data
  - existing seller delivery settings data for pickup origin context
- verified label content:
  - order code
  - recipient name/phone/address snapshot
  - sender/pickup summary
  - manual Yandex id when present
  - payment method/status
  - package summary
  - QR to public tracking lookup
- verified business isolation:
  - no order lifecycle mutation was added
  - no payment review logic changed
  - no real Yandex API call or official provider label generation was introduced

## Seller Payment Settings + Products i18n Addendum

- seller payment settings now render role-based localized copy in `ru`, `en`, and `vi` on the active frontend runtime
- seller product list filter toolbar is now a client-subscribed locale surface:
  - search placeholder
  - status filter
  - stock-state filter
  - apply-filters CTA
- seller shop switcher helper text now follows seller locale state
- seller product metadata form no longer exposes hard-coded English labels for local title/description, SEO slug, visibility, and save states
- no seller business logic changed:
  - product visibility/readiness rules remain unchanged
  - product delete/update logic remains unchanged
  - payment-settings save/upload behavior remains unchanged

## Customer Account i18n Cleanup Addendum

- customer notifications route now uses customer-shell dictionary keys for the page frame instead of server-hard-coded Vietnamese text
- customer returns/refunds now use localized RU/EN UI chrome for:
  - page frame
  - form labels
  - helper text
  - detail metrics
  - case actions
  - file upload trigger/empty filename state
- customer order detail support section and public receipt lookup now render localized account-level labels while preserving existing API and business behavior
- no checkout, return/refund, support, or session business logic changed in this cleanup

## Customer Account i18n Addendum

- customer auth and account surfaces now follow the buyer locale policy:
  - supported locales: `ru`, `en`
  - default locale: `ru`
  - no Vietnamese option in buyer UI
- verified customer-localized surfaces:
  - `/customer/login`
  - `/customer/register`
  - `/customer/account`
  - `/customer/account/addresses`
  - `/customer/account/security`
  - `/customer/account/support`
  - `/customer/orders`
  - `/customer/orders/[checkoutCode]`
  - `/customer/returns`
- customer business flows remain locale-agnostic in regression coverage:
  - account management uses stable field and badge test ids
  - return / refund status assertions use raw `data-status`
  - notification regression checks role-level visibility and actions instead of localized copy bodies
- no customer backend contract or business rule changed:
  - register still redirects to `/customer/login?registered=1`
  - session refresh behavior is unchanged
  - checkout address readiness rules remain backend-authoritative
  - order, return, refund, and support flows preserve existing business logic

## Seller Workspace Hydration Addendum

- seller operational pages now tolerate direct deep links and page refreshes without assuming `currentShopId` is already present in the client workspace store
- seller detail flows resolve the owning shop from seller-accessible detail APIs and then synchronize the workspace store after the payload is loaded
- verified restored paths:
  - seller payment review detail from direct URL
  - seller orders board after refresh with persisted locale
  - seller finance dashboard metrics after login/refresh
  - seller product detail and images routes in lifecycle E2E
- locale switching remains orthogonal to auth/session/shop hydration:
  - seller default `ru`
  - seller switch `ru -> vi -> en` persists after refresh
  - no regression to payment/order/delivery contracts was observed in required seller regression suites

## Admin Fulfillment Supervision Addendum

- admin supervision now follows the same normalized fulfillment buckets already released on the seller side
- `/admin/deliveries` is now an order-level fulfillment board instead of primarily a raw delivery queue
- admin can search by seller, shop, order, and buyer while also filtering by payment status, delivery status, provider, date range, and overdue state
- admin still reuses shipment-level override endpoints for in-delivery, delivered, and cancelled transitions, so seller and admin act on the same delivery state
- internal seller reminders for missing manual Yandex creation remain available and are still non-external audit events only

## Seller Payment Review And Fulfillment Addendum

- seller proof review is now an explicit queue instead of an incidental state mixed into the fulfillment board
- seller confirmation of payment proof still drives the same backend payment transition, but the UI now immediately removes the item from the review queue and treats the order as fulfillment-ready
- seller fulfillment buckets now map raw order + delivery states into operational buckets:
  - `NEW`
  - `ASSEMBLING`
  - `IN_TRANSIT`
  - `COMPLETED`
  - `CANCELLED`
  - `ARCHIVED`
- buyer public order tracking now shows a friendlier fulfillment label instead of only raw internal status values
- archived seller orders are kept in the same order domain instead of creating a separate storage flow

## Session Auto Refresh Addendum

- protected customer, seller, and admin routes now tolerate expired role access cookies when the matching role refresh cookie is still valid
- the frontend retries a protected request once after silent refresh and only redirects to login after refresh failure
- refresh is role-aware and role-isolated:
  - customer refresh uses only customer refresh cookies
  - seller refresh uses only seller refresh cookies
  - admin refresh uses only admin refresh cookies
- register flow remains separate from session establishment and still redirects to login without auto-login

## Register To Login Flow Addendum

- customer register now creates the account, shows a success toast, and redirects to `/customer/login?registered=1`
- seller register now creates the account, shows a success toast, and redirects to `/seller/login?registered=1`
- no frontend auto-login happens after register
- no immediate `/api/auth/customer/me` or `/api/auth/seller/me` call is part of the successful register path
- unauthorized session messaging is now reserved for session restoration and protected-route checks, not public registration forms

## Global Action Feedback, Toast & Refresh Policy Addendum

- Implemented a global Toast Notification system with action-level visual overlays (`toast-success`, `toast-error`).
- Standardized visual action feedback states (`isRunning`) and Vietnamese loading labels: Save (`Đang lưu...`), Submit (`Đang gửi...`), Confirm (`Đang xác nhận...`), Upload (`Đang tải lên...`), Checkout (`Đang tạo đơn...`), Delete (`Đang xóa...`), Mark delivered (`Đang cập nhật...`).
- Added window-level confirmation dialogs (`window.confirm`) to protect critical/destructive actions (delete address, cancel order, reject payment/return, archive product, mark delivered, override refund, mark invoice paid, generate invoice).
- Enforced strict UX policies: success actions trigger immediate page data refreshes, preventing stale UI.
- Integrated error maps to translate generic HTTP status codes (401, 403, 409, 429, 500) into friendly Vietnamese notifications.
- Resolved dynamic Next.js chunk singleton state duplication by storing toast listeners and state globally on the `window` object.
- Patched all affected Playwright E2E tests (`customer-account.spec.ts`, `return-refund-dispute.spec.ts`, `seller-fee-dashboard.spec.ts`) to handle confirm dialogs and avoid strict mode violations.
- Verification targets: `test:e2e:action-feedback`, `test:e2e:customer-account`, `test:e2e:seller-fee-dashboard`, `test:e2e:return-refund-dispute`, `test:e2e:three-role-demo`, `test:e2e:public-full`, and `test:e2e:marketplace-search-filter-sort`.

## Return / Refund / Dispute Addendum

- customer can now open a return/refund/dispute case from order detail
- seller can review case context, respond, request evidence, reject, or mark refund sent
- admin can review marketplace-wide return cases and issue a decision
- manual refund transfer confirmation now feeds finance adjustment logic
- seller fee due decreases only after refund confirmation, not merely after approval

## Three Role Order Sync Addendum

- customer checkout visibility, seller order visibility, and admin supervision are now explicitly tied together through role-aware status projection
- seller order list/detail now surfaces the next operational action instead of raw internal-only status combinations
- admin seller management now exposes status tabs, search, counts, and seller finance/order summary
- admin payment supervision now shows whether seller final confirmation has already generated a finance ledger row
- finance hook remains:
  - prepaid seller QR -> ledger on seller confirmed prepaid payment
  - pay on delivery seller QR -> ledger on seller confirmed delivery payment
  - deposit then delivery -> ledger on seller confirmed final payment

## Seller Manual Yandex Delivery Workbench Addendum

- direct-seller payment confirmation can now move Yandex-preferred orders into `READY_TO_CREATE_YANDEX`
- seller order detail now supports a manual Yandex workbench instead of only a generic manual tracking form
- seller can save:
  - pickup / dropoff / package context
  - manual Yandex order id / claim id
  - courier identity
  - ETA and delivery price
  - note and tracking link
- seller/admin can move manual Yandex shipment states through:
  - `YANDEX_MANUAL_CREATED`
  - `COURIER_ASSIGNED`
  - `PICKED_UP`
  - `ON_THE_WAY`
  - `DELIVERED`
  - `FAILED`
  - `CANCELLED`
- admin supervision now has two important manual-ops queues:
  - `READY_TO_CREATE_YANDEX`
  - `OVERDUE`
- buyer tracking now shows a simpler manual Yandex timeline instead of only raw provider status

## Customer Account Management Addendum

- customer profile, password change, and saved-address management are now implemented in the active new stack
- logged-in customers now have a dedicated account area at `/customer/account`
- existing customer order history and parent receipt detail remain intact and are linked from the same account shell
- checkout now supports optional saved-address selection through `addressId` without removing the manual-address path
- seller/admin sessions still do not gain access to customer account functionality

## Auth UX Separation Addendum

- Public `/`, `/products`, `/cart`, and `/checkout` now expose customer and seller entry points only.
- Admin login remains operational at `/admin-login` and is intentionally absent from public marketplace navigation.
- Customer auth flow:
  - register/login by email or phone
  - redirect to `/customer/orders`
- Seller auth flow:
  - register/login by email or phone
  - redirect to `/seller/onboarding` until approved, then `/seller/dashboard`
- Compatibility staff login `/login` still works for seller/admin test flows.

## Cart Reliability Addendum

- Added backend preflight endpoint `POST /api/public/cart/validate`.
- `/cart` now catches stale items before customer enters final checkout submit.
- `/checkout` reruns preflight immediately before order creation.
- Final checkout validation remains server-side and authoritative.

## Public Buying UX Addendum

Date: 2026-05-17

- public marketplace card/detail UX was upgraded to a Wildberries-inspired marketplace layout without copying assets
- `/products` now exposes clear quick-cart vs select-size behavior
- `/products/[id]` now uses:
  - gallery thumbnails
  - size pills with disabled out-of-stock variants
  - quantity stepper
  - sticky purchase card
  - `Добавить в корзину`
  - `Купить сейчас`
- cart and checkout domain flow stayed the same; only public buying ergonomics changed
- focused verification pass:
  - `npm run test:e2e:product-buying-ux`
  - `npm run test:e2e:cart-checkout`
  - `npm run test:e2e:multi-shop-checkout`
  - `npm run test:e2e:marketplace-search-filter-sort`

Date: 2026-05-13

Scope: `frontend-next`, `backend-nest`, `ai-service`, and Docker runtime. Legacy apps `strawberry-frontend` and `strawberry-backend` were intentionally not modified.

## Seller Catalog Curation Addendum

- WB import and WB API sync no longer publish products directly to the public marketplace.
- Imported products now land in seller catalog status `IMPORTED`.
- Seller must review readiness and explicitly publish products before they appear on `/products` or become checkout-eligible.
- Unpublish and archive remove products from public listing and checkout immediately.
- Seller bulk editing now covers category, price, stock, and optional `publishIfReady` from `/seller/products`.

## Category Mapping + Search/Filter/Sort

- Category mapping preserves WB source category while adding internal `categoryId`.
- Unmapped categories produce `UNMAPPED_CATEGORY` warnings.
- Public catalog search/filter/sort is verified by `smoke:marketplace-search` and `test:e2e:marketplace-search-filter-sort`.
- Price sorting uses the minimum active variant price; checkout still recalculates totals.

## 1. Executive Summary

Overall result: **PASS for the current MVP/demo flow; PARTIAL for production readiness**.

The practical seller-to-customer path is now verifiable end to end in the new stack: public product browse, checkout, stock deduction, order tracking, payment proof upload, seller payment review, mark paid, mock delivery shipment, seller status update, and customer tracking refresh all pass through automated checks.

Seller-managed manual delivery is now supported for the current no-credentials operating model: sellers create shipments in Yandex/CDEK dashboards outside the system, paste tracking data into seller order detail, and admins supervise paid orders without delivery from `/admin/deliveries`.

Wildberries import is also covered end to end by `npm run smoke:wb-import-checkout` and `npm run test:e2e:wb-import-checkout`: approved seller import, `REMOTE_URL` images, seller price/stock update, public catalog eligibility, customer checkout, stock deduction, order tracking, seller order/payment visibility, and re-import idempotency.

Strong points:
- Docker runtime is healthy for frontend, backend, AI service, Postgres, Redis, and MinIO.
- Backend module tests and smoke scripts cover checkout, order tracking, payments, inventory, low-stock alerts, and mock delivery.
- Browser E2E now covers auth cookies, public catalog, public checkout/proof, seller payment review, and full commerce payment/delivery/fulfillment.
- Secrets are kept out of tracked files by current `git ls-files` checks; `.env` files are ignored.

Still missing or partial:
- Seller approval admin API/UI and KYC onboarding are now implemented; production readiness still needs notification workflows, retention policy, and broader admin audit coverage.
- Seller create shop/product/product-image and delivery settings now have focused browser E2E coverage; full-commerce still uses API setup where that keeps the broader end-to-end scenario deterministic.
- Real payment provider integration is not implemented; manual transfer review is the verified path.
- Real Yandex/CDEK modes are skeleton/optional and were not called. Mock delivery is the verified default.
- OpenAI real image generation was not called during this audit by design.

Demo readiness: **Yes, demo-ready for the MVP using Docker, seeded demo data, manual payment, and mock delivery.**

## 2. Full End-to-End Flow Table

| Step | Actor | UI route/API endpoint | Status | Verification evidence | Notes |
|---|---|---|---|---|---|
| Seller register | Seller | `POST /api/auth/register`, `/login` | PASS | `backend-nest` tests; `npm run test:e2e:auth` registers via API and logs in through UI | Register creates active seller user with seller profile pending approval. |
| Seller approval | Admin | `/admin/sellers`, `/admin/sellers/[id]`, `/api/admin/sellers` | PASS | `npm run smoke:seller-approval`; `npm run smoke:seller-onboarding`; `npm run test:e2e:admin-seller-approval`; `npm run test:e2e:seller-onboarding` | Admin can list, review KYC, approve documents, approve sellers, reject sellers, and audit actions. Approval requires at least one approved KYC document. |
| Seller login | Seller | `/login`, `POST /api/auth/login` | PASS | `npm run test:e2e:auth`; `npm run test:e2e:full-commerce` | `httpOnly` auth cookie verified; no raw JWT in localStorage. |
| Seller create shop | Seller | `/seller/products`, `POST /api/shops` | PASS | `npm run test:e2e:seller-product-lifecycle`; backend tests | Browser E2E creates the seller's first shop from UI after API-only seller approval setup. |
| Seller onboarding/KYC | Seller/Admin | `/seller/onboarding`, `/admin/sellers/[id]`, onboarding/document APIs | PASS | `npm run smoke:seller-onboarding`; `npm run test:e2e:seller-onboarding`; backend Jest | Seller saves legal profile, uploads document, admin reviews document, audit log records review. |
| Seller delivery settings | Seller | `/seller/settings`, `GET/PATCH /api/shops/:shopId/delivery/settings` | PASS | `npm run smoke:delivery`; `npm run test:e2e:seller-delivery-settings`; `npm run test:e2e:full-commerce` API setup | Focused browser E2E saves and reloads pickup, carrier priority, and package defaults from UI. |
| Seller create product | Seller | `/seller/products`, `POST /api/shops/:shopId/products` | PASS | `npm run test:e2e:seller-product-lifecycle`; backend tests | Browser E2E creates a unique active product with initial price/stock variant. |
| Seller upload product image | Seller | `/seller/products/[id]/images`, `POST /api/shops/:shopId/products/:productId/images` | PASS | `npm run test:e2e:seller-product-lifecycle`; product image tests | Browser E2E uploads a PNG product image and verifies gallery card. |
| Seller inventory update | Seller | `/seller/products/[id]`, `PATCH /api/shops/:shopId/products/:productId/inventory` | PASS | `npm run smoke:inventory`; `npm run smoke:inventory-alerts`; `npm run test:e2e:seller-product-lifecycle` | Browser E2E updates stock before customer checkout. |
| Public product listing | Customer | `/products`, `GET /api/public/products` | PASS | `npm run test:e2e:public`; `npm run test:e2e:public-full`; `npm run test:e2e:full-commerce`; `npm run test:e2e:seller-product-lifecycle` | Search and product card selection verified, including seller-created product. |
| Product detail | Customer | `/products/[id]`, `GET /api/public/products/:productId` | PASS | `npm run test:e2e:public-full`; `npm run test:e2e:full-commerce`; `npm run test:e2e:seller-product-lifecycle` | Product heading, quantity, checkout CTA verified. |
| Customer checkout | Customer | `/checkout`, `POST /api/checkout/orders` | PASS | `npm run smoke:checkout`; `npm run test:e2e:public-full`; `npm run test:e2e:full-commerce`; `npm run test:e2e:seller-product-lifecycle` | Backend recalculates totals. |
| Stock deduction | System | Checkout transaction, public product API | PASS | `npm run smoke:inventory`; `npm run test:e2e:full-commerce` compares `availableQuantity` before/after | Atomic update protects against oversell. |
| Customer order tracking | Customer | `/orders/track`, `/orders/[id]`, `GET /api/public/orders/track` | PASS | `npm run smoke:order-tracking`; public/full/full-commerce E2E | Phone verification required. |
| Customer payment proof upload | Customer | `/orders/[id]`, `POST /api/public/orders/:orderId/payment-proof` | PASS | `npm run smoke:order-tracking`; public-full; public-payment-review; full-commerce | Upload is stored and visible to seller. |
| Seller orders list/detail | Seller | `/seller/orders`, `/seller/orders/[id]`, `GET /api/shops/:shopId/orders` | PASS | `npm run test:e2e:full-commerce`; `npm run test:e2e:seller-product-lifecycle`; `npm run smoke:checkout` seller visibility | Lifecycle E2E verifies seller sees order created for seller-created product. |
| Seller payment queue/detail | Seller | `/seller/payments`, `/seller/payments/[orderId]`, `GET /api/shops/:shopId/payments` | PASS | `npm run smoke:payments`; `npm run test:e2e:public-payment-review`; full-commerce | Payment proof link verified. |
| Seller mark paid | Seller | `POST /api/shops/:shopId/payments/:orderId/mark-paid` | PASS | `npm run smoke:payments`; payment-review E2E; full-commerce | Audit log created. |
| Delivery calculate/create/refresh | Seller | `/seller/orders/[id]`, delivery endpoints | PASS | `npm run smoke:delivery`; `npm run test:e2e:seller-delivery-settings`; `npm run test:e2e:full-commerce` | Browser E2E verifies same-city Yandex recommendation and mock shipment create/refresh. |
| Seller-managed manual delivery | Seller/Admin | `/seller/orders/[id]`, `/admin/deliveries`, manual delivery endpoints | PASS | `npm run smoke:manual-delivery`; `npm run smoke:admin-delivery-supervision`; `npm run test:e2e:manual-delivery`; `npm run test:e2e:admin-delivery-supervision` | Seller pastes Yandex/CDEK tracking data; admin monitors paid-without-delivery and can override status. |
| Customer sees delivery tracking | Customer | `/orders/[id]` | PASS | `npm run smoke:delivery`; `npm run test:e2e:seller-delivery-settings`; `npm run test:e2e:full-commerce` | Customer sees provider, `IN_TRANSIT`, and tracking link after seller refresh. |
| Seller order status update | Seller | `/seller/orders/[id]`, `PATCH /api/shops/:shopId/orders/:orderId/status` | PASS | `npm run test:e2e:full-commerce` | Full E2E updates to `ASSEMBLING` then `SHIPPING`. |
| Logout/session refresh | Seller | `/login`, `/seller/dashboard`, `POST /api/auth/logout` | PASS | `npm run test:e2e:auth` | Refresh/reload and protected redirect verified. |

## 3. API Coverage Table

| Method | Endpoint | Module | Auth required? | Tested by | Status |
|---|---|---|---|---|---|
| POST | `/api/auth/register` | Auth | No | Backend tests; `test:e2e:auth` setup | PASS |
| POST | `/api/auth/login` | Auth | No | Backend tests; auth/full-commerce E2E | PASS |
| POST | `/api/auth/refresh` | Auth | Refresh token | Backend tests | PASS |
| POST | `/api/auth/logout` | Auth | Cookie/session | `test:e2e:auth` | PASS |
| GET | `/api/auth/me` | Auth | Yes | Frontend auth bootstrap; tests | PASS |
| GET | `/api/users/me` | Users | Yes | Backend tests | PASS |
| POST | `/api/shops` | Shops | Yes | Backend tests | PASS |
| GET | `/api/shops` | Shops | Yes | Full-commerce setup; frontend seller shell | PASS |
| GET | `/api/shops/:shopId` | Shops | Yes + shop access | Backend tests | PASS |
| GET | `/api/shops/:shopId/products` | Products | Yes + shop access | Backend tests; frontend seller pages | PASS |
| POST | `/api/shops/:shopId/products` | Products | Yes + shop access | Backend tests | PASS |
| GET | `/api/shops/:shopId/products/:productId` | Products | Yes + shop access | Backend tests; seller product UI | PASS |
| PATCH | `/api/shops/:shopId/products/:productId` | Products | Yes + shop access | Backend tests; seller product UI | PASS |
| DELETE | `/api/shops/:shopId/products/:productId` | Products | Yes + shop access | Backend tests | PASS |
| GET | `/api/shops/:shopId/products/:productId/inventory` | Products | Yes + shop access | `smoke:inventory` | PASS |
| PATCH | `/api/shops/:shopId/products/:productId/inventory` | Products | Yes + shop access | `smoke:inventory`; `smoke:inventory-alerts` | PASS |
| GET | `/api/shops/:shopId/products/:productId/images` | Product images | Yes + shop access | Backend tests; seller image UI | PASS |
| POST | `/api/shops/:shopId/products/:productId/images` | Product images | Yes + shop access | Backend tests | PASS |
| PATCH | `/api/shops/:shopId/products/:productId/images/:imageId` | Product images | Yes + shop access | Backend tests | PASS |
| DELETE | `/api/shops/:shopId/products/:productId/images/:imageId` | Product images | Yes + shop access | Backend tests | PASS |
| GET | `/api/public/products` | Public products | No | Public/full/full-commerce E2E | PASS |
| GET | `/api/public/products/:productId` | Public products | No | Public/full/full-commerce E2E | PASS |
| POST | `/api/checkout/orders` | Checkout | Optional | `smoke:checkout`; public/full/full-commerce E2E | PASS |
| GET | `/api/public/orders/track` | Order tracking | No, phone required | `smoke:order-tracking`; E2E | PASS |
| GET | `/api/public/orders/:orderId/track` | Order tracking | No, phone required | Public/full/full-commerce E2E | PASS |
| POST | `/api/public/orders/:orderId/payment-proof` | Order tracking | No, phone required | `smoke:order-tracking`; E2E | PASS |
| GET | `/api/shops/:shopId/orders` | Orders | Yes + shop access | `smoke:checkout`; full-commerce E2E | PASS |
| GET | `/api/shops/:shopId/orders/:orderId` | Orders | Yes + shop access | `smoke:payments`; full-commerce E2E | PASS |
| PATCH | `/api/shops/:shopId/orders/:orderId/status` | Orders | Yes + shop access | Full-commerce E2E | PASS |
| GET | `/api/shops/:shopId/payments` | Payments | Yes + shop access | `smoke:payments`; payment pages | PASS |
| GET | `/api/shops/:shopId/payments/:orderId` | Payments | Yes + shop access | `smoke:payments`; payment-review/full-commerce E2E | PASS |
| POST | `/api/shops/:shopId/payments/:orderId/mark-paid` | Payments | Yes + shop access | `smoke:payments`; E2E | PASS |
| POST | `/api/shops/:shopId/payments/:orderId/reject` | Payments | Yes + shop access | Backend tests; `smoke:payments` | PASS |
| POST | `/api/shops/:shopId/payments/:orderId/notes` | Payments | Yes + shop access | `smoke:payments` | PASS |
| GET | `/api/shops/:shopId/delivery/settings` | Delivery | Yes + shop access | `smoke:delivery`; seller settings UI | PASS |
| PATCH | `/api/shops/:shopId/delivery/settings` | Delivery | Yes + shop access | `smoke:delivery`; full-commerce setup | PASS |
| POST | `/api/shops/:shopId/orders/:orderId/delivery/offers` | Delivery | Yes + shop access | `smoke:delivery`; full-commerce E2E | PASS |
| POST | `/api/shops/:shopId/orders/:orderId/delivery/shipments` | Delivery | Yes + shop access | `smoke:delivery`; full-commerce E2E | PASS |
| GET | `/api/shops/:shopId/orders/:orderId/delivery` | Delivery | Yes + shop access | `smoke:delivery`; order detail UI | PASS |
| POST | `/api/shops/:shopId/orders/:orderId/delivery/shipments/:shipmentId/refresh` | Delivery | Yes + shop access | `smoke:delivery`; full-commerce E2E | PASS |
| POST | `/api/shops/:shopId/orders/:orderId/delivery/shipments/:shipmentId/accept` | Delivery | Yes + shop access | Backend tests | PASS |
| POST | `/api/shops/:shopId/orders/:orderId/delivery/shipments/:shipmentId/cancel` | Delivery | Yes + shop access | Backend tests; smoke coverage | PASS |
| POST | `/api/files/upload-url` | Files | Yes | Backend module review | PARTIAL |
| GET | `/api/seller/onboarding/profile` | Seller onboarding | Seller | Backend Jest; `test:e2e:seller-onboarding` | PASS |
| PUT | `/api/seller/onboarding/profile` | Seller onboarding | Seller | Backend Jest; `smoke:seller-onboarding`; `test:e2e:seller-onboarding` | PASS |
| GET | `/api/seller/onboarding/documents` | Seller onboarding | Seller | Backend Jest; `smoke:seller-onboarding` | PASS |
| POST | `/api/seller/onboarding/documents` | Seller onboarding | Seller | Backend Jest; `smoke:seller-onboarding`; `test:e2e:seller-onboarding` | PASS |
| DELETE | `/api/seller/onboarding/documents/:documentId` | Seller onboarding | Seller | Backend Jest | PASS |
| GET | `/api/admin/sellers/:userId/onboarding` | Admin onboarding | Admin | Backend Jest; `smoke:seller-onboarding`; `test:e2e:seller-onboarding` | PASS |
| GET | `/api/admin/sellers/:userId/documents` | Admin onboarding | Admin | Backend Jest; frontend admin detail | PASS |
| POST | `/api/admin/sellers/:userId/documents/:documentId/approve` | Admin onboarding | Admin | Backend Jest; `smoke:seller-onboarding`; `test:e2e:seller-onboarding` | PASS |
| POST | `/api/admin/sellers/:userId/documents/:documentId/reject` | Admin onboarding | Admin | Backend Jest | PASS |
| GET | `/api/admin/audit-logs?targetUserId=...` | Admin audit logs | Admin | Backend Jest; `smoke:seller-onboarding`; `test:e2e:seller-onboarding` | PASS |

## 4. Frontend Coverage Table

| Route | Purpose | Tested by | Status | Notes |
|---|---|---|---|---|
| `/login` | Seller login | `test:e2e:auth`, full-commerce | PASS | Cookie login verified. |
| `/seller/dashboard` | Seller landing shell | `test:e2e:auth` | PASS | KPI content remains partly placeholder. |
| `/seller/products` | Seller product list/create/inventory alerts | `test:e2e:seller-product-lifecycle`; backend smoke | PASS | Browser E2E creates first shop and product from this page. |
| `/seller/products/[id]` | Seller product detail/inventory | `test:e2e:seller-product-lifecycle`; backend smoke | PASS | Browser E2E updates stock from detail UI. |
| `/seller/products/[id]/images` | Seller product image gallery/upload/AI attach | `test:e2e:seller-product-lifecycle`; backend tests | PASS | Browser E2E uploads product image; AI attach remains separately covered by API/module paths. |
| `/seller/orders` | Seller order queue | Full-commerce E2E; seller-product-lifecycle E2E | PASS | Search and detail navigation verified; lifecycle test verifies seller-created product order appears. |
| `/seller/orders/[id]` | Seller order detail, delivery, status update | Full-commerce E2E; seller-delivery-settings E2E | PASS | Delivery calculate/create/refresh and status update verified. |
| `/seller/payments` | Seller payment queue | Frontend build; payment module smoke | PARTIAL | Detail flow is browser-tested; list smoke is API-level. |
| `/seller/payments/[orderId]` | Seller payment detail/review | Payment-review E2E; full-commerce E2E | PASS | Proof visibility and mark-paid verified. |
| `/seller/onboarding` | Seller onboarding/KYC | `test:e2e:seller-onboarding` | PASS | Legal profile and document upload verified. |
| `/admin/sellers` | Admin seller queue | `test:e2e:admin-seller-approval` | PASS | Seller queue, filters, and review entry point verified. |
| `/admin/sellers/[id]` | Admin seller onboarding detail | `test:e2e:seller-onboarding` | PASS | Profile, documents, approve actions, and audit timeline verified. |
| `/products` | Public catalog | Public/full/full-commerce E2E | PASS | Search and card navigation verified. |
| `/products/[id]` | Public product detail | Public-full/full-commerce E2E | PASS | Quantity and checkout CTA verified. |
| `/checkout` | Customer checkout | Public-full/full-commerce E2E | PASS | Manual-transfer order creation verified. |
| `/orders/track` | Public tracking lookup | Public smoke/payment-review | PASS | Lookup by order code + phone verified. |
| `/orders/[id]` | Public tracking detail/proof/delivery | Public-full/payment-review/full-commerce E2E | PASS | Payment, proof, delivery, and order status verified. |
| `/seller/settings` | Seller delivery settings | `test:e2e:seller-delivery-settings`; delivery API smoke | PASS | Browser E2E saves/reloads pickup, carrier priority, enabled carriers, and package defaults. |

## 5. Existing Smoke/E2E Coverage

| Script | Current coverage | Gaps | Status |
|---|---|---|---|
| `npm run smoke:checkout` | Seller auth/setup, product/order creation, anonymous checkout, seller order visibility | Browser UI not included | PASS |
| `npm run smoke:order-tracking` | Checkout, public tracking, proof upload, seller proof visibility, mark paid, tracking sees paid | Browser UI not included | PASS |
| `npm run smoke:payments` | Pending payment list/detail, note, mark paid, audit log, cross-shop guard | Browser UI not included | PASS |
| `npm run smoke:inventory` | Inventory read/update, checkout stock deduction, insufficient stock, cross-shop guard | Browser UI not included | PASS |
| `npm run smoke:inventory-alerts` | Low/out/in-stock filters and stock status changes | Browser UI not included | PASS |
| `npm run smoke:delivery` | Delivery settings, Yandex-first mock offers, paid order shipment create/refresh, customer tracking delivery projection | Real Yandex/CDEK not included | PASS |
| `npm run smoke:seller-approval` | Seller registration pending, pending create-shop blocked, KYC document precondition, admin approve/reject, non-admin blocked | Browser UI only covered separately | PASS |
| `npm run smoke:seller-onboarding` | Seller profile save, document upload, admin onboarding view, document approve, seller approve, audit log, approved seller creates shop | Uses storage abstraction; no real external KYC provider | PASS |
| `npm run test:e2e:auth` | Browser login, cookie persistence, logout, protected redirect, no JWT localStorage | Does not create shop/product | PASS |
| `npm run test:e2e:admin-seller-approval` | Browser admin queue approval path | Uses API setup for KYC document precondition | PASS |
| `npm run test:e2e:seller-onboarding` | Browser seller onboarding submit/upload plus admin document/seller approval and audit view | Does not test document reject UI path in browser | PASS |
| `npm run test:e2e:public` | Public routes load and basic navigation | No checkout/payment | PASS |
| `npm run test:e2e:public-full` | Public browse/detail/checkout/tracking/proof | No seller review | PASS |
| `npm run test:e2e:public-payment-review` | Customer proof, seller payment detail, mark paid, customer sees paid | No delivery/status update | PASS |
| `npm run test:e2e:full-commerce` | Public browse/detail/checkout, stock deduction, proof, seller orders, seller payment review, mark paid, delivery create/refresh, seller status update, customer sees paid/delivery/shipping | Uses API setup for delivery settings and seeded product data | PASS |
| `npm run test:e2e:seller-product-lifecycle` | API creates/approves seller, then browser creates shop/product/image, updates stock, finds product publicly, checks out, tracks order, and verifies seller order queue | Seller approval/KYC is API setup to keep this test focused on seller operations UI | PASS |
| `npm run test:e2e:seller-delivery-settings` | API creates approved seller/shop/product/paid same-city order, then browser saves delivery settings, calculates recommended Yandex offer, creates/refreshes mock shipment, and verifies customer tracking delivery projection | Seller approval/KYC and paid order setup are API-driven to keep this test focused on delivery UI | PASS |

## 6. Gaps / Risks

- Browser E2E now creates a seller shop/product/image through UI and separately verifies seller delivery settings plus order delivery operations through UI. Seller registration/onboarding/admin approval is API setup in those focused tests; those UI paths are covered by `test:e2e:seller-onboarding`.
- Seller approval now has admin UI/API and KYC document review. Remaining production gaps are KYC retention/access policy, notifications, and wider admin audit coverage.
- Product image upload browser coverage exists for the seller lifecycle path; remaining image risks are production storage policy, moderation, and larger asset edge cases.
- Delivery real providers were not verified. Default verified mode is mock; Yandex/CDEK credentials and account/billing/address edge cases remain unproven.
- Payment is manual-review only. There is no real payment provider, capture, reconciliation, refund, or webhook path.
- OpenAI real mode was not called. Existing docs still treat mock/local-safe AI verification as the baseline; real OpenAI may be blocked by billing/quota in a separate environment.
- Inventory deducts at checkout and releases/restores through seller lifecycle paths, but multi-cart reservations, warehouse inventory, and inventory history ledger are not implemented.
- Order/payment data is demo-grade. Production hardening still needs idempotency keys, rate limits, audit retention policy, and stronger fraud/payment-proof validation.

## 7. Recommended Next Steps

1. Define KYC production retention, object access, encryption, and deletion policy.
2. Harden order/payment/inventory with idempotency keys, concurrency-focused tests, and payment-proof validation rules.
3. Add real Yandex mode verification only when a valid token, billing, and safe test addresses are available.
4. Add CI/CD to run backend tests/smoke and frontend Playwright against Docker.
5. Prepare VPS deployment with secret manager/env injection and non-demo seed strategy.
6. Revisit real AI/OpenAI and try-on only after core commerce and deployment are stable.

## Verification Commands Run

## Wildberries Excel Import Addition

- New seller flow:
  - open `/seller/import/wildberries`
  - upload WB `.xlsx`
  - preview products, variants, images, warnings, and errors
  - confirm import
  - imported products appear in `/seller/products`
- Isolation:
  - endpoints are guarded by JWT + shop access
  - service additionally requires seller role and `APPROVED` seller profile
  - confirm uses the saved import session for the same seller and shop
- Idempotency:
  - product match by seller SKU / external product id / WB nm id
  - variant match by barcode or size tuple
  - image match by URL

- `docker version`: PASS
- `docker compose version`: PASS
- `docker compose -f infra/docker-compose.yml --env-file infra/.env config`: PASS, output suppressed to avoid secret exposure
- `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build`: PASS
- `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: PASS, all six core services healthy
- `curl.exe --ipv4 http://localhost:3001/api/health`: PASS
- `curl.exe --ipv4 -I http://localhost:3000/products`: PASS, HTTP 200
- `curl.exe --ipv4 http://localhost:8000/health`: PASS
- `backend-nest npm run prisma:generate`: PASS
- `backend-nest npm run prisma:db:push`: PASS
- `backend-nest npm run seed:demo`: PASS
- `backend-nest npm run lint`: PASS
- `backend-nest npm test -- --runInBand`: PASS, 13 suites / 73 tests
- `backend-nest npm run build`: PASS
- `backend-nest npm run smoke:checkout`: PASS
- `backend-nest npm run smoke:order-tracking`: PASS
- `backend-nest npm run smoke:payments`: PASS
- `backend-nest npm run smoke:inventory`: PASS
- `backend-nest npm run smoke:inventory-alerts`: PASS
- `backend-nest npm run smoke:delivery`: PASS
- `frontend-next npm run lint`: PASS
- `frontend-next npm run build`: PASS
- `frontend-next npm run test:e2e:auth`: PASS
- `frontend-next npm run test:e2e:public`: PASS
- `frontend-next npm run test:e2e:public-full`: PASS
- `frontend-next npm run test:e2e:public-payment-review`: PASS
- `frontend-next npm run test:e2e:full-commerce`: PASS
- `frontend-next npm run test:e2e:seller-product-lifecycle`: PASS
- `frontend-next npm run test:e2e:seller-delivery-settings`: PASS
# Delivery Exception Audit Addendum

Delivery exception operations write `delivery_events` audit rows:

- seller mark failed
- seller/admin comment added
- admin mark failed
- admin customer-visible message update
- admin status override

Internal comments are stored in `delivery_comments` with `visibility=INTERNAL`; customer-facing messages/comments use `CUSTOMER_VISIBLE`. Public tracking only reads customer-safe fields.
# Admin Dashboard Audit Addendum

Admin operations dashboard is read-only and admin-only. It aggregates operational counts from orders, payments, delivery shipments, inventory variants, seller profiles, delivery exceptions, payment review logs, and admin audit logs.

The dashboard does not create audit rows because it does not mutate state. It exposes existing latest admin audit actions for operational context.

# Admin Operational Queues Audit Addendum

Admin operational queues are read-only and admin-only. They expose seller, payment, delivery, and inventory worklists with SLA age calculations but do not mutate marketplace state.

No audit rows are created by queue reads. Follow-up actions still happen through existing seller approval, payment review, delivery supervision, and product/inventory flows, which keep their existing audit/event behavior.

# Admin Task Ownership Audit Addendum

Admin queue task ownership is admin-only and mutates only operational task metadata. It does not change the underlying seller, payment, order, delivery, or inventory business status by itself.

Ownership mutations create `admin_queue_task_events` rows and admin audit logs for:

- task creation
- assignment/reassignment
- unassignment
- status changes
- escalation

Only users with role `ADMIN` can be assigned to tasks. Sellers and customers receive `403` from task APIs through the admin guard.

# Admin Ops Reporting Audit Addendum

Admin Ops Reporting is read-only and admin-only. It exposes operational aggregates and row-level reports for SLA breaches, workload, delivery exceptions, and payment aging.

CSV exports use explicit column allowlists and do not include secrets, tokens, raw provider payloads, internal private files, or customer-invisible internal comments. CSV values are escaped for commas, quotes, and newlines and are capped at 5000 rows per export.

No audit rows are created by report reads or exports.

# Wildberries API Sync Audit Addendum

Legacy WB API code was audited read-only from `strawberry-backend/src/main/java/com/strawberry/ecommerce/wb`; no legacy files were changed.

New WB API sync lives only in `backend-nest` and `frontend-next`. Tests and smoke use mock mode and do not call the real Wildberries API. WB API keys are shop-scoped, never returned to clients, never logged, and real credential storage requires `WB_CREDENTIALS_ENCRYPTION_KEY`.
# Cart Checkout Audit Update

Phase Cart + Multi-item Checkout is implemented in the new stack only:

- `frontend-next` owns a localStorage cart, groups cart/checkout summary by shop, and submits multi-shop carts for split-order checkout.
- `backend-nest` accepts multi-item checkout payloads and recalculates trusted totals.
- Seller order detail, payment detail, and customer tracking render multiple order items.
- Legacy `strawberry-backend` and `strawberry-frontend` were not modified.

Future audit item: design an optional marketplace parent order for combined receipts/support. Current behavior automatically splits multi-shop carts into per-shop orders.

# Multi-shop Checkout Audit Update

- Backend `POST /api/checkout/orders` accepts items from multiple shops, validates all items before writes, creates a parent marketplace checkout receipt, creates one order per shop in one transaction, and returns `checkoutCode`, `orders[]`, `orderCodes[]`, and `grandTotal`.
- Existing single-order fields remain in the checkout response for backward compatibility.
- Seller order/payment queues remain shop-scoped, so sellers only see their own split order.
- Customer tracking remains per order code plus phone, while receipt lookup is available by checkout code plus phone.
- Logged-in customers can access `/customer/orders` and `/customer/orders/[checkoutCode]`.
- Verification targets: `backend-nest npm run smoke:customer-order-history`, `backend-nest npm run smoke:multi-shop-checkout`, `frontend-next npm run test:e2e:customer-order-history`, and `frontend-next npm run test:e2e:multi-shop-checkout`.

# Support Cases Audit Addendum

- Customer can open checkout-level and order-level support cases from `/customer/orders/[checkoutCode]`.
- Admin triages and replies from `/admin/support-cases`.
- Seller reads and replies from `/seller/support-cases`.
- Internal admin notes are never returned to customer or seller responses.
- Seller visibility remains constrained to the linked shop/order.
- Verification targets: `backend-nest/test/support-cases.e2e-spec.ts`, `backend-nest npm run smoke:support-cases`, and `frontend-next npm run test:e2e:support-cases`.

# Wildberries Real API Sync Audit Addendum

- Real WB sync is now explicit and shop-scoped:
  - `WB_SYNC_MODE=real`
  - saved encrypted credential per shop
  - `POST /api/shops/:shopId/wb-sync/credentials/verify`
- Real mode calls `POST /content/v2/get/cards/list` and paginates with WB cursor fields `updatedAt` and `nmID`.
- Real mode does not fall back to mock data after credential or API failure.
- Seller UI at `/seller/import/wildberries-api` now shows mode, connection state, `keyLast4`, verify status, and last sanitized error.
- Optional runtime verification is `backend-nest npm run smoke:wb-api-sync-real` with local env `WB_REAL_API_KEY`.

# Public Marketplace Contract Hardening Audit Addendum

- public visibility remains gated by `PUBLISHED` plus readiness
- fully out-of-stock tracked products are hidden from public list/detail
- mixed-stock products expose disabled out-of-stock variants safely in public detail
- checkout continues to reject invalid variant, unpublished, archived, missing-price, and over-stock requests
- header search, cart badge, and mobile sticky CTA now have dedicated regression coverage

# Public Marketplace Empty / Fallback Audit Addendum

- `/products` now distinguishes catalog-empty from search/filter no-result states
- no-result state exposes current filter summary and clear-filters action
- public and cart image fallback no longer depends on a remote placeholder provider
- product detail unavailable state is explicit for hidden/unpublished/nonexistent products
- mobile sticky CTA remains reachable without masking the fallback states above it

# Role-Based i18n Audit Addendum

- locale policy is now role-aware in `frontend-next` and does not expose admin locale switching in public navigation
- preferred locale can be stored in backend user state and in cookie fallback
- public/customer and seller locale switching is designed to avoid touching auth, cart, checkout, and order identifiers
- checkout/backend business rules remain source-of-truth and unchanged by locale switching
- dedicated locale E2E coverage is now passing after rebuilding the runtime and isolating locale state per browser context
- public runtime default is Russian when no user preference and no locale cookie exist
- seller runtime supports `ru -> vi -> en` switching with persistence
- admin runtime remains English-only with no language switcher

# Locale Switcher UX Audit Addendum

- seller and buyer/customer locale switching now use the same dropdown interaction model instead of always-visible pills
- live switch remains client-side, immediate, and cookie/profile-backed
- customer/public surfaces still do not expose `vi`
- seller surfaces still expose `ru/en/vi`
- auth, protected shell, cart, and notification bell flows were left unchanged by the switcher redesign
