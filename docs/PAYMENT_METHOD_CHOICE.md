# Payment Method Choice

## Current marketplace posture

The marketplace does not route money through platform accounts.

Current real buyer-facing methods:

- `PREPAID_SELLER_QR`
  - buyer pays seller before fulfillment by seller QR / SBP
  - buyer can upload proof
  - seller confirms before fulfillment

- `PAY_ON_DELIVERY_SELLER_QR`
  - buyer receives the parcel from Yandex courier
  - buyer then pays the seller directly by QR / SBP
  - Yandex only delivers; Yandex does not collect money in this mode
  - seller can accept the order for pay-on-delivery, create manual Yandex delivery, and confirm final payment after delivery

- `DEPOSIT_THEN_DELIVERY_PAYMENT`
  - seller can expose deposit-based checkout choice
  - current phase stores capability/settings and checkout selection
  - future phases can extend the remaining-balance flow further

Future-only methods:

- `YANDEX_CARD_ON_DELIVERY`
  - not buyer-visible unless provider status is `AVAILABLE`
  - use only after contractual/API verification

- `CASH_COURIER_COLLECTION`
  - not available
  - must not be shown as selectable buyer UX

## Validation rules

- checkout accepts only methods that every shop in the checkout supports
- if one shop does not support the selected method, checkout fails with `SHOP_PAYMENT_METHOD_NOT_SUPPORTED`
- `YANDEX_CARD_ON_DELIVERY` is rejected unless shop capability status is `AVAILABLE`
- `CASH_COURIER_COLLECTION` is always rejected in the current stack

## Seller settings

Per-shop payment settings now include:

- `allowPrepaidQr`
- `allowPayOnDeliverySellerQr`
- `allowDepositPayment`
- `depositPercent`
- `depositRequiredAboveAmount`
- `codMaxOrderAmount`
- `yandexCardOnDeliveryStatus`
- `cashCourierCollectionStatus`

## Audit note

This phase intentionally does not assume Yandex can collect cash or card money for the seller.
