# Checkout API

## Scope
This document describes the customer checkout MVP implemented in `backend-nest`.

Current scope includes:
- public product browsing
- anonymous or logged-in customer order creation
- seller visibility of newly created orders through the existing seller Orders API
- direct seller payment details snapshot for manual QR/bank transfer flows
- payment-method strategy selection for seller QR + Yandex manual delivery preparation
- structured customer address snapshot for Yandex-compatible manual delivery

Current scope does not include:
- real payment provider integration
- payment approval or capture endpoints
- customer account-based order history pages
- shipment creation or tracking

## Payment methods

Checkout currently accepts:

- `PREPAID_SELLER_QR`
- `PAY_ON_DELIVERY_SELLER_QR`
- `DEPOSIT_THEN_DELIVERY_PAYMENT`

Checkout rejects:

- `YANDEX_CARD_ON_DELIVERY` unless every shop capability status is `AVAILABLE`
- `CASH_COURIER_COLLECTION`

Multi-shop rule:

- the selected method must be supported by every shop in the checkout
- otherwise checkout returns `SHOP_PAYMENT_METHOD_NOT_SUPPORTED`

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
    "latitude": 55.751244,
    "longitude": 37.618423,
    "note": "Ring the bell"
  },
  "paymentMethod": "MANUAL_TRANSFER"
}
```

Validation:
- `shopId` is retained for backward compatibility with single-shop callers; split-order checkout groups by each product's current shop
- `items` must contain at least one item
- `quantity >= 1`
- shop must exist and be `ACTIVE`
- seller approval must be `APPROVED`
- every product must exist
- products may belong to different shops; each shop receives its own order
- inactive products are rejected when `visibility !== ACTIVE`
- products without at least one image are rejected
- active checkout variant price must be greater than `0`
- requested quantity must be within available stock
- customer `fullName`, `phone`, and `address` are required
- `customer.latitude` and `customer.longitude` are optional and are stored as shipping coordinate snapshots when present
- when a logged-in customer uses `addressId`, the backend copies structured address fields into dedicated dropoff snapshot fields
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
- multi-shop cart checkout creates one order per `product.shopId`
- every checkout creates one parent marketplace receipt in `marketplace_checkouts`
- any validation or stock failure blocks the entire checkout and prevents partial order creation

### Preflight companion

- `POST /api/public/cart/validate` is the read-only companion endpoint for stale-cart detection.
- It is intended for `/cart` and `/checkout` UI preflight only.
- `POST /api/checkout/orders` still performs the final authoritative validation even if preflight already passed.

Response:

```json
{
  "orderId": "uuid",
  "checkoutId": "uuid",
  "checkoutCode": "CHK-1715512345678-123",
  "orderCode": "ORD-1715512345678-123",
  "status": "PENDING",
  "paymentStatus": "PENDING",
  "totalAmount": "198",
  "paymentInstructions": "Transfer to bank account 123.",
  "paymentDetails": {
    "mode": "STATIC_QR",
    "bankName": "T-Bank",
    "recipientName": "Seller One",
    "recipientPhone": "+79990000001",
    "recipientAccount": "40817810000000000123",
    "sbpPhone": "+79990000001",
    "staticQrImageUrl": "http://localhost:3001/uploads/shop-payment-qr/...",
    "paymentInstruction": "Scan the seller QR and transfer the exact order total."
  },
  "trackingPath": "/orders/<orderId>",
  "customerPhone": "0123456789",
  "orders": [
    {
      "orderId": "uuid",
      "orderCode": "ORD-1715512345678-123",
      "shopId": "shop-uuid",
      "shopName": "Shop One",
      "status": "PENDING",
      "paymentStatus": "PENDING",
      "totalAmount": "198",
      "paymentInstructions": "Transfer to bank account 123.",
      "paymentDetails": {
        "mode": "STATIC_QR",
        "bankName": "T-Bank",
        "recipientName": "Seller One",
        "recipientPhone": "+79990000001",
        "recipientAccount": "40817810000000000123",
        "sbpPhone": "+79990000001",
        "staticQrImageUrl": "http://localhost:3001/uploads/shop-payment-qr/...",
        "paymentInstruction": "Scan the seller QR and transfer the exact order total."
      },
      "trackingPath": "/orders/<orderId>",
      "itemsCount": 2
    }
  ],
  "orderCodes": ["ORD-1715512345678-123"],
  "grandTotal": "198"
}
```

Compatibility:
- `orderId`, `orderCode`, `status`, `paymentStatus`, `totalAmount`, `paymentInstructions`, and `trackingPath` describe the first created order for legacy single-order consumers.
- `paymentDetails` follows the same compatibility rule and describes the first created order for legacy single-order consumers.
- New cart consumers should read `checkoutCode`, `orders[]`, `orderCodes[]`, and `grandTotal`.

Structured address addendum:

- `shippingAddress` remains for legacy compatibility
- structured dropoff fields are now also stored for Yandex-compatible delivery operations:
  - `dropoffAddressFullName`
  - `dropoffCity`
  - `dropoffStreet`
  - `dropoffBuilding`
  - `dropoffEntrance`
  - `dropoffIntercom`
  - `dropoffFloor`
  - `dropoffApartment`
  - `dropoffLatitude`
  - `dropoffLongitude`
  - `dropoffGeoPrecision`
  - `dropoffComment`

Current policy:

- missing coordinates do not block checkout
- seller manual Yandex workbench can still operate
- future real Yandex API claim creation can require coordinates more strictly

## Customer Receipt APIs

- `GET /api/customer/orders`: logged-in customer receipt history.
- `GET /api/customer/orders/:checkoutCode`: logged-in customer receipt detail.
- `GET /api/public/checkouts/:checkoutCode?phone=...`: anonymous receipt lookup by checkout code plus phone.

Tracking follow-up:
- customer can continue directly to `/orders/:orderId`
- customer can also use `/orders/track` later with `orderCode + phone`
- manual transfer proof upload is now documented in `docs/API_ORDER_TRACKING.md`
- when a shop is configured for direct seller QR payment, checkout confirmation can render the seller QR and bank/SBP snapshot directly from `paymentDetails`

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
- `backend-nest/scripts/smoke-direct-seller-qr-payment.ps1`
  - verifies seller QR config is present in checkout response snapshot

## Known Limitations

- Payment flow is still manual and informational only.
- direct seller QR payment is static and snapshot-based; checkout does not call any bank API.
- delivery routing can now snapshot optional shipping coordinates for downstream manual Yandex workbench usage, but checkout still does not call any carrier API.
- structured Yandex-compatible address suggestions/geocoding remain mock/manual only in this phase.
- Checkout chooses the requested `variantId` when provided, otherwise it falls back to the first active priced variant for legacy callers.
- Manual transfer orders remain `paymentStatus=PENDING`, so later fulfillment progression still depends on future payment workflows.
- Payment proof and delivery remain per created shop order; parent receipt is for combined customer view/history.

## WB Import Checkout Verification

Run:

```bash
cd backend-nest
npm run smoke:wb-import-checkout
```

The smoke confirms imported WB products use `REMOTE_URL` images, seller-updated price/stock make the product public, `totalAmount` is calculated as `1990 * 2`, stock is deducted from `5` to `3`, insufficient stock is blocked, the customer can track by `orderCode + phone`, and the seller sees the pending payment.
# Checkout API

`POST /api/checkout/orders` now supports cart checkout with multiple items.

```json
{
  "shopId": "shop-uuid",
  "customer": {
    "fullName": "Customer Name",
    "phone": "+79990000001",
    "email": "optional@example.com",
    "address": "Delivery address",
    "note": "Optional note"
  },
  "paymentMethod": "MANUAL_TRANSFER",
  "items": [
    {
      "productId": "product-uuid",
      "variantId": "variant-uuid",
      "quantity": 2
    }
  ]
}
```

Rules:

- `items` is required and non-empty.
- `quantity` must be at least 1.
- `variantId` is supported and should be sent by the cart UI. Legacy single-product requests without `variantId` still resolve the first checkout-ready variant.
- Frontend prices are ignored. The backend calculates `unitPrice`, `lineTotal`, and `totalAmount`.
- If `trackInventory=true`, stock must be sufficient. Any invalid item fails the entire checkout.
- One checkout request can contain multiple shops. The backend creates one order per shop and returns `orders[]` plus `grandTotal`.

Support addendum:

- customer receipt detail built on top of checkout now includes `supportCases[]` summary
- support workflow starts from the parent `checkoutCode`, not from checkout creation itself

Address readiness addendum:

- checkout response now returns `addressGeoReadiness`
- checkout response now returns `addressWarnings`
- manual Yandex-compatible delivery still allows addresses without coordinates
- future real `YANDEX_API` delivery mode should block non-API-ready addresses
