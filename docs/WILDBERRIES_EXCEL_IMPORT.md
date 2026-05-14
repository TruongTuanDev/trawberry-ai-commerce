# Wildberries Excel Import

Seller product import from a Wildberries `.xlsx` export.

## Scope
- Source sheet: `Товары`.
- Header row: `3`.
- Data starts: auto-detected after the header. The audited Wildberries export has help text on row `4` and product data starting on row `5`.
- Rows are grouped into products by `Артикул продавца`, then `Артикул WB`, then product name + color fallback.
- Each grouped row becomes a variant/size.
- `Фото` is split by `;` and stored as remote URLs in the MVP.
- `REMOTE_URL` is the default and recommended image mode for this phase.
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

## Image Strategy
- MVP keeps Wildberries image links as remote URLs. This is the fastest path for sellers importing an existing WB catalog.
- Image URLs are trimmed, deduped per product, and accepted only when they use `http` or `https`.
- Invalid image URLs create `INVALID_IMAGE_URL` warnings and are skipped; they do not block the import.
- The first valid image becomes the main product image. Sort order follows the valid URL order from the Excel cell.
- Confirm import stores the remote URL in product image records and does not require object storage.
- Re-import checks existing image URLs and does not create duplicates.

Risks of remote URLs:
- A Wildberries CDN URL can stop resolving or change availability outside our control.
- Image latency and caching behavior depend on the remote host.
- Public and seller UIs include an image fallback when a remote image fails to load.

Future plan:
- `DOWNLOAD_TO_STORAGE` remains a future mode. If the option appears, the import warns that it is not implemented and continues with remote URLs.
- A later phase can add background download, storage keys, retry handling, and broken-link monitoring without changing the normalized import payload shape.

## Backend Endpoints
All endpoints require seller auth and shop access. Only `APPROVED` sellers can import.

### Preview
`POST /api/shops/:shopId/imports/wildberries/preview`

Multipart fields:
- `file`: `.xlsx`
- `defaultStockQuantity`: optional number, default `0`
- `publishMode`: `DRAFT | ACTIVE`, default `DRAFT`
- `imageMode`: `REMOTE_URL | DOWNLOAD_TO_STORAGE`; default is `REMOTE_URL`. `DOWNLOAD_TO_STORAGE` is not implemented yet and falls back to remote URLs with a warning.
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
npm run smoke:wb-import-checkout
```

## Import To Checkout Flow

The verified WB import-to-checkout path is:

1. Approved seller creates an active shop.
2. Seller previews and confirms the sanitized Wildberries Excel fixture.
3. Import stores image links as `REMOTE_URL`; images are not downloaded in this phase.
4. Seller reviews imported products and updates price and stock.
5. Product becomes public when seller is approved, shop is active, product visibility is `ACTIVE`, at least one image exists, an active variant has price `> 0`, and stock is available.
6. Customer checkout uses backend-calculated totals and deducts stock immediately.
7. Re-importing the same file is idempotent for products, variants, and images.

`npm run smoke:wb-import-checkout` verifies price `1990`, stock `5`, checkout quantity `2`, total `3980`, stock after checkout `3`, insufficient-stock rejection, customer tracking, seller order/payment visibility, and same-file re-import without duplicates.
