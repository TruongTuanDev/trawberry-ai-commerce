# Checkout API

## Scope
This document describes the customer checkout MVP implemented in `backend-nest`.

Current scope includes:
- public product browsing
- anonymous or logged-in customer order creation
- seller visibility of newly created orders through the existing seller Orders API

Current scope does not include:
- real payment provider integration
- payment approval or capture endpoints
- customer account-based order history pages
- shipment creation or tracking

## Public Catalog

### `GET /api/public/products`

List customer-visible products.

Returned fields are public-safe:
- `id`
- `shopId`
- `name`
- `description`
- `brand`
- `categoryName`
- `price`
- `images`
- `shop`
- `inStock`
- `availableQuantity`

Only active products with at least one active variant are returned.

### `GET /api/public/products/:productId`

Return one customer-visible product using the same safe shape as the list endpoint.

## Checkout Endpoint

### `POST /api/checkout/orders`

Create an order from customer checkout input.

Auth:
- anonymous checkout is allowed
- if a valid auth cookie or bearer token is present, the backend attaches the logged-in `userId`
- if checkout is anonymous, the backend creates or reuses a lightweight customer account record because the current Prisma schema requires `orders.customer_id`

Request body:

```json
{
  "shopId": "uuid-or-id",
  "items": [
    {
      "productId": "uuid-or-id",
      "quantity": 2
    }
  ],
  "customer": {
    "fullName": "Alice Checkout",
    "phone": "0123456789",
    "email": "alice@example.com",
    "address": "123 Main St",
    "note": "Ring the bell"
  },
  "paymentMethod": "MANUAL_TRANSFER"
}
```

Validation:
- `shopId` is required
- `items` must contain at least one item
- `quantity >= 1`
- shop must exist and be `ACTIVE`
- seller approval must be `APPROVED`
- every product must exist
- every product must belong to the requested shop
- inactive products are rejected when `visibility !== ACTIVE`
- products without at least one image are rejected
- active checkout variant price must be greater than `0`
- requested quantity must be within available stock
- customer `fullName`, `phone`, and `address` are required
- frontend-supplied totals or seller-only fields are ignored because they are not accepted by the DTO

Order creation behavior:
- order `status` defaults to `PENDING`
- `paymentStatus` defaults to:
  - `PENDING` for `MANUAL_TRANSFER`
  - `UNPAID` for `CASH_ON_DELIVERY`
- `totalAmount` is calculated only on the backend
- order items snapshot current product title, slug, image, and price
- duplicate `productId` lines are normalized and summed before stock validation
- checkout validates current stock before writing the order
- variant stock is deducted immediately by decreasing `stockQuantity`
- variant stock is reserved by increasing `reservedStock`
- deduction and reservation are executed atomically inside the checkout transaction to prevent oversell

Response:

```json
{
  "orderId": "uuid",
  "orderCode": "ORD-1715512345678-123",
  "status": "PENDING",
  "paymentStatus": "PENDING",
  "totalAmount": "198",
  "paymentInstructions": "Transfer to bank account 123.",
  "trackingPath": "/orders/<orderId>",
  "customerPhone": "0123456789"
}
```

Tracking follow-up:
- customer can continue directly to `/orders/:orderId`
- customer can also use `/orders/track` later with `orderCode + phone`
- manual transfer proof upload is now documented in `docs/API_ORDER_TRACKING.md`

## Runtime Verification

Coverage currently includes:
- `backend-nest/test/checkout.e2e-spec.ts`
  - create order success
  - invalid shop
  - product not in shop
  - invalid quantity
  - missing customer fields
  - insufficient stock
  - seller orders list/detail can read the newly created order
- `backend-nest/scripts/smoke-checkout.ps1`
  - register seller
  - approve seller
  - login seller
  - create shop
  - create product
  - seed a priced variant
  - create anonymous checkout order
  - verify seller list/detail can see the new order

## Known Limitations

- Payment flow is still manual and informational only.
- Checkout currently chooses the first active priced variant for a product.
- Manual transfer orders remain `paymentStatus=PENDING`, so later fulfillment progression still depends on future payment workflows.
- Inventory is tracked at the variant layer, but the current customer checkout MVP still selects the first active priced variant for each product.

## WB Import Checkout Verification

Run:

```bash
cd backend-nest
npm run smoke:wb-import-checkout
```

The smoke confirms imported WB products use `REMOTE_URL` images, seller-updated price/stock make the product public, `totalAmount` is calculated as `1990 * 2`, stock is deducted from `5` to `3`, insufficient stock is blocked, the customer can track by `orderCode + phone`, and the seller sees the pending payment.
