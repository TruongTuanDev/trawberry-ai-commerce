# Yandex Address Readiness

## 2026-05-24 Checkout Enforcement Addendum

Operational rule for the current marketplace:

- guest/manual checkout can still use the existing anonymous delivery form
- authenticated customer checkout must use a saved customer address
- that saved address must be `yandexManualReady`

Meaning:

- customer account addresses are now the source of truth for Yandex delivery readiness at checkout
- frontend may warn early, but backend enforcement is authoritative
- if a saved address is incomplete, checkout returns `CUSTOMER_ADDRESS_NOT_YANDEX_READY`
- if an authenticated customer does not provide `addressId`, checkout returns `CUSTOMER_ADDRESS_REQUIRED`

## Readiness levels

The marketplace now distinguishes three address states for Yandex-compatible delivery:

- `saved`: the address record exists and can still be used by current checkout
- `manual-ready`: the address is good enough for seller-operated manual Yandex workbench
- `api-ready`: the address is precise enough for a future real Yandex Delivery API claim

## Rules

`manual-ready` requires:

- `city`
- `street`
- `building`
- recipient `fullName`
- recipient `phone`
- `entrance` or `noEntrance=true`
- `floor` or `noFloor=true`
- `apartment` or `noApartment=true`

`api-ready` requires:

- everything from `manual-ready`
- `latitude`
- `longitude`
- `geoPrecision = BUILDING | MANUAL_PIN`

Entrance, intercom, floor, apartment, and comment are optional but recommended.

## Current policy

- Current manual checkout is still allowed when coordinates are missing.
- Seller workbench must show a warning when pickup or dropoff coordinates are missing.
- Admin deliveries can filter missing-coordinate rows.
- Future `YANDEX_API` mode is not enabled in this phase.
- Real Yandex geocoder is not called in default runtime or tests.

## Why coordinates are optional now

Current delivery flow is still seller-managed manual Yandex creation.

That means:

- the seller can still copy the address into Yandex manually
- marketplace does not need to block the order just because lat/lng are missing
- the system can start collecting structured data now without breaking current operations

## Manual coordinate entry

Customer account now supports:

- manual latitude
- manual longitude
- explicit `MANUAL_PIN` precision
- clearing coordinates safely

This is a real manual data path, not a fake geocoder or fake map integration.

## Reminder for future API enablement

Current manual Yandex checkout still allows operation without coordinates only because sellers are creating deliveries manually.

When a future real Yandex claim-creation phase is enabled, addresses should only be accepted for that mode when:

- `yandexApiReady=true`
- pickup coordinates are also available
