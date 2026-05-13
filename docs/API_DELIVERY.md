# Delivery API

## Scope

This document describes the generic multi-carrier delivery foundation implemented in `backend-nest`.

Current scope includes:
- seller shop delivery settings
- delivery offer calculation
- shipment creation
- shipment refresh
- shipment cancellation
- customer tracking visibility for provider and tracking data

Current scope does not include:
- real carrier calls in default test mode
- pickup-point selection UI
- webhook ingestion from carriers
- multi-shipment per order
- warehouse or multi-location fulfillment

## Provider Model

Supported provider codes in this phase:
- `CDEK`
- `YANDEX`

Runtime selection:
- `DELIVERY_PROVIDER_MODE=mock`
- `DELIVERY_PROVIDER_MODE=cdek`
- `DELIVERY_PROVIDER_MODE=yandex`

Default verified mode for smoke/tests:
- `mock`

## Seller Endpoints

All endpoints below require:
- authentication
- `JwtAuthGuard`
- `ShopAccessGuard`
- the order must belong to the shop

### `GET /api/shops/:shopId/delivery/settings`

Return current shop delivery settings.

### `PATCH /api/shops/:shopId/delivery/settings`

Create or update shop delivery settings.

Request body:

```json
{
  "pickupAddress": "ул. Ленина, 10",
  "pickupCity": "Moscow",
  "pickupPostalCode": "101000",
  "pickupPhone": "+79990000001",
  "pickupContactName": "Demo Seller",
  "enabledCarriers": ["CDEK", "YANDEX"],
  "defaultCarrier": "CDEK",
  "defaultWeight": 0.7,
  "defaultLength": 20,
  "defaultWidth": 15,
  "defaultHeight": 8
}
```

Validation:
- pickup address, phone, and contact are required
- at least one carrier must be enabled
- default carrier must belong to enabled carriers
- dimensions and weight must be positive

### `POST /api/shops/:shopId/orders/:orderId/delivery/offers`

Calculate delivery offers for an order.

Request body:

```json
{
  "carriers": ["CDEK", "YANDEX"],
  "package": {
    "weightKg": 0.7,
    "lengthCm": 20,
    "widthCm": 15,
    "heightCm": 8
  }
}
```

Behavior:
- validates shop delivery settings
- validates customer phone/address on the order
- fills missing package values from shop settings defaults
- stores fresh rows in `delivery_offers`

### `POST /api/shops/:shopId/orders/:orderId/delivery/shipments`

Create one shipment for a paid order.

Request body:

```json
{
  "selectedOfferId": "uuid",
  "provider": "CDEK",
  "offerType": "CDEK_PICKUP",
  "package": {
    "weightKg": 0.7,
    "lengthCm": 20,
    "widthCm": 15,
    "heightCm": 8
  }
}
```

Validation:
- order `paymentStatus` must be `PAID`
- shop delivery settings must exist
- order must have customer address and phone
- only one active shipment per order is allowed

### `GET /api/shops/:shopId/orders/:orderId/delivery`

Return delivery detail for the order.

Includes:
- stored offers
- latest shipment
- shipment events

### `POST /api/shops/:shopId/orders/:orderId/delivery/shipments/:shipmentId/refresh`

Refresh shipment status from the active provider.

### `POST /api/shops/:shopId/orders/:orderId/delivery/shipments/:shipmentId/cancel`

Cancel a shipment.

Request body:

```json
{
  "reason": "Customer changed delivery preference"
}
```

## Mock Mode Behavior

Mock mode is the verified default.

Offer calculation can return:
- `CDEK_PICKUP`
- `CDEK_COURIER`
- `YANDEX_EXPRESS` if enabled in shop settings

Shipment creation returns:
- provider shipment id
- tracking number
- tracking URL
- initial internal status such as `CREATED`

Refresh returns a later status such as `IN_TRANSIT`.

Cancel returns a terminal status such as `CANCELLED`.

## Customer Tracking Projection

Customer order tracking reads the latest shipment and exposes:
- `provider`
- `status`
- `providerShipmentId`
- `trackingNumber`
- `trackingUrl`

## Runtime Verification

Coverage currently includes:
- `backend-nest/test/delivery.e2e-spec.ts`
- `backend-nest/scripts/smoke-delivery.ps1`
