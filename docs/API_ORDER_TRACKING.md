# API Order Tracking

## Scope
This document describes the customer order tracking and payment proof upload MVP implemented in `backend-nest`.

Current scope includes:
- public customer order tracking by `orderCode + phone`
- public customer order tracking by `orderId + phone`
- public payment proof upload for manual transfer
- seller payment detail visibility of uploaded proof
- basic audit logging through `payment_review_logs`
- latest delivery shipment visibility through the generic delivery foundation

Current scope does not include:
- customer account-based order history
- real payment provider integration
- automatic payment reconciliation
- refund or dispute workflows

## Public Tracking Endpoints

### `GET /api/public/orders/track`

Track an order by `orderCode` and `phone`.

Query params:
- `orderCode` required
- `phone` required

### `GET /api/public/orders/:orderId/track`

Track an order by `orderId` and `phone`.

Query params:
- `phone` required

Validation:
- the order must exist
- `phone` must match `orders.customer_phone`
- phone mismatch returns `404` to avoid leaking order existence

Returned fields:
- `orderId`
- `orderCode`
- `status`
- `paymentStatus`
- `totalAmount`
- `paymentMethod`
- `paymentInstructions`
- `customer`
- `customerNote`
- `items`
- `paymentProof`
- `paymentLogs`
- `delivery`

Delivery projection currently includes:
- `provider`
- `status`
- `statusLabel`
- `statusMessage`
- `internalStatus`
- `providerStatus`
- `providerShipmentId`
- `trackingNumber`
- `trackingUrl`
- `courierPhone`
- `estimatedDeliveryAt`
- `deliveryNote`

## Payment Proof Upload

### `POST /api/public/orders/:orderId/payment-proof`

Upload customer payment proof.

Content type:
- `multipart/form-data`

Form fields:
- `phone` required
- `file` required

Allowed mime types:
- `image/jpeg`
- `image/png`
- `image/webp`
- `application/pdf`

Size limit:
- `PAYMENT_PROOF_MAX_SIZE_MB`
- falls back to `MAX_INPUT_IMAGE_SIZE_MB`

Behavior:
- stores the file through the existing file storage service
- updates additive proof fields on `orders`
- creates `PaymentReviewLog.action = UPLOAD_PROOF`
- does not allow customer to set `paymentStatus` or `orderStatus`

## Schema Notes

This phase adds additive fields on `orders`:
- `payment_proof_url`
- `payment_proof_storage_key`
- `payment_proof_original_name`
- `payment_proof_mime_type`
- `payment_proof_size`
- `payment_proof_uploaded_at`

## Runtime Verification

Coverage currently includes:
- `backend-nest/test/order-tracking.e2e-spec.ts`
  - track success with matching phone
  - track fail with wrong phone
  - upload proof success
  - upload proof fail with wrong phone
  - upload proof fail with invalid file type
  - seller payment detail sees proof
  - seller mark paid after proof upload
- `backend-nest/scripts/smoke-order-tracking.ps1`
  - register seller
  - approve seller
  - login seller
  - create shop
  - create product
  - create anonymous checkout order
  - customer tracks order
  - customer uploads payment proof
  - seller payment detail sees proof
  - seller marks paid
  - customer tracks again and sees `paymentStatus=PAID`
## Delivery Projection

Customer tracking includes the latest delivery shipment when one exists:

```json
{
  "delivery": {
    "provider": "YANDEX",
    "status": "IN_TRANSIT",
    "statusLabel": "In transit",
    "statusMessage": "The order is on the way.",
    "internalStatus": "IN_TRANSIT",
    "providerStatus": "IN_TRANSIT",
    "providerShipmentId": "mock-yandex-shipment-id",
    "trackingNumber": "MOCK-YANDEX-ORD-1",
    "trackingUrl": "https://mock-delivery.local/yandex/track/order-id",
    "courierPhone": "+79991112233",
    "estimatedDeliveryAt": "2026-05-15T12:00:00.000Z",
    "deliveryNote": "Seller-created delivery in Yandex dashboard"
  }
}
```

Mock mode never calls real Yandex or CDEK. Same-city mock shipments are expected to use the recommended Yandex offer; inter-city shipments are expected to use CDEK.
# Delivery Exception Tracking Addendum

Public order tracking includes customer-safe delivery exception data:

- `delivery.status`
- `delivery.failureReasonCode`, omitted for unsafe generic `OTHER`
- `delivery.customerVisibleMessage`
- `delivery.deliveryComments[]`, filtered to `CUSTOMER_VISIBLE`
- `delivery.trackingUrl`, when applicable

Internal seller/admin delivery comments are never returned by tracking endpoints. Failed deliveries render as a delivery issue; cancelled deliveries render as delivery cancelled.
# Order Tracking API Update

Public tracking responses now return every order item created by cart checkout.

`items[]` includes:

- product and variant ids when available
- product title snapshot
- variant name snapshot
- image snapshot
- quantity
- unit price
- line total

Customers can track multi-item orders through the existing order id/code plus phone lookup routes.

Multi-shop checkout returns a parent `checkoutCode` and multiple shop orders. Customers can open the combined receipt through `/api/public/checkouts/:checkoutCode?phone=...`, then track each child order separately with that order's `orderCode + phone` or order id plus phone.

## Support Cases Addendum

Order tracking remains per child order. Support workflow starts from the parent receipt or customer receipt detail and does not replace payment proof upload or delivery status endpoints.
