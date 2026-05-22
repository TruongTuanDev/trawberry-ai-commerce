# Return / Refund / Dispute Foundation

## Scope

This phase adds a manual return, refund, and dispute workflow for the active marketplace stack.

Important operating rule:

- buyer money still goes directly to the seller
- the platform does not push money back through a payment API
- refunds are confirmed manually with evidence, messages, and admin oversight

## Supported case types

- `REFUND_ONLY`
- `RETURN_AND_REFUND`
- `EXCHANGE_REQUEST`
- `PAYMENT_DISPUTE_ONLY`

## Supported reasons

- `WRONG_SIZE`
- `ITEM_NOT_AS_DESCRIBED`
- `DAMAGED_ITEM`
- `MISSING_ITEM`
- `WRONG_ITEM`
- `LATE_DELIVERY`
- `BUYER_CHANGED_MIND`
- `PAYMENT_DISPUTE`
- `OTHER`

## Core status lifecycle

- `WAITING_SELLER_RESPONSE`
- `SELLER_REJECTED`
- `WAITING_BUYER_EVIDENCE`
- `WAITING_RETURN_SHIPMENT`
- `RETURN_RECEIVED`
- `ADMIN_REVIEW`
- `REFUND_PENDING`
- `REFUND_MARKED_SENT`
- `REFUND_CONFIRMED`
- `CLOSED`
- `CANCELLED`

## Responsibilities

### Customer

- opens the case from order detail or customer returns page
- uploads evidence when needed
- can confirm refund received after seller marks refund sent

### Seller

- accepts, rejects, requests evidence, or escalates to admin
- marks return received for physical return flows
- records manual refund transfer and optional proof

### Admin

- reviews escalated or disputed cases
- approves, rejects, requests more evidence, closes, or overrides refund confirmation
- monitors fee-adjustment effect through finance views

## Finance behavior

- seller commission ledger entries are never deleted
- if a refund is confirmed after commission was already charged, the system creates a negative adjustment entry
- adjustment is idempotent by case reference
- admin seller-fee view and seller finance ledger both reflect the adjustment

## Current limitations

- no bank refund API
- no automatic chargeback handling
- no Yandex return shipment API
- no legal return-policy content pack yet
