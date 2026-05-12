# API Order Tracking

## Scope
This document describes the customer order tracking and payment proof upload MVP implemented in `backend-nest`.

Current scope includes:
- public customer order tracking by `orderCode + phone`
- public customer order tracking by `orderId + phone`
- public payment proof upload for manual transfer
- seller payment detail visibility of uploaded proof
- basic audit logging through `payment_review_logs`

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
