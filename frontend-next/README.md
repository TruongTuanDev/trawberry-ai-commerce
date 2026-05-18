# frontend-next

## Multi-Role Sessions

- Frontend auth state is split into `adminUser`, `sellerUser`, and `customerUser`.
- Admin shell calls `GET /api/auth/admin/me`.
- Seller shell calls `GET /api/auth/seller/me`.
- Customer pages and public header call `GET /api/auth/customer/me`.
- Public marketplace header only reflects customer auth state.
- Browser verification entry:

```bash
npm run test:e2e:multi-role-sessions
```

## Auth Role Separation

- Public marketplace surfaces show customer login/register, seller register/login, cart, and search.
- Public marketplace does not show admin login links.
- `/admin-login` remains operational-only and is not a substitute for role guards.
- Customer and seller auth accept email or phone identifiers.
- Browser verification entry:

```bash
npm run test:e2e:auth-role-separation
```

## Auth Hardening 2

- Public customer/seller forms now normalize phone input before submit.
- Seller non-approved states distinguish onboarding incomplete vs pending admin review.
- Added `/seller/pending` for waiting-approval and rejected seller states.
- Browser verification entry:

```bash
npm run test:e2e:auth-hardening
```

Next.js frontend runs in parallel with the legacy Angular app in `strawberry-frontend`.

## Stack
- Next.js App Router
- TypeScript
- Tailwind CSS
- React Hook Form
- Zod
- fetch wrapper
- Zustand

## Routes
- `/`
- `/admin/sellers`
- `/admin/sellers/[id]`
- `/admin/dashboard`
- `/admin/queues`
- `/admin/reports`
- `/admin/deliveries`
- `/products`
- `/products/[id]`
- `/checkout`
- `/orders/track`
- `/orders/[id]`
- `/login`
- `/seller/dashboard`
- `/seller/products`
- `/seller/products/[id]`
- `/seller/products/[id]/images`
- `/seller/import/wildberries`
- `/seller/import/wildberries-api`
- `/seller/ai-images`
- `/seller/orders`
- `/seller/orders/[id]`
- `/seller/payments`
- `/seller/payments/[orderId]`
- `/seller/onboarding`
- `/seller/settings`

## Seller Catalog Workflow

- Wildberries import and sync add products to seller catalog first.
- `/seller/products` now separates imported, needs-review, ready, published, unpublished, and archived states.
- Seller must publish products manually before they appear on public `/products`.
- Seller can unpublish or archive products to remove them from public marketplace and checkout.
- Seller can bulk edit category, price, and stock for selected products before bulk publishing them.

## Current features
- Admin seller approval UI with:
  - pending/approved/rejected filters
  - seller onboarding detail
  - KYC document review
  - audit timeline
  - approve action
  - reject action with optional reason
- Admin operations dashboard UI with:
  - orders, payments, deliveries, inventory, sellers, and exceptions cards
  - needs-attention queue
  - latest orders, delivery exceptions, and audit actions
  - quick links to seller approvals and delivery supervision
- Admin operational queues UI with:
  - seller, payment, delivery, and inventory tabs
  - SLA badges and age indicators
  - task assignee, status, and priority badges
  - Claim, In progress, Escalate, and Resolve actions
- Admin reports UI with:
  - ops summary cards
  - SLA breach, workload, delivery exception, and payment aging tabs
  - date range filters
  - CSV export buttons
- Seller onboarding UI with:
  - legal profile form
  - KYC document upload
  - document status list
  - pending/rejected CTA in seller shell
- Public marketplace UI with:
  - polished home page
  - responsive product grid
  - quick add vs select-size product cards
  - Wildberries-inspired product detail layout
  - size selector pills and quantity stepper
  - sticky purchase card with add-to-cart and buy-now
  - mobile sticky bottom CTA on product detail
  - cart badge in the public header
  - header search that keeps the current `q` value visible after navigation
  - stale cart validation warnings for stock, price, and availability drift
  - checkout preflight before submit
  - order tracking and payment proof upload UI
- Seller delivery operations with:
  - delivery settings form
  - order-level delivery offer calculation
  - shipment create / refresh / cancel in mock mode
- Seller center layout with sidebar, header, and shop switcher
- Seller shop/product lifecycle UI with:
  - first-shop creation from `/seller/products`
  - product creation with initial price/stock variant
  - product detail metadata and stock update
  - product image upload
  - bulk product editing for category, price, stock, and publish-if-ready
- Seller Wildberries import UI with:
  - `.xlsx` upload
  - stock, publish, and fallback-price options
  - preview counts, warnings, and errors
  - Wildberries remote image links as the default MVP image mode
  - confirm import and result summary
- Seller Wildberries API sync UI with:
  - explicit `MOCK` / `REAL` mode state
  - per-shop credential management for the currently selected shop
  - credentials status with `keyLast4`
  - verify connection button for real mode only
  - delete key action
  - last verification status and sanitized error
  - safe missing-config / diagnostics visibility
  - early real-mode guard when the selected shop has no saved WB key
  - preview/import all products
  - preview/import by article/APT/vendorCode
  - sync result summary
- Login flow against NestJS auth
- Shop-scoped product list and detail pages
- Product images page with:
  - multi-image upload
  - gallery display
  - delete image action
  - Generate AI Image modal
  - AI task polling
  - attach generated image back into product gallery

## Local run

### 1. Install
```bash
npm install
```

### 2. Configure env
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Start dev server
```bash
npm run dev
```

Default URL:
- `http://localhost:3000`

## Auth note
- Seller login now uses NestJS `httpOnly` cookies.
- The frontend only keeps lightweight user/shop hydration state in `localStorage`.
- Raw JWT auth tokens are not stored in `localStorage`.

## Playwright auth smoke
With the Docker stack or local frontend/backend already running:

```bash
npm run test:e2e:auth
```

## Playwright WB Import Checkout Flow

With Docker runtime and demo seed available:

```bash
npm run test:e2e:wb-import-checkout
```

This browser flow sets up an approved seller and shop through the API, then verifies seller login, WB import preview/confirm, imported product price and stock update, public checkout, customer order tracking, seller order visibility, and stock after checkout.

Defaults:
- frontend base URL: `http://localhost:3000`
- backend API URL for test registration: `http://localhost:3001`

Optional overrides:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000
PLAYWRIGHT_BACKEND_URL=http://localhost:3001
```

## Playwright WB API Sync Flow

With Docker runtime and demo seed available:

```bash
npm run test:e2e:wb-api-sync
```

Current coverage:
- creates an approved seller and shop through the API
- opens `/seller/import/wildberries-api`
- verifies mock mode messaging disables real verify
- saves and deletes a per-shop credential
- previews all mock WB API products
- imports all mock WB API products
- imports one product by article/APT
- verifies a safe backend verify failure is shown in the UI
- verifies the imported product appears in `/seller/products`

Real runtime note:

- default Playwright stays in mock mode
- real WB verification is done through backend smoke, not default browser CI
- seller page now shows explicit mode and connection diagnostics so real-mode issues are visible in the UI
- runtime seller flow does not use `WB_REAL_API_KEY`; the seller must save the key through the UI for the selected shop
- request/verify behavior is aligned with the legacy successful backend call documented in `docs/WB_LEGACY_SUCCESSFUL_FLOW_AUDIT.md`

## Playwright Bulk Product Editing

```bash
npm run test:e2e:bulk-product-edit
```

Coverage:

- approved seller/shop setup
- WB import into private seller catalog
- bulk category update
- bulk price update
- bulk stock update

## Playwright Cart Validation

```bash
npm run test:e2e:cart-validation
```

Coverage:

- stale cart quantity exceeds stock
- `Set to max` reconciliation
- unavailable unpublished item warning
- checkout preflight blocking before submit
- publish-if-ready result
- public product visibility

## Playwright Public Marketplace Contract

```bash
npm run test:e2e:public-marketplace-contract
```

Coverage:

- header search redirects to `/products?q=...`
- out-of-stock variant is disabled on public detail
- cart badge updates after add and quantity changes
- buy-now still lands on `/checkout`
- mobile sticky CTA stays accessible on product detail
- checkout success after bulk edit and publish

## Playwright Marketplace Search/Filter/Sort

```bash
npm run test:e2e:marketplace-search-filter-sort
```

The public `/products` page supports URL-persistent search, internal category filtering, brand/color/gender filters, stock filtering, sorting, and category/brand display on product detail.

## Playwright Product Buying UX

```bash
npm run test:e2e:product-buying-ux
```

Coverage:

- product card shows price and cart/select-size CTA
- product detail shows gallery, thumbnails, size selector, and sticky purchase card
- out-of-stock variant is disabled
- quantity stepper respects variant stock
- add to cart updates in-cart state and header cart count
- buy now opens `/checkout`
- checkout still completes with backend stock deduction

## Playwright admin seller approval flow
With Docker runtime already healthy and demo data seeded:

```bash
npm run test:e2e:admin-seller-approval
```

Current coverage:
- registers a pending seller through the backend API
- submits a minimal KYC document precondition through the backend API
- logs in as seeded demo admin
- opens `/admin/sellers`
- approves the pending seller
- verifies the seller moves to the approved tab

## Playwright admin dashboard flow
With Docker runtime already healthy and demo data seeded:

```bash
npm run test:e2e:admin-dashboard
```

Current coverage:
- prepares seller, order, inventory, and delivery exception data through the backend API
- logs in as seeded demo admin
- opens `/admin/dashboard`
- verifies dashboard cards and numeric counts
- follows the delivery exceptions link
- verifies a non-admin is redirected away from the dashboard

## Playwright admin queues flow
With Docker runtime already healthy and demo data seeded:

```bash
npm run test:e2e:admin-queues
```

Current coverage:
- prepares a pending seller through the backend API
- logs in as seeded demo admin
- opens `/admin/dashboard`
- follows the pending seller queue link
- verifies `/admin/queues` tabs, queue rows, and SLA badges
- verifies a non-admin is redirected away from the queues page

## Playwright admin task ownership flow
With Docker runtime already healthy and demo data seeded:

```bash
npm run test:e2e:admin-task-ownership
```

Current coverage:
- prepares a pending seller through the backend API
- logs in as seeded demo admin
- opens `/admin/queues` filtered to that seller
- claims the queue task
- escalates the task
- resolves the task

## Playwright admin reports flow
With Docker runtime already healthy and demo data seeded:

```bash
npm run test:e2e:admin-reports
```

Current coverage:
- prepares a breached admin queue task through the backend API
- logs in as seeded demo admin
- opens `/admin/reports`
- verifies summary, SLA, and workload sections
- verifies a CSV download event
- verifies a non-admin is redirected away from reports

## Playwright seller onboarding flow
With Docker runtime already healthy and demo data seeded:

```bash
npm run test:e2e:seller-onboarding
```

Current coverage:
- registers a pending seller
- logs in as seller and opens `/seller/onboarding`
- saves legal profile
- uploads a KYC document
- logs in as seeded demo admin
- opens `/admin/sellers/[id]`
- approves the document
- approves the seller
- verifies audit timeline contains the seller approval action

## Playwright seller product lifecycle flow
With Docker runtime already healthy and demo data seeded:

```bash
npm run test:e2e:seller-product-lifecycle
```

Current coverage:
- uses API setup only to create and approve a seller with KYC precondition
- logs in through UI as that seller
- creates the first shop from `/seller/products`
- creates a product from UI with initial price and stock
- updates stock from product detail UI
- uploads a product image from UI
- finds the product in public `/products`
- completes customer checkout and tracking
- verifies the seller order queue contains the new order

## Playwright seller delivery settings flow
With Docker runtime already healthy and demo data seeded:

```bash
npm run test:e2e:seller-delivery-settings
```

Current coverage:
- uses API setup only to create/approve a seller, create one shop/product, create a same-city paid order, and avoid cross-test data collisions
- logs in through UI as the seller
- opens `/seller/settings`
- saves pickup address, pickup city, contact details, enabled `YANDEX` and `CDEK`, Yandex same-city priority, CDEK inter-city/fallback priority, and package defaults
- reloads the settings page and verifies persisted values
- opens `/seller/orders/[id]`
- calculates delivery offers from UI and verifies the recommended same-city offer is Yandex
- creates and refreshes a mock shipment from UI
- verifies customer `/orders/[id]` tracking shows provider, status, and tracking link

## Playwright public smoke
With the Docker stack or local frontend/backend already running:

```bash
npm run test:e2e:public
```

Current coverage:
- `/` loads
- `/products` loads
- first product detail opens when at least one product exists
- `/orders/track` loads

## Demo seed
Run from `backend-nest` before full customer demo or full public E2E:

```bash
npm run seed:demo
```

The seed is idempotent and refuses production by default.

Seeded demo seller:
- email: `demo-seller@trawberry.local`
- password: `DemoSeller123!`

## Playwright public full flow
With Docker runtime already healthy and demo data seeded:

```bash
npm run test:e2e:public-full
```

Current coverage:
- home page
- products listing with seeded data
- product detail
- checkout create order
- confirmation capture of `orderCode` and `orderId`
- order tracking by phone
- payment proof upload

## Playwright public payment review flow
With Docker runtime already healthy and demo data seeded:

```bash
npm run test:e2e:public-payment-review
```

Current coverage:
- customer checkout from seeded catalog
- customer order tracking
- customer payment proof upload
- seller login with seeded demo account
- seller payment review detail
- seller mark paid
- customer sees `PAID` on tracking re-check

Seeded seller credentials used by this flow:
- email: `demo-seller@trawberry.local`
- password: `DemoSeller123!`

## Playwright full commerce flow
With Docker runtime already healthy and demo data seeded:

```bash
npm run test:e2e:full-commerce
```

Current coverage:
- public product listing and product detail
- customer checkout and order tracking
- stock deduction assertion through the public product API
- customer payment proof upload
- seller orders list and detail
- seller payment detail, proof visibility, and mark-paid action
- seller mock delivery offer calculation, shipment creation, and refresh
- seller fulfillment status update to `ASSEMBLING` and `SHIPPING`
- customer tracking re-check for `PAID`, delivery `IN_TRANSIT`, tracking link, and `SHIPPING`

This flow uses seeded demo products and API setup for delivery settings to keep the browser path deterministic.

## Seller delivery demo
With Docker runtime healthy and backend smoke data available, seller pages can now exercise the mock delivery flow:

- `/seller/settings`
- `/seller/orders/[id]`

The current verified delivery mode is backend-driven mock mode. The frontend does not call CDEK or Yandex directly.

## Main files
- `src/app/login/page.tsx`
- `src/app/seller/layout.tsx`
- `src/app/seller/products/page.tsx`
- `src/app/seller/products/[id]/page.tsx`
- `src/app/seller/products/[id]/images/page.tsx`
- `src/app/seller/import/wildberries/page.tsx`
- `src/lib/api.ts`
- `src/lib/seller-api.ts`

## Legacy safety
This project does not modify `strawberry-frontend`.
# Cart Checkout

Useful script:

```bash
npm run test:e2e:public-empty-fallbacks
npm run test:e2e:cart-checkout
npm run test:e2e:multi-shop-checkout
npm run test:e2e:customer-order-history
npm run test:e2e:support-cases
```

The public cart is stored in browser localStorage and checkout submits `items[]` with `productId`, `variantId`, and `quantity`.

The cart and checkout pages group multi-shop carts by shop, show shop subtotals plus a grand total, and render one confirmation card per split shop order. Customers track each created order separately.

Public marketplace hardening now also covers:

- distinct empty and no-result states on `/products`
- search/filter summary chips in no-result state
- local image fallback placeholders for public cards, detail gallery, and cart items
- explicit empty cart state
- explicit unavailable product state on `/products/[id]`

Customer account routes are `/customer/register`, `/customer/login`, `/customer/orders`, and `/customer/orders/[checkoutCode]`. Anonymous/customer receipt lookup is available at `/orders/receipt/[checkoutCode]`.

Support case coverage verifies:

- customer creates checkout-level and order-level support cases from receipt detail
- admin opens `/admin/support-cases` and sends a public reply
- internal admin note remains hidden from customer and seller
- seller opens `/seller/support-cases` and replies to a linked shop case
- unrelated seller does not see another shop's case

## Docker Build Reliability

- Docker image builds use deterministic `npm ci`.
- npm fetch retry settings are configured in the Dockerfile to reduce transient `ECONNRESET` failures.
- The Docker runtime uses Next standalone output from inside the image build:
  - `.next/standalone`
  - `.next/static`
- Supported rebuild flow:

```bash
cd ..
docker compose -f infra/docker-compose.yml --env-file infra/.env build frontend-next
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d frontend-next
```

- Do not use host `.next` copy as a primary runtime fix path.
