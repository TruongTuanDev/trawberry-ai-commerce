# CDEK Delivery Notes

## Role in the Platform

`CDEK` is the primary delivery carrier for the Russia-focused commerce roadmap:
- nationwide shipping
- pickup point delivery
- courier delivery
- e-commerce friendly coverage

This MVP phase does not yet enable real CDEK requests by default. It establishes the generic delivery contract and a CDEK-first provider shape.

## Current CDEK Implementation

Implemented:
- `CdekDeliveryClient` skeleton
- `CdekDeliveryProvider` skeleton
- config validation for real mode
- mock-mode offer and shipment lifecycle through the generic provider abstraction

Deferred:
- real tariff calculation
- real order creation
- real status refresh
- pickup-point search and selection

## Required Env for Real Mode

Do not commit real values.

```env
DELIVERY_PROVIDER_MODE=cdek
CDEK_DELIVERY_ENABLED=true
CDEK_API_BASE_URL=
CDEK_ACCOUNT=
CDEK_SECURE_PASSWORD=
CDEK_TIMEOUT_MS=30000
CDEK_DEFAULT_CURRENCY=RUB
CDEK_DEFAULT_TARIFF_CODE=
```
