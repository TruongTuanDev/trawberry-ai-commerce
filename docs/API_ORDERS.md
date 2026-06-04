# Orders API

## 2026-05-25 Seller Printable Shipping Label Addendum

No new backend endpoint was required for the printable seller shipping label.

The existing seller order detail projection already provides the data needed by the frontend print route:

- `orderNumber`
- `shopId`
- `shopName`
- `paymentMethod`
- `paymentStatus`
- `customer.name`
- `customer.phone`
- `items[]`
- `manualYandexOrderId`
- `trackingUrl`
- structured dropoff snapshot fields already exposed on seller order detail

The frontend composes the printable route from existing contracts:

- seller order detail:
  - `GET /api/shops/:shopId/orders/:orderId`
- seller delivery detail:
  - existing seller delivery detail route used by seller order detail/workbench
- seller delivery settings:
  - existing seller delivery settings route used to show pickup origin context

Important scope note:

- the printable label is an internal marketplace label only
- it is not an official Yandex label
- no new provider integration or lifecycle status was introduced

## 2026-05-24 Admin Fulfillment Supervision Tabs Addendum

Admin order supervision now has a dedicated seller-friendly fulfillment projection.

New admin endpoint:

- `GET /api/admin/orders/fulfillment`

Query params:

- `page`
- `size`
- `bucket=NEW|ASSEMBLING|IN_TRANSIT|COMPLETED|CANCELLED|ARCHIVED`
- `search`
- `shopId`
- `sellerId`
- `paymentStatus`
- `deliveryStatus`
- `provider`
- `overdueOnly=true`
- `dateFrom`
- `dateTo`

Per-row fields include:

- `orderId`
- `orderCode`
- `sellerId`
- `sellerName`
- `sellerEmail`
- `sellerPhone`
- `shopId`
- `shopName`
- `customerName`
- `customerPhone`
- `paymentMethod`
- `paymentStatus`
- `fulfillmentBucket`
- `fulfillmentLabel`
- `deliveryStatus`
- `deliveryShipmentId`
- `manualYandexOrderId`
- `yandexTrackingUrl`
- `createdAt`
- `updatedAt`
- `sellerArchivedAt`
- `isOverdue`
- `ageMinutes`
- `lastReminderAt`
- `nextAdminActions`

Summary counts are returned as:

- `ALL`
- `NEW`
- `ASSEMBLING`
- `IN_TRANSIT`
- `COMPLETED`
- `CANCELLED`
- `ARCHIVED`

`nextAdminActions` is now supervision-only:

- `VIEW`
- `REMIND_SELLER`

The admin fulfillment page must not expose seller fulfillment transition mutations.

## 2026-05-24 Seller Fulfillment Buckets Addendum

Seller orders now expose a normalized fulfillment board contract.

Additional list response field:

- `summary`
  - `ALL`
  - `NEW`
  - `ASSEMBLING`
  - `IN_TRANSIT`
  - `COMPLETED`
  - `CANCELLED`
  - `ARCHIVED`

Updated seller order projection fields:

- `sellerStatusBucket`
  - now normalized to seller-friendly fulfillment buckets
- `sellerArchivedAt`
- `sellerArchiveSourceStatus`

Additional seller endpoint:

- `POST /api/shops/:shopId/orders/:orderId/archive`
  - archives only `COMPLETED` or `CANCELLED` seller orders

Operational meaning:

- seller fulfillment board is now separate from payment proof review
- payment-confirmed orders first appear in `NEW`
- shipment-created but not handed-off orders appear in `ASSEMBLING`
- delivered / cancelled orders can be moved into `ARCHIVED`

## 2026-05-22 Return / Refund / Dispute Addendum

Seller and customer order projections now include linked return/refund case summaries when present.

Additive response projection:

- `returnRefundCases[]`
  - `id`
  - `type`
  - `reason`
  - `status`
  - `requestedAmount`
  - `approvedAmount`
  - `openedAt`
  - `updatedAt`

Operational meaning:

- customer order detail can link directly into the return/refund workflow
- seller order detail can see active case status and react operationally

## 2026-05-22 Three Role Order Sync Addendum

Seller orders now expose role-aware operational metadata.

Additional list query params:

- `q`
- `paymentStatus`
- `deliveryStatus`
- `from`
- `to`
- `sort=createdAt_desc|createdAt_asc`

Additional response fields:

- `paymentMethod`
- `paymentMethodLabel`
- `itemsCount`
- `sellerDisplayStatus`
- `sellerDisplayLabel`
- `sellerStatusBucket`
- `nextAction`
- `paymentDetails`
- `finance`

This allows seller order list/detail UI to stay synchronized with payment review, delivery workbench, and finance ledger state.

## Scope
This document describes the current seller-facing Orders API implemented in `backend-nest`.

Current scope is limited to seller order management:
- list orders for one shop
- get order detail
- update fulfillment status
- read new orders created by the Checkout MVP
- read split orders created by multi-shop checkout, scoped to the seller's shop only
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

List orders for a seller shop with pagination and operational filters.

Query params:
- `page`
- `size`
- `search`
- `q`
- `status`
- `paymentStatus`
- `deliveryStatus`
- `dateFrom`
- `from`
- `dateTo`
- `to`
- `sort`

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
      "paymentMethod": "PREPAID_SELLER_QR",
      "paymentMethodLabel": "Prepaid seller QR",
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
      "itemsCount": 1,
      "sellerDisplayStatus": "PAYMENT_PROOF_SUBMITTED",
      "sellerDisplayLabel": "Payment proof submitted",
      "sellerStatusBucket": "PAYMENT_PROOF",
      "nextAction": "review_payment_proof",
      "paymentDetails": {},
      "finance": {
        "ledgerStatus": "PENDING",
        "commissionAmount": "9",
        "invoiceStatus": null
      },
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

Return one seller-visible order with customer snapshot, items, totals, shipping address, payment status, role-aware next action, latest delivery shipment summary, payment destination snapshot, and latest finance ledger summary when present.

Delivery summary fields currently projected in the order detail:
- `provider`
- `status`
- `providerShipmentId`
- `trackingNumber`
- `trackingUrl`
- `courierPhone`
- `estimatedDeliveryAt`
- `deliveryNote`

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
# Orders API Update

Seller order list/detail responses expose multi-item checkout snapshots in `items[]`.

Each item includes the legacy fields plus additive cart fields:

- `productId`
- `variantId`
- `variantNameSnapshot`
- `unitPrice`
- `lineTotal`
- `productImageSnapshot`

Existing single-item orders remain compatible because the original snapshot fields are still returned.

Multi-shop checkout creates separate orders per shop. Seller order list/detail endpoints do not expose sibling shop orders; each seller sees only the order whose `shopId` matches the active seller shop.

Support addendum:

- seller order detail now includes `supportCases[]` summary for support cases linked to that order
- checkout-wide cases without a linked order remain admin/customer-only and do not appear in seller order detail
