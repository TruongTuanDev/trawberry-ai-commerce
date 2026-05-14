# Worktree Audit

## Current Branch

- `main`

## Latest Commit

- `629f9d79cddb15d2ba94f71a368b20337671ff00`

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

## Delivery / Demo Workflow Review

Reviewed after cleanup commit `629f9d79cddb15d2ba94f71a368b20337671ff00`.

### Source Changes Reviewed

- `backend-nest/scripts/seed-demo.js`
  - Valid demo workflow change. Seeds `demo-customer@trawberry.local` alongside admin and seller demo accounts for browser demo playback.
  - No secrets or artifacts found.
- `docs/API_DELIVERY.md`
  - Valid delivery documentation update for seller settings, delivery offer selection, shipment creation, and customer tracking UI coverage.
- `frontend-next/src/components/orders/seller-order-detail-page-client.tsx`
  - Valid delivery UI/testability change. Adds stable test hooks, selects the recommended offer after calculation, and keeps existing shipment pickup data stable once delivery is active.
- `frontend-next/src/components/public/order-track-detail-page-client.tsx`
  - Valid customer tracking test hook for delivery provider/status assertions.
- `frontend-next/src/components/seller/seller-delivery-settings-page-client.tsx`
  - Valid seller delivery settings test hooks for browser E2E coverage.
- `frontend-next/tests/e2e/full-commerce-flow.spec.ts`
  - Valid locator hardening using the delivery action message test ID.
- `frontend-next/tests/e2e/seller-delivery-settings.spec.ts`
  - Valid browser E2E for delivery settings and mock Yandex/CDEK flow.
- `frontend-next/tests/e2e/three-role-demo-workflow.spec.ts`
  - Valid video-oriented browser E2E for admin, seller, and customer demo workflow. The admin step now opens the demo seller detail page directly by API-discovered `userId` so the test does not depend on approved seller list ordering.
- `frontend-next/package.json`
  - Valid script additions for `test:e2e:seller-delivery-settings` and `test:e2e:three-role-demo`.

### Verification Result

- Backend:
  - `npm run lint`: pass
  - `npm test -- --runInBand`: pass, 16 suites / 84 tests
  - `npm run build`: pass
  - `npm run smoke:delivery`: pass
  - `npm run smoke:checkout`: pass
  - `npm run smoke:wb-import-checkout`: pass
  - `npm run seed:demo`: pass
- Frontend:
  - `npm run lint`: pass
  - `npm run build`: pass
  - `npm run test:e2e:full-commerce`: pass
  - `npm run test:e2e:seller-delivery-settings`: pass
  - `npm run test:e2e:three-role-demo`: pass
- Docker/runtime:
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: pass, services healthy
  - `curl.exe --ipv4 http://localhost:3001/api/health`: pass
  - `curl.exe --ipv4 -I http://localhost:3000/products`: pass
  - `curl.exe --ipv4 http://localhost:8000/health`: pass

### Commit Decision

- Delivery/demo source, test, and docs changes are valid as one release-test scope.
- No `.env`, `data.xlsx`, Excel private files, or Playwright artifacts should be staged.
- Recommended commit message: `test: finalize delivery and demo workflow coverage`
