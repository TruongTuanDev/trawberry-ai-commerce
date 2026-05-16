# Cart + Multi-item Checkout

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
- Each item must reference an active checkout-ready product and an active priced variant.
- Variant must belong to the product.
- `trackInventory=true` variants require enough `stockQuantity`.
- All stock deductions happen in one transaction. Any failed item blocks the whole checkout.
- Order items snapshot product name, variant label, seller SKU, barcode, image, unit price, quantity, and line total.
- Multi-shop carts fail atomically: if one shop item is invalid or out of stock, no shop order is created and no stock is deducted.
- Payment proof, seller review, delivery, and customer tracking remain per shop order.
- Logged-in customers can view receipt history under `/customer/orders`; anonymous customers can lookup `/orders/receipt/:checkoutCode` with checkout phone.

## Verification

- Backend: `npm run smoke:cart-checkout`
- Backend multi-shop: `npm run smoke:multi-shop-checkout`
- Backend customer history: `npm run smoke:customer-order-history`
- Frontend: `npm run test:e2e:cart-checkout`
- Frontend multi-shop: `npm run test:e2e:multi-shop-checkout`
- Frontend customer history: `npm run test:e2e:customer-order-history`
