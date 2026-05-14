# frontend-next

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
- `/seller/ai-images`
- `/seller/orders`
- `/seller/orders/[id]`
- `/seller/payments`
- `/seller/payments/[orderId]`
- `/seller/onboarding`
- `/seller/settings`

## Current features
- Admin seller approval UI with:
  - pending/approved/rejected filters
  - seller onboarding detail
  - KYC document review
  - audit timeline
  - approve action
  - reject action with optional reason
- Seller onboarding UI with:
  - legal profile form
  - KYC document upload
  - document status list
  - pending/rejected CTA in seller shell
- Public marketplace UI with:
  - polished home page
  - responsive product grid
  - product gallery and checkout CTA
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
- Seller Wildberries import UI with:
  - `.xlsx` upload
  - stock, publish, and fallback-price options
  - preview counts, warnings, and errors
  - Wildberries remote image links as the default MVP image mode
  - confirm import and result summary
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

Defaults:
- frontend base URL: `http://localhost:3000`
- backend API URL for test registration: `http://localhost:3001`

Optional overrides:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000
PLAYWRIGHT_BACKEND_URL=http://localhost:3001
```

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
