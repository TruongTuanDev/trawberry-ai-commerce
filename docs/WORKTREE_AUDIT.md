# Worktree Audit

## Current Branch

- `main`

## Latest Commit

- `356cd1c9f3431cf6bd06fe2786bc3a7665e2b362`

## Untracked Files Found

- `frontend-next/playwright-report-artifacts/three-role-demo/.last-run.json`
- `frontend-next/playwright-report-artifacts/three-role-demo/three-role-demo-workflow-three-role-demo-workflow-video/video.webm`
- `frontend-next/tests/e2e/seller-delivery-settings.spec.ts`
- `frontend-next/tests/e2e/three-role-demo-workflow.spec.ts`

## Modified Files Found

- `.gitignore`
- `backend-nest/scripts/seed-demo.js`
- `docs/API_DELIVERY.md`
- `frontend-next/src/components/orders/seller-order-detail-page-client.tsx`
- `frontend-next/src/components/public/order-track-detail-page-client.tsx`
- `frontend-next/src/components/seller/seller-delivery-settings-page-client.tsx`
- `frontend-next/tests/e2e/full-commerce-flow.spec.ts`

## Deleted Files Found

- None.

## Files Cleaned

- Removed `frontend-next/playwright-report-artifacts/`, including:
  - `.last-run.json`
  - Playwright demo video `video.webm`

## Files Ignored

Updated root `.gitignore` for recurring test artifacts:

- `test-results/`
- `playwright-report/`
- `playwright-report-artifacts/`
- `blob-report/`
- `.playwright/`
- `*.webm`
- `trace.zip`

Existing ignore coverage already includes:

- `.env`, `.env.local`, `*.env` except examples
- `data.xlsx`
- `*.local.xlsx`

Tracked env audit found only example files:

- `ai-service/.env.example`
- `backend-nest/.env.example`
- `frontend-next/.env.example`
- `infra/.env.example`

`data.xlsx` is not tracked.

## Files Intentionally Left

These are source/docs/test changes, not artifacts. They were not removed and should be handled as a separate delivery/UI testability phase.

- `backend-nest/scripts/seed-demo.js`
  - Adds demo customer credentials to seed output and creates/updates `demo-customer@trawberry.local`.
  - Related phase: demo workflow / three-role demo.
  - Recommendation: commit with demo workflow changes if intentional; otherwise stash.

- `docs/API_DELIVERY.md`
  - Documents browser UI coverage for seller delivery settings, seller order delivery operations, and customer tracking delivery fields.
  - Related phase: delivery browser E2E coverage.
  - Recommendation: commit with delivery E2E changes if intentional; otherwise stash with the source changes.

- `frontend-next/src/components/seller/seller-delivery-settings-page-client.tsx`
  - Adds stable `data-testid` hooks to delivery settings form fields and success message.
  - Related phase: delivery browser E2E coverage.
  - Recommendation: commit with `seller-delivery-settings.spec.ts` after review.

- `frontend-next/src/components/orders/seller-order-detail-page-client.tsx`
  - Adds stable delivery-operation test hooks, selects recommended offer by default, and avoids overwriting pickup address after an active shipment exists.
  - Related phase: delivery browser E2E coverage.
  - Recommendation: commit with delivery order E2E changes after review.

- `frontend-next/src/components/public/order-track-detail-page-client.tsx`
  - Adds a delivery provider test hook for customer tracking assertions.
  - Related phase: delivery browser E2E coverage.
  - Recommendation: commit with delivery E2E changes after review.

- `frontend-next/tests/e2e/full-commerce-flow.spec.ts`
  - Uses stable delivery action message test IDs instead of broad text locators.
  - Related phase: delivery browser E2E hardening.
  - Recommendation: commit with delivery selector changes after review.

- `frontend-next/tests/e2e/seller-delivery-settings.spec.ts`
  - New untracked browser E2E for seller delivery settings and mock delivery shipment flow.
  - Related phase: delivery browser E2E coverage.
  - Recommendation: commit separately after review and relevant verification, or stash.

- `frontend-next/tests/e2e/three-role-demo-workflow.spec.ts`
  - New untracked video-oriented demo workflow with admin, seller, and customer captions.
  - Related phase: demo/video workflow.
  - Recommendation: do not commit with delivery code unless this demo workflow is intentionally part of the release; likely commit separately or keep local.

## Recommended Next Action

1. Commit only `.gitignore` and this audit document as hygiene changes.
2. Review delivery-related source/test changes as a separate unit:
   - run `npm run test:e2e:seller-delivery-settings` if the script exists or add the script with the spec
   - run `npm run test:e2e:full-commerce`
   - run `npm run lint` and `npm run build` in `frontend-next`
3. Decide whether `three-role-demo-workflow.spec.ts` is a real release test or a local video/demo asset.
4. If deferring delivery/demo work, use:

```powershell
git stash push -m "wip: delivery changes before next phase" -- backend-nest/scripts/seed-demo.js docs/API_DELIVERY.md frontend-next/src/components/orders/seller-order-detail-page-client.tsx frontend-next/src/components/public/order-track-detail-page-client.tsx frontend-next/src/components/seller/seller-delivery-settings-page-client.tsx frontend-next/tests/e2e/full-commerce-flow.spec.ts frontend-next/tests/e2e/seller-delivery-settings.spec.ts frontend-next/tests/e2e/three-role-demo-workflow.spec.ts
```
