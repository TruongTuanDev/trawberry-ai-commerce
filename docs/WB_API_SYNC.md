# Wildberries API Product Sync

The backend WB API sync integration has two runtime modes:

- `mock`: deterministic fixture for local CI/default smoke
- `real`: calls Wildberries Content API with the selected shop's stored API key

The Seller production UI does not expose or activate mock mode. When the backend reports mock mode, Seller actions are blocked and the integration is shown as unavailable. Mock remains an internal automated-test facility.

Excel import remains separate and unchanged.

WB API sync follows the same catalog curation workflow as Excel import: new products are stored in the seller catalog as `IMPORTED`, remain private, and require manual publish before they appear on `/products`.

## Routes and APIs

Reference audit:

- `docs/WB_LEGACY_SUCCESSFUL_FLOW_AUDIT.md`

UI:

- `/seller/import/wildberries-api`

Backend:

- `POST /api/shops/:shopId/wb-sync/credentials`
- `GET /api/shops/:shopId/wb-sync/credentials/status`
- `GET /api/shops/:shopId/wb-sync/diagnostics`
- `POST /api/shops/:shopId/wb-sync/credentials/verify`
- `DELETE /api/shops/:shopId/wb-sync/credentials`
- `POST /api/shops/:shopId/wb-sync/products`
- `POST /api/shops/:shopId/wb-sync/products/by-article`
- `POST /api/shops/:shopId/wb-sync/products/by-codes`
- `GET /api/shops/:shopId/wb-sync/runs/:syncRunId`

## Real Mode Setup

Required backend env:

```env
WB_SYNC_MODE=real
WB_API_BASE_URL=https://content-api.wildberries.ru
WB_SYNC_TIMEOUT_MS=30000
WB_SYNC_PAGE_LIMIT=100
WB_SYNC_MAX_PAGES=20
WB_CREDENTIAL_ENCRYPTION_KEY=change-me-local-wb-credential-key
```

Notes:

- `WB_SYNC_MODE=real` is the only way to call Wildberries.
- `WB_CREDENTIAL_ENCRYPTION_KEY` is required to save and read shop credentials.
- Docker must not silently inject a fallback encryption key. If the env is blank, save/verify must fail clearly.
- The legacy `WB_CREDENTIALS_ENCRYPTION_KEY` name is still accepted as a compatibility fallback, but new setup should use `WB_CREDENTIAL_ENCRYPTION_KEY`.
- `WB_REAL_API_KEY` is not a production runtime credential source. It is only a local smoke helper used to save a per-shop credential through the API.
- Never commit real WB tokens to git.
- Runtime seller flow is aligned with the working legacy call format:
  - `Authorization: <wb-api-key>`
  - `settings.sort.ascending=true`
  - `settings.filter.withPhoto=-1`
  - cursor fields `limit`, `updatedAt`, `nmID`

## Credential Flow

1. Seller opens `/seller/import/wildberries-api`
2. Page shows whether the real Wildberries integration is ready without exposing internal runtime-mode controls
3. Seller enters API key and clicks Save
4. Frontend calls `POST /api/shops/:shopId/wb-sync/credentials`
5. Backend trims the key, encrypts it with AES-GCM, stores `keyLast4`, and never returns the raw key
6. Seller clicks Verify connection
7. Frontend calls `POST /api/shops/:shopId/wb-sync/credentials/verify`
8. Backend loads the encrypted key from DB, decrypts it, and calls WB `POST /content/v2/get/cards/list` with `limit=1`
9. Status card updates:
   - `connected`
   - `keyLast4`
   - `lastVerifiedAt`
   - `lastVerificationStatus`
   - `lastVerificationError`
10. Frontend clears the password input after save and re-fetches status after save, verify, and delete

## Catalog Curation After Sync

- `POST /api/shops/:shopId/wb-sync/products`
- `POST /api/shops/:shopId/wb-sync/products/by-article`
- `POST /api/shops/:shopId/wb-sync/products/by-codes`

These endpoints now:

- use the selected shop's encrypted DB credential in real mode
- keep mock mode only for CI/default tests
- create new products as `source=WILDBERRIES_API`, `catalogStatus=IMPORTED`, `visibility=DRAFT`
- preserve already published products on re-sync instead of forcing unpublish
- avoid overwriting manual seller price and stock

Seller must review and publish products from `/seller/products` before they become public.

Seller can now use `/seller/products` bulk editing to set category, price, and stock for many imported WB API products before bulk publishing them.

Status response shape:

```json
{
  "connected": true,
  "hasCredentials": true,
  "keyLast4": "abcd",
  "mode": "real",
  "lastVerifiedAt": "2026-05-17T10:00:00.000Z",
  "lastVerificationStatus": "SUCCESS",
  "lastVerificationError": null,
  "canAttemptRealVerify": true,
  "missingConfig": []
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

If WB rejects the minimal body with HTTP `400`, the client retries once with:

```json
{
  "settings": {
    "cursor": {
      "limit": 100
    },
    "filter": {
      "withPhoto": -1
    },
    "sort": {
      "ascending": false
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
- `mock` mode does not pretend to verify the real WB API; verify returns `WB_MOCK_MODE_ACTIVE`
- if `WB_SYNC_MODE=real` and the seller has no saved key, backend returns:
  - `WB_CREDENTIAL_MISSING: Real mode active, this shop needs its own WB API key.`
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

## Sync Selected Products By WB Article / nmID

`POST /api/shops/:shopId/wb-sync/products/by-codes`

Example body:

```json
{
  "codes": "1013414108,123456789",
  "mode": "IMPORT",
  "publishMode": "DRAFT",
  "imageMode": "REMOTE_URL"
}
```

Parsing and matching:

- separators: comma, semicolon, carriage return, or new line
- surrounding whitespace is trimmed
- only numeric `Артикул WB / nmID` values are valid
- numeric duplicates are canonicalized without converting them to JavaScript `Number`, while the first original token is preserved for reporting
- maximum input length is `5000` characters and maximum unique code count is `100`
- real mode retrieves WB Cards List pages and filters exact requested `card.nmID` values locally
- mock mode applies the same exact nmID matching contract for deterministic tests
- `vendorCode` is not used for selected-product matching
- all-invalid selected input fails before card retrieval; selected sync never calls or falls back to sync-all

Selected-code responses include `requestedCodes`, `requestedCount`, `normalizedNmIds`, `matchedNmIds`, `syncedCount`, `syncedCodes`, `notFound`, `invalid`, `skipped`, `errors`, and the persisted WB sync `run`.

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

The WB API sync page must make the real integration and connection state clear without exposing internal simulation controls:

- integration ready or unavailable state
- mock/internal runtime state is presented as unavailable and all Seller sync/verify actions remain disabled
- `Connected with key ending ****1234.`
- connected status with `keyLast4`
- last verification result and sanitized last error
- save/update API key button
- verify button disabled in mock mode
- delete key button
- result panel with:
  - source mode
  - fetched/products/variants/images
  - warnings/errors
  - sync run id

## Diagnostics

Use:

- `GET /api/shops/:shopId/wb-sync/credentials/status`
- `GET /api/shops/:shopId/wb-sync/diagnostics`

Diagnostics example:

```json
{
  "mode": "real",
  "shopId": "shop-123",
  "hasCredential": true,
  "connected": true,
  "keyLast4": "1234",
  "lastVerifiedAt": "2026-05-17T10:00:00.000Z",
  "lastVerificationStatus": "FAILED",
  "lastVerificationError": "WB_UNAUTHORIZED_401: Wildberries API rejected the token.",
  "canAttemptRealVerify": true,
  "missingConfig": []
}
```

Safe verification errors:

- `WB_CREDENTIAL_MISSING`
- `WB_CREDENTIAL_DECRYPT_FAILED`
- `WB_CONFIG_MISSING`
- `WB_UNAUTHORIZED_401`
- `WB_FORBIDDEN_403`
- `WB_RATE_LIMIT_429`
- `WB_BAD_REQUEST_400`
- `WB_EMPTY_RESPONSE`
- `WB_NETWORK_TIMEOUT`

Runtime debug checklist:

1. Confirm backend runtime is actually `WB_SYNC_MODE=real`.
2. Confirm `WB_CREDENTIAL_ENCRYPTION_KEY` exists in the running backend container.
3. Confirm the seller selected the intended `shopId`.
4. Confirm the WB token has Content API access.
5. Rebuild runtime if Docker was started with old env:

```bash
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build backend-nest frontend-next
```

## Manual Real UI Test

Do not put the WB key in `.env`.

1. Edit local `infra/.env` only:
   - `WB_SYNC_MODE=real`
   - `WB_CREDENTIAL_ENCRYPTION_KEY=<local secret>`
   - optional `WB_API_BASE_URL=https://content-api.wildberries.ru`
2. Rebuild runtime:

```bash
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build backend-nest frontend-next
```

3. Login as seller.
4. Open `/seller/import/wildberries-api`.
5. Select the intended shop.
6. Enter the real WB API key.
7. Click Save.
8. Click Verify.
9. If verification succeeds:
   - run Preview all
   - run Sync all
   - run Preview/Sync by article
   - run Preview/Sync selected products by codes
10. If verification fails, inspect the safe error:
   - `401` / `403`: token or token scope
   - `400`: request body rejected by WB
   - `429`: rate limit
   - `WB_CREDENTIAL_DECRYPT_FAILED` / `WB_CONFIG_MISSING`
   - wrong selected `shopId`

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

Safe read-only real API nmID diagnostic:

```powershell
$env:WB_API_KEY="PASTE_ROTATED_TOKEN_HERE"
npm run diagnose:wb-nmids -- 955686992 982708059
Remove-Item Env:WB_API_KEY
```

- run from `backend-nest`
- rotate any token previously pasted into chat before using it
- the script calls only the WB Cards List endpoint, exact-matches `nmID`, never calls backend sync/sync-all, never writes products, and never prints the token or raw WB response
- if `WB_API_KEY` is missing, the script fails before making a network request

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
- uses `WB_REAL_API_KEY` only to save that key into the test shop through `POST /api/shops/:shopId/wb-sync/credentials`
- verifies connection
- previews all
- imports all
- optionally previews/imports by article
- asserts `sourceMode=real`
- asserts sync reads the shop credential from DB, not directly from env

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

Missing credential in real mode

- save or update the selected shop's WB API key first
- expected safe error: `WB_CREDENTIAL_MISSING`

Seller page shows the integration as unavailable

- confirm backend runtime has `WB_SYNC_MODE=real`
- restart backend after changing the runtime environment

## Security

- raw WB API keys are never returned from backend
- raw WB API keys are not written to docs or git
- logs and safe errors must not expose full bearer-like strings
- UI shows only `keyLast4`
