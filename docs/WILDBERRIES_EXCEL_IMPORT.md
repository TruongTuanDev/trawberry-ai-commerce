# Wildberries Excel Import

Seller product import from a Wildberries `.xlsx` export.

## Scope
- Source sheet: `Товары`.
- Header row: `3`.
- Data starts: auto-detected after the header. The audited Wildberries export has help text on row `4` and product data starting on row `5`.
- Rows are grouped into products by `Артикул продавца`, then `Артикул WB`, then product name + color fallback.
- Each grouped row becomes a variant/size.
- `Фото` is split by `;` and stored as remote URLs in the MVP.
- Local `data.xlsx` is a private reference export for audit only and must not be committed.

## Audited Wildberries Layout
- Workbook sheets observed locally: `Товары`, `Инструкция`.
- Product sheet range observed locally: `A1:CT42`.
- Header row: `3`.
- Row `4`: Wildberries help/instruction cells.
- First product data row: `5`.
- The product sheet can include merged group headers and hidden columns; parser maps by normalized header text instead of column index.

## Supported Columns
- `Группа`
- `Артикул продавца`
- `Артикул WB`
- `Наименование`
- `Категория продавца`
- `Бренд`
- `Описание`
- `Фото`
- `Видео`
- `КИЗ`
- `Вес с упаковкой (кг)`
- `Пол`
- `Состав`
- `Цвет`
- `Баркоды`
- `Размер`
- `Рос. размер`
- `Цена`
- `Вес товара с упаковкой (г)`
- `Высота упаковки`
- `Длина упаковки`
- `Ширина упаковки`

Header matching trims text, lowercases it, collapses duplicate spaces, tolerates `ё`/`е`, and supports small aliases such as `Артикул ВБ`, `Баркод`, and `Фотографии`.

## Backend Endpoints
All endpoints require seller auth and shop access. Only `APPROVED` sellers can import.

### Preview
`POST /api/shops/:shopId/imports/wildberries/preview`

Multipart fields:
- `file`: `.xlsx`
- `defaultStockQuantity`: optional number, default `0`
- `publishMode`: `DRAFT | ACTIVE`, default `DRAFT`
- `imageMode`: `REMOTE_URL | DOWNLOAD_TO_STORAGE`; MVP currently supports `REMOTE_URL`
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
