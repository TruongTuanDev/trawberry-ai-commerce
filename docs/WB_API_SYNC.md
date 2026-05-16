# Wildberries API Product Sync

WB API Product Sync lets approved sellers sync Wildberries Content API cards into a marketplace shop without uploading Excel.

## Excel Import vs API Sync

Excel import remains available:

- `/seller/import/wildberries`
- `POST /api/shops/:shopId/imports/wildberries/preview`
- `POST /api/shops/:shopId/imports/wildberries/confirm`

API sync is available:

- `/seller/import/wildberries-api`
- `POST /api/shops/:shopId/wb-sync/products`
- `POST /api/shops/:shopId/wb-sync/products/by-article`

Excel import is file-based and can carry price/stock columns. API sync uses Content API cards and currently does not receive price or stock.

## Backend API

- `POST /api/shops/:shopId/wb-sync/credentials`
- `GET /api/shops/:shopId/wb-sync/credentials/status`
- `POST /api/shops/:shopId/wb-sync/products`
- `POST /api/shops/:shopId/wb-sync/products/by-article`
- `GET /api/shops/:shopId/wb-sync/runs/:syncRunId`

Security:

- `JwtAuthGuard`
- `ShopAccessGuard`
- seller must own the shop
- seller must be `APPROVED`
- API keys are never returned to frontend

## Modes

Environment:

- `WB_API_BASE_URL=https://content-api.wildberries.ru`
- `WB_SYNC_TIMEOUT_MS=30000`
- `WB_SYNC_PAGE_LIMIT=100`
- `WB_SYNC_MODE=mock|real`
- `WB_CREDENTIALS_ENCRYPTION_KEY` for real credential storage

Mock mode is the default and does not call Wildberries. Real mode only runs when `WB_SYNC_MODE=real`, shop credentials exist, and encryption key is configured.

## Mapping

Product:

- `vendorCode` -> `sellerSku`, `wbVendorCode`
- `nmID` -> `wbNmId`, `externalProductId`
- `imtID` -> `wbImtId`
- `nmUUID` -> `wbNmUuid`
- `title` -> `wbTitle`, `localTitle`
- `description` -> `wbDescription`, `localDescription`
- `brand` -> `brand`
- `subjectName` -> `categoryName`
- `subjectID` -> `subjectId`
- selected characteristics -> gender, composition, color

Variant:

- `sizes[].chrtID` -> `chrtId`
- `sizes[].techSize` -> `techSize`, `sizeName`
- `sizes[].wbSize` -> `wbSize`, `russianSize`
- first `sizes[].skus[]` -> `wbBarcode`

Images:

- `REMOTE_URL` only
- first image is main
- re-sync does not duplicate existing URLs

## Import Behavior

- idempotent by shop + sellerSku, wbNmId, or externalProductId
- variants upsert by barcode, chrtId, or size tuple
- products missing from WB response are not deleted
- manual price and stock are preserved on re-sync because cards API has no price/stock

Warnings include missing article, nmID, image, barcode, size, price, and stock.

## Verification

- Backend smoke: `npm run smoke:wb-api-sync`
- Frontend E2E: `npm run test:e2e:wb-api-sync`

Both use mock mode and do not call the real WB API.
