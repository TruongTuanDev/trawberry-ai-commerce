# Wildberries Excel Import

Seller product import from a Wildberries `.xlsx` export.

## Scope
- Source sheet: `Товары`
- Header row: `3`
- Data starts: row `6`
- Rows are grouped into products by `Артикул продавца`, then `Артикул WB`, then product name + color fallback.
- Each grouped row becomes a variant/size.
- `Фото` is split by `;` and stored as remote URLs in the MVP.

## Backend Endpoints
All endpoints require seller auth and shop access. Only `APPROVED` sellers can import.

### Preview
`POST /api/shops/:shopId/imports/wildberries/preview`

Multipart fields:
- `file`: `.xlsx`
- `defaultStockQuantity`: optional number, default `0`
- `publishMode`: `DRAFT | ACTIVE`, default `DRAFT`
- `imageMode`: `REMOTE_URL | DOWNLOAD_TO_STORAGE`, MVP supports `REMOTE_URL`
- `priceFallback`: optional number

### Confirm
`POST /api/shops/:shopId/imports/wildberries/confirm`

```json
{ "importId": "uuid" }
```

### Status
`GET /api/shops/:shopId/imports/wildberries/:importId`

## Idempotency
- Products are idempotent by `shopId + sellerSku`.
- Variants are matched by barcode first, then SKU + size + Russian size.
- Images are added only if the same remote URL does not already exist for the product.
- Existing products not present in the file are not deleted.

## Visibility
When `publishMode=ACTIVE`, imported products become `ACTIVE` only if they have a priced variant, at least one image, and at least one variant. Otherwise they stay `DRAFT`.

## Fixture And Smoke
Sanitized fixture:
- `backend-nest/test/fixtures/wb-products-sample.xlsx`

Smoke:
```bash
cd backend-nest
npm run smoke:wb-import
```
