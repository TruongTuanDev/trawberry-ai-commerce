# WB Legacy Successful Flow Audit

Date: 2026-05-17

Scope reviewed:

- `strawberry-backend/src/main/java/com/strawberry/ecommerce/wb/*`
- `strawberry-backend/src/main/java/com/strawberry/ecommerce/sync/*`
- `strawberry-backend/src/main/java/com/strawberry/ecommerce/catalog/*`
- `strawberry-frontend/src/app/core/api/seller-wb-api.service.ts`
- `strawberry-frontend/src/app/core/api/seller-sync-api.service.ts`
- `strawberry-frontend/src/app/features/seller/settings/shop-settings.component.ts`
- `strawberry-frontend/src/app/features/seller/sync/*`
- `strawberry-frontend/src/app/core/services/shop-context.service.ts`

## Executive Summary

The legacy project split Wildberries into two flows:

- integration settings:
  - save one encrypted WB API key per shop
  - edit it from seller shop settings
- sync operations:
  - trigger full or incremental sync for the selected shop
  - use the stored encrypted key
  - fetch WB cards through `/content/v2/get/cards/list`
  - map WB cards into product, variant, image, and characteristic tables

The legacy system did not expose a dedicated "verify credential" endpoint. The stored credential was effectively verified by trying a real sync.

## 1. Legacy endpoint that calls WB

Backend file:

- `strawberry-backend/src/main/java/com/strawberry/ecommerce/wb/client/WildberriesApiClient.java`

Legacy WB endpoint:

- `POST https://content-api.wildberries.ru/content/v2/get/cards/list`

## 2. Legacy Authorization header format

Legacy sets:

- `Authorization: <decryptedApiKey>`

It does not prepend `Bearer`.

## 3. Legacy request body for `/content/v2/get/cards/list`

Legacy DTO:

- `strawberry-backend/src/main/java/com/strawberry/ecommerce/wb/dto/WbCardsRequestDto.java`

Observed default body shape:

```json
{
  "settings": {
    "sort": {
      "ascending": true
    },
    "cursor": {
      "limit": 100,
      "updatedAt": "...",
      "nmID": 123
    },
    "filter": {
      "withPhoto": -1
    }
  }
}
```

Key detail:

- legacy includes `sort.ascending=true` by default
- cursor uses `limit`, then `updatedAt` and `nmID` on later pages

## 4. Legacy pagination and cursor handling

Legacy sync loop:

- `CatalogSyncService.executeSyncWithMetrics`

Behavior:

- call WB cards list
- stop if `cards` is empty
- process all cards from the page
- if `cards.size() < limit`, stop
- otherwise update request cursor:
  - `updatedAt = response.cursor.updatedAt`
  - `nmID = response.cursor.nmID`
- sleep `600ms` between pages
- persist last cursor back to `shop_wb_integrations`

Important differences from new code:

- legacy persists a cursor watermark in the integration row
- legacy full/incremental sync are separate concepts
- legacy incremental uses the stored cursor if present

## 5. Legacy verify connection behavior

Legacy has no dedicated verify endpoint.

Closest successful legacy behavior:

- seller saves API key via:
  - `PUT /api/v1/seller/shops/{shopId}/api-key`
- later a full or incremental sync is triggered via:
  - `POST /api/v1/seller/shops/{shopId}/sync/full`
  - `POST /api/v1/seller/shops/{shopId}/sync/update`
- if the key is wrong, the real sync job fails

Implication for the new system:

- new dedicated verify endpoint is an architectural improvement
- but the actual WB call used for verify should match the legacy cards-list call closely

## 6. Legacy credential storage

Legacy entity:

- `ShopWbIntegration`

Legacy table:

- `shop_wb_integrations`

Important fields:

- `shop_id` unique
- `api_key_encrypted`
- `is_active`
- `last_cursor_updated_at`
- `last_cursor_nm_id`
- `last_sync_at`
- `last_sync_status`
- `last_error_message`
- `sync_interval_minutes`
- `is_sync_paused`

Legacy encryption:

- `EncryptionUtils`
- plain AES with a shared secret from config
- no plaintext fallback

Legacy save flow:

- `WbIntegrationService.updateIntegration`
- encrypt key
- upsert by `shopId`
- mark `isActive=true`

## 7. Legacy frontend backend routes

Legacy frontend API routes:

- `GET /api/v1/seller/shops/{shopId}/integration`
- `PUT /api/v1/seller/shops/{shopId}/api-key`
- `GET /api/v1/seller/shops/{shopId}/sync/stats`
- `GET /api/v1/seller/shops/{shopId}/sync/history`
- `POST /api/v1/seller/shops/{shopId}/sync/full`
- `POST /api/v1/seller/shops/{shopId}/sync/update`
- `PUT /api/v1/seller/shops/{shopId}/sync/settings`

Legacy shop selection:

- shop context comes from the route:
  - `/seller/shops/:shopId/...`

This is important because it reduces the risk of sending requests for the wrong shop.

## 8. Legacy mapping card -> product / variant / image

Legacy mapping files:

- `CatalogSyncService`
- `WbCatalogMapper`

Product core mapping:

- `nmID` -> `wbNmId`
- `imtID` -> `wbImtId`
- `nmUUID` -> `wbNmUuid`
- `subjectID` -> `subjectId`
- `subjectName` -> category name
- `vendorCode` -> `wbVendorCode`
- `brand` -> `brand`
- `title` -> `wbTitle`
- `description` -> `wbDescription`
- `video` -> `wbVideoUrl`
- `needKiz` -> `wbNeedKiz`
- dimensions -> local dimension fields
- wholesale -> local wholesale fields

Images:

- choose best URL in order:
  - `big`
  - `hq`
  - `c516x688`
- reconcile by `wbUrl`
- missing old images are removed
- new image URLs are inserted

Characteristics:

- stored as raw JSON text
- normalized text derived for simple search

Variants:

- keyed primarily by `chrtID`
- update `techSize`, `wbSize`, `isActive`
- reconcile nested SKU rows from `sizes[].skus`
- missing variants are soft-disabled, not hard-deleted

Local commercial data:

- price and stock remain local-managed defaults
- legacy does not overwrite seller-controlled price/stock from WB

## 9. Differences vs current `backend-nest` / `frontend-next`

Backend differences found before alignment:

- new code had a dedicated verify endpoint, legacy did not
- new code initially used a minimal cards-list body without `sort`
- legacy includes `sort.ascending=true` by default
- legacy sync stored cursor watermark in the integration row
- new code stores verification metadata but not persistent cursor watermark
- legacy integration and sync were two modules; new code combines them under `wb-sync`

Frontend differences found before alignment:

- legacy key entry lived in seller shop settings
- legacy shop context came from route `/seller/shops/:shopId/...`
- new frontend uses a selected shop store instead of route-derived shop context
- legacy had no explicit verify button; new UI adds one

## 10. Likely failure causes in the new project

- backend runtime still in `WB_SYNC_MODE=mock`
- wrong selected `shopId` in the new frontend store
- missing `WB_CREDENTIAL_ENCRYPTION_KEY` in runtime
- docker-compose injecting a fallback key and hiding config mistakes
- request body mismatch vs the working legacy call
- adding `Bearer` to the WB Authorization header
- decrypt failure after changing the encryption key between save and verify
- saving credential correctly but verifying against another shop
- token lacks WB Content API scope
- safe error handling too generic, hiding whether the real failure was `400`, `401`, `403`, or `429`

## Practical Conclusions For `backend-nest` / `frontend-next`

- keep per-shop encrypted credential storage
- keep `Authorization: <apiKey>` with no `Bearer`
- use the legacy cards-list body shape by default:
  - include `sort.ascending=true`
  - include `filter.withPhoto=-1`
  - use cursor `limit`, `updatedAt`, `nmID`
- keep manual local price/stock untouched on sync
- keep article matching based on trimmed, case-insensitive `vendorCode`
- make shop selection explicit and safe in the new frontend
- preserve mock mode for CI, but never let it pretend to verify a real WB key
