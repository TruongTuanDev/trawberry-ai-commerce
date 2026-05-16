# Cart + Multi-item Checkout

## MVP decision

- Cart persistence is frontend `localStorage` in `frontend-next`.
- Backend checkout remains the source of truth for price, stock, totals, and order item snapshots.
- MVP supports one shop per order. Frontend blocks carts with multiple `shopId` values and shows: `Multi-shop checkout is coming soon. Please checkout one shop at a time.`
- Future phase: split a multi-shop cart into one order per shop or introduce a marketplace parent order.

## Customer flow

1. Customer opens a public product detail page.
2. Customer selects a variant and quantity.
3. `Add to cart` stores/merges the item by `productId + variantId`.
4. `/cart` supports quantity update, remove, clear, subtotal, and checkout.
5. `/checkout` submits cart items to `POST /api/checkout/orders`.
6. Backend validates every item, creates a multi-item order, deducts variant stock transactionally, and returns order tracking data.

## Backend guarantees

- Request prices are ignored.
- Each item must reference an active checkout-ready product and an active priced variant.
- Variant must belong to the product.
- `trackInventory=true` variants require enough `stockQuantity`.
- All stock deductions happen in one transaction. Any failed item blocks the whole checkout.
- Order items snapshot product name, variant label, seller SKU, barcode, image, unit price, quantity, and line total.

## Verification

- Backend: `npm run smoke:cart-checkout`
- Frontend: `npm run test:e2e:cart-checkout`
