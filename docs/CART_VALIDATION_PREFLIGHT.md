# Cart Validation Preflight

Date: 2026-05-18

## Source Of Truth

- `frontend-next` local cart storage is only a client snapshot.
- Backend remains authoritative for:
  - public visibility
  - archived/unpublished state
  - variant ownership
  - stock availability
  - current unit price

## API

- Endpoint: `POST /api/public/cart/validate`
- Purpose: read-only preflight for `/cart` and `/checkout`
- It never mutates:
  - local cart
  - stock
  - orders

### Statuses

- `OK`
- `PRODUCT_NOT_FOUND`
- `PRODUCT_NOT_PUBLIC`
- `PRODUCT_ARCHIVED`
- `VARIANT_NOT_FOUND`
- `OUT_OF_STOCK`
- `QUANTITY_EXCEEDS_STOCK`
- `MISSING_PRICE`
- `PRICE_CHANGED`

## Frontend Behavior

- `/cart`
  - validates on load and after cart edits
  - disables checkout when blocking invalid items remain
  - exposes customer actions:
    - `Set to max`
    - `Remove`
    - `Accept new price`
- `/checkout`
  - validates again immediately before submit
  - blocks submit when blocking statuses remain
  - refreshes cart price snapshot when the backend reports `PRICE_CHANGED`

## Verification

- Backend: `npm run smoke:cart-validation`
- Frontend: `npm run test:e2e:cart-validation`
