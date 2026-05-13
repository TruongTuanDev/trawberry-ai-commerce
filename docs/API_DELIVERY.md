# Delivery API

## Scope

`backend-nest/src/modules/delivery` provides the multi-carrier foundation for seller delivery operations.

Supported providers:
- `YANDEX`
- `CDEK`

Default strategy:
- same-city order: Yandex first, CDEK fallback
- inter-city order: CDEK first
- tests and smoke scripts use mock mode by default

## Settings

`GET /api/shops/:shopId/delivery/settings`

`PATCH /api/shops/:shopId/delivery/settings`

```json
{
  "pickupCountry": "RU",
  "pickupCity": "Moscow",
  "pickupAddress": "Tverskaya 1",
  "pickupPostalCode": "101000",
  "pickupContactName": "Delivery Ops",
  "pickupContactPhone": "+74950000000",
  "pickupWorkingHours": "10:00-19:00",
  "pickupComment": "Call before arrival",
  "enabledCarriers": ["YANDEX", "CDEK"],
  "defaultCarrier": "YANDEX",
  "sameCityPreferredCarrier": "YANDEX",
  "interCityPreferredCarrier": "CDEK",
  "fallbackCarrier": "CDEK",
  "defaultWeightGram": 1200,
  "defaultLengthCm": 30,
  "defaultWidthCm": 20,
  "defaultHeightCm": 10
}
```

Validation:
- pickup city, address, contact name, and contact phone are required
- enabled carriers must not be empty
- default, preferred, and fallback carriers must be enabled
- package defaults must be positive

## Offers

`POST /api/shops/:shopId/orders/:orderId/delivery/offers`

```json
{
  "carriers": ["YANDEX", "CDEK"],
  "packageInfo": {
    "weightGram": 1200,
    "lengthCm": 30,
    "widthCm": 20,
    "heightCm": 10
  }
}
```

Response includes `isRecommended` on each offer.

Mock examples:
- Moscow pickup + Moscow customer: `YANDEX_EXPRESS` recommended, `CDEK_COURIER` fallback
- Moscow pickup + Kazan customer: `CDEK_COURIER` recommended, `CDEK_PICKUP` optional

## Shipments

`POST /api/shops/:shopId/orders/:orderId/delivery/shipments`

```json
{
  "selectedOfferId": "uuid",
  "provider": "YANDEX",
  "packageInfo": {
    "weightGram": 1200,
    "lengthCm": 30,
    "widthCm": 20,
    "heightCm": 10
  }
}
```

Rules:
- order must belong to the shop
- order `paymentStatus` must be `PAID`
- one active shipment per order
- order must have customer phone and address
- shop delivery settings must be configured

## Delivery Detail

`GET /api/shops/:shopId/orders/:orderId/delivery`

Returns:
- active shipment
- stored offers
- shipment events

## Refresh / Cancel

`POST /api/shops/:shopId/orders/:orderId/delivery/shipments/:shipmentId/refresh`

`POST /api/shops/:shopId/orders/:orderId/delivery/shipments/:shipmentId/cancel`

Cancel body:

```json
{
  "reason": "Customer changed delivery preference"
}
```

## Customer Tracking

Public order tracking exposes latest delivery projection:
- provider
- status
- provider shipment id
- tracking number
- tracking URL

## Real Carrier Calls

Real Yandex/CDEK calls are disabled in default verification. Carrier credentials must not be committed.
