# Order Lifecycle

## Seller printable shipping label addendum

Seller order detail now supports an internal printable shipping label for manual Yandex operations.

- route:
  - `/seller/orders/[id]/shipping-label`
  - optional print mode: `/seller/orders/[id]/shipping-label?print=1`
- purpose:
  - internal marketplace package identification for seller/courier handling
  - not an official Yandex label
- default print size:
  - `100mm x 150mm`
- content:
  - order code
  - recipient summary
  - sender / pickup summary
  - manual Yandex id and tracking URL when present
  - payment summary
  - package item summary
  - QR that links to public order tracking lookup

Operational rules remain unchanged:

- seller still creates Yandex shipments manually outside the platform
- seller still enters `manualYandexOrderId` and optional tracking URL manually
- no real Yandex API label or provider barcode is generated in this phase
- payment and fulfillment transitions are unchanged

## Admin fulfillment supervision addendum

Admin now supervises the same normalized fulfillment lifecycle as the seller board:

1. `NEW`
   - payment is confirmed
   - shipment has not started
2. `ASSEMBLING`
   - seller created manual Yandex shipment or started packing
3. `IN_TRANSIT`
   - package has been handed off to delivery
4. `COMPLETED`
   - delivered successfully
5. `CANCELLED`
   - seller cancelled or delivery failed / customer refused during delivery
6. `ARCHIVED`
   - completed or cancelled order moved out of the active supervision board

Admin supervision is read-only for fulfillment transitions:

- admin can view, filter, search, inspect overdue, inspect payment state, inspect Yandex tracking, and remind seller
- seller owns the actual fulfillment transitions and archive flow

## Manual Yandex operational addendum

For seller-operated Yandex fulfillment, the expected operational sequence is now:

1. payment confirmed or seller accepted COD
2. order enters `READY_TO_CREATE_YANDEX`
3. seller enters `manualYandexOrderId` and saves manual Yandex data
4. shipment moves to `YANDEX_MANUAL_CREATED`
5. seller moves courier states:
   - `COURIER_ASSIGNED`
   - `PICKED_UP`
   - `ON_THE_WAY`
   - `DELIVERED`
6. customer tracking shows `manualYandexOrderId` once available
7. admin can remind the seller if the order stays too long without a Yandex ID

## Role-oriented lifecycle

The marketplace uses one core order record with role-specific display mapping.

## Seller display buckets

- `NEW`
- `AWAITING_PAYMENT`
- `PAYMENT_PROOF`
- `TO_PACK`
- `READY_FOR_YANDEX`
- `IN_DELIVERY`
- `DELIVERED`
- `PAYMENT_ISSUES`
- `CANCELLED`

Backend helper:

- `computeSellerOrderDisplayStatus(order)`
- `computeAdminOrderOpsStatus(order)`
- `computeCustomerOrderDisplayStatus(order)`

## Main flows

### PREPAID_SELLER_QR

1. checkout creates order
2. buyer uploads proof
3. seller confirms or rejects
4. confirmed payment creates seller fee ledger entry
5. seller prepares shipment / creates manual Yandex if needed

### PAY_ON_DELIVERY_SELLER_QR

1. checkout creates order with `PAY_ON_DELIVERY_SELECTED`
2. seller accepts COD order
3. order moves to `READY_TO_CREATE_YANDEX`
4. seller creates manual Yandex shipment
5. shipment is delivered
6. buyer marks paid or seller waits for payment
7. seller confirms or rejects final payment
8. final confirmation creates seller fee ledger entry

### DEPOSIT_THEN_DELIVERY_PAYMENT

1. checkout creates order with deposit strategy
2. seller confirms deposit
3. seller delivers
4. seller confirms final payment
5. final confirmation creates seller fee ledger entry

## Seller next actions

- `review_payment_proof`
- `accept_pay_on_delivery_order`
- `create_yandex_delivery`
- `prepare_order`
- `continue_preparing`
- `mark_picked_up`
- `mark_on_the_way`
- `mark_delivered`
- `confirm_delivery_payment`
- `wait_for_delivery_payment`
- `resolve_delivery_payment_issue`
- `review_payment_issue`
- `wait_for_payment`
- `monitor_delivery`
- `review_order`

## Finance hook

Finance ledger entries must be created only on final confirmed seller payment. They are idempotent and keep commission snapshot history.

Commission model:

- commission is configured per shop
- each confirmed order snapshots `commissionPercent` at confirmation time
- later shop commission changes do not rewrite old ledger rows
- monthly invoices use stored ledger entries and their snapshots, not a recomputed live percent

## Known limits

- no provider-backed payment status sync
- no provider-backed delivery webhook sync
- refunds remain manual and evidence-driven

## Return / refund / dispute overlay

Return/refund lifecycle is separate from the core delivery lifecycle but linked to the order.

Main manual refund path:

1. customer opens case after payment-confirmed or delivered order
2. seller responds or escalates
3. admin can approve or reject disputed cases
4. seller marks refund sent outside the platform
5. buyer confirms refund received
6. finance ledger creates a negative commission adjustment if needed

Important rule:

- opening a case does not change payment history or delete prior ledger rows
- only confirmed refund closes the finance loop

## Internal shipping label note

- seller order detail and `/seller/orders/[id]/shipping-label` now support internal label sizes `75x120`, `100x150`, and `a6`
- default label size is `100x150`, stored client-side for seller convenience, and passed through the `size` query param
- the printable label remains an internal marketplace handoff aid for manual/Yandex-compatible delivery and must not be presented as an official Yandex label
- the print layout now includes QR plus barcode scanning zones, compact sender/recipient blocks, and a warehouse sorting code while remaining single-page per supported label size
- text-heavy blocks such as recipient address, courier note, item preview, and internal note must clamp or wrap within their own section and must not visually overlap neighboring sections in any supported size
