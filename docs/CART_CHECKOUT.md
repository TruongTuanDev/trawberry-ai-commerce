# Cart + Multi-item Checkout

## Public Buying UX Addendum

- `/products` now supports quick cart UX:
  - single-variant products add directly from the card
  - multi-variant products route to detail with `Выбрать размер`
- `/products/[id]` now drives cart state from explicit variant pills plus a quantity stepper
- detail and product cards show `В корзине` state for the selected variant
- quantity rules stay checkout-safe:
  - minimum `1`
  - maximum `availableQuantity` when `trackInventory=true`
- checkout API contract is unchanged; cart still submits `productId`, `variantId`, and `quantity`

## MVP decision

- Cart persistence is frontend `localStorage` in `frontend-next`.
- Backend checkout remains the source of truth for price, stock, totals, and order item snapshots.
- Cart supports products from multiple shops.
- Checkout creates a parent marketplace receipt and splits a multi-shop cart into one order per shop.

## Customer flow

1. Customer opens a public product detail page.
2. Customer selects a variant and quantity.
3. `Add to cart` stores/merges the item by `productId + variantId`.
4. `/cart` supports quantity update, remove, clear, subtotal, and checkout.
5. `/checkout` submits cart items to `POST /api/checkout/orders`.
6. Backend validates every item, creates a parent `checkoutCode`, groups valid items by shop, creates one order per shop, deducts variant stock transactionally, and returns all order codes.

## Backend guarantees

- Request prices are ignored.
- Each item must reference a `PUBLISHED`, active, checkout-ready product and an active priced variant.
- Variant must belong to the product.
- `trackInventory=true` variants require enough `stockQuantity`.
- All stock deductions happen in one transaction. Any failed item blocks the whole checkout.
- Order items snapshot product name, variant label, seller SKU, barcode, image, unit price, quantity, and line total.
- Multi-shop carts fail atomically: if one shop item is invalid or out of stock, no shop order is created and no stock is deducted.
- Payment proof, seller review, delivery, and customer tracking remain per shop order.
- Logged-in customers can view receipt history under `/customer/orders`; anonymous customers can lookup `/orders/receipt/:checkoutCode` with checkout phone.
- Imported, draft, unpublished, or archived seller-catalog products are rejected at checkout.
- backend still recalculates trusted price and stock before order creation.

## Verification

- Backend: `npm run smoke:cart-checkout`
- Backend multi-shop: `npm run smoke:multi-shop-checkout`
- Backend customer history: `npm run smoke:customer-order-history`
- Frontend: `npm run test:e2e:cart-checkout`
- Frontend multi-shop: `npm run test:e2e:multi-shop-checkout`
- Frontend customer history: `npm run test:e2e:customer-order-history`

## Contract Hardening Addendum

- public header cart badge is now covered as a contract, not just a visual detail
- product detail stepper updates the same shared cart count used by `/cart` and `/checkout`
- mobile sticky CTA reuses the same add-to-cart and buy-now handlers as the desktop purchase card
- checkout backend still revalidates product publication, variant ownership, stock, and price before any stock deduction

## Empty State Addendum

- `/cart` now has an explicit empty state with `Continue shopping`
- empty cart no longer renders checkout CTA
- cart image thumbnails now use the same safe local fallback used by public product cards and detail pages
- future work: surface a dedicated warning when a stale cart item becomes unavailable before checkout

## Stale Cart Validation Addendum

- `/cart` now calls `POST /api/public/cart/validate` against every local cart line.
- Blocking statuses disable checkout until the customer resolves the problem.
- `PRICE_CHANGED` is surfaced as a warning and can be accepted without bypassing server validation.
- `/checkout` now reruns the same preflight before submit.
- Final order creation still validates again server-side inside `POST /api/checkout/orders`.
