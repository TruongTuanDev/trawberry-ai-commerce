# API Inventory

## Scope
This document describes the inventory / stock management MVP implemented in `backend-nest`.

Current scope includes:
- seller inventory read/update per product
- public product availability in catalog responses
- checkout stock validation and deduction
- basic low-stock visibility in the frontend

Current scope does not include:
- multi-warehouse inventory
- inventory reservations across separate carts
- purchase-order or supplier workflows
- inventory history ledger

## Inventory Model

This MVP reuses the existing `product_variants` fields:
- `stockQuantity`
- `reservedStock`

Current semantics:
- `stockQuantity` = sellable stock still available for checkout
- `reservedStock` = units already allocated to placed orders and not yet released by lifecycle transitions

Checkout behavior:
- successful checkout decrements `stockQuantity`
- successful checkout increments `reservedStock`
- order cancellation restores stock by incrementing `stockQuantity` and decrementing `reservedStock`
- delivered completion releases the reservation by decrementing `reservedStock`

## Seller Endpoints

All seller inventory endpoints require:
- JWT auth
- `ShopAccessGuard`

Base path:
- `/api/shops/:shopId/products/:productId/inventory`

### `GET /api/shops/:shopId/products/:productId/inventory`

Return inventory summary for one product and its variants.

Example response:

```json
{
  "productId": "uuid",
  "shopId": "uuid",
  "totalStockQuantity": 5,
  "totalReservedStock": 2,
  "totalAvailableQuantity": 5,
  "inStock": true,
  "variants": [
    {
      "variantId": "uuid",
      "size": "M",
      "color": "Black",
      "price": "99.00",
      "stockQuantity": 5,
      "reservedStock": 2,
      "availableQuantity": 5,
      "inStock": true
    }
  ]
}
```

### `PATCH /api/shops/:shopId/products/:productId/inventory`

Update stock for one variant, or for the first/only variant if `variantId` is omitted.

Request body:

```json
{
  "variantId": "uuid",
  "stockQuantity": 8
}
```

Rules:
- `stockQuantity >= 0`
- product must belong to the target shop
- variant must belong to the product when `variantId` is provided
- cross-shop access is rejected with `403`

## Public Product Availability

The public catalog APIs now include:
- `inStock`
- `availableQuantity`

Endpoints:
- `GET /api/public/products`
- `GET /api/public/products/:productId`

These values are derived from active variants under the product.

## Checkout Stock Enforcement

### `POST /api/checkout/orders`

Inventory rules enforced during checkout:
- requested quantity must be less than or equal to current available stock
- duplicate product lines are merged before stock validation
- stock deduction and reservation happen inside the same database transaction
- each variant update is guarded atomically to prevent oversell under concurrent checkout

Failure cases:
- out of stock: `400`
- insufficient stock for requested quantity: `400`
- stock changed during checkout: `400` with refresh/retry guidance

## Runtime Verification

Coverage includes:
- `backend-nest/test/checkout.e2e-spec.ts`
  - checkout success deducts stock
  - checkout fails when stock is insufficient
- `backend-nest/test/product.e2e-spec.ts`
  - seller inventory read/update
  - cross-shop inventory access `403`
- `backend-nest/scripts/smoke-inventory.ps1`
  - create product with stock `2`
  - checkout `1` succeeds and stock becomes `1`
  - checkout `2` fails
  - seller updates stock to `5`
  - checkout `2` succeeds and stock becomes `3`

Run:

```bash
cd backend-nest
npm run smoke:inventory
```
