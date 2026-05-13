# Delivery Providers

## Strategy

- `CDEK` is the primary carrier for nationwide Russia e-commerce shipments.
- `Yandex` is the secondary carrier for intra-city express delivery.
- `Boxberry` and `Russian Post` remain future extensions.

This phase introduces a generic delivery foundation so seller and customer flows do not hardcode one carrier into orders.

## Modes

### Mock mode

Use mock mode for local development, CI, and default smoke verification.

- `DELIVERY_PROVIDER_MODE=mock`
- no real carrier credentials required
- returns deterministic offers and shipment lifecycle transitions

Mock mode currently simulates:
- `CDEK_PICKUP`
- `CDEK_COURIER`
- `YANDEX_EXPRESS` when enabled in shop settings

### CDEK mode

Use real CDEK mode only when all required env values are present.

- `DELIVERY_PROVIDER_MODE=cdek`
- `CDEK_DELIVERY_ENABLED=true`

Current implementation status:
- provider/client skeleton exists
- config validation exists
- real offer and shipment API calls are intentionally deferred

### Yandex mode

Yandex is prepared as a placeholder provider for a later phase.

- `DELIVERY_PROVIDER_MODE=yandex`
- `YANDEX_DELIVERY_ENABLED=true`

Current implementation status:
- provider/client placeholder exists
- config validation exists
- real shipment lifecycle is intentionally deferred

## Generic Domain Models

### `shop_delivery_settings`

Per-shop operational defaults:
- pickup address and contact
- enabled carriers
- default carrier
- default package weight and dimensions

### `delivery_offers`

Carrier quote snapshots for one order:
- provider
- offer type
- price and currency
- ETA range
- optional pickup point id
- raw provider payload

### `delivery_shipments`

Created shipment records:
- provider shipment identifiers
- internal and provider statuses
- tracking number and URL
- pickup and dropoff addresses
- timestamps such as accepted, cancelled, delivered

### `delivery_events`

Shipment event history:
- provider
- event type
- provider status
- message
- raw provider payload

## Provider Abstraction

The NestJS delivery module uses a single provider contract:

- `calculateOffers`
- `createShipment`
- `refreshShipment`
- `cancelShipment`

Current provider implementations:
- `MockDeliveryProvider`
- `CdekDeliveryProvider`
- `YandexDeliveryProvider`

## Customer-Side Surface

Public order tracking now exposes:
- delivery provider
- delivery status
- tracking number
- tracking URL

This keeps the customer tracking view stable even when the active carrier changes behind the scenes.

## Credential Safety

- Never commit `CDEK_ACCOUNT`, `CDEK_SECURE_PASSWORD`, `YANDEX_DELIVERY_TOKEN`, or `YANDEX_DELIVERY_CLIENT_ID`.
- Keep real values only in local runtime env files or secret managers.
- `.env.example` files document shape only and must not contain production credentials.
