# WB Real API Sync Audit

Date: 2026-05-17

Scope:

- `backend-nest/src/modules/wb-sync`
- `frontend-next/src/app/seller/import/wildberries-api`
- `frontend-next/src/lib/seller-api.ts`
- runtime env examples and Docker wiring
- legacy WB code read-only for comparison

## Executive Summary

Before hardening, the repo already had a WB sync foundation, but the real-mode credential flow still had a few weak points:

- verification metadata was too thin
- credential disconnect/update flow was incomplete
- `sync by article` depended on the currently fetched page only
- UI wording was too easy to misread as "mock only"
- docs did not make it explicit enough that real sync must use the selected shop's stored credential

After this pass:

- each shop keeps its own encrypted WB API key in `shop_wb_credentials`
- seller UI can save, update, verify, and disconnect that key
- real sync uses the selected shop credential from DB
- `WB_REAL_API_KEY` is only a smoke helper, not the runtime credential source
- real mode does not fall back to mock

## Audit Answers

1. Real mode is enabled by which env?

- `WB_SYNC_MODE=real`

2. Where is the API key stored?

- table `shop_wb_credentials`
- encrypted field `encrypted_api_key`
- display-only field `key_last4`

3. Does the UI "Save WB API key" really call backend?

- yes
- frontend calls `POST /api/shops/:shopId/wb-sync/credentials`

4. Is the credential encrypted?

- yes
- AES-256-GCM
- primary env: `WB_CREDENTIAL_ENCRYPTION_KEY`
- compatibility fallback: `WB_CREDENTIALS_ENCRYPTION_KEY`

5. Does backend really call the WB API?

- yes, when `WB_SYNC_MODE=real`
- endpoint used: `POST {WB_API_BASE_URL}/content/v2/get/cards/list`

6. If `WB_SYNC_MODE=real` but the shop has no credential, does the system fail clearly or fall back to mock?

- fail clearly
- current safe error: `WB_CREDENTIAL_MISSING: Real mode active, this shop needs its own WB API key.`
- no mock fallback

7. Is the `/content/v2/get/cards/list` request body correct?

- yes, it now follows the cursor-based Content API shape:

```json
{
  "settings": {
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

8. Is the `Authorization` header correct?

- yes
- `Authorization: <wb-api-key>`

9. Is pagination/cursor handled?

- yes
- next pages use `updatedAt` and `nmID`
- bounded by requested limit and `WB_SYNC_MAX_PAGES`

10. Does `sync by article` filter from real data or mock?

- `mock` mode: deterministic fixture
- `real` mode: cards fetched from the real WB API, then filtered by trimmed/case-insensitive `vendorCode`

11. Do logs expose the token?

- no intentional raw-token logging remains in the hardened path
- safe error sanitizer masks bearer-like strings
- UI and API responses never return the raw key

12. Why might a user still see "disconnected" even though they have a real WB key?

- backend is still running with `WB_SYNC_MODE=mock`
- seller saved the key on a different selected shop
- backend env lost `WB_CREDENTIAL_ENCRYPTION_KEY`, so stored credential cannot be read
- seller never clicked Save after entering the key

13. Checklist to save a key and run real sync

1. Set backend env:
   - `WB_SYNC_MODE=real`
   - `WB_API_BASE_URL=https://content-api.wildberries.ru`
   - `WB_CREDENTIAL_ENCRYPTION_KEY=...`
2. Restart backend
3. Login as an approved seller
4. Open `/seller/import/wildberries-api`
5. Select the target shop
6. Confirm the page says `REAL`
7. Save the WB API key
8. Click Verify connection
9. Confirm `lastVerificationStatus=SUCCESS`
10. Run Preview all or Sync all
11. Optionally run Preview by article or Sync by article

## Runtime Findings

- Mock mode remains the default for CI/default smoke.
- Real mode is now explicit and shop-scoped.
- Product import still does not sync WB price or stock.
- Manual local price and stock remain preserved on re-sync.

## Current Limitations

- no real WB price sync
- no real WB stock sync
- no download-to-storage image mode
- category mapping remains marketplace-local and basic
- default Playwright suite remains mock-only by design

## Recommended Next Phase

- add incremental sync with persisted per-shop cursor/watermark
- add seller-facing sync history and diff preview
- add richer per-card diagnostics for partial import failures
