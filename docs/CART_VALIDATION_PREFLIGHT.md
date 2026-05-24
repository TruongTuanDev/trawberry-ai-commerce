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

- Public header cart badge now counts product lines, not total summed quantity.
- Cart page and checkout still use the real per-line quantity for totals and order creation.
- Product detail quantity now supports direct numeric entry.
- Quantity input is normalized to:
  - integer only
  - minimum `1`
  - current variant stock maximum when inventory is tracked
- If customer enters more than available stock, UI clamps to stock and shows a warning toast.

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
  - for logged-in customers, also blocks submit until a saved `yandexManualReady` address is selected

## Verification

- Backend: `npm run smoke:cart-validation`
- Frontend: `npm run test:e2e:cart-validation`
