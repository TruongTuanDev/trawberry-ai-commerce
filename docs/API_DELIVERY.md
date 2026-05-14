# Delivery API

## Scope

`backend-nest/src/modules/delivery` provides the multi-carrier foundation for seller delivery operations.

Supported providers:
- `YANDEX`
- `CDEK`
- `MANUAL` for seller-managed entries

Default strategy:
- same-city order: Yandex first, CDEK fallback
- inter-city order: CDEK first
- tests and smoke scripts use mock mode by default
- seller-managed manual delivery does not call real Yandex/CDEK APIs

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

## Seller-Managed Manual Delivery

Seller creates the real shipment outside the marketplace and saves tracking data:

`POST /api/shops/:shopId/orders/:orderId/delivery/manual`

`PATCH /api/shops/:shopId/orders/:orderId/delivery/shipments/:shipmentId/manual`

```json
{
  "provider": "YANDEX",
  "trackingNumber": "YANDEX-123",
  "trackingUrl": "https://track.example/yandex-123",
  "courierPhone": "+79991112233",
  "estimatedDeliveryAt": "2026-05-15T12:00:00.000Z",
  "deliveryNote": "Created manually in Yandex dashboard"
}
```

Seller status actions:

- `POST /api/shops/:shopId/orders/:orderId/delivery/shipments/:shipmentId/mark-in-transit`
- `POST /api/shops/:shopId/orders/:orderId/delivery/shipments/:shipmentId/mark-delivered`
- `POST /api/shops/:shopId/orders/:orderId/delivery/shipments/:shipmentId/cancel`

Manual status values:
- `NOT_CREATED`
- `CREATED_MANUALLY`
- `IN_TRANSIT`
- `DELIVERED`
- `CANCELLED`
- `FAILED`

Validation:
- seller can only operate orders in their shop
- order must be `PAID`
- seller cannot cancel `DELIVERED`
- `trackingUrl` must be a valid URL when provided

## Admin Supervision

Admins monitor all shops:

`GET /api/admin/deliveries`

Query filters:
- `status`
- `provider`
- `shopId`
- `sellerId`
- `paidWithoutDelivery=true`
- `dateFrom`
- `dateTo`

Admin actions:
- `GET /api/admin/deliveries/:deliveryShipmentId`
- `PATCH /api/admin/deliveries/:deliveryShipmentId`
- `POST /api/admin/deliveries/:deliveryShipmentId/mark-in-transit`
- `POST /api/admin/deliveries/:deliveryShipmentId/mark-delivered`
- `POST /api/admin/deliveries/:deliveryShipmentId/cancel`

`paidWithoutDelivery=true` returns paid orders with no active delivery shipment and non-terminal order status.

## Delivery Detail

`GET /api/shops/:shopId/orders/:orderId/delivery`

Returns:
- active shipment
- stored offers
- shipment events

## Refresh / Cancel

`POST /api/shops/:shopId/orders/:orderId/delivery/shipments/:shipmentId/accept`

Accepts a created shipment. In Yandex real mode this calls `claims/accept` with the stored claim id and version.

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
- customer-facing status label/message
- provider status
- provider shipment id
- tracking number
- tracking URL
- courier phone
- estimated delivery
- delivery note

## Browser UI Coverage

The Next.js seller UI exposes the delivery MVP at:
- `/seller/settings` for pickup address, pickup city, pickup contact, enabled carriers, carrier priorities, and default package dimensions
- `/seller/orders/[id]` for offer calculation, recommended offer selection, shipment creation, shipment refresh, and tracking link visibility
- `/seller/orders/[id]` for seller-managed manual delivery entry and status updates
- `/admin/deliveries` for paid-without-delivery monitoring and admin status override
- `/orders/[id]` for customer-facing delivery provider, delivery status, and tracking link

`npm run test:e2e:seller-delivery-settings` verifies these paths in mock mode. The test uses API setup for seller approval, shop/product creation, and paid order creation, then performs delivery settings and shipment operations through browser UI.
`npm run test:e2e:manual-delivery` and `npm run test:e2e:admin-delivery-supervision` verify the seller-managed delivery model.

## Real Carrier Calls

Real Yandex/CDEK calls are disabled in default verification. Carrier credentials must not be committed.

Yandex real-mode mapping:
- offer calculation: `offers/calculate`
- claim creation: `claims/create`
- claim acceptance: `claims/accept`
- refresh: `claims/info` plus `claims/tracking-links`
- cancellation: `claims/cancel-info` followed by `claims/cancel`

Enable Yandex real mode only with:

```env
DELIVERY_PROVIDER_MODE=yandex
YANDEX_DELIVERY_ENABLED=true
YANDEX_DELIVERY_TOKEN=<from Yandex Delivery account Integration tab>
YANDEX_DELIVERY_BASE_URL=https://b2b.taxi.yandex.net
```

Common real-mode failures are returned as clear API errors: invalid token, inactive billing/account, address validation failure, unavailable courier, expired offer, or claim status that cannot be accepted/cancelled.
# Delivery Exception API Addendum

Seller:

- `POST /api/shops/:shopId/orders/:orderId/delivery/shipments/:shipmentId/mark-failed`
- `POST /api/shops/:shopId/orders/:orderId/delivery/shipments/:shipmentId/comments`

Admin:

- `GET /api/admin/deliveries?exceptionOnly=true`
- `GET /api/admin/deliveries?status=FAILED|CANCELLED`
- `POST /api/admin/deliveries/:deliveryShipmentId/mark-failed`
- `POST /api/admin/deliveries/:deliveryShipmentId/comments`
- `PATCH /api/admin/deliveries/:deliveryShipmentId/customer-message`

`mark-failed` requires `reasonCode`. Supported codes are `CUSTOMER_UNAVAILABLE`, `WRONG_ADDRESS`, `COURIER_CANCELLED`, `SELLER_CANCELLED`, `CUSTOMER_CANCELLED`, `DAMAGED_PACKAGE`, `LOST_PACKAGE`, `DELIVERY_TIMEOUT`, and `OTHER`.

Comments use `visibility: INTERNAL | CUSTOMER_VISIBLE`. Customer-visible comments require a non-empty message and are the only comments returned by public tracking.
