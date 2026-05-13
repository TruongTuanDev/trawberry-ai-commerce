# Orders API

## Scope
This document describes the current seller-facing Orders API implemented in `backend-nest`.

Current scope is limited to seller order management:
- list orders for one shop
- get order detail
- update fulfillment status
- read new orders created by the Checkout MVP
- read latest delivery shipment summary created by the delivery foundation

This is not yet a full payments module and does not include:
- payment provider integration
- carrier webhook processing
- advanced fulfillment automation

## Auth and Access

- All endpoints require authentication.
- `JwtAuthGuard` supports:
  - `httpOnly` auth cookie
  - `Authorization: Bearer <token>` fallback
- `ShopAccessGuard` ensures a seller can only access orders for shops they own.
- Admin users retain broader access through existing auth/guard logic.

## Endpoints

### `GET /api/shops/:shopId/orders`

List orders for a seller shop with pagination and basic filters.

Query params:
- `page`
- `size`
- `search`
- `status`
- `dateFrom`
- `dateTo`

Response shape:

```json
{
  "items": [
    {
      "id": "uuid",
      "orderNumber": "ORD-1001",
      "shopId": "uuid",
      "shopName": "Shop One",
      "status": "PENDING",
      "paymentStatus": "PENDING",
      "totalAmount": "120.00",
      "shippingCost": "10.00",
      "shippingMethodName": "Courier",
      "shippingAddress": "123 Main St",
      "customer": {
        "name": "Alice",
        "phone": "123456",
        "email": "alice@example.com"
      },
      "customerNote": null,
      "createdAt": "2025-01-10T10:00:00.000Z",
      "updatedAt": "2025-01-10T10:00:00.000Z",
      "customerCompletedAt": null,
      "items": []
    }
  ],
  "meta": {
    "page": 1,
    "size": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

### `GET /api/shops/:shopId/orders/:orderId`

Return one seller-visible order with customer snapshot, items, totals, shipping address, payment status, and the latest delivery shipment summary when present.

Delivery summary fields currently projected in the order detail:
- `provider`
- `status`
- `providerShipmentId`
- `trackingNumber`
- `trackingUrl`

### `PATCH /api/shops/:shopId/orders/:orderId/status`

Update seller fulfillment status.

Allowed values:
- `PENDING`
- `NEW`
- `ASSEMBLING`
- `SHIPPING`
- `DELIVERED`
- `CANCELLED`

Current transition rules:
- `PENDING -> ASSEMBLING` requires `paymentStatus=APPROVED` or `PAID`
- `NEW -> ASSEMBLING` requires `paymentStatus=APPROVED` or `PAID`
- `ASSEMBLING -> SHIPPING`
- `SHIPPING -> DELIVERED`
- `CANCELLED` allowed only before `SHIPPING`

Side effects:
- `DELIVERED` reduces reserved stock for linked variants
- `CANCELLED` reduces reserved stock and restores stock quantity for linked variants

## Validation

Implemented DTO validation:
- `ListShopOrdersQueryDto`
  - typed `page`/`size`
  - min/max limits
  - `dateFrom` / `dateTo` must be valid ISO date strings
- `UpdateOrderStatusDto`
  - status enum validation with `class-validator`

## Runtime Verification

Current verification coverage:
- `backend-nest/test/orders.e2e-spec.ts`
  - list with pagination/search/status
  - detail
  - update status
  - cross-shop `403`
- `npm run smoke:orders`
  - register/login seller
  - approve seller in local DB
  - create shop
  - create product
  - seed one order in local DB
  - list/detail/update order
  - verify cross-shop access returns `403`

## Gaps

Still missing in the new NestJS stack:
- customer order history API
- payment confirmation upload/review workflow
- payment provider integration
- carrier webhooks and automated delivery events
- multi-shipment orchestration

Those flows still belong to the migration backlog and should not be treated as complete.
## Delivery Integration

Orders are not coupled directly to a carrier. Delivery state is stored in the generic delivery tables:

- `delivery_offers`
- `delivery_shipments`
- `delivery_events`

Seller delivery endpoints enforce that the order belongs to the shop and that shipment creation only happens after `paymentStatus=PAID`. Current selection strategy is Yandex-first for same-city orders and CDEK-first for inter-city orders, with mock mode as the default verification path.
