# WB Real API Sync Audit

Date: 2026-05-17

Scope:

- `backend-nest/src/modules/wb-sync`
- `frontend-next/src/app/seller/import/wildberries-api`
- `frontend-next/src/lib/seller-api.ts`
- runtime env examples and Docker wiring
- legacy WB code read-only for comparison

## Executive Summary

Before hardening, the project already had a WB sync foundation, but the real-mode path was incomplete for production use:

- no persisted verification status
- no explicit verify endpoint
- no delete-credential endpoint
- single-page fetch only
- by-article matched only whatever happened to be in the current page
- UI status was too generic and easy to misread as mock-only

After this pass:

- seller credential save/status/verify/delete are explicit
- real mode uses shop-scoped encrypted credentials
- `POST /content/v2/get/cards/list` is called in real mode
- cursor pagination is handled
- no silent fallback from real to mock
- sync results return real safe errors
- UI shows current mode, key state, verify status, and last sanitized error

## Audit Answers

1. Real mode hiện được bật bằng env nào?

- `WB_SYNC_MODE=real`

2. API key được lưu ở đâu?

- table `shop_wb_credentials`
- field `encrypted_api_key`
- field `key_last4`

3. UI “Save WB API key” có thật sự gọi backend không?

- yes
- frontend calls `POST /api/shops/:shopId/wb-sync/credentials`

4. Credential có được encrypt không?

- yes
- AES-256-GCM with backend env `WB_CREDENTIAL_ENCRYPTION_KEY`
- legacy env name `WB_CREDENTIALS_ENCRYPTION_KEY` is still accepted for compatibility

5. Backend có thật sự gọi WB API không?

- yes, when `WB_SYNC_MODE=real`
- endpoint used: `POST {WB_API_BASE_URL}/content/v2/get/cards/list`

6. Nếu `WB_SYNC_MODE=real` nhưng thiếu credential thì hệ thống đang fail rõ hay fallback mock?

- fail clearly
- current message: `Real mode active, API key required.`
- no mock fallback

7. Endpoint `/content/v2/get/cards/list` hiện request body đúng chưa?

- now aligned with the official Content API cursor request shape:

```json
{
  "settings": {
    "cursor": { "limit": 100, "updatedAt": "...", "nmID": 123 },
    "filter": { "withPhoto": -1 }
  }
}
```

8. Authorization header đúng chưa?

- yes
- `Authorization: <wb-api-key>`

9. Pagination/cursor đã xử lý chưa?

- yes
- next page uses cursor `updatedAt` and `nmID`
- bounded by requested limit and `WB_SYNC_MAX_PAGES`

10. Sync by article đang filter từ dữ liệu thật hay mock?

- `mock` mode: deterministic fixture
- `real` mode: filters from real fetched WB cards
- matching uses trimmed/case-insensitive `vendorCode`

11. Logs có lộ token không?

- no intentional raw-token logging remains in the hardened flow
- safe error sanitizer masks bearer-like strings
- UI never receives the raw key

12. Vì sao người dùng thấy “Not connected (mock)” dù đã có API thật?

- common causes before/after this pass:
  - backend still running with `WB_SYNC_MODE=mock`
  - API key was never actually saved for the selected shop
  - backend restarted without the encryption env and could not read saved credentials
  - seller is viewing a different shop in the shop switcher

13. Checklist để user nhập API key và sync thật

1. Set backend env:
   - `WB_SYNC_MODE=real`
   - `WB_API_BASE_URL=https://content-api.wildberries.ru`
   - `WB_CREDENTIAL_ENCRYPTION_KEY=...`
2. Restart backend
3. Login as approved seller
4. Open `/seller/import/wildberries-api`
5. Select the target shop
6. Confirm page badge says `REAL`
7. Save API key
8. Click Verify connection
9. Confirm `lastVerificationStatus=SUCCESS`
10. Run Preview all
11. Run Sync all or by article

## Runtime Findings

- Mock mode is still the default for local CI and default smoke.
- Real mode is now opt-in and explicit.
- Product import still does not sync WB price or stock.
- Manual local price/stock are preserved on re-sync.

## Current Limitations

- no real WB price sync
- no real WB stock sync
- no download-to-storage image mode
- category mapping remains marketplace-local and basic
- default Playwright suite remains mock-only by design

## Recommended Next Phase

- add incremental sync with persisted cursor/watermark per shop
- add seller-facing sync history and diff preview
- add richer per-card diagnostics for partial import failures
