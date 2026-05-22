# Order Lifecycle

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
