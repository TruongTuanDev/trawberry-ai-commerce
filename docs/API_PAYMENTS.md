# Payments API

## Scope
This document describes the manual payment review MVP implemented in `backend-nest`.

Current scope includes:
- seller payment review queue
- payment detail with customer/order snapshots
- payment proof visibility in seller detail
- mark manual payment as paid
- reject a pending payment
- add payment review notes
- basic audit logging in `payment_review_logs`

Current scope does not include:
- payment provider integration
- automatic reconciliation
- refunds, chargebacks, or provider webhooks

## Schema Notes

This phase adds one additive Prisma model:
- `PaymentReviewLog` mapped to `payment_review_logs`

Key fields:
- `shopId`
- `orderId`
- `reviewerUserId`
- `action`
- `fromStatus`
- `toStatus`
- `note`
- `createdAt`

This is additive and does not modify legacy apps.

## Auth and Access

- All endpoints require authentication.
- `JwtAuthGuard` supports:
  - `httpOnly` auth cookie
  - `Authorization: Bearer <token>` fallback
- `ShopAccessGuard` ensures the seller/admin only accesses payments for shops they own.

## Endpoints

### `GET /api/shops/:shopId/payments`

List the seller payment review queue for one shop.

Default behavior:
- if no `status` filter is provided, the queue returns orders with `paymentStatus in [PENDING, UNPAID]`

Query params:
- `page`
- `size`
- `status`
- `search`

### `GET /api/shops/:shopId/payments/:orderId`

Return payment review detail for one order, including:
- order id / code
- order status
- payment status
- payment method
- payment instructions
- totals
- customer snapshot
- item snapshots
- payment proof metadata when present
- payment review logs

### `POST /api/shops/:shopId/payments/:orderId/mark-paid`

Mark a manual payment as paid.

Behavior:
- `paymentStatus -> PAID`
- order status remains unchanged in this MVP
- seller fulfillment can still continue because the Orders module now accepts `PAID` the same way it accepts legacy `APPROVED`
- creates a `MARK_PAID` audit log

Validation:
- fails if payment is already `PAID` or legacy `APPROVED`
- fails if payment was already rejected

### `POST /api/shops/:shopId/payments/:orderId/reject`

Reject a payment.

Behavior:
- `paymentStatus -> REJECTED`
- if order status is still `PENDING` or `NEW`, order status is set to `CANCELLED`
- creates a `REJECT_PAYMENT` audit log

Validation:
- fails if payment is already `PAID` or legacy `APPROVED`
- fails if payment is already `REJECTED`
- fails for shipped or delivered orders

### `POST /api/shops/:shopId/payments/:orderId/notes`

Add a payment review note.

Behavior:
- keeps the current payment status unchanged
- creates an `ADD_NOTE` audit log

Validation:
- `note` is required
- `note` max length is `1000`

## Runtime Verification

Coverage currently includes:
- `backend-nest/test/payments.e2e-spec.ts`
  - list pending payments
  - detail
  - mark paid
  - reject
  - add note
  - cross-shop `403`
  - invalid transition
- `backend-nest/test/order-tracking.e2e-spec.ts`
  - seller payment detail sees customer-uploaded proof
  - seller mark paid still works after proof upload
- `backend-nest/scripts/smoke-payments.ps1`
  - register seller
  - approve seller
  - login
  - create shop
  - create product
  - create checkout order
  - list pending payments
  - detail
  - add note
  - mark paid
  - verify audit logs
  - verify seller order detail sees `paymentStatus=PAID`
  - verify cross-shop `403`

## Known Limitations

- `paymentMethod` currently reuses the order snapshot from `shippingMethodName`, because the schema does not yet have a dedicated payment-method column.
- customer proof upload is public and phone-based; richer customer account history still does not exist yet.
- provider-backed statuses and true settlement are still future work.
