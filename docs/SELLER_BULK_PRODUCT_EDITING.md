# Seller Bulk Product Editing

Seller catalog now supports bulk updates for category, price, stock, and inventory tracking without opening products one by one.

## Goal

- keep WB-imported products private in seller catalog first
- let seller fix readiness blockers in bulk
- keep publish as an explicit seller action, unless `publishIfReady=true` is sent intentionally

## Backend API

`POST /api/shops/:shopId/products/bulk-update`

```json
{
  "productIds": ["uuid-1", "uuid-2"],
  "updates": {
    "categoryId": 10,
    "price": 1990,
    "stockQuantity": 5,
    "trackInventory": true
  },
  "scope": {
    "variantMode": "MISSING_ONLY"
  },
  "publishIfReady": false
}
```

## Variant Scope

- `ALL_VARIANTS`: apply to every variant in the product
- `MISSING_ONLY`: apply only where price or stock is missing
- `FIRST_VARIANT_ONLY`: apply only to the first variant for MVP flows

## Response Shape

```json
{
  "updated": 2,
  "failed": 0,
  "items": [
    {
      "productId": "uuid-1",
      "success": true,
      "error": null,
      "readiness": {
        "ready": true,
        "blockingReasons": [],
        "catalogStatus": "READY"
      }
    }
  ]
}
```

## Seller UI

`/seller/products` now includes:

- multi-select checkboxes
- bulk toolbar for `Set category`, `Set price`, `Set stock`
- bulk lifecycle actions for `Publish selected`, `Unpublish selected`, `Archive selected`
- variant mode selector
- optional `Publish automatically if a product becomes ready`
- per-product bulk result summary

## Rules

- seller can update only products in the current shop
- archived products are rejected by bulk edit
- `categoryId` must exist
- `price > 0`
- `stockQuantity >= 0`
- bulk update does not overwrite the seller/public lifecycle unless `publishIfReady=true`

## Verification

- Backend smoke: `npm run smoke:bulk-product-edit`
- Frontend E2E: `npm run test:e2e:bulk-product-edit`
