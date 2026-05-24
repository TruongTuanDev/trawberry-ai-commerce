# Payments API

## 2026-05-24 Seller Payment Review Queue Addendum

The seller payments list is now treated as a dedicated payment proof review queue instead of a mixed operational list.

Operational meaning:

- queue focuses on buyer-submitted proof waiting for seller review
- seller confirmation keeps existing payment transition logic
- after confirmation, the order leaves payment review and becomes eligible for seller fulfillment buckets in Orders
- seller rejection keeps the order out of fulfillment and leaves it in payment-resolution flow

## 2026-05-22 Return / Refund / Dispute Foundation

Direct-to-seller payments now support manual refund tracking after payment confirmation.

Important rule:

- the marketplace still does not execute refunds through a provider API
- seller sends money back directly to the buyer
- the system records case status, evidence, and manual transfer proof

Payment-adjacent additions:

- return/refund cases can be opened only for customer-owned orders
- seller can mark a manual refund transfer as sent
- buyer can confirm refund received
- admin can override refund confirmation when evidence is sufficient
- finance ledger creates a negative adjustment only after refund confirmation, not at case open time

## 2026-05-22 Three Role Order Sync Addendum

Admin payment supervision now projects marketplace finance sync state directly on each payment row.

Additional admin payment response fields:

- `sellerId`
- `sellerName`
- `sellerEmail`
- `ledgerStatus`
- `ledgerCommissionAmount`
- `ledgerInvoiceStatus`

Operational meaning:

- `ledgerStatus=null` means final fee ledger has not been created yet
- final ledger should appear only after the seller confirms the final payment event for that order
- admin can now see payment review and finance sync in one queue

## 2026-05-22 Seller Fee Ledger For Direct-to-Seller Payment

Direct-to-seller payment now has a separate finance layer.

Important rule:

- the marketplace still does not hold buyer funds in this phase
- platform fees are calculated from confirmed seller revenue through ledger entries

New finance-facing models:

- `ShopCommissionSetting`
- `PlatformCommissionSetting`
- `SellerFeeLedgerEntry`
- `SellerMonthlyInvoice`

Ledger entries are created only on final confirmed seller payment:

- prepaid seller QR -> seller confirmed prepaid payment
- pay on delivery seller QR -> seller confirmed delivery payment
- deposit then delivery -> seller confirmed final payment

Excluded from fee calculation:

- cancelled orders
- rejected orders
- refund-reversal situations after adjustment
- delivery fee when it is separated from product revenue

Manual invoice behavior:

- admin can generate one invoice per `shopId + billingPeriod`
- admin can mark invoice paid manually
- no automatic bank debit is attempted

## 2026-05-22 Payment Method Strategy For Yandex Delivery

Current buyer-facing payment methods are now:

- `PREPAID_SELLER_QR`
- `PAY_ON_DELIVERY_SELLER_QR`
- `DEPOSIT_THEN_DELIVERY_PAYMENT`

Future-only / disabled methods:

- `YANDEX_CARD_ON_DELIVERY`
  - must stay unavailable unless shop capability status is `AVAILABLE`
- `CASH_COURIER_COLLECTION`
  - must stay unavailable

Important rule:

- manual Yandex delivery does not collect money in the current stack
- `PAY_ON_DELIVERY_SELLER_QR` means buyer pays seller directly by QR/SBP after receiving the parcel

New shop payment capability fields include:

- `allowPrepaidQr`
- `allowPayOnDeliverySellerQr`
- `allowDepositPayment`
- `depositPercent`
- `depositRequiredAboveAmount`
- `codMaxOrderAmount`
- `yandexCardOnDeliveryStatus`
- `cashCourierCollectionStatus`

Order snapshots now store dedicated payment strategy fields instead of relying only on `shippingMethodName`.

## Scope
This document describes the manual payment review MVP implemented in `backend-nest`.

Current scope includes:
- seller payment review queue
- payment detail with customer/order snapshots
- payment proof visibility in seller detail
- direct seller static QR / bank payment configuration per shop
- buyer-side "marked as paid" proof upload
- seller confirm / reject after buyer proof
- admin payment supervision and override
- reject a pending payment
- add payment review notes
- basic audit logging in `payment_review_logs`

Current scope does not include:
- payment provider integration
- automatic reconciliation
- refunds, chargebacks, or provider webhooks
- automatic bank verification

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
- `proofStatus`

### `GET /api/shops/:shopId/payment-settings`

Return one shop direct-payment configuration.

### `PATCH /api/shops/:shopId/payment-settings`

Update one shop direct-payment configuration.

Key body fields:
- `paymentMode=STATIC_QR`
- `status`
- `bankName`
- `recipientName`
- `recipientPhone`
- `recipientAccount`
- `sbpPhone`
- `paymentInstruction`

### `POST /api/shops/:shopId/payment-settings/qr-image`

Upload a static QR image for direct seller payment.

### `GET /api/shops/:shopId/payments/:orderId`

Return payment review detail for one order, including:
- order id / code
- order status
- payment status
- payment method
- payment instructions
- payment details snapshot:
  - mode
  - bankName
  - recipientName
  - recipientPhone
  - recipientAccount
  - sbpPhone
  - staticQrImageUrl
- totals
- customer snapshot
- item snapshots
- payment proof metadata when present
- payment proof status
- buyer payment note
- payment review logs

### `POST /api/shops/:shopId/payments/:orderId/mark-paid`

Mark a manual payment as paid.

Behavior:
- `paymentStatus -> PAID`
- order status remains unchanged in this MVP
- seller fulfillment can still continue because the Orders module now accepts `PAID` the same way it accepts legacy `APPROVED`
- creates a `SELLER_CONFIRMED` audit log

### `POST /api/shops/:shopId/payments/:orderId/confirm`

Alias for seller confirmation in the direct seller QR flow.

Validation:
- fails if payment is already `PAID` or legacy `APPROVED`
- fails if payment was already rejected

### `POST /api/shops/:shopId/payments/:orderId/reject`

Reject a payment.

Behavior:
- `paymentStatus -> REJECTED`
- `paymentProofStatus -> SELLER_REJECTED`
- if order status is still `PENDING` or `NEW`, order status is set to `CANCELLED`
- creates a `SELLER_REJECTED` audit log

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

### `GET /api/admin/payments`

Admin marketplace-wide payment supervision queue.

Query params:
- `page`
- `size`
- `status`
- `proofStatus`
- `shopId`

### `GET /api/admin/payments/:orderId`

Admin marketplace-wide payment detail.

### `POST /api/admin/payments/:orderId/confirm`

Admin override that confirms a payment and writes `ADMIN_CONFIRMED`.

### `POST /api/admin/payments/:orderId/reject`

Admin override that rejects a payment and writes `ADMIN_REJECTED`.

## Runtime Verification

Coverage currently includes:
- `backend-nest/test/payments.e2e-spec.ts`
  - list pending payments
  - detail
  - mark paid
  - reject
  - add note
  - seller queue by `proofStatus`
  - admin list / confirm / reject
  - cross-shop `403`
  - invalid transition
- `backend-nest/test/order-tracking.e2e-spec.ts`
  - seller payment detail sees customer-uploaded proof
  - buyer proof upload writes `BUYER_MARKED_PAID`
  - seller confirmation works after proof upload
- `backend-nest/scripts/smoke-direct-seller-qr-payment.ps1`
  - seller payment settings
  - QR upload
  - checkout QR snapshot
  - buyer proof upload
  - seller confirm
  - admin supervision
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
- customer proof upload is still public and phone-based even though customer account history now exists.
- provider-backed statuses and true settlement are still future work.
- this phase supports static QR / bank instructions only; it does not verify real incoming bank transactions.
