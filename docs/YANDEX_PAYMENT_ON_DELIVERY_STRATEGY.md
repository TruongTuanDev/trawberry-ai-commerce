# Yandex Payment On Delivery Strategy

## Safe assumption

Current implementation assumes:

- manual Yandex delivery is available
- Yandex payment collection is not verified
- seller QR / SBP remains the only trusted pay-on-delivery path today

## Supported now

### `PAY_ON_DELIVERY_SELLER_QR`

- buyer selects pay on delivery at checkout
- seller accepts that payment posture
- order moves to `READY_TO_CREATE_YANDEX`
- seller creates manual Yandex delivery
- after delivery, buyer can mark payment complete with optional proof
- seller confirms or rejects final payment

This is the production-safe COD-like flow for the current phase.

## Not enabled now

### `YANDEX_CARD_ON_DELIVERY`

This is stored as a future capability only.

Status values:

- `NOT_CONFIGURED`
- `PROVIDER_PENDING`
- `AVAILABLE`
- `DISABLED`

Buyer checkout must not expose it unless the shop capability status is `AVAILABLE`.

## Explicitly unavailable

### `CASH_COURIER_COLLECTION`

- current status is `NOT_AVAILABLE`
- buyer cannot select it
- docs and UI must not imply courier cash collection is supported

## Future integration preparation

Delivery/payment persistence already reserves fields for future Yandex API mapping:

- `deliveryPaymentMethod`
- `yandexPaymentMethod`
- `yandexPaymentRefId`
- `yandexInvoiceLink`
- `yandexPaymentIsPaid`
- `yandexFiscalizationStatus`
- `yandexPaymentRawPayload`
- `yandexClaimId`
- `yandexRawStatus`
- `yandexRawPayload`

These fields are preparatory only in this phase. No real Yandex payment API call is made.
