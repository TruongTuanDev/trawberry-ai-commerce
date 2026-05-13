# Full Commerce Flow Audit

Date: 2026-05-13

Scope: `frontend-next`, `backend-nest`, `ai-service`, and Docker runtime. Legacy apps `strawberry-frontend` and `strawberry-backend` were intentionally not modified.

## 1. Executive Summary

Overall result: **PASS for the current MVP/demo flow; PARTIAL for production readiness**.

The practical seller-to-customer path is now verifiable end to end in the new stack: public product browse, checkout, stock deduction, order tracking, payment proof upload, seller payment review, mark paid, mock delivery shipment, seller status update, and customer tracking refresh all pass through automated checks.

Strong points:
- Docker runtime is healthy for frontend, backend, AI service, Postgres, Redis, and MinIO.
- Backend module tests and smoke scripts cover checkout, order tracking, payments, inventory, low-stock alerts, and mock delivery.
- Browser E2E now covers auth cookies, public catalog, public checkout/proof, seller payment review, and full commerce payment/delivery/fulfillment.
- Secrets are kept out of tracked files by current `git ls-files` checks; `.env` files are ignored.

Still missing or partial:
- Seller approval admin API/UI and KYC onboarding are now implemented; production readiness still needs notification workflows, retention policy, and broader admin audit coverage.
- Seller create shop/product/product-image flows are API-covered and UI-present, but the new full browser flow uses seeded product setup rather than creating product data through the browser.
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
| Seller create shop | Seller | `POST /api/shops` | PASS | Backend tests and shop module review | UI create-shop flow was not found in this MVP; demo seed creates active shop. |
| Seller onboarding/KYC | Seller/Admin | `/seller/onboarding`, `/admin/sellers/[id]`, onboarding/document APIs | PASS | `npm run smoke:seller-onboarding`; `npm run test:e2e:seller-onboarding`; backend Jest | Seller saves legal profile, uploads document, admin reviews document, audit log records review. |
| Seller delivery settings | Seller | `/seller/settings`, `GET/PATCH /api/shops/:shopId/delivery/settings` | PASS | `npm run smoke:delivery`; `npm run test:e2e:full-commerce` API setup | Full E2E configures settings through API for deterministic setup. |
| Seller create product | Seller | `/seller/products`, `POST /api/shops/:shopId/products` | PASS | Backend tests, product module review, seed/demo | Full browser flow uses seeded products, not browser product creation. |
| Seller upload product image | Seller | `/seller/products/[id]/images`, `POST /api/shops/:shopId/products/:productId/images` | PASS | Product image tests/module review; seed includes product images | Browser full flow does not upload product image; payment proof upload is browser-tested. |
| Seller inventory update | Seller | `/seller/products/[id]`, `PATCH /api/shops/:shopId/products/:productId/inventory` | PASS | `npm run smoke:inventory`; `npm run smoke:inventory-alerts` | Browser full flow verifies stock deduction after checkout. |
| Public product listing | Customer | `/products`, `GET /api/public/products` | PASS | `npm run test:e2e:public`; `npm run test:e2e:public-full`; `npm run test:e2e:full-commerce` | Search and product card selection verified. |
| Product detail | Customer | `/products/[id]`, `GET /api/public/products/:productId` | PASS | `npm run test:e2e:public-full`; `npm run test:e2e:full-commerce` | Product heading, quantity, checkout CTA verified. |
| Customer checkout | Customer | `/checkout`, `POST /api/checkout/orders` | PASS | `npm run smoke:checkout`; `npm run test:e2e:public-full`; `npm run test:e2e:full-commerce` | Backend recalculates totals. |
| Stock deduction | System | Checkout transaction, public product API | PASS | `npm run smoke:inventory`; `npm run test:e2e:full-commerce` compares `availableQuantity` before/after | Atomic update protects against oversell. |
| Customer order tracking | Customer | `/orders/track`, `/orders/[id]`, `GET /api/public/orders/track` | PASS | `npm run smoke:order-tracking`; public/full/full-commerce E2E | Phone verification required. |
| Customer payment proof upload | Customer | `/orders/[id]`, `POST /api/public/orders/:orderId/payment-proof` | PASS | `npm run smoke:order-tracking`; public-full; public-payment-review; full-commerce | Upload is stored and visible to seller. |
| Seller orders list/detail | Seller | `/seller/orders`, `/seller/orders/[id]`, `GET /api/shops/:shopId/orders` | PASS | `npm run test:e2e:full-commerce`; `npm run smoke:checkout` seller visibility | Full E2E searches order queue and opens detail. |
| Seller payment queue/detail | Seller | `/seller/payments`, `/seller/payments/[orderId]`, `GET /api/shops/:shopId/payments` | PASS | `npm run smoke:payments`; `npm run test:e2e:public-payment-review`; full-commerce | Payment proof link verified. |
| Seller mark paid | Seller | `POST /api/shops/:shopId/payments/:orderId/mark-paid` | PASS | `npm run smoke:payments`; payment-review E2E; full-commerce | Audit log created. |
| Delivery calculate/create/refresh | Seller | `/seller/orders/[id]`, delivery endpoints | PASS | `npm run smoke:delivery`; `npm run test:e2e:full-commerce` | Verified in mock mode only. |
| Customer sees delivery tracking | Customer | `/orders/[id]` | PASS | `npm run smoke:delivery`; `npm run test:e2e:full-commerce` | Customer sees `IN_TRANSIT` and tracking link after seller refresh. |
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
| `/seller/products` | Seller product list/inventory alerts | Frontend build; backend smoke | PARTIAL | UI present; not browser-covered in this audit. |
| `/seller/products/[id]` | Seller product detail/inventory | Frontend build; backend smoke | PARTIAL | UI present; inventory API smoke pass. |
| `/seller/products/[id]/images` | Seller product image gallery/upload/AI attach | Frontend build; backend tests | PARTIAL | UI present; browser image upload not included. |
| `/seller/orders` | Seller order queue | Full-commerce E2E | PASS | Search and detail navigation verified. |
| `/seller/orders/[id]` | Seller order detail, delivery, status update | Full-commerce E2E | PASS | Delivery calculate/create/refresh and status update verified. |
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
| `/seller/settings` | Seller delivery settings | Frontend build; delivery API smoke | PARTIAL | UI exists; full-commerce config uses API setup for stability. |

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

## 6. Gaps / Risks

- Browser E2E does not yet create a seller shop/product/image entirely through UI. Those pieces are API-tested and UI-present, but the current full browser flow starts from seeded demo data.
- Seller approval now has admin UI/API and KYC document review. Remaining production gaps are KYC retention/access policy, notifications, and wider admin audit coverage.
- Product image upload browser coverage is still missing for seller-managed assets.
- Delivery real providers were not verified. Default verified mode is mock; Yandex/CDEK credentials and account/billing/address edge cases remain unproven.
- Payment is manual-review only. There is no real payment provider, capture, reconciliation, refund, or webhook path.
- OpenAI real mode was not called. Existing docs still treat mock/local-safe AI verification as the baseline; real OpenAI may be blocked by billing/quota in a separate environment.
- Inventory deducts at checkout and releases/restores through seller lifecycle paths, but multi-cart reservations, warehouse inventory, and inventory history ledger are not implemented.
- Order/payment data is demo-grade. Production hardening still needs idempotency keys, rate limits, audit retention policy, and stronger fraud/payment-proof validation.

## 7. Recommended Next Steps

1. Define KYC production retention, object access, encryption, and deletion policy.
2. Add browser E2E for seller shop creation, seller product creation, inventory update, and product image upload.
3. Add browser E2E for `/seller/settings` delivery settings form instead of using API setup in full-commerce.
4. Harden order/payment/inventory with idempotency keys, concurrency-focused tests, and payment-proof validation rules.
5. Add real Yandex mode verification only when a valid token, billing, and safe test addresses are available.
6. Add CI/CD to run backend tests/smoke and frontend Playwright against Docker.
7. Prepare VPS deployment with secret manager/env injection and non-demo seed strategy.
8. Revisit real AI/OpenAI and try-on only after core commerce and deployment are stable.

## Verification Commands Run

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
