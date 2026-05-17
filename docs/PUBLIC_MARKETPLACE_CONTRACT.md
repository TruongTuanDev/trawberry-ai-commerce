# Public Marketplace Contract Hardening

Date: 2026-05-17

Scope: public marketplace contract in `backend-nest` and `frontend-next`. Legacy apps remain untouched.

## Visibility Rules

- `GET /api/public/products` and `GET /api/public/products/:productId` only expose products that are:
  - `catalogStatus=PUBLISHED`
  - `visibility=ACTIVE`
  - owned by an approved seller
  - in an active shop
  - readiness-passing
  - backed by at least one image
  - backed by at least one active priced variant
- readiness still requires at least one sellable variant with stock when `trackInventory=true`
- result: products with every variant out of stock are hidden from both public list and public detail

## Variant Availability Rules

- public detail exposes mixed availability safely when the product is still public
- in-stock variants return `inStock=true` and positive `availableQuantity`
- out-of-stock variants still return in the variant array, but with:
  - `inStock=false`
  - `availableQuantity=0`
  - disabled selection in the public UI

## Checkout Source Of Truth

- frontend cart and buy-now flows are convenience UX only
- backend checkout remains the authority for:
  - publication and readiness validation
  - variant ownership validation
  - price presence
  - quantity vs stock validation
- checkout rejects:
  - out-of-stock variants
  - unpublished products
  - archived products
  - invalid variants
  - missing-price variants
  - quantities above available stock

## Cart Preflight Contract

- Public cart preflight endpoint: `POST /api/public/cart/validate`
- It uses the same visibility and stock/price rules as final checkout.
- It returns:
  - per-item status
  - current server unit price
  - current stock and `maxQuantity`
  - trusted subtotal for currently available items
- `PRICE_CHANGED` is non-mutating and does not create or reserve orders.

## Header And Mobile UX Contract

- public header search submits to `/products?q=...`
- header search input keeps the current `q` visible after navigation
- public header cart badge reflects the shared cart store and only renders when count is positive
- product detail keeps the desktop sticky purchase card
- mobile product detail adds a sticky bottom CTA with:
  - current price
  - selected variant summary
  - quantity stepper
  - add-to-cart
  - buy-now

## Empty And Fallback UX

- `/products` distinguishes between:
  - no public catalog items
  - no matching result for the current search/filter state
- no-result states expose active filter summary plus `Clear filters`
- `/cart` has a dedicated empty state and hides checkout CTA when empty
- public detail renders a friendly unavailable state when a product is no longer public
- image fallbacks are local and safe for card, gallery, and cart rendering

## Verification Targets

- backend: `backend-nest/test/public-products.e2e-spec.ts`
- frontend: `frontend-next/tests/e2e/public-marketplace-contract.spec.ts`
- frontend empty/fallback: `frontend-next/tests/e2e/public-empty-fallbacks.spec.ts`
- regressions:
  - header search navigation
  - cart badge updates
  - disabled out-of-stock size
  - mobile sticky CTA access
