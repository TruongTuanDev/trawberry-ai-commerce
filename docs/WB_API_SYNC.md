# Wildberries API Product Sync

WB API sync now has two explicit runtime modes:

- `mock`: deterministic fixture for local CI/default smoke
- `real`: calls Wildberries Content API with a seller's stored API key

Excel import remains separate and unchanged.

## Routes and APIs

UI:

- `/seller/import/wildberries-api`

Backend:

- `POST /api/shops/:shopId/wb-sync/credentials`
- `GET /api/shops/:shopId/wb-sync/credentials/status`
- `POST /api/shops/:shopId/wb-sync/credentials/verify`
- `DELETE /api/shops/:shopId/wb-sync/credentials`
- `POST /api/shops/:shopId/wb-sync/products`
- `POST /api/shops/:shopId/wb-sync/products/by-article`
- `GET /api/shops/:shopId/wb-sync/runs/:syncRunId`

## Real Mode Setup

Required backend env:

```env
WB_SYNC_MODE=real
WB_API_BASE_URL=https://content-api.wildberries.ru
WB_SYNC_TIMEOUT_MS=30000
WB_SYNC_PAGE_LIMIT=100
WB_SYNC_MAX_PAGES=20
WB_CREDENTIAL_ENCRYPTION_KEY=change-me-dev-wb-credential-key
```

Notes:

- `WB_SYNC_MODE=real` is the only way to call Wildberries.
- `WB_CREDENTIAL_ENCRYPTION_KEY` is required to save and read shop credentials.
- The legacy `WB_CREDENTIALS_ENCRYPTION_KEY` name is still accepted as a compatibility fallback, but new setup should use `WB_CREDENTIAL_ENCRYPTION_KEY`.
- Never commit real WB tokens to git.

## Credential Flow

1. Seller opens `/seller/import/wildberries-api`
2. Page shows current source mode: `MOCK` or `REAL`
3. Seller enters API key and clicks Save
4. Frontend calls `POST /api/shops/:shopId/wb-sync/credentials`
5. Backend trims the key, encrypts it with AES-GCM, stores `keyLast4`, and never returns the raw key
6. Seller clicks Verify connection
7. Frontend calls `POST /api/shops/:shopId/wb-sync/credentials/verify`
8. Backend calls WB `POST /content/v2/get/cards/list` with `limit=1`
9. Status card updates:
   - `connected`
   - `keyLast4`
   - `lastVerifiedAt`
   - `lastVerificationStatus`
   - `lastError`

Status response shape:

```json
{
  "connected": true,
  "hasCredentials": true,
  "keyLast4": "abcd",
  "mode": "real",
  "lastVerifiedAt": "2026-05-17T10:00:00.000Z",
  "lastVerificationStatus": "SUCCESS",
  "lastError": null
}
```

## Real WB API Call

Endpoint:

- `POST https://content-api.wildberries.ru/content/v2/get/cards/list`

Auth header:

```http
Authorization: <wb-api-key>
Content-Type: application/json
```

Request body used by the new client:

```json
{
  "settings": {
    "cursor": {
      "limit": 100
    },
    "filter": {
      "withPhoto": -1
    }
  }
}
```

Pagination:

- first page uses only `limit`
- next pages reuse WB cursor fields:
  - `updatedAt`
  - `nmID`
- fetching stops when one of these is true:
  - requested limit reached
  - response has no cards
  - cursor is incomplete for next page
  - `cursor.total` is less than page limit
  - `WB_SYNC_MAX_PAGES` reached

## No Silent Mock Fallback

Rules:

- `mock` mode returns fixture data only when `WB_SYNC_MODE != real`
- `real` mode never swaps to mock after an error
- if `WB_SYNC_MODE=real` and the seller has no saved key, backend returns:
  - `Real mode active, API key required.`
- if real WB call fails, sync returns a real safe error and the UI shows failure

## Sync All

`POST /api/shops/:shopId/wb-sync/products`

Example body:

```json
{
  "mode": "IMPORT",
  "limit": 5,
  "publishMode": "DRAFT",
  "imageMode": "REMOTE_URL"
}
```

Behavior:

- `PREVIEW`: fetch and normalize cards, no product writes
- `IMPORT`: fetch, normalize, upsert products/variants/images, persist `wb_sync_run`
- manual local price and stock are preserved on re-sync
- imported WB products do not become checkout-ready unless the local product still satisfies marketplace visibility rules

## Sync By Article / APT / vendorCode

`POST /api/shops/:shopId/wb-sync/products/by-article`

Example body:

```json
{
  "article": "APT-123",
  "mode": "PREVIEW",
  "publishMode": "DRAFT",
  "imageMode": "REMOTE_URL"
}
```

Behavior:

- exact trimmed match first
- case-insensitive vendorCode matching
- no import-all fallback when article is missing
- missing article produces warning `ARTICLE_NOT_FOUND`

## Mapping Rules

Product:

- `nmID` -> `wbNmId`, `externalProductId`
- `imtID` -> `wbImtId`
- `nmUUID` -> `wbNmUuid`
- `vendorCode` -> `sellerSku`, `wbVendorCode`
- `title` -> local/WB title
- `subjectName` -> source category name
- `photos[]` -> product images

Variant:

- `sizes[].chrtID` -> `chrtId`
- `sizes[].techSize` -> `sizeName`
- `sizes[].wbSize` -> `russianSize`
- first `skus[]` -> `wbBarcode`

Additional mapping:

- brand, dimensions, color, composition, gender
- category mapping goes through `CategoryMappingService`
- no WB price sync
- no WB stock sync

## UI Expectations

The WB API sync page must make mode and connection state explicit:

- `MOCK` or `REAL` badge
- `Mock mode active. Set WB_SYNC_MODE=real to call Wildberries.`
- `Real mode active, API key required.`
- connected status with `keyLast4`
- last verification result and sanitized last error
- verify button
- delete key button
- result panel with:
  - source mode
  - fetched/products/variants/images
  - warnings/errors
  - sync run id

## Diagnostics

`POST /api/shops/:shopId/wb-sync/credentials/verify`

Success:

```json
{
  "success": true,
  "mode": "real",
  "fetched": 1,
  "message": "WB API connection verified"
}
```

Safe failures:

- `Wildberries API rejected the token or token scope.`
- `Wildberries API rate limit reached. Please retry later.`
- `Wildberries API timeout after 30000 ms.`
- `Wildberries API returned a malformed cards response.`

## Smoke and Tests

Default mock verification:

```bash
npm run smoke:wb-api-sync
npm run test:e2e:wb-api-sync
```

Optional real verification:

```bash
WB_SYNC_MODE=real
WB_REAL_API_KEY=...
WB_REAL_TEST_ARTICLE=...
npm run smoke:wb-api-sync-real
```

Behavior of `smoke:wb-api-sync-real`:

- skips with message if `WB_SYNC_MODE != real`
- fails clearly if `WB_SYNC_MODE=real` but `WB_REAL_API_KEY` is missing
- saves shop credential through backend API
- verifies connection
- previews all
- imports all
- optionally previews/imports by article
- asserts `sourceMode=real`

## Troubleshooting

`401` or `403`

- token invalid
- token scope wrong for Content API
- wrong WB account/API key

`429`

- WB rate limit
- retry later

Empty cards

- WB account has no cards visible to the token
- current filters return no results

Article not found

- vendorCode does not match the WB card
- trimmed/case-insensitive comparison still found nothing

Credential save fails

- `WB_CREDENTIAL_ENCRYPTION_KEY` missing in backend env

Page shows `MOCK`

- backend runtime still has `WB_SYNC_MODE=mock`
- restart backend after env change

## Security

- raw WB API keys are never returned from backend
- raw WB API keys are not written to docs or git
- logs and safe errors must not expose full bearer-like strings
- UI shows only `keyLast4`
