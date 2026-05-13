# Delivery Providers

## Strategy

- `YANDEX` is preferred for same-city / intra-city express orders.
- `CDEK` is preferred for inter-city delivery, pickup points, and fallback.
- If Yandex cannot return an offer for a same-city order, CDEK remains the fallback carrier.
- If both carriers are unavailable, the API should fail clearly or a later manual-delivery path can be attached.
- `Boxberry` and `Russian Post` are future providers behind the same abstraction.

The delivery module is intentionally generic so orders do not hardcode one carrier.

## Modes

### Mock mode

Default for local development, tests, CI, and smoke checks:

```env
DELIVERY_PROVIDER_MODE=mock
DELIVERY_DEFAULT_PROVIDER=yandex
DELIVERY_SAME_CITY_PREFERRED_PROVIDER=yandex
DELIVERY_INTER_CITY_PREFERRED_PROVIDER=cdek
DELIVERY_FALLBACK_PROVIDER=cdek
```

Mock mode does not call Yandex or CDEK.

Mock offer behavior:
- same city: `YANDEX_EXPRESS` recommended, `CDEK_COURIER` fallback
- inter-city: `CDEK_COURIER` recommended, `CDEK_PICKUP` optional

### Yandex mode

Only enabled when:
- `DELIVERY_PROVIDER_MODE=yandex`
- `YANDEX_DELIVERY_ENABLED=true`
- required credentials are present

Current status: provider and client skeleton exist. Real calls are reserved for a later phase.

Implemented real-mode methods:
- `offers/calculate`
- `claims/create`
- `claims/accept`
- `claims/info`
- `claims/tracking-links`
- `claims/cancel-info`
- `claims/cancel`

Get the OAuth token in Yandex Delivery business account: `dostavka.yandex.ru/account` -> Integration. The token is sent as `Authorization: Bearer <OAuth_token>` and must stay in a real local `.env` or secret manager.

### CDEK mode

Only enabled when:
- `DELIVERY_PROVIDER_MODE=cdek`
- `CDEK_DELIVERY_ENABLED=true`
- required credentials are present

Current status: provider and client skeleton exist. Real calls are reserved for a later phase.

## Real Smoke

`npm run smoke:delivery-yandex-real` skips safely unless:
- `DELIVERY_PROVIDER_MODE=yandex`
- `YANDEX_DELIVERY_ENABLED=true`
- `YANDEX_DELIVERY_TOKEN` is present

When enabled, the script creates a paid same-city order, creates a Yandex claim, accepts it, refreshes claim info, and reads tracking data. It does not print the token.

## Generic Tables

- `shop_delivery_settings`: pickup address/contact, enabled carriers, carrier priority, fallback carrier, default package dimensions.
- `delivery_offers`: provider quote snapshots, ETA, price, pickup point, `isRecommended`, and raw payload.
- `delivery_shipments`: created shipment/claim, provider ids, status, tracking number/link, pickup/dropoff addresses.
- `delivery_events`: shipment event history.

## Credential Safety

Never commit:
- `YANDEX_DELIVERY_TOKEN`
- `YANDEX_DELIVERY_CLIENT_ID`
- `CDEK_ACCOUNT`
- `CDEK_SECURE_PASSWORD`

Only `.env.example` files should be tracked.
