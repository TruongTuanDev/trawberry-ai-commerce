# Customer Accounts, Order History, And Checkout Receipts

## Scope

Customer accounts use the existing `POST /api/auth/register` and `POST /api/auth/login` flow with role `CUSTOMER`. Seller and admin auth are unchanged.

This phase adds a parent marketplace checkout receipt:

- every checkout creates one `marketplace_checkouts` parent row
- each shop order stores optional `marketplaceCheckoutId`
- single-shop checkout has one child order
- multi-shop checkout has one child order per shop
- anonymous checkout remains allowed
- logged-in customer checkout attaches `customerUserId`

## Checkout Response

`POST /api/checkout/orders` now returns:

```json
{
  "checkoutId": "uuid",
  "checkoutCode": "CHK-...",
  "grandTotal": "800",
  "orders": [],
  "orderCodes": [],
  "orderId": "legacy-first-order-id",
  "orderCode": "legacy-first-order-code"
}
```

The legacy first-order fields stay for existing clients.

## Customer APIs

- `GET /api/customer/orders`
- `GET /api/customer/orders/:checkoutCode`

Both require a logged-in `CUSTOMER` account and return marketplace receipt data with child orders and items.

## Public Receipt Lookup

- `GET /api/public/checkouts/:checkoutCode?phone=...`

Anonymous customers can open a receipt with the checkout code and the phone used at checkout. Wrong phone returns `404`.

## Frontend

- `/customer/register`
- `/customer/login`
- `/customer/orders`
- `/customer/orders/[checkoutCode]`
- `/orders/receipt/[checkoutCode]`

The receipt page shows all child shop orders, order codes, items, payment status, delivery status, shop totals, and tracking links.

## Verification

- Backend: `npm run smoke:customer-order-history`
- Frontend: `npm run test:e2e:customer-order-history`
