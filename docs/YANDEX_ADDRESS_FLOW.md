# Yandex-Compatible Address Flow

## 2026-05-24 Public Header + Checkout Addendum

Customer navigation now makes address setup explicit:

- public header `Address` sends guests to customer login with `next=/customer/account/addresses`
- public header `Address` sends logged-in customers directly to `/customer/account/addresses`

Checkout flow now follows this contract:

- logged-in customers must configure a saved delivery-ready address before placing an order
- checkout page shows a dedicated address configuration CTA when no ready saved address exists
- seller remains the downstream operator of manual Yandex delivery
- checkout stores the saved-address snapshot used at confirmation time into order dropoff fields

## Why this phase exists

Yandex delivery workflows need a more structured dropoff address than the legacy single-line customer address.

This phase upgrades customer addresses so the marketplace can preserve:

- a human-readable address fullname for manual seller operations
- separate access details for courier instructions
- latitude and longitude for future Yandex API readiness

No real Yandex geocoder or delivery API is called in this phase.

## Structured customer address model

Customer addresses now support:

- `country`
- `countryCode`
- `federalSubject`
- `city`
- `cityType`
- `district`
- `settlement`
- `street`
- `streetType`
- `building`
- `buildingBlock`
- `entrance`
- `intercom`
- `floor`
- `apartment`
- `comment`
- `latitude`
- `longitude`
- `geoPrecision`
- `geoProvider`
- `geoProviderUri`
- `geoRawPayload`
- `addressFullName`
- `addressShortName`

The recommended Yandex-compatible split is:

- fullname: `city + street + building`
- access details: `entrance`, `intercom`, `floor`, `apartment`, `comment`

## Geocoder posture

Supported providers in this phase:

- `MOCK`
- `MANUAL`

Future-only provider:

- `YANDEX_GEOCODER`

Default test/runtime behavior does not require any Yandex API key.

The mock provider returns deterministic Moscow suggestions so smoke tests and E2E can remain stable.

## Checkout integration

Saved customer addresses can still be selected by `addressId`.

Checkout now snapshots structured dropoff fields into the order:

- `dropoffAddressFullName`
- `dropoffCity`
- `dropoffStreet`
- `dropoffBuilding`
- `dropoffEntrance`
- `dropoffIntercom`
- `dropoffFloor`
- `dropoffApartment`
- `dropoffLatitude`
- `dropoffLongitude`
- `dropoffGeoPrecision`
- `dropoffComment`

Legacy manual/guest checkout remains available.

If coordinates are missing:

- checkout is still allowed in the current MVP
- seller workbench shows that the address is not fully API-ready
- future real Yandex claim creation can tighten this later

## Seller manual Yandex workbench

Seller order detail now exposes a clearer dropoff block:

- Yandex-friendly address fullname
- separated access instructions
- coordinates when present
- copy-ready sender / recipient / full delivery block
- Yandex-ready badge when pickup and dropoff both have coordinates

This is intentionally compatible with manual copy-paste into Yandex tools today and future API mapping later.

## Known limitations

- no real Yandex geocoding call
- no map picker
- no real Yandex Delivery API call
- coordinates can still be entered manually
- address verification remains mock/manual only in default mode

## Address readiness policy

This phase now exposes explicit readiness states:

- `yandexManualReady`
- `yandexApiReady`
- `geoReadiness.missingFields`

Operational meaning:

- saved address with no coordinates: still valid for current checkout
- manual-ready address: seller can use it in manual Yandex workbench
- API-ready address: future-safe for real Yandex claim creation

Current policy does **not** block manual checkout when coordinates are missing.
It only warns customer, seller, and admin that the address is manual-only.

## Manual Yandex completeness rules

Structured address entry now also preserves access decisions needed by a manual Yandex courier handoff:

- `entrance` or explicit `noEntrance`
- `floor` or explicit `noFloor`
- `apartment` or explicit `noApartment`

These fields are stored separately and are not folded into `addressFullName`.

This keeps the Yandex handoff copy clean:

- fullname: `city + street + building`
- access details: entrance / intercom / floor / apartment / comment
