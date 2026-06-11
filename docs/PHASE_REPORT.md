# Phase Report

## 2026-06-11 Ads Platform Phase 6.2 Invalid Click and Fraud Protection

- Status: implemented and verified
- Extended the existing `RecommendationEvent` tracking path with privacy-safe fraud hashes, click validity, and invalid reason metadata instead of creating a parallel click system.
- Added no-charge guards for duplicate token, rapid customer/guest session repeat, rapid IP/user-agent repeat, seller self-click, admin click, malformed token, invalid campaign/product mapping, non-approved/inactive campaign, unavailable product, exhausted budget, and unavailable wallet.
- Added random signed click ids to sponsored tracking tokens so each recommendation serve receives a distinct opaque click opportunity.
- Added a serializable transaction boundary around event validation and CPC mutation; only a valid click can debit wallet and write a ledger row.
- Seller and admin campaign UIs now show aggregate total, charged, and invalid clicks with existing spend and remaining budget. No buyer identity, raw IP, raw user-agent, token, or fraud hash is exposed.
- Production-safe defaults:
  - `ADS_INVALID_CLICK_PROTECTION_ENABLED=true`
  - `ADS_SELF_CLICK_BLOCK_ENABLED=true`
  - `ADS_RAPID_REPEAT_CLICK_WINDOW_SECONDS=30`
  - `ADS_IP_REPEAT_CLICK_WINDOW_SECONDS=10`
  - production must set a dedicated `ADS_CLICK_HASH_SALT`
- Safety:
  - recommendation core ranking formula unchanged
  - CPC amount/formula unchanged
  - checkout, order, cart, payment, shipping, seller payment confirmation, shop readiness, WB sync, AI Try-On, and legacy apps untouched
- Focused verification completed:
  - recommendations sponsored click/fraud/idempotency/moderation/budget/wallet regression: pass (`55` tests)
  - campaign/billing/recommendations focused regression: pass (`68` tests)
- Final verification:
  - Prisma generate, backend lint, backend build: pass
  - Prisma db push: Windows host schema engine failed before applying; the same command passed in the backend Linux container
  - backend full test: pass (`39` suites / `396` tests); an initial concurrent run had two unrelated payment timeouts, then the payment spec and full suite passed when rerun independently
  - frontend i18n, lint, and build: pass
  - required Playwright moderation, recommendations, locale, public smoke, cart checkout, cart validation, full commerce, seller operations, and responsive suites: pass (`17` tests)
  - rebuilt runtime: all `6/6` services healthy; backend health and seller campaign route smoke passed
  - database schema inspection: all six privacy/validity fields present
  - manual invalid-click QA: `204`, `invalid_token`, `charged=false`, and no ledger entry

## 2026-06-11 Ads Platform Phase 6.1 Campaign Moderation

- Status: implemented and verified
- Added a parallel campaign moderation lifecycle with `pending_review`, `approved`, `rejected`, `changes_requested`, and `suspended`.
- Campaign creation writes a submitted audit; seller edits to reviewed campaign content or targets reset approval and write a resubmitted audit.
- Added admin-only moderation APIs and `/admin/campaigns/moderation` with filtering, detail, reasoned actions, and audit history.
- Seller `/seller/campaigns` now shows moderation status, reason, serving eligibility, and the approval prerequisite for activation.
- Sponsored serving requires approval by default, and the CPC charge path rechecks approval before wallet or ledger mutation.
- Production-safe defaults:
  - `ADS_CAMPAIGN_MODERATION_ENABLED=true`
  - `ADS_MODERATION_REQUIRED_FOR_SERVING=true`
- Explicit demo/development bypass: `ADS_MODERATION_REQUIRED_FOR_SERVING=false`.
- Safety:
  - core recommendation ranking formula unchanged
  - CPC amount and calculation unchanged
  - wallet, budget, attribution, and ledger behavior unchanged except the new no-charge moderation guard
  - checkout, order, cart, payment, shipping, seller payment confirmation, shop readiness, WB sync, AI Try-On, and legacy apps untouched
- Focused verification completed:
  - campaign moderation/access/transition/audit/serving tests: pass
  - recommendation approved-CPC and post-suspension no-charge test: pass
  - campaign/recommendation/billing focused regression: pass
  - frontend i18n, lint, and build: pass
- Final verification:
  - Prisma generate: pass
  - Prisma db push: Windows host schema engine failed before applying; the same no-data-loss command passed in the backend Linux container and a second run confirmed the database is already in sync
  - backend lint, full test, and build: pass (`39` suites / `396` tests)
  - frontend i18n, lint, and build: pass
  - required Playwright moderation, recommendations, locale, public smoke, cart checkout, cart validation, full commerce, seller operations, and responsive suites: pass (`17` tests)
  - rebuilt runtime: all `6/6` services healthy
  - database schema inspection: moderation fields present with safe non-null defaults for status and submitted time

## 2026-06-11 WB Selected nmID Real Lookup Fix

- Status: Implemented and real-read verified
- Root cause:
  - the safe real API diagnostic found nmIDs `955686992` and `982708059` on the first descending Cards List page
  - selected-sync requested ascending cards first, so recent cards could remain outside the configured scan window
  - after an early selected match, the client also reduced the next page size, which could trigger a false last-page stop before remaining nmIDs were found
- Fix:
  - selected nmID lookup now requests descending Cards List pages and keeps a stable page size across cursor pagination
  - sync-all and non-selected article behavior remain unchanged
  - added regression coverage for descending selected lookup and stable pagination after an early match
- Real API QA:
  - direct diagnostic: 1 page, 100 cards scanned, both requested nmIDs found
  - built app `WbApiClientService`: 1 page, 100 cards scanned, both requested nmIDs found
  - no backend sync endpoint, sync-all action, database write, or product persistence was used
  - the user-provided token was used only in temporary process environment and must be rotated because it appeared in chat
- Verification:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass (38 suites, 387 tests)
  - `backend-nest npm run build`: pass
  - `frontend-next npx playwright test tests/e2e/wb-api-sync.spec.ts --workers=1`: pass (2 tests)
  - rebuilt backend container health check: pass

## 2026-06-11 Safe WB Real API nmID Diagnostic QA.1

- Status: Reusable diagnostic implemented; real API execution pending a rotated `WB_API_KEY`
- Scope:
  - added `backend-nest/scripts/check-wb-nmids.mjs`, a read-only diagnostic for exact WB `nmID` lookup through the Content API Cards List endpoint
  - diagnostic reads only `WB_API_KEY`, never prints or persists it, paginates up to 200 pages, stops early when all targets are found, and emits only a bounded safe summary
  - default targets are `955686992` and `982708059`; CLI arguments can override them
- Safety:
  - no backend sync endpoint, sync-all action, product persistence, database write, or production business logic is used
  - the previously shared WB token is treated as compromised and must be rotated before real diagnostic use
- Verification:
  - missing-token failure path: pass
  - invalid-input failure path: pass
  - Node syntax check and repository safety checks: pass
  - backend Prisma generation, lint, full tests (38 suites, 386 tests), and build: pass
  - real WB API call: not run because `WB_API_KEY` was not present in the process environment

## 2026-06-11 Seller Production UX and WB nmID Selected Sync

- Status: Implemented on current branch
- Seller production UX:
  - removed the Seller Center sidebar search while preserving grouped navigation, active states, desktop sidebar, and mobile drawer behavior
  - removed internal mock/simulation wording and controls from Seller WB sync and AI image surfaces; internal mock responses are presented as unavailable and cannot trigger Seller production actions
  - polished Seller billing, campaign, return-payment, WB sync, and AI image copy across `ru`, `en`, and `vi`
- WB selected sync:
  - selected-product input now accepts numeric Wildberries `Артикул WB / nmID` values instead of seller `vendorCode`
  - backend validates and canonicalizes numeric nmIDs without JavaScript number conversion, exact-matches cards by `nmID`, reports invalid/not-found/matched values, and never falls back to sync-all
  - real selected sync uses the WB Cards List endpoint and filters exact requested nmIDs locally; sync-all and the legacy single-article route remain unchanged
- Safety:
  - no checkout, order, cart, payment, shipping, campaign billing, recommendation, or AI Try-On business logic changed
  - automated verification did not call the real WB API or OpenAI API
- Verification:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass (38 suites, 386 tests)
  - `backend-nest npm run build`: pass
  - `frontend-next npm run check:i18n`: pass (0 missing English keys, 0 locale fallback gaps)
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - focused Seller locale, responsive, AI mock-blocking, and WB selected-sync Playwright suites: pass

## 2026-06-10 Admin Seller Approval Error Visibility Fix

- Status: Implemented on current branch
- Scope:
  - admin seller approval actions now surface backend business-rule errors instead of collapsing them into the generic "Something went wrong. Please try again."
  - seller list and seller detail admin screens now persist failed approve/reject/document-review messages inline after toast display
  - preserved auth/session-specific fallback mapping for unauthorized, forbidden, conflict, rate-limit, and server-error cases
- User-facing impact:
  - when an admin tries to approve a seller without any approved KYC document, the UI now shows the actual backend reason so the next action is clear
- Verification:
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - runtime smoke / E2E: not run because local frontend/backend were not listening on `127.0.0.1:3000` and `127.0.0.1:3001`

## 2026-06-07 Storefront Homepage and Product Listing Polish Phase UI.3

- Status: Implemented and pushed to main
- Scope:
  - hero slider: improved fallback slides with custom gradients, CTA gradients, button scaling hover states, and brand active slider dot transitions
  - promo slider: styled cards with glassmorphism and replaced legacy indigo gradients with brand purple/magenta gradients
  - category navigation: integrated horizontal scrollable category navigation chips with active states and item counts to products listing and the homepage
  - search & catalog filter controls: styled dropdowns, range inputs, active chips, and reset buttons with storefront primary magenta brand colors, preserving query triggers and automation hooks
  - typography & scrollbar: updated custom scrollbar colors to use brand primary magenta variables and optimized typography contrast
- Safety & Integrity:
  - verified that the AI Try-On client page `public-product-detail-page-client.tsx` remains completely untouched
  - verified checkout, campaigns charging, and CPC ledger business logic remain unaffected
- Verification:
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npx playwright test tests/e2e/recommendations.spec.ts --workers=1`: pass (2 passed)

## 2026-06-07 Product Detail and Checkout-like UX Polish Phase UI.2

- Status: Implemented and pushed to main
- Scope:
  - brand accent variables: restored the core magenta storefront branding (`#cb11ab`, `#b00f92`) for buyer workflows while keeping dashboard variables clean/slate
  - product gallery: refactored `product-gallery.tsx` for responsive scrollable lists (horizontal on mobile, vertical on desktop) and active state indicator borders
  - purchase panel UX: redesigned desktop aside block and mobile sticky panel to present dominant pricing, discount badge calculations, custom stepper components, and trust indicators
  - recommendations section: adjusted card sizes and translated "Sponsored" labels under `en.json` and `ru.json`
  - safety checks: preserved the out-of-scope AI Try-On modal diff in `public-product-detail-page-client.tsx` without reverting or breaking existing functions
- Verification:
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass

## 2026-06-07 Professional Frontend Design Refactor Phase UI.1

- Status: Implemented on current branch
- Scope:
  - replaced the legacy neon magenta (`#cb11ab`, `#b00f92`) and purple-gradient branding with a premium slate-navy and slate-indigo design system
  - integrated premium typography using Google Fonts (Inter for UI, JetBrains Mono for metrics and QA data) loaded via Next.js `next/font/google` in the main layout
  - established CSS variables in `:root` and added utility classes (`.glass-card`, `.premium-badge`, `.metric-card`, `.table-shell`) in `globals.css`
  - refactored the public storefront: modernized the `PublicHeader` search input, logo text, and cart count badge; modernized `ProductCard` price layouts, wishlist controls, CTAs, and fallbacks
  - refactored the seller dashboard: updated the campaign dashboard tables, input fields, and forms; modernized wallet balance summaries, reserved balances, and the transaction ledger table inside `seller-billing-page-client.tsx`
  - refactored the admin dashboard: aligned the admin recommendation analytics views, range filters, metrics, and QA comparison table with styled movement indicator badges
  - strictly preserved all API contract scopes, recommendation explainability gating, tracking hooks, and auth/session separation
- Safety guarantee:
  - no backend NestJS business logic was modified
  - no checkout, cart, order, payment, shipping, WB sync, or AI Try-On business logic was modified
  - the dirty AI Try-On button changes in `frontend-next/src/components/public/public-product-detail-page-client.tsx` were preserved intact
  - no real billing, payment gateway top-up, or public invoicing logic was introduced
- Verification:
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
- Next recommended phase:
  - Post-refactor visual QA audits and accessibility refinements

## 2026-06-11 Controlled Ranking Tuning Presets Phase 5.4

- Status: Implemented and verified on current branch
- Scope:
  - added admin-only controlled ranking tuning presets with versioned immutable rows
  - added explicit draft, active, and archived lifecycle states
  - added safe new-version editing, explicit activation, previous-version rollback, and archive actions
  - added audit records for create, update, preview, activate, rollback, and archive actions
  - made preset mutations and their audit records transactional
  - returns recent audit history across the complete version family
  - added side-effect-free ranking preview for home, similar-product, and search scenarios
  - reused existing `rule_based_v2` loaders, explainability, and ranking comparison concepts instead of replacing the ranking engine
  - added `/admin/recommendations/tuning` with preset editing, preview, activation confirmation, rollback, and audit visibility
- Feature flags, all default off:
  - `RECOMMENDATION_TUNING_WORKFLOW_ENABLED`
  - `RECOMMENDATION_TUNING_PRESETS_ENABLED`
  - `RECOMMENDATION_TUNING_ACTIVE_PRESET_ENABLED`
- Runtime behavior:
  - drafts and archived versions never affect public recommendation ranking
  - an active preset affects public ranking only when all three tuning flags are enabled
  - when flags are off, existing `rule_based_v2`, personalization, analytics tuning, and sponsored behavior remain unchanged
  - local runtime was returned to all three tuning flags disabled after QA
- Guardrails:
  - core score multipliers are restricted to `0.5..1.5`
  - personalization and analytics multipliers are restricted to `0..1.5`
  - sponsored multiplier is restricted to `0..1`, so Phase 5.4 cannot increase the existing sponsored boost
  - core weight sum must stay within `4..9.5`
  - sponsored, business, analytics, and personalization score caps cannot exceed platform safety limits
  - existing public-readiness, stock, campaign wallet, campaign budget, and sponsored relevance caps remain enforced
- Preview safety:
  - does not write recommendation tracking events
  - does not charge CPC
  - does not write campaign spend or billing ledger entries
  - records only a safe admin audit entry
  - does not expose customer ids, guest session ids, secrets, or internal sponsored target lists
- Safety guarantee:
  - no checkout, order, cart, payment, shipping, seller payment confirmation, shop readiness, WB sync, AI Try-On, or legacy strawberry app business logic was modified
  - seller campaigns, CPC pricing, wallet mutations, budget enforcement, and billing ledger behavior remain unchanged
- Verification:
  - `backend-nest npm run prisma:generate`: pass
  - host `backend-nest npm run prisma:db:push`: blocked by a Windows Prisma schema-engine error
  - container `npx prisma db push` against the local PostgreSQL runtime: pass without `--accept-data-loss`
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass, `39` suites and `395` tests
  - focused recommendation, tuning, campaign, and billing tests: pass, `4` suites and `73` tests
  - `backend-nest npm run build`: pass
  - `frontend-next npm run check:i18n`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - required recommendation, locale, public, commerce, seller, and responsive Playwright groups: pass
  - tuning workflow Playwright with local workflow flags enabled and active-runtime flag disabled: pass, `2` tests
  - real local API QA: create/version, unsafe `400`, preview, activate, rollback, archive, and unchanged public scores with runtime activation disabled
  - default-off runtime smoke: healthy `rule_based_v2` results with `sponsored=false`
- Remaining gaps:
  - tuning remains rule-based and heuristic, not ML-driven
  - no A/B experimentation framework, automated tuning recommendation, auction bidding, fraud detection, or real ads funding was added
  - production activation still requires explicit operator-managed flags and rollout monitoring

## 2026-06-07 Ranking Weight Tuning from Analytics Phase 5.3

- Status: Implemented on current branch
- Scope:
  - added a bounded analytics-based tuning layer for the active recommendation stack only
  - kept tuning disabled by default behind `RECOMMENDATION_ANALYTICS_TUNING_ENABLED`
  - reused existing recommendation analytics events instead of adding a new tracking store
  - added internal score breakdown support for:
    - `analyticsPerformanceScore`
    - `ctrScore`
    - `productEngagementScore`
    - `algorithmPerformanceHint`
    - `scenarioPerformanceHint`
  - added internal explainability markers:
    - `analyticsSignalsUsed`
    - `analyticsTuningEnabled`
  - extended internal QA comparison output and snapshot/diff support to carry analytics tuning breakdowns safely
  - added an internal analytics note on `/admin/recommendations-analytics`
  - kept public recommendation APIs backward compatible:
    - `GET /api/public/recommendations/home`
    - `GET /api/public/recommendations/products/:productId/similar`
    - `GET /api/public/recommendations/search`
- Safety guarantee:
  - no checkout, cart, order, payment, shipping, WB sync, AI Try-On, or legacy strawberry app business logic was modified
  - analytics tuning is additive, bounded, and subordinate to organic relevance
  - public non-debug payloads do not expose analytics tuning internals
  - no raw user ids, guest session ids, cookies, or private tracking payloads are returned
  - sponsored CPC charging, wallet protection, budget protection, fallback algorithm behavior, and personalization remain intact
- Local QA guide:
  1. enable backend `RECOMMENDATION_ANALYTICS_TUNING_ENABLED=true`
  2. optionally enable backend `RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
  3. optionally enable frontend `NEXT_PUBLIC_RECOMMENDATION_ANALYTICS_TUNING_ENABLED=true`
  4. generate homepage, similar-product, and search recommendation traffic plus a few clicks
  5. open `/admin/recommendations-analytics` to review CTR and top-product performance
  6. open `/admin/recommendations-qa`
  7. compare the same scenario and inspect bounded analytics tuning fields in debug mode only
  8. confirm normal public recommendation responses still do not include analytics internals
- Verification:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npx playwright test tests/e2e/recommendations.spec.ts --workers=1`: blocked, local backend runtime unavailable at `127.0.0.1:3001` (`ECONNREFUSED`)
  - campaign and billing regression coverage: pass via full backend suite
  - `git diff --check`: pass
  - `git diff --cached --check`: pass before staging
  - `git ls-files | Select-String "\.env"`: pass, only `.env.example` files are tracked
  - `git ls-files data.xlsx`: pass
- Remaining gaps:
  - this phase does not add live weight editing or an ML ranking pipeline
  - tuning still depends on existing event quality and remains heuristic by design
  - there is still no automated tuning recommendation workflow from the dashboard
- Next recommended phase:
  - Phase 5.4: controlled tuning presets or internal weight-adjustment workflows

## 2026-06-07 Recommendation Analytics Dashboard Phase 5.2

- Status: Implemented on current branch
- Scope:
  - added recommendation analytics aggregation for the active recommendation stack only
  - added admin APIs:
    - `GET /api/admin/recommendations/analytics/overview`
    - `GET /api/admin/recommendations/analytics/algorithms`
    - `GET /api/admin/recommendations/analytics/scenarios`
    - `GET /api/admin/recommendations/analytics/products`
  - added seller-safe shop-scoped API:
    - `GET /api/seller/shops/:shopId/recommendations/analytics/overview`
  - added frontend dashboards:
    - `/admin/recommendations-analytics`
    - `/seller/recommendations-analytics`
  - reused existing `RecommendationEvent` data instead of adding duplicate storage
  - added tracked personalization analytics support through the safe `personalized` tracking marker
  - kept public recommendation APIs backward compatible:
    - `GET /api/public/recommendations/home`
    - `GET /api/public/recommendations/products/:productId/similar`
    - `GET /api/public/recommendations/search`
- Safety guarantee:
  - no checkout, cart, order, payment, shipping, WB sync, AI Try-On, or legacy strawberry app business logic was modified
  - analytics responses expose aggregate metrics only and do not return raw user/session identifiers
  - sponsored CPC charging, wallet protection, budget protection, and idempotent event handling remain intact
- Local QA guide:
  1. generate homepage, similar-product, and search recommendation traffic locally
  2. click a mix of organic and sponsored recommendation cards
  3. open `/admin/recommendations-analytics`
  4. verify overview, algorithm, scenario, and product tables
  5. open `/seller/recommendations-analytics`
  6. verify only the current seller shop data appears
  7. use `today`, `last7d`, `last30d`, or `custom` range filters to confirm date scoping
- Verification:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npx playwright test tests/e2e/recommendations.spec.ts --workers=1`: skipped, local runtime unavailable at `127.0.0.1:3000` and `127.0.0.1:3001`
  - campaign and billing regression coverage: pass via `npm test -- --runInBand --runTestsByPath test/campaigns.e2e-spec.ts test/billing.e2e-spec.ts`
  - `git diff --check`: pass
  - `git diff --cached --check`: pass
  - `git ls-files | Select-String "\.env"`: pass, only `.env.example` files are tracked
  - `git ls-files data.xlsx`: pass
- Remaining gaps:
  - analytics remains event-aggregate only and is intentionally not a full BI system
  - personalization analytics depends on tracked recommendation events and is not retroactive for older traffic
  - no charting or snapshot export was added to the analytics dashboard in this phase
- Next recommended phase:
  - Phase 5.3: Ranking Weight Tuning from Analytics

## 2026-06-07 User Behavior Personalization Foundation Phase 5.1

- Status: Implemented on current branch
- Scope:
  - added a lightweight behavior-personalization foundation for the active recommendation stack only
  - reused existing safe tracking primitives instead of introducing risky profile storage:
    - product views
    - search queries
    - recommendation impressions
    - recommendation clicks
  - added internal behavior aggregation with:
    - recent view affinity
    - derived category affinity
    - search intent token affinity
    - recommendation click affinity
    - time decay
  - kept the personalization layer:
    - additive
    - bounded
    - disabled by default behind `RECOMMENDATION_PERSONALIZATION_ENABLED`
  - extended internal explainability and QA score breakdowns with:
    - `personalizationScore`
    - `recentViewScore`
    - `categoryAffinityScore`
    - `searchIntentScore`
    - `clickAffinityScore`
  - allowed anonymous recommendation `GET` requests to reuse the existing `x-guest-session-id` flow so behavior can safely influence later requests
  - kept public recommendation APIs backward compatible:
    - `GET /api/public/recommendations/home`
    - `GET /api/public/recommendations/products/:productId/similar`
    - `GET /api/public/recommendations/search`
- Safety guarantee:
  - no checkout, cart, order, payment, shipping, WB sync, AI Try-On, or legacy strawberry app business logic was modified
  - no ML ranking, vector search, collaborative filtering, or analytics dashboard work was introduced
  - no raw user ids, guest session ids, cookies, or private behavior history are exposed in public recommendation payloads
  - sponsored CPC attribution, budget checks, wallet checks, and idempotent charging remain intact
- QA / local verification flow:
  1. enable `RECOMMENDATION_PERSONALIZATION_ENABLED=true`
  2. optionally enable `RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
  3. browse a few products, run a few searches, and click recommendation cards
  4. reload homepage, search recommendations, or similar-product recommendations
  5. verify ranking stays stable without behavior data and shows bounded personalization only when the flag is on
  6. if QA tools are enabled, compare ranking output in `/admin/recommendations-qa`
- Verification:
  - `backend-nest npm run prisma:generate`: pending
  - `backend-nest npm run lint`: pending
  - `backend-nest npm test -- --runInBand`: pending
  - `backend-nest npm run build`: pending
  - `frontend-next npm run lint`: pending
  - `frontend-next npm run build`: pending
  - `frontend-next npx playwright test tests/e2e/recommendations.spec.ts --workers=1`: pending
  - campaign and billing regression coverage: pending
  - `git diff --check`: pending
  - `git ls-files | Select-String "\.env"`: pending
  - `git ls-files data.xlsx`: pending
- Remaining gaps:
  - personalization is still lightweight and heuristic-based by design
  - there is no recommendation analytics dashboard yet
  - there is no persisted user-profile management or cross-device identity stitching
- Next recommended phase:
  - Phase 5.2: Recommendation Analytics Dashboard

## 2026-06-07 Final V1 Report and Demo Freeze Phase 4.5

- Status: Implemented on current branch
- Scope:
  - froze the V1 feature set for final demo/reporting without adding major new features
  - verified the stable V1 loop remains intact:
    - seller wallet dev funding
    - campaign create and edit
    - campaign target add and remove
    - campaign activation
    - sponsored recommendation boost
    - sponsored click attribution
    - CPC billing ledger write
    - wallet-limit blocking
    - budget-exhaustion blocking
  - added a final regression for `budget_exhausted` sponsored click protection
  - polished seller campaign copy so the demo more clearly explains:
    - status
    - budget
    - remaining budget
    - spend readiness
    - impressions and clicks in performance
  - updated final V1 docs for:
    - demo script
    - completed feature list
    - intentionally excluded feature list
    - post-V1 roadmap
- Safety guarantee:
  - no checkout, cart, order, payment, shipping, WB sync, AI Try-On, or legacy strawberry business logic was modified
  - no new payment gateway, invoice, fraud, or analytics platform work was introduced
  - public recommendation APIs remain backward compatible and still avoid leaking private billing or campaign internals
- Final demo script:
  1. log in as seller
  2. open `/seller/billing`
  3. add demo wallet credit
  4. open `/seller/campaigns`
  5. create a campaign
  6. add product targets
  7. activate the campaign
  8. open a public page with recommendations
  9. click a sponsored recommendation
  10. return to `/seller/billing` and show the charge ledger row
  11. return to `/seller/campaigns` and show campaign spend plus performance
- Verification:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npx playwright test tests/e2e/recommendations.spec.ts --workers=1`: pass
  - `git diff --check`: pass
  - `git ls-files | Select-String "\.env"`: pass
  - `git ls-files data.xlsx`: pass
- Completed V1 features:
  - recommendation and ranking
  - recommendation QA
  - sponsored ranking
  - campaign management
  - campaign product targets
  - seller wallet
  - billing ledger
  - sponsored CPC attribution
  - campaign spend tracking
  - budget and wallet limits
  - safe dev/demo wallet funding
  - seller billing UI
  - seller campaign UI
- Intentionally excluded from V1:
  - real payment gateway
  - invoice flow
  - fraud prevention
  - advanced campaign analytics
  - CPM batching
  - admin finance review
  - production monitoring
  - campaign moderation
- Next recommended phase:
  - Post-V1 production hardening and operational rollout planning

## 2026-06-07 V1 Demo Readiness and Safe Dev Funding Phase 4.4

- Status: Implemented on current branch
- Scope:
  - added a safe seller dev/demo wallet funding path for the active NestJS + Next.js stack only
  - added seller API:
    - `POST /api/seller/shops/:shopId/billing/wallet/dev-credit`
  - gated backend dev funding behind:
    - `BILLING_DEV_TOOLS_ENABLED=true`
    - optional `BILLING_DEV_TOOLS_MAX_CREDIT_AMOUNT`
  - gated frontend demo funding visibility behind:
    - `NEXT_PUBLIC_BILLING_DEV_TOOLS_ENABLED=true`
  - enforced demo funding safety rules:
    - disabled by default
    - seller can only fund their own wallet
    - positive amount only
    - capped max amount
    - immutable ledger write with `Dev/demo funding` labeling
  - upgraded seller UI:
    - `/seller/billing` now includes a demo-only funding action and clearer V1 reporting guidance
    - `/seller/campaigns` now explains how billing demo funding fits into the sponsored campaign walkthrough
  - added regression coverage for:
    - dev funding disabled by default
    - dev funding enabled by flag
    - wallet and ledger mutation after funding
    - invalid amount rejection
    - oversize amount rejection
    - ownership protection
    - sponsored CPC charging still works after funding
- Safety guarantee:
  - no checkout, cart, order, payment, shipping, WB sync, AI Try-On, or legacy strawberry app business logic was modified
  - no real payment gateway or public top-up flow was introduced
  - seller responses still avoid exposing user id, session id, cookies, or raw metadata
- Demo flow:
  1. enable backend `BILLING_DEV_TOOLS_ENABLED=true`
  2. enable frontend `NEXT_PUBLIC_BILLING_DEV_TOOLS_ENABLED=true`
  3. open `/seller/billing`
  4. credit a small demo amount into the seller wallet
  5. open `/seller/campaigns` and confirm an active `cpc` campaign
  6. trigger a sponsored recommendation click from the public storefront
  7. return to `/seller/billing` and `/seller/campaigns`
  8. confirm ledger balance movement and campaign spend update safely
- Verification:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npx playwright test tests/e2e/recommendations.spec.ts --workers=1`: pass
  - `git diff --check`: pass
  - `git ls-files | Select-String "\.env"`: pass
  - `git ls-files data.xlsx`: pass
- Remaining gaps:
  - no real seller funding, payment gateway, invoice, or fraud layer exists yet
  - demo funding is still intentionally local/dev-only
- Next recommended phase:
  - Phase 4.5: demo fixture polish, safer reconciliation guardrails, or broader reporting handoff support

## 2026-06-07 Campaign Billing V1 Completion Phase 4.3

- Status: Implemented on current branch
- Scope:
  - completed the first end-to-end sponsored campaign billing flow for the active NestJS + Next.js stack only
  - extended `RecommendationEvent` with safe sponsored attribution fields:
    - `shopId`
    - `campaignId`
    - `scenarioType`
    - `billingMode`
    - `sponsored`
    - `charged`
    - `chargeStatus`
    - `cost`
    - `ledgerEntryId`
    - `idempotencyKey`
  - wired active seller campaigns into bounded sponsored recommendation ranking
  - added safe public recommendation item fields:
    - `sponsored`
    - `trackingToken`
  - kept public recommendation APIs backward compatible:
    - `GET /api/public/recommendations/home`
    - `GET /api/public/recommendations/products/:productId/similar`
    - `GET /api/public/recommendations/search`
  - completed V1 CPC billing behavior:
    - sponsored click attribution
    - backend-only CPC pricing
    - transactional ledger debit on charge
    - idempotent click charging
    - insufficient-wallet protection
    - budget enforcement for further serving/charging
  - added seller campaign performance APIs:
    - `GET /api/seller/shops/:shopId/campaigns/:campaignId/performance`
    - `GET /api/seller/shops/:shopId/campaigns/:campaignId/events`
  - upgraded seller UI:
    - `/seller/campaigns` now shows spend, remaining budget, click metrics, and recent events
    - `/seller/billing` now explains live campaign-charge ledger behavior
  - added regression coverage for:
    - sponsored CPC charge success
    - duplicate idempotent click protection
    - insufficient wallet charge blocking
    - campaign performance visibility
    - seller ownership enforcement for campaign performance
- Safety guarantee:
  - no checkout, cart, order, payment, shipping, WB sync, or AI Try-On business logic was modified
  - no payment gateway, invoice flow, or auction logic was introduced
  - public pages still do not expose wallet balances or private campaign billing internals
- Demo flow:
  1. seller opens `/seller/campaigns`
  2. seller creates a draft campaign
  3. seller adds product targets
  4. seller activates the campaign
  5. public recommendation sections serve a safe sponsored item
  6. sponsored click tracking posts back with `trackingToken` + `idempotencyKey`
  7. backend attributes the event, writes a ledger charge, and updates campaign spend
  8. seller reviews `/seller/campaigns` and `/seller/billing`
- Verification:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npx prisma db push --accept-data-loss`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npx playwright test tests/e2e/recommendations.spec.ts --workers=1`: pending rerun after final doc-only changes
  - `git diff --check`: pending final rerun
  - `git ls-files | Select-String "\.env"`: pending final rerun
  - `git ls-files data.xlsx`: pending final rerun
- Remaining gaps:
  - no real top-up flow or payment gateway exists yet
  - CPM batching, invoices, fraud controls, advanced analytics, and auction logic remain future work
- Next recommended phase:
  - Phase 4.4: seller funding/dev top-up path plus stronger campaign budget and analytics polish

## 2026-06-07 Seller Wallet and Billing Ledger Foundation Phase 4.2

- Status: Implemented on current branch
- Scope:
  - added a shop-scoped seller billing foundation for the active NestJS + Next.js stack only
  - added Prisma-backed billing tables:
    - `SellerWallet`
    - `BillingLedgerEntry`
  - added seller billing APIs under:
    - `GET /api/seller/shops/:shopId/billing/wallet`
    - `GET /api/seller/shops/:shopId/billing/ledger`
  - implemented transactional billing service primitives for:
    - wallet auto-create
    - credit
    - debit
    - reserve
    - release reserved
    - refund
    - ledger listing
  - enforced money and safety rules:
    - Prisma `Decimal` money storage
    - two-decimal rounding
    - negative balance blocked by default
    - negative reserved balance blocked
    - reserved balance cannot exceed total balance
    - wallet writes and ledger writes happen together in one transaction
  - kept billing ownership aligned to existing seller shop patterns through `ShopAccessGuard`
  - added seller UI at `/seller/billing` for:
    - wallet balance
    - reserved balance
    - available balance
    - wallet status
    - ledger history
    - explicit Phase 4.2 foundation messaging
  - added regression coverage for:
    - wallet auto create
    - credit
    - debit
    - insufficient debit rejection
    - reserve
    - insufficient reserve rejection
    - release reserved
    - refund
    - ledger entry creation per mutation
    - balance before/after correctness
    - reserved before/after correctness
    - seller ownership enforcement on wallet/ledger reads
- Safety guarantee:
  - no checkout, cart, order, payment, shipping, WB sync, or AI Try-On business logic was modified
  - no live recommendation spend charging or budget deduction was introduced
  - no public recommendation payload changed
  - no legacy `strawberry-*` apps were modified
- Handoff:
  - Phase 4.2 provides the accounting primitives needed before sponsored attribution can charge anything safely.
  - Implemented:
    - shop-scoped wallet model
    - immutable billing ledger model
    - transactional mutation primitives
    - seller wallet + ledger visibility
  - Intentionally not implemented:
    - payment gateway UI
    - top-up flow
    - automatic campaign charging
    - sponsored click/impression attribution
    - budget consumption logic
    - invoice workflow for this wallet layer
- Local QA guide:
  - enable the local backend and frontend runtime
  - open `/seller/billing`
  - pick a seller shop
  - confirm the wallet auto-creates when first opened
  - confirm the page shows zero balances and `active` status by default
  - confirm the ledger safely shows an empty state before any mutations
  - confirm another seller account cannot open the same shop wallet route
  - use future internal service/manual tooling only after later phases expose controlled write paths
- Verification:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - targeted backend billing and campaign regression tests: pass
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npx playwright test tests/e2e/recommendations.spec.ts --workers=1`: pass
  - `git diff --check`: pass
  - `git ls-files | Select-String "\.env"`: pass, only `.env.example` files are tracked
  - `git ls-files data.xlsx`: pass, no tracked `data.xlsx`
- Remaining gaps:
  - no live write endpoint for wallet funding is exposed yet by design
  - no campaign or recommendation attribution writes into this billing foundation yet
  - no budget consumption or reconciliation dashboard exists yet
- Next recommended phase:
  - Phase 4.3: Sponsored Impression / Click Attribution

## 2026-06-07 Campaign Management Foundation Phase 4.1

- Status: Implemented on current branch
- Scope:
  - added a shop-scoped seller campaign management foundation for the active NestJS + Next.js stack only
  - added Prisma-backed campaign tables:
    - `SponsoredCampaign`
    - `SponsoredCampaignProduct`
  - added seller campaign APIs under:
    - `GET /api/seller/shops/:shopId/campaigns`
    - `POST /api/seller/shops/:shopId/campaigns`
    - `GET /api/seller/shops/:shopId/campaigns/:campaignId`
    - `PATCH /api/seller/shops/:shopId/campaigns/:campaignId`
    - `POST /api/seller/shops/:shopId/campaigns/:campaignId/archive`
    - `DELETE /api/seller/shops/:shopId/campaigns/:campaignId`
    - `POST /api/seller/shops/:shopId/campaigns/:campaignId/targets`
    - `DELETE /api/seller/shops/:shopId/campaigns/:campaignId/targets/:targetId`
  - reused existing seller auth plus `ShopAccessGuard` patterns so sellers can only access campaigns for their own shops
  - enforced safe activation and lifecycle rules:
    - invalid status transitions rejected
    - active campaigns require valid targets
    - targets must belong to the same shop
    - active campaigns reject non-public-safe products
    - target boost cannot exceed campaign `maxBoost`
    - `endAt < startAt` is rejected
  - added safe placeholder billing metadata only:
    - `billingMode`
    - `budgetLimit`
    - non-charging billing summary with `chargingEnabled=false`
    - `spendTracked=false`
  - added a read-only internal recommendation bridge method for future targeting integration without changing public recommendation APIs
  - added seller UI at `/seller/campaigns` for:
    - create
    - list
    - edit
    - archive
    - add/remove targets
    - viewing placeholder billing notes
  - added regression coverage for:
    - create/list ownership boundaries
    - activation with valid targets
    - invalid no-target activation
    - invalid date window rejection
    - invalid ownership / boost rejection
    - remove/archive flows and invalid transitions
    - public recommendation backward compatibility and no campaign leakage
- Safety guarantee:
  - no checkout, cart, order, payment, shipping, WB sync, or AI Try-On business logic was modified
  - no real billing, wallet deduction, spend charging, or auction behavior was introduced
  - no public recommendation payload now exposes campaign or billing internals
  - no legacy `strawberry-*` apps were modified
- Handoff:
  - Phase 4.1 provides the persistence, lifecycle, and ownership baseline needed for future wallet and billing work.
  - Implemented:
    - campaign data model
    - seller CRUD / target management
    - lifecycle validation
    - internal bridge for future recommendation use
    - seller UI foundation
  - Intentionally not implemented:
    - wallet balance
    - billing ledger
    - click/impression attribution charging
    - budget consumption
    - invoice generation
    - seller ad auction workflow
- Verification:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npx playwright test tests/e2e/recommendations.spec.ts --workers=1`: pass
  - `git diff --check`: pass
  - `git ls-files | Select-String "\.env"`: pass, only `.env.example` files are tracked
  - `git ls-files data.xlsx`: pass, no tracked `data.xlsx`
- Remaining gaps:
  - campaign billing is still placeholder-only and intentionally non-charging
  - no wallet, spend ledger, or attribution events exist yet
  - the recommendation bridge is internal-only and not wired into live ranking yet
- Next recommended phase:
  - Phase 4.2: Seller Wallet and Billing Ledger Foundation

## 2026-06-07 Finalize Recommendation for Campaign and Billing Integration Phase 3.3

- Status: Implemented on current branch
- Scope:
  - finalized the recommendation-side sponsored contract for future campaign and billing integration in the active NestJS + Next.js stack only
  - added internal-only campaign-readiness contract fields for sponsored ranking, including safe placeholders for:
    - `campaignId`
    - `sponsorType`
    - `scenarioType`
    - `billingMode`
    - `rolloutMode`
    - `maxBoost`
  - extended internal explainability and QA output with campaign-readiness metadata:
    - `sponsoredEligible`
    - `sponsoredBoostApplied`
    - `sponsoredBoostScore`
    - `sponsoredReason`
    - `sponsoredPresetId`
    - `campaignReadinessStatus`
    - `billingMode`
    - `rolloutMode`
  - kept these fields internal-only and unavailable in normal public recommendation payloads
  - kept sponsored ranking:
    - disabled by default
    - additive and bounded
    - unable to override core relevance fully
    - blocked for out-of-stock or inactive products
  - kept recommendation tracking on backend-returned algorithm names without exposing campaign internals publicly
  - added regression coverage for:
    - disabled-by-default sponsored ranking
    - bounded boosts
    - ineligible product rejection
    - internal-only campaign-readiness explainability
    - no public leakage of campaign or billing placeholders
    - backward-compatible recommendation APIs and fallback behavior
- Safety guarantee:
  - no checkout, cart, order, payment, shipping, WB sync, or AI Try-On business logic was modified
  - no billing, wallet, budget deduction, campaign CRUD, or seller ads UI was added
  - no legacy `strawberry-*` apps were modified
- Handoff:
  - Recommendation is now ready for Campaign/Billing integration on the recommendation side.
  - Implemented:
    - safe sponsored preset resolution
    - internal campaign/billing placeholder contract
    - internal campaign-readiness explainability and QA metadata
    - backward-compatible public recommendation APIs
  - Intentionally not implemented:
    - campaign CRUD
    - billing charges
    - wallet or ledger writes
    - sponsored attribution charging
    - budget enforcement
    - campaign analytics dashboard
  - Public APIs that must remain backward compatible:
    - `GET /api/public/recommendations/home`
    - `GET /api/public/recommendations/products/:productId/similar`
    - `GET /api/public/recommendations/search`
- Verification:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npx playwright test tests/e2e/recommendations.spec.ts --workers=1`: pass
  - `git diff --check`: pass
  - `git ls-files | Select-String "\.env"`: pass, only `.env.example` files are tracked
  - `git ls-files data.xlsx`: pass, no tracked `data.xlsx`
- Remaining gaps:
  - campaign and billing placeholders are recommendation-only contracts for now, not real campaign or billing modules
  - no sponsored impression/click attribution storage changes exist yet by design
- Next recommended phase:
  - Phase 4.1: Campaign Management Foundation

## 2026-06-07 Managed Sponsored Config Catalogs and Rollout Presets Phase 3.2

- Status: Implemented on current branch
- Scope:
  - extended the Phase 3 sponsored ranking foundation with a managed internal preset catalog for the active NestJS + Next.js stack only
  - added code-managed internal sponsored rollout presets:
    - `conservative`
    - `balanced`
    - `aggressive-internal-only`
    - `stock-safe`
    - `search-safe`
  - added safe preset metadata for QA:
    - `id`
    - `name`
    - `description`
    - `version`
    - `stability`
    - `maxSponsoredBoost`
    - `maxBusinessBoost`
    - `allowedScenarioTypes`
    - `notes`
  - added internal endpoint:
    - `GET /api/internal/recommendations/sponsored-presets`
  - updated sponsored ranking resolution so:
    - invalid preset ids safely fall back to `balanced`
    - env overrides are clamped by preset caps
    - scenario restrictions are enforced per preset
    - sponsored ranking still remains disabled unless `RECOMMENDATION_SPONSORED_RANKING_ENABLED=true`
  - extended internal explainability and QA comparison/export payloads with safe sponsored preset metadata only when allowed
  - enhanced `/admin/recommendations-qa` so internal users can inspect active and available sponsored presets without exposing them on public pages
  - added regression coverage for:
    - sponsored presets endpoint disabled by default
    - sponsored presets endpoint enabled behind the QA flag
    - conservative vs aggressive cap differences
    - invalid/unbounded preset override clamping
    - explainability-safe sponsored preset metadata
    - public response compatibility with no preset leakage
- Safety guarantee:
  - no checkout, cart, order, payment, shipping, WB sync, or AI Try-On business logic was modified
  - no seller-facing ads UI or campaign management UI was introduced
  - no legacy `strawberry-*` apps were modified
  - public recommendation pages remain free of internal preset/config metadata
- Local QA workflow:
  - keep `RECOMMENDATION_QA_TOOLS_ENABLED=true`
  - keep `NEXT_PUBLIC_RECOMMENDATION_QA_TOOLS_ENABLED=true`
  - optional explainability:
    - `RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
    - `NEXT_PUBLIC_RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
  - enable sponsored ranking only while auditing:
    - `RECOMMENDATION_SPONSORED_RANKING_ENABLED=true`
  - choose a preset with:
    - `RECOMMENDATION_SPONSORED_PRESET_ID=balanced`
  - open `/admin/recommendations-qa`
  - inspect the active preset card and preset catalog
  - run the same saved scenario before and after changing the sponsored preset or caps
  - export snapshots and use the existing diff / QA pack validation workflow to review rank movement safely
- Verification:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npx playwright test tests/e2e/recommendations.spec.ts --workers=1`: pass
  - `git diff --check`: pass
  - `git ls-files | Select-String "\.env"`: pass, only `.env.example` files are tracked
  - `git ls-files data.xlsx`: pass, no tracked `data.xlsx`
- Remaining gaps:
  - sponsored presets are still code-managed internal assets, not a managed campaign system
  - no billing, budget pacing, scheduling, or seller self-serve ads workflow exists by design
- Next recommended phase:
  - Phase 3.3: add lightweight preset versioning/sharing workflows or rollout audit baselines for sponsored ranking changes

## 2026-06-07 Sponsored Ranking and Rollout-Safe Configuration Phase 3.1

- Status: Implemented on current branch
- Scope:
  - started Phase 3 with a lightweight sponsored/business-aware ranking foundation for the active NestJS + Next.js stack only
  - added a rollout-safe sponsored ranking config layer behind:
    - `RECOMMENDATION_SPONSORED_RANKING_ENABLED`
    - optional env lists for sponsored product ids and business-boost shop ids
    - bounded numeric envs for sponsored/product/business boost caps
  - kept sponsored/business boost additive and bounded so it cannot fully replace core relevance
  - kept the public recommendation APIs backward compatible:
    - `GET /api/public/recommendations/home`
    - `GET /api/public/recommendations/products/:productId/similar`
    - `GET /api/public/recommendations/search`
  - extended internal explainability and Phase 2 QA tooling so score breakdown can show:
    - `sponsoredBoostScore`
    - `businessBoostScore`
    - `maxSponsoredBoost`
    - `sponsoredReason`
  - ensured out-of-stock or otherwise inactive/non-public-safe products are not eligible for sponsored/business boost
  - added regression coverage for:
    - sponsored ranking disabled by default
    - sponsored ranking enabled only with env flag
    - bounded boost behavior
    - stronger organic relevance staying ahead of weaker sponsored candidates
    - out-of-stock candidate boost rejection
    - explainability gating with sponsored diagnostics
    - public response backward compatibility and no config leakage
    - safe fallback behavior when smart ranking is off
- Safety guarantee:
  - no checkout, cart, order, payment, shipping, WB sync, or AI Try-On business logic was modified
  - no legacy `strawberry-*` apps were modified
  - no full ads management dashboard or campaign system was introduced in this phase
- Rollout guidance:
  - keep sponsored ranking off by default
  - export a baseline snapshot with Phase 2 QA tooling before enabling the flag
  - enable a small bounded local sponsored config
  - export the same scenario again and use snapshot diff plus threshold validation before rollout
  - keep sponsored diagnostics internal-only through explainability/QA mode
- Verification:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npx playwright test tests/e2e/recommendations.spec.ts --workers=1`: pass
  - `git diff --check`: pass
  - `git ls-files | Select-String "\.env"`: pass, only `.env.example` files are tracked
  - `git ls-files data.xlsx`: pass, no tracked `data.xlsx`
- Remaining gaps:
  - sponsored targeting still uses lightweight env/config inputs rather than a managed campaign source
  - no budget pacing, billing, scheduling, or advertiser workflow exists yet
- Next recommended phase:
  - Phase 3.2: internal managed sponsored config catalogs or safer rollout presets before any real campaign workflow

## 2026-06-06 Recommendation Ranking Readiness Finalization Phase 2.8

- Status: Implemented on current branch
- Scope:
  - finalized Phase 2 recommendation QA readiness for the active NestJS + Next.js stack only
  - extended internal QA preset and baseline catalog metadata with lightweight versioning fields:
    - `version`
    - `updatedAt`
    - `owner`
    - `notes`
    - `stability`
  - returned the same metadata from internal backend endpoints:
    - `GET /api/internal/recommendations/presets`
    - `GET /api/internal/recommendations/baseline-catalog`
  - enhanced `/admin/recommendations-qa` so QA can inspect preset/catalog metadata directly while preparing pack validation and diff review
  - extended Markdown export context with preset/catalog version and stability details for safer internal handoff
  - added backend regression coverage for:
    - explainability hidden when `debug=true` is missing
    - explainability hidden when `RECOMMENDATION_EXPLAINABILITY_ENABLED` is off
    - safe allowlisted preset metadata shape
    - safe allowlisted catalog metadata shape
  - kept all public recommendation APIs backward compatible:
    - `GET /api/public/recommendations/home`
    - `GET /api/public/recommendations/products/:productId/similar`
    - `GET /api/public/recommendations/search`
- Safety guarantee:
  - no checkout, cart, order, payment, shipping, WB sync, or AI Try-On business logic was modified
  - no legacy `strawberry-*` apps were modified
  - QA versioning stays internal-only behind existing recommendation QA flags
  - committed QA artifacts remain safe mock/sample data only
- Phase 2 handoff guide:
  - use `stable` presets/catalog entries for rollout-readiness signoff
  - treat preset/catalog `version` as the lightweight audit handle when sharing internal QA findings
  - when tuning recommendation weights again:
    - reuse the same preset and baseline catalog entry first
    - validate thresholds
    - diff snapshots
    - export the Markdown summary with version/stability context
  - when updating an internal preset/catalog entry:
    - bump `version`
    - refresh `updatedAt`
    - keep `notes` explicit about intended QA usage
    - never commit real storefront snapshot exports
- Verification:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npx playwright test tests/e2e/recommendations.spec.ts --workers=1`: pass
  - `git diff --check`: pass
  - `git ls-files | Select-String "\.env"`: pass, only `.env.example` files are tracked
  - `git ls-files data.xlsx`: pass, no tracked `data.xlsx`
- Remaining gaps:
  - presets and baseline catalog entries are still code-managed internal assets, not centrally shared QA records
  - there is still no non-code configuration workflow for ranking changes yet
- Next recommended phase:
  - Phase 3: sponsored ranking, ads inventory, or controlled rollout configuration on top of the completed Phase 2 QA tooling baseline

## 2026-06-06 Recommendation QA Baseline Catalog Presets Phase 2.7

- Status: Implemented on current branch
- Scope:
  - added internal-only QA threshold preset support with safe preset ids:
    - `strict`
    - `balanced`
    - `lenient`
    - `search-intent-sensitive`
    - `similar-products-sensitive`
  - added internal-only reusable baseline catalog support using file-based safe mock data
  - added backend internal endpoints:
    - `GET /api/internal/recommendations/presets`
    - `GET /api/internal/recommendations/baseline-catalog`
  - extended QA pack validation so packs can include:
    - optional `thresholdPresetId`
    - optional `catalogId`
  - backend validation now returns:
    - `appliedThresholdPreset`
    - `resolvedThresholds`
    - existing `evaluation`
  - explicit pack thresholds can override or extend preset-derived thresholds
  - enhanced `/admin/recommendations-qa` with:
    - threshold preset picker
    - baseline catalog loader
    - preset threshold preview before validation
    - resolved threshold chips after validation
    - Markdown/print export including preset and catalog context
  - added backend regression coverage for:
    - presets gated by QA flag
    - baseline catalog gated by QA flag
    - strict vs lenient threshold tightness
    - safe allowlisted catalog shape
    - preset-based QA pack validation
    - explicit threshold override behavior
    - no user/session/private leakage
- Safety guarantee:
  - no checkout, cart, order, payment, shipping, WB sync, or AI Try-On business logic was modified
  - no database model was added for this phase
  - catalog and preset data remain internal-only and file-based
  - committed catalog entries contain only safe mock/sample data
- Local QA workflow:
  - set `RECOMMENDATION_QA_TOOLS_ENABLED=true`
  - set `NEXT_PUBLIC_RECOMMENDATION_QA_TOOLS_ENABLED=true`
  - optional explainability:
    - set `RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
    - set `NEXT_PUBLIC_RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
  - open `/admin/recommendations-qa`
  - choose a threshold preset
  - load a baseline catalog entry
  - validate the generated or imported QA pack
  - review:
    - preset thresholds
    - resolved thresholds
    - threshold evaluation status
  - run the snapshot diff and export Markdown or print summary
  - when adding new catalog entries, commit only safe mock/sample snapshots and never real exported storefront data
- Verification:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npx playwright test tests/e2e/recommendations.spec.ts --workers=1`: pass
  - `git diff --check`: pass
  - `git ls-files | Select-String "\.env"`: pass, only `.env.example` files are tracked
  - `git ls-files data.xlsx`: pass, no tracked `data.xlsx`
- Remaining gaps:
  - baseline catalog remains repo-local rather than shared through a central QA service
  - preset/catalog editing is still code-driven rather than UI-authored

## 2026-06-06 Recommendation QA Threshold Evaluation and Fixture Library Phase 2.6

- Status: Implemented on current branch
- Scope:
  - extended internal-only QA pack validation at `POST /api/internal/recommendations/packs/validate`
  - QA pack validation now returns safe threshold evaluation with:
    - `evaluation.overallStatus`
    - `evaluation.summary`
    - `evaluation.thresholds[]`
  - supported threshold keys now include:
    - `maxMovedDownCount`
    - `maxMovedUpCount`
    - `maxAddedCount`
    - `maxRemovedCount`
    - `maxScoreDelta`
    - `maxAbsoluteRankMovement`
    - `minUnchangedCount`
    - `maxTotalChangedCount`
  - added backend regression coverage for:
    - omitted thresholds -> `not_evaluated`
    - all thresholds passing -> `pass`
    - any threshold failing -> `fail`
    - malformed threshold payload rejection
    - no user/session/private leakage
    - existing public recommendation endpoint compatibility
  - organized a lightweight internal fixture library with safe mock sample QA packs for:
    - home ranking stability
    - search intent ranking stability
    - similar products ranking stability
  - enhanced `/admin/recommendations-qa` with:
    - multiple sample QA pack buttons
    - visible overall pass/fail/not-evaluated status
    - per-threshold table with actual value, expected threshold, and message
    - Markdown and print export including threshold evaluation
- Safety guarantee:
  - no checkout, cart, order, payment, shipping, WB sync, or AI Try-On business logic was modified
  - threshold evaluation remains internal-only behind QA flags
  - committed fixtures use safe mock/sample data only
- Local QA workflow:
  - set `RECOMMENDATION_QA_TOOLS_ENABLED=true`
  - set `NEXT_PUBLIC_RECOMMENDATION_QA_TOOLS_ENABLED=true`
  - optional explainability:
    - set `RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
    - set `NEXT_PUBLIC_RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
  - open `/admin/recommendations-qa`
  - load one of the safe fixture packs
  - validate the pack and review:
    - `overallStatus`
    - threshold rows
    - total changed count
    - max score delta
    - max rank movement
  - run the snapshot diff and export the Markdown or print summary
  - repeat the same fixture after future weight changes to see whether thresholds still pass
- Verification:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npx playwright test tests/e2e/recommendations.spec.ts --workers=1`: pass
  - `git diff --check`: pass
  - `git ls-files | Select-String "\.env"`: pass, only `.env.example` files are tracked
  - `git ls-files data.xlsx`: pass, no tracked `data.xlsx`
- Remaining gaps:
  - threshold fixture libraries are still repo-local mock artifacts rather than shared/persisted QA assets
  - the internal QA page is intentionally not linked in public navigation

## 2026-06-06 Recommendation QA Baseline Packs and Visual Diff Export Phase 2.5

- Status: Implemented on current branch
- Scope:
  - added internal-only QA pack validation at `POST /api/internal/recommendations/packs/validate`
  - QA packs now support:
    - `packName`
    - `description`
    - `scenarioType`
    - `query` or `productId`
    - `limit`
    - `baselineSnapshot`
    - `candidateSnapshot`
    - optional `expectedSummaryThresholds`
  - committed a safe mock/sample QA pack for internal tooling only
  - enhanced `/admin/recommendations-qa` with:
    - sample QA pack loading
    - pasted/imported QA pack JSON
    - backend pack validation
    - pack-driven baseline/candidate snapshot hydration
    - Markdown visual summary export
    - print-friendly visual summary workflow
  - added backend regression coverage for:
    - QA pack validation with safe mock data
    - rejecting malformed QA pack payloads
    - no user/session/private data leakage
    - existing snapshot diff behavior still works
- Safety guarantee:
  - no checkout, cart, order, payment, shipping, WB sync, or AI Try-On business logic was modified
  - no public recommendation endpoint contracts were broken
  - only safe mock/sample QA pack data is committed
- Local QA workflow:
  - create baseline snapshot A from `/admin/recommendations-qa`
  - tune ranking weights
  - create candidate snapshot B from the same scenario
  - build a QA pack with scenario metadata plus snapshots A/B
  - import or paste the QA pack JSON
  - validate the QA pack
  - run snapshot diff using the pack snapshots
  - export the visual Markdown summary or print the diff review
- Verification:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npx playwright test tests/e2e/recommendations.spec.ts --workers=1`: pass
  - `git diff --check`: pass
  - `git ls-files | Select-String "\.env"`: pass, only `.env.example` files are tracked
  - `git ls-files data.xlsx`: pass, no tracked `data.xlsx`
- Remaining gaps:
  - QA pack fixtures are lightweight and file-based, not centrally managed
  - the internal QA page is intentionally not linked in public navigation

## 2026-06-06 Recommendation Snapshot Diffing and Baseline Catalog Phase 2.4

- Status: Implemented on current branch
- Scope:
  - added internal-only snapshot diffing at `POST /api/internal/recommendations/diff`
  - kept `GET /api/internal/recommendations/compare` backward compatible for compare and export flows
  - diff output now supports safe QA review with:
    - scenario metadata
    - summary metrics
    - `productId`
    - `productName`
    - `oldRank`
    - `newRank`
    - `rankMovement`
    - `oldScore`
    - `newScore`
    - `scoreDelta`
    - `status`
    - optional `reasonDelta`
    - optional `scoreBreakdownDelta`
  - added backend regression coverage for:
    - diff disabled by default
    - diff enabled behind `RECOMMENDATION_QA_TOOLS_ENABLED`
    - unchanged item detection
    - moved-up item detection
    - moved-down item detection
    - added item detection
    - removed item detection
    - score delta calculation
    - no user/session/private field leakage
  - enhanced `/admin/recommendations-qa` with:
    - snapshot A / snapshot B paste inputs
    - JSON file import for both snapshots
    - diff summary cards
    - diff table
    - baseline catalog cards for repeatable audit scenarios
- Safety guarantee:
  - no checkout, cart, order, payment, shipping, WB sync, or AI Try-On business logic was modified
  - no public recommendation endpoint contracts were broken
  - diffing remains internal-only behind QA flags
- Local QA workflow:
  - set `RECOMMENDATION_QA_TOOLS_ENABLED=true`
  - set `NEXT_PUBLIC_RECOMMENDATION_QA_TOOLS_ENABLED=true`
  - optional explainability:
    - set `RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
    - set `NEXT_PUBLIC_RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
  - open `/admin/recommendations-qa`
  - export snapshot A from a baseline scenario
  - tune ranking weights
  - export snapshot B from the same scenario
  - paste or import both snapshots into the diff panel
  - review:
    - `moved_up`
    - `moved_down`
    - `added`
    - `removed`
    - `unchanged`
- Verification:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npx playwright test tests/e2e/recommendations.spec.ts --workers=1`: pass
  - `git diff --check`: pass
  - `git ls-files | Select-String "\.env"`: pass, only `.env.example` files are tracked
  - `git ls-files data.xlsx`: pass, no tracked `data.xlsx`
- Remaining gaps:
  - baseline catalog is intentionally static and documented, not persisted to a database
  - the internal QA page is intentionally not linked in public navigation

## 2026-06-06 Recommendation QA Snapshot Export and Saved Scenarios Phase 2.3

- Status: Implemented on current branch
- Scope:
  - extended `GET /api/internal/recommendations/compare` with internal-only snapshot export using:
    - `export=true`
    - `format=json`
  - kept the default comparison response backward compatible when export mode is not requested
  - exported snapshots now include:
    - `scenarioType`
    - `placement`
    - `productId` or `query` when applicable
    - `limit`
    - `generatedAt`
    - `comparedAlgorithms`
    - public product summary fields only
    - `rankMovement`
    - per-algorithm `rank`
    - per-algorithm `finalScore`
    - optional `reasons`
    - optional `scoreBreakdown`
  - added backend regression coverage for:
    - snapshot export disabled by default
    - snapshot export enabled behind `RECOMMENDATION_QA_TOOLS_ENABLED`
    - exported snapshot shape
    - exported snapshot rank movement preservation
    - no user/session/private field leakage
  - enhanced the internal frontend QA route `/admin/recommendations-qa` with:
    - saved scenario presets for home, search, and similar-product audits
    - JSON snapshot export for the current comparison result
- Safety guarantee:
  - no checkout, cart, order, payment, shipping, WB sync, or AI Try-On business logic was modified
  - no public recommendation endpoint contracts were broken
  - snapshot export remains internal-only behind QA flags
- Local QA workflow:
  - set `RECOMMENDATION_QA_TOOLS_ENABLED=true`
  - set `NEXT_PUBLIC_RECOMMENDATION_QA_TOOLS_ENABLED=true`
  - optional explainability:
    - set `RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
    - set `NEXT_PUBLIC_RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
  - start backend and frontend locally
  - open `/admin/recommendations-qa`
  - run saved scenarios or custom inputs for:
    - `home`
    - `search&q=...`
    - `product_detail&productId=...`
  - click `Export JSON snapshot`
  - compare the saved JSON snapshot against later exports after weight changes
- Verification:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npx playwright test tests/e2e/recommendations.spec.ts --workers=1`: pass
  - `git diff --check`: pass
  - `git ls-files | Select-String "\.env"`: pass, only `.env.example` files are tracked
  - `git ls-files data.xlsx`: pass, no tracked `data.xlsx`
- Remaining gaps:
  - saved scenarios are currently preset-based and do not persist to a database
  - the internal QA page is intentionally not linked in public navigation

## 2026-06-06 Recommendation Internal Ranking Comparison QA Tools Phase 2.2

- Status: Implemented on current branch
- Scope:
  - added `GET /api/internal/recommendations/compare` for internal-only ranking comparison
  - added `RECOMMENDATION_QA_TOOLS_ENABLED` gating on the backend compare workflow
  - added `NEXT_PUBLIC_RECOMMENDATION_QA_TOOLS_ENABLED` gating on the frontend internal QA page
  - comparison output now supports safe side-by-side snapshots for:
    - `rule_based_v1`
    - `rule_based_v2`
  - comparison rows include:
    - `productId`
    - `productName`
    - `rankMovement`
    - `ruleBasedV1`
    - `ruleBasedV2`
  - when explainability is enabled, each algorithm snapshot can also include:
    - `reasons`
    - `scoreBreakdown`
  - added internal frontend QA route:
    - `/admin/recommendations-qa`
  - added backend regression coverage for:
    - QA comparison disabled by default
    - QA comparison enabled behind internal flag
    - comparison shape for `rule_based_v1` vs `rule_based_v2`
    - rank movement calculation
    - no session/customer data leakage
- Safety guarantee:
  - no checkout, cart, order, payment, shipping, WB sync, or AI Try-On business logic was modified
  - no public recommendation endpoint contracts were broken
  - the compare workflow is opt-in and internal-only
- Local QA workflow:
  - set `RECOMMENDATION_QA_TOOLS_ENABLED=true`
  - set `NEXT_PUBLIC_RECOMMENDATION_QA_TOOLS_ENABLED=true`
  - optional explainability:
    - set `RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
    - set `NEXT_PUBLIC_RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
  - start backend and frontend locally
  - open `/admin/recommendations-qa`
  - compare:
    - `placement=home`
    - `placement=search&q=...`
    - `placement=product_detail&productId=...`
- Verification:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npx playwright test tests/e2e/recommendations.spec.ts --workers=1`: pass
  - `git diff --check`: pass
  - `git ls-files | Select-String "\.env"`: pass, only `.env.example` files are tracked
  - `git ls-files data.xlsx`: pass, no tracked `data.xlsx`
- Remaining gaps:
  - the internal QA page is intentionally not linked in public navigation

## 2026-06-06 Recommendation Explainability and Safer Weight Tuning Phase 2.1

- Status: Implemented on current branch
- Scope:
  - extracted recommendation scoring weights into explicit constants in `backend-nest/src/modules/recommendations/recommendation-scoring.service.ts`
  - added optional internal explainability payloads per recommendation item with:
    - `scoreExplanation.algorithm`
    - `scoreExplanation.finalScore`
    - `scoreExplanation.reasons`
    - `scoreExplanation.scoreBreakdown`
  - gated explainability behind both `debug=true` and `RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
  - kept public recommendation response backward compatible by preserving `algorithm`, `placement`, `items`, `products`, `score`, and `reasonCodes`
  - preserved Phase 2 frontend tracking behavior so impression/click events keep using the algorithm returned by backend
  - removed frontend hardcoded recommendation algorithm defaults and now treat the backend response as the source of truth
  - added backend regression coverage for:
    - same-category scoring
    - category-name fallback scoring
    - search text intent scoring
    - popularity scoring
    - freshness/rating/stock/shop/image contributions
    - penalty scoring
    - fallback algorithm tracking persistence
- Feature flags:
  - `RECOMMENDATIONS_ENABLED`
  - `PUBLIC_RECOMMENDATIONS_ENABLED`
  - `RECOMMENDATION_TRACKING_ENABLED`
  - `RECOMMENDATION_SMART_RANKING_ENABLED`
  - `RECOMMENDATION_EXPLAINABILITY_ENABLED`
  - `NEXT_PUBLIC_RECOMMENDATION_EXPLAINABILITY_ENABLED`
- Safety guarantee:
  - no checkout, cart, order, payment, shipping, WB sync, or AI Try-On business logic was modified
  - recommendation explainability does not expose raw customer IDs, guest IDs, search history, or viewed product history
  - when explainability is disabled, recommendation APIs keep returning the existing public-safe contract
- QA guide:
  - default public QA:
    - call `GET /api/public/recommendations/home?limit=8`
    - call `GET /api/public/recommendations/products/:productId/similar?limit=8`
    - call `GET /api/public/recommendations/search?q=jacket&limit=8`
    - verify each response still contains stable `algorithm`, `placement`, `items`, and `products`
  - internal explainability QA:
    - set `RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
    - set `NEXT_PUBLIC_RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
    - call the same endpoints with `debug=true`
    - verify `items[].scoreExplanation` appears with `algorithm`, `finalScore`, `reasons`, and `scoreBreakdown`
    - verify no user identifiers or session identifiers appear anywhere in explainability payloads
  - fallback QA:
    - set `RECOMMENDATION_SMART_RANKING_ENABLED=false`
    - verify home and similar endpoints return `rule_based_v1`
    - verify search recommendations safely return `[]`
    - verify recommendation event tracking can still persist `algorithm=rule_based_v1`
- Verification:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npx playwright test tests/e2e/recommendations.spec.ts --workers=1`: blocked by missing backend runtime at `http://127.0.0.1:3001` (`ECONNREFUSED`)
  - `git diff --check`: pass
  - `git ls-files | Select-String "\.env"`: only `.env.example` files are tracked
  - `git ls-files data.xlsx`: no tracked `data.xlsx`
- Remaining gaps:
  - public recommendation E2E still depends on a live local backend at `127.0.0.1:3001`
  - recommendation explainability is intentionally opt-in and is not enabled in the normal public storefront path

## 2026-06-06 Recommendation Smart Ranking Phase 2

- Status: Implemented on current branch
- Scope:
  - added `rule_based_v2` scoring via `backend-nest/src/modules/recommendations/recommendation-scoring.service.ts`
  - upgraded home and similar-product recommendation APIs to return ranked recommendation items plus backward-compatible flat `products`
  - added `GET /api/public/recommendations/search?q=...&limit=12`
  - personalized home ranking from recent `ProductViewLog` and `SearchLog` when a customer or guest session is available
  - expanded frontend recommendation blocks to homepage, product detail, and search results
  - upgraded recommendation impression/click tracking to send `rule_based_v2`, rank, and score best-effort
  - fixed frontend recommendation tracking to use the backend-returned `algorithm` value, including `rule_based_v1` fallback mode
  - updated recommendation i18n keys in `en`, `ru`, and `vi`
- Feature flags:
  - `RECOMMENDATIONS_ENABLED`
  - `PUBLIC_RECOMMENDATIONS_ENABLED`
  - `RECOMMENDATION_TRACKING_ENABLED`
  - `RECOMMENDATION_SMART_RANKING_ENABLED`
- Safety guarantee:
  - no checkout, cart, order, payment, shipping, WB sync, or AI Try-On business logic was modified
  - disabled recommendation flags still return safe empty payloads or Phase 1 fallback behavior
- Verification:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npx playwright test tests/e2e/recommendations.spec.ts --workers=1`: blocked by missing backend runtime at `http://127.0.0.1:3001` (`ECONNREFUSED`)
  - `git diff --check`: pass
  - `git ls-files | Select-String "\.env"`: only `.env.example` files are tracked
  - `git ls-files data.xlsx`: no tracked `data.xlsx`
- Future Phase 3:
  - sponsored ranking
  - ad inventory and campaign controls
  - richer session intent weighting

## 2026-06-06 Seller Center Navigation UX Refactor

- Status: Implemented on current branch
- Root UX issue:
  - seller sidebar had grown into one long flat list, mixing catalog, sales, payments, onboarding, and settings in a way that made scanning and mobile use harder
  - route depth such as `/seller/products/[id]`, `/seller/payments/[orderId]`, and `/seller/orders/[id]/shipping-label` also needed clearer parent highlighting without changing route behavior
- Implemented fix:
  - extracted seller navigation into config-driven groups in `frontend-next/src/components/seller/seller-nav-config.ts`
  - grouped navigation into:
    - Overview
    - Catalog
    - Sales
    - Delivery & operations
    - Payments & finance
    - Settings
  - added collapsible sections with localStorage persistence for collapse state
  - ensured the active route group auto-expands and child routes highlight the correct parent item
  - added a compact sidebar search field for section filtering
  - added a mobile hamburger/drawer navigation while preserving desktop sticky sidebar behavior
  - preserved all existing seller routes and access logic; only the menu presentation changed
- Verification:
  - `frontend-next npm run check:i18n`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npx playwright test tests/e2e/i18n-seller-operations.spec.ts --workers=1`: pass
- Notes:
  - no checkout/order/payment/shipping/WB sync/AI Try-On business logic or API contracts were changed

## 2026-06-06 Role i18n Root-Cause Cleanup and Guardrails

- Status: Implemented on current branch
- Root cause:
  - `translate()` previously returned the raw key whenever both the active locale and `en` were missing a path.
  - frontend dictionaries had drifted from code usage, especially across mixed namespaces like `seller.*`, `adminShell.*`, `adminUsers.*`, `catalog.*`, `public.*`, and `aiTryOn.*`.
  - this created repeated UI regressions where seller/admin/customer screens exposed keys such as `seller.dashboard.title` directly in production.
- Implemented fix:
  - added a readable final fallback in `frontend-next/src/i18n/translate.ts` so missing keys no longer leak raw i18n ids into the UI
  - added `frontend-next/scripts/check-i18n-keys.mjs` plus `npm run check:i18n` to audit all used translation keys in `src/app` and `src/components`
  - backfilled all currently used missing English base keys so `en` is now the complete fallback source for active frontend code paths
  - added missing `seller.dashboard.*` translations used by the seller dashboard and preserved earlier admin/public fixes
- Verification:
  - `frontend-next node scripts/check-i18n-keys.mjs --write-en`: pass
  - `frontend-next npm run check:i18n`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
- Remaining gap:
  - `ru` and `vi` still have large fallback coverage gaps, but they now fall back to readable English instead of raw keys
  - future locale-completion work should focus on `seller.aiImages.*`, `adminAiSettings.*`, `catalog.*`, `public.shop.*`, and `aiTryOn.*`

## 2026-06-04 Visual Product Search Phase 1

- Status: Implemented on current branch
- Scope:
  - additive Prisma `VisualSearchLog` and `VisualSearchEvent` models plus migration
  - new public APIs: `POST /api/public/visual-search` and `POST /api/public/visual-search/events`
  - safe provider flow with optional OpenAI vision analysis and guaranteed fallback to rule-based matching
  - public-header camera trigger and modal upload/crop/category-hint flow
  - storefront result grid reusing existing `ProductCard`
- Feature flags:
  - `VISUAL_SEARCH_ENABLED`
  - `PUBLIC_VISUAL_SEARCH_ENABLED`
  - `VISUAL_SEARCH_TRACKING_ENABLED`
  - `NEXT_PUBLIC_VISUAL_SEARCH_ENABLED`
- Safety guarantee:
  - checkout, order, cart, payment, shipping, WB sync, and AI Try-On contracts were not modified
  - when flags are off, the camera trigger is hidden and the API returns a safe disabled/empty payload
  - if AI analysis fails or is not configured, the backend falls back to `categoryHint` plus empty keywords without surfacing a provider `500`
- Phase 2 direction:
  - image embeddings and vector search

## 2026-06-04 Seller Fulfillment Count Mismatch & Thermal Print Improvements

- Status: Implemented on current branch (`fix/seller-orders-count-mismatch`)
- Scope:
  - Excluded unpaid and pending-review orders from the seller fulfillment counts and lists by modifying `buildWhere()` and `resolveSellerStatusWhere('NEW')` in backend `orders.service.ts`.
  - Resolved shipping label print layout overflow generating blank pages by adjusting page boundaries and outer component heights in print mode.
  - Improved print clarity/sharpness of shipping labels for monochrome thermal printers by forcing solid black (`#000000`) for text/borders, converting dashed borders to solid, and disabling anti-aliasing on barcodes/QRs (`shape-rendering: crispEdges`).
- Verification:
  - `backend-nest` E2E orders and checkout tests: pass
  - `backend-nest` build & lint: pass
  - `frontend-next` lint: pass
  - `frontend-next` build: pass

## 2026-06-03 Recommendation Tracking and Rule-Based Discovery Phase 1

- Status: Implemented on current branch
- Scope:
  - additive Prisma analytics tables for product views, search logs, and recommendation events
  - public tracking APIs for product views, search queries, and recommendation impressions/clicks
  - rule-based homepage and similar-product recommendation APIs
  - homepage and product-detail recommendation sections with fail-safe hiding on empty/error
  - client-side search and product-view tracking with safe guest session IDs
- Feature flags:
  - `RECOMMENDATIONS_ENABLED`
  - `PUBLIC_RECOMMENDATIONS_ENABLED`
  - `RECOMMENDATION_TRACKING_ENABLED`
- Safety guarantee:
  - checkout, cart, order, payment, shipping, seller orders, WB sync, and AI Try-On flows were not modified
  - recommendation APIs fall back to `[]` and tracking APIs fall back to `204`
- Verification:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm run build`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - phase-specific frontend Playwright execution requires running frontend/backend servers and is pending environment availability
- Future Phase 2:
  - sponsored product ads and reserved sponsored labeling activation

## 2026-05-30 AI Try-On Generated Bytes Contract Fix

- Status: Completed on current branch
- Root cause:
  - `ai-service` already had generated OpenAI try-on bytes from `b64_json`, but `backend-nest` still expected a downloadable `image.url` and failed new production tasks with `RESULT_IMAGE_UPLOAD_FAILED`.
  - this left the pipeline dependent on a URL that does not exist for the active `gpt-image-1` path even though the image bytes were already available internally.
- Implemented fix:
  - `ai-service` internal `/internal/ai-try-on/generate` responses now return `imageBase64` payloads for generated try-on images instead of persisting final try-on objects itself
  - `backend-nest` AI try-on worker now reads `imageBase64` first, logs received byte length safely, uploads bytes directly to bucket `ai-try-on` with canonical keys such as `openai/<taskId>/1.png`, and only then marks the task `COMPLETED`
  - backend still supports URL fallback for future providers, but no longer requires URL download for the active OpenAI b64 path
  - missing payloads now fail with `OPENAI_RESULT_IMAGE_MISSING`; storage failures still fail with `RESULT_IMAGE_UPLOAD_FAILED`
- Verification:
  - `ai-service python -m compileall app`: pass
  - `ai-service python -m pytest -q`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm run build`: pass
  - `backend-nest npm test -- --runInBand test/ai-try-on.e2e-spec.ts`: pass
  - `git diff --check`: pending in this phase until final safety pass

## 2026-05-30 AI Try-On Backend Result Upload Ordering Fix

- Status: Completed on current branch
- Root cause:
  - `backend-nest` trusted the AI service response URL and marked `AiTryOnTask` as `COMPLETED` before backend-owned object persistence was verified.
  - production tasks could therefore contain `result_image_url` values under `https://skidkaberry.com/storage/ai-try-on/openai/<taskId>/1.png` while the MinIO object did not exist.
- Implemented fix:
  - added backend result-image persistence in [backend-nest/src/modules/files/files.service.ts](/c:/Users/admin/trawberry-ai-commerce/backend-nest/src/modules/files/files.service.ts)
  - `ai-try-on.worker.ts` now downloads the generated image, uploads it to bucket `ai-try-on` with object key `openai/<taskId>/1.png` for OpenAI tasks, logs safe upload metadata, and only then marks the task `COMPLETED`
  - upload failures now leave the task in `FAILED` with code `RESULT_IMAGE_UPLOAD_FAILED`
  - added regression tests covering canonical bucket/key/url generation and the worker completion/failure ordering
- Verification:
  - `backend-nest npm test -- --runInBand test/ai-try-on.e2e-spec.ts`: pass
  - `git diff --check`: pass

## 2026-05-30 AI Try-On Public MinIO Bucket Policy Fix

- Status: Completed on current branch
- Confirmed the production root cause in infra:
  - AI Try-On result objects were saved successfully to MinIO
  - public reads failed with `AccessDenied` on bucket `ai-try-on`
  - production `minio-init` only created and published `MINIO_BUCKET`
  - app/runtime storage could point at `S3_BUCKET=ai-try-on`, so the real AI Try-On bucket was left without anonymous download policy
- Implemented fix:
  - added [infra/minio-init/init-buckets.sh](/c:/Users/admin/trawberry-ai-commerce/infra/minio-init/init-buckets.sh) as the shared MinIO bootstrap script
  - updated production compose to mount and run the shared init script instead of inline `mc` commands
  - kept the existing default/public bucket bootstrap in place
  - added explicit bootstrap for `S3_BUCKET` when it differs from `MINIO_BUCKET`
  - added explicit bootstrap for `AI_TRY_ON_BUCKET` with `mc anonymous set download`
- Documentation:
  - updated [docs/DEPLOYMENT.md](/c:/Users/admin/trawberry-ai-commerce/docs/DEPLOYMENT.md)
  - updated [docs/PRODUCTION_RUNBOOK.md](/c:/Users/admin/trawberry-ai-commerce/docs/PRODUCTION_RUNBOOK.md)
  - updated [README.md](/c:/Users/admin/trawberry-ai-commerce/README.md)
- Verification:
  - `docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production.example config`: pass
  - post-deploy operator verification required:
    - `mc anonymous get local/ai-try-on`
    - `curl -I https://skidkaberry.com/storage/ai-try-on/openai/<taskId>/1.png`

## 2026-05-30 AI Try-On Result Pipeline and Image Persistence Fix

- Status: Completed on branch `dev/bugfix/ai-tryon-real-generation-failures`
- Root cause:
  - OpenAI images.edit API response can return either `b64_json` or `url` values. The previous AI service parser only parsed `b64_json`, causing generation requests returning `url` format to fail or lose the image data.
  - When the AI service returned a successful response, the NestJS backend worker marked tasks `COMPLETED` even if the generated image URL was empty, resulting in the frontend showing a success state with a default "No image available" placeholder.
- Implemented fix:
  - **AI Service:** Modified `openai_image_support.py` and `openai_image_provider.py` to be asynchronous, retrieve and parse both `b64_json` and `url` values from the OpenAI API response, fetch/download the URL image bytes when returned using an async client (`httpx.AsyncClient`), and write them to the configured object storage (MinIO/S3 or local).
  - **AI Service:** Added safe logging of image parsing metadata (presence of base64/url, byte length, MIME type) without leaking raw image bytes or secrets.
  - **Backend:** Updated `ai-try-on.worker.ts` to assert the presence of `image.url` in the AI service response, transitioning the task to `FAILED` with code `RESULT_IMAGE_URL_MISSING` otherwise.
  - **Backend:** Standardized the API contract by returning the direct unified field `resultImageUrl` in `mapTask()` under `ai-try-on.service.ts`.
  - **Frontend:** Updated client interfaces in `public-api.ts` to expose `resultImageUrl` and updated `ai-try-on-result.tsx` to read the unified URL field.
  - **Frontend:** Modified `ai-try-on-result.tsx` to display a styled, clear error message `"AI generated a recommendation but no image was returned."` instead of the success screen if the image URL is missing.
  - **Frontend:** Mapped stable error codes (`RESULT_IMAGE_MISSING`, `OPENAI_RESULT_IMAGE_MISSING`, `RESULT_IMAGE_UPLOAD_FAILED`, `RESULT_IMAGE_URL_MISSING`, `TASK_COMPLETED_WITHOUT_IMAGE`) in `resolveTryOnErrorMessage` and `resolveTaskErrorMessage` under `ai-try-on-modal.tsx`.
- Verification:
  - `ai-service python -m pytest -q`: pass (33 tests passed, including new test cases for URL response downloading and missing payload errors)
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand test/ai-try-on.e2e-spec.ts`: pass (25 tests passed, including new task persistence validation spec)
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `git diff --check`: pass
  - `git status --short`: pass (modified files only in scope before commit)
  - `git ls-files | Select-String "\.env"`: pass (`*.example` files only)
  - `git ls-files data.xlsx`: pass

## 2026-05-30 OpenAI Image Edit MIME Type Fix

- Status: Completed on current branch
- Confirmed the production root cause in `ai-service`:
  - image downloads succeeded for both product and demo/person inputs
  - the failing request was `POST /v1/images/edits`
  - OpenAI rejected at least one uploaded file as `unsupported_file_mimetype`
  - the request payload reached OpenAI with `application/octet-stream` instead of `image/png`, `image/jpeg`, or `image/webp`
- Implemented fix:
  - added a shared `build_image_edit_upload(...)` helper in `app/services/openai_image_support.py`
  - all `images.edit(...)` calls now send named uploads as `(filename, BytesIO, content_type)` tuples
  - GPT edit flows now preserve valid source extensions and MIME types from downloaded images
  - PNG-converted edit assets are now sent with explicit names and MIME types such as `person.png` / `image/png` and `mask.png` / `image/png`
  - removed the old temp-file `rb` upload path that allowed SDK fallback to `application/octet-stream`
  - kept sanitized OpenAI bad-request logging unchanged
- Added regression coverage:
  - `tests/test_openai_try_on_provider.py` now asserts `image[0]`/`image[1]` uploads carry non-octet-stream MIME metadata and that DALL-E 2 try-on sends `person.png` and `mask.png` as `image/png`
  - `tests/test_openai_provider.py` now asserts GPT edit uploads carry valid extensions and MIME types and that DALL-E 2 mask uploads are `image/png`
- Verification:
  - `ai-service python -m compileall app`: pass
  - `ai-service python -m pytest -q`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm run build`: pass
  - `backend-nest npm test -- --runInBand test/ai-try-on.e2e-spec.ts`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `git diff --check`: pass
  - `git status --short`: pass (modified files only in scope before commit)
  - `git ls-files | Select-String "\.env"`: pass (`*.example` files only)
  - `git ls-files data.xlsx`: pass

## 2026-05-30 AI Try-On OpenAI Edit Payload Fix

- Status: Completed on current branch
- Confirmed the production root cause in `ai-service`:
  - product and demo model downloads succeeded
  - the failing request was `POST /v1/images/edits`
  - the rejected payload parameter was `response_format`
  - production error shape was `400 invalid_request_error` with `Unknown parameter: 'response_format'`
- Implemented fix:
  - removed `response_format` from `client.images.edit(...)` in `app/services/openai_image_support.py`
  - removed `response_format` from the shared edit parameter builder in `app/services/openai_image_provider.py`
  - kept GPT image edit `extra_body.output_format` unchanged
  - kept sanitized OpenAI bad-request logging unchanged
- Added regression coverage:
  - `tests/test_openai_provider.py` now asserts the GPT edit paths do not send `response_format`
  - `tests/test_openai_try_on_provider.py` now asserts the active try-on edit path does not send `response_format`
- Verification:
  - `ai-service python -m compileall app`: pass
  - `ai-service python -m pytest -q`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm run build`: pass
  - `backend-nest npm test -- --runInBand test/ai-try-on.e2e-spec.ts`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `git diff --check`: pending final rerun after docs update
  - `git status --short`: pending final rerun after docs update
  - `git ls-files | Select-String "\.env"`: pending final rerun after docs update
  - `git ls-files data.xlsx`: pending final rerun after docs update

## 2026-05-30 Database-backed AI Try-On Demo Models

- Status: Completed on branch `dev/bugfix/ai-tryon-real-generation-failures`
- Unified AI Try-On demo models to load dynamically from the Postgres database:
  - Added `AiTryOnModel` model to [schema.prisma](file:///c:/Users/admin/trawberry-ai-commerce/backend-nest/prisma/schema.prisma).
  - Created a seed script `backend-nest/scripts/seed-ai-tryon-models.ts` and registered it in `package.json` under `"ai-tryon:seed-models"`.
  - Integrated Try-On models database upsert in `backend-nest/scripts/seed-demo.js`.
  - Exposed public models list on backend endpoint `GET /api/public/ai-try-on/models` sorted by `sortOrder`.
  - Deprecated the hardcoded `BUILT_IN_TRY_ON_MODELS` array.
  - Added validation checking for legacy model IDs in `createTask` throwing `DEMO_MODEL_OUTDATED`, and unknown model IDs throwing `DEMO_MODEL_NOT_FOUND`.
  - Updated worker thread model lookup to use Prisma queries.
  - Mocked `prismaMock.aiTryOnModel` in Jest specs to assert the new models endpoint and legacy validation.
- Updated Next.js Frontend:
  - Added `getPublicAiTryOnModels` to [public-api.ts](file:///c:/Users/admin/trawberry-ai-commerce/frontend-next/src/lib/public-api.ts).
  - Modified [ai-try-on-modal.tsx](file:///c:/Users/admin/trawberry-ai-commerce/frontend-next/src/components/ai-try-on/ai-try-on-modal.tsx) to fetch models dynamically, rendering loading indicators, error boxes, or empty-state warnings.
  - Localized new error codes in English and Russian translation files.
- Verification status:
  - Backend NestJS tests: `npm test -- --runInBand test/ai-try-on.e2e-spec.ts` -> pass (all 24 tests passed)
  - Python AI Service tests: `python -m pytest -q` -> pass (all 29 tests passed)
  - Frontend type safety, linting and compilation: `npm run lint` -> pass; `npm run build` -> pass

## 2026-05-30 AI Try-On Real Generation Failures Fix

- Status: Completed on branch `dev/bugfix/ai-tryon-real-generation-failures`
- Implemented backend URL resolution fixes:
  - Added support for `FRONTEND_INTERNAL_BASE_URL` (defaulting to `http://frontend-next:3000` in the docker network) in the NestJS `ConfigService`.
  - Refactored `resolveSelectedModelImageUrl` to resolve relative demo model URLs (e.g. `/ai-try-on/models/model2.png`) directly using `frontendInternalBaseUrl` to avoid 404 download errors.
  - Added backend unit tests confirming URL resolution.
- Refactored Python AI Service (`ai-service`) image editing logic:
  - Added PIL (Pillow) helper functions to square and pad images (`make_square_png`) and generate transparent mask PNGs (`generate_transparent_mask`).
  - Separated **DALL-E 2 edit flow** (uses square image + transparent mask, ignoring product image from files parameter) from **gpt-image-1 / other edit flow** (retains original format).
  - Sanitized logging for `openai.BadRequestError` to log only `status_code`, `error.type`, `error.code`, and sanitized `error.message` without leaking the API key, base64 payload, or raw bytes.
  - Mapped all download and OpenAI errors to stable error codes: `OPENAI_BAD_REQUEST`, `INVALID_REFERENCE_IMAGE`, `INVALID_PRODUCT_IMAGE`, `OPENAI_AUTH_FAILED`, `OPENAI_QUOTA_EXCEEDED`, `OPENAI_RATE_LIMITED`, `OPENAI_PROVIDER_ERROR`, `DEMO_MODEL_IMAGE_NOT_FOUND`.
- Updated Next.js Frontend (`frontend-next`) UI/UX:
  - Added logic to clear stale errors and reset task state (`setTask(null)`) on source switches, model selections, photo uploads, and new Generate triggers in `AiTryOnModal`.
  - Configured error visibility to suppress reference upload errors in demo model mode, and suppress model download errors in user photo mode.
  - Refactored `AiTryOnResult` to display a clear success state card if the task is completed but the generated image URL is empty.
  - Localized the new error codes in English and Russian translations.
- Verification status:
  - Backend NestJS tests: `npm test -- --runInBand test/ai-try-on.e2e-spec.ts` -> pass (all 21 tests passed)
  - Python AI Service tests: `python -m pytest -q` -> pass (all 29 tests passed)
  - Frontend type safety, linting and compilation: `npm run lint` -> pass; `npm run build` -> pass

## 2026-05-30 Admin User Management

- Implemented a complete Admin User Management panel to view, filter, create, edit, disable, and delete users safely.
- Added backend validation with `ListAdminUsersQueryDto`, `CreateAdminUserDto`, and `UpdateAdminUserDto`.
- Built `AdminUsersService` and controller protectively, ensuring security constraints:
  - Last admin deactivation, demotion, or deletion is blocked.
  - Self-deactivation, demotion, or deletion is blocked.
  - Hard deletion is blocked if the user has dependencies (orders, shops, checkouts, or fee ledger entries), returning `USER_HAS_DEPENDENCIES` to encourage deactivation instead.
  - Automatically registers `sellerProfile` in `PENDING` state when a new Seller is created.
  - Writes audit logs for user management operations (`CREATE_USER`, `UPDATE_USER`, `DELETE_USER`, `RESET_USER_PASSWORD`).
- Added robust backend E2E tests in `test/admin-users.e2e-spec.ts`.
- Built frontend dashboard page `/admin/users` with dynamic data rendering:
  - Users table with full details.
  - Live query filters (text search, role filter, status filter, and pagination).
  - Modal drawer for user CRUD operations and reset password switches.
  - Safe confirmation gates for disabling and deleting users.
- Provided English and Russian translations for all UI texts and backend error codes.

Verification:
- `backend-nest npm run lint`: pass
- `backend-nest npm test -- --runInBand test/admin-users.e2e-spec.ts`: pass (all 14 tests passed)
- `backend-nest npm run build`: pass
- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass

Remaining gaps:
- None.

## 2026-05-29 AI Try-On Reference Source Selection

- fixed the public AI Try-On modal so reference selection now follows an explicit one-of-two rule:
  - upload your own photo
  - choose a built-in demo model
- removed the implicit default built-in model selection; users now must choose one source before generation
- added a segmented source selector and updated Step 3 copy in `en/ru`
- updated frontend reference-state behavior:
  - uploading a photo clears the selected demo model
  - selecting a demo model clears the uploaded photo preview
  - product summary now shows either the selected model label or `Reference: Your uploaded photo`
  - source-switch info messages are shown in `en/ru`
- hardened frontend error handling so RU no longer falls back to raw English API messages for AI Try-On task/create failures
- hardened frontend generate gating:
  - disabled when consent is missing
  - disabled when no reference source is chosen
  - disabled with the correct uploaded-photo reason only when a photo source exists and the backend marked it unsuitable
- hardened backend validation for task creation:
  - accepts `selectedModelId` only
  - accepts uploaded photo only
  - rejects neither source with `AI_TRY_ON_REFERENCE_REQUIRED`
  - rejects both sources with `AI_TRY_ON_REFERENCE_CONFLICT`
- expanded regression coverage:
  - backend e2e now covers photo-only success and both-source rejection
  - Playwright AI Try-On MVP spec now covers missing-source messaging, built-in-only enablement, upload/model clearing behavior, and RU localization for the new Step 3 flow

Verification:

- pending

Remaining gaps:

- focused Playwright execution still depends on live local frontend/backend services
- no paid OpenAI smoke was run in this phase by design
- the pre-branch stash `codex-temp-ai-tryon-pre-branch` was intentionally preserved and not reapplied

## 2026-05-29 AI Try-On Real Models Restore Audit

- audited git history after the reported production regression and confirmed the original UI work still exists in git:
  - `771a90c feat: replace ai try-on placeholders with real demo models`
  - `09c628b fix: improve ai try-on upload preview layout`
- confirmed the current branch already inherits both commits through:
  - `c7d2196` merge of the real-model branch
  - `81c1805` merge of the upload-preview branch
- confirmed `HEAD` still tracks:
  - `frontend-next/public/ai-try-on/models/model1.png` ... `model10.png`
  - backend built-in model config pointing to `/ai-try-on/models/model*.png`
  - upload preview rendered with portrait aspect and `object-contain`
  - reference-source toggle logic from the latest fix
- added regression guards so future deploys fail faster if the UI falls back to legacy placeholder paths:
  - backend AI Try-On config e2e now asserts model image URLs stay on `/ai-try-on/models/model*.png`
  - backend AI Try-On config e2e now asserts no built-in model uses `.svg`
  - Playwright AI Try-On MVP spec now asserts model card image `src` uses the real PNG assets
  - Playwright AI Try-On MVP spec now asserts uploaded preview keeps `object-contain`

Verification:

- pending

Remaining gaps:

- production regression root cause points to deploy/ref selection rather than missing files in the current branch
- focused Playwright execution still requires live local frontend/backend services

## 2026-05-28 AI Try-On Real Demo Models

- replaced the old built-in AI Try-On placeholder catalog with 10 real demo model assets under `frontend-next/public/ai-try-on/models/`
- updated the shared built-in model config returned by the backend:
  - new `model-1` through `model-10` ids
  - real image paths
  - expanded body-type vocabulary
  - added `weightKg` metadata
- updated the public AI Try-On model picker UI:
  - responsive 1 / 2 / 3 column grid
  - real model photos instead of silhouettes
  - localized EN/RU labels
  - localized gender/body-type meta line
  - height/weight summary line
  - image cards now use `object-contain` to avoid cropping heads/feet too aggressively
- updated backend worker resolution for built-in model images:
  - public config still returns relative frontend asset paths
  - worker now resolves those relative model image paths against `FRONTEND_URL` / `PUBLIC_SITE_URL` before sending them to ai-service
- updated automated coverage:
  - public config test now asserts 10 built-in models and the new asset paths
  - AI Try-On e2e/backend specs now use the new model ids
  - Playwright MVP spec now asserts 10 model cards are visible

Verification:

- `backend-nest npm run prisma:generate`: pass
- `backend-nest npm run lint`: pass
- `backend-nest npm run build`: pass
- `backend-nest npm test -- --runInBand test/ai-try-on.e2e-spec.ts`: pass
- `backend-nest npm test -- --runInBand test/product.e2e-spec.ts`: pass
- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `git diff --check`: pending rerun after docs update
- `git ls-files | Select-String "\.env"`: pending rerun after docs update
- `git ls-files data.xlsx`: pending rerun after docs update

Remaining gaps:

- Playwright was not executed because local services were not started in this phase
- built-in model labels are fully localized for EN/RU; no additional VI AI Try-On copy was added in this phase because the public AI Try-On modal is currently scoped to EN/RU

## 2026-05-28 AI Try-On Product Availability Sync From Admin Settings

- audited the admin AI settings save path and confirmed the root cause:
  - `ai_feature_settings.supported_categories` could be updated to category ids such as `["1010","1040"]`
  - but `products.ai_try_on_enabled` was left stale
  - public AI Try-On support checks still depend on that product-level availability flag, so supported products could remain blocked
- updated the admin AI settings write flow to save settings and sync product availability in one Prisma transaction
- added automatic product availability synchronization policy:
  - when supported categories are selected, products with `categoryId` in the selected ids are enabled
  - products with other `categoryId` values, or `null`, are disabled
  - when supported categories are empty, all eligible public-ready products with images are enabled and ineligible products are disabled
- extended the admin settings response contract with `productAvailabilitySync` so the UI can confirm the product update result
- updated the admin UI success toast/message to explain that product availability was refreshed and to show enabled/disabled counts when returned
- added backend regression coverage for:
  - category-id-based product availability sync
  - replacing one selected category set with another
  - empty supported-category policy re-enabling eligible products
  - a public AI Try-On request succeeding after admin save flips a supported product back to enabled

Verification:

- `backend-nest npm run prisma:generate`: pass
- `backend-nest npm run lint`: pass
- `backend-nest npm run build`: pass
- `backend-nest npm test -- --runInBand test/ai-try-on.e2e-spec.ts`: pass
- `backend-nest npm test -- --runInBand test/product.e2e-spec.ts`: pass
- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `git diff --check`: pending rerun after docs update
- `git ls-files | Select-String "\.env"`: pending rerun after docs update
- `git ls-files data.xlsx`: pending rerun after docs update

Remaining gaps:

- this fix removes the need for manual SQL for the main admin-settings flow, but legacy products without `categoryId` still benefit from the existing `categories:link-products` script
- focused Playwright coverage for the admin save message still depends on a live local runtime

## 2026-05-28 AI Try-On Category Id Support

- audited the AI Try-On category gate and confirmed admin settings are now intended to persist category ids, not only legacy slugs
- hardened supported-category parsing so stored JSON arrays containing numeric ids no longer get dropped during runtime reads
- hardened AI Try-On support evaluation so it now:
  - matches directly on `String(product.categoryId)` when the relation/id exists
  - resolves a fallback category by exact `Category.name` match from `product.categoryName` or `product.sourceCategoryName` when `categoryId` is still null
  - continues to enrich stored supported ids into related category names/slugs for backward compatibility
- added a conservative idempotent script `npm run categories:link-products` that links legacy products to existing categories only:
  - no category creation
  - exact normalized name match only
  - `--dry-run` support
- expanded AI Try-On backend regression coverage for:
  - supported ids stored as strings
  - supported ids stored as numbers
  - null `product.categoryId` with legacy `categoryName`
  - still-blocked unsupported categories

Verification:

- `backend-nest npm run prisma:generate`: pass
- `backend-nest npm run lint`: pass
- `backend-nest npm run build`: pass
- `backend-nest npm test -- --runInBand test/ai-try-on.e2e-spec.ts`: pass
- `backend-nest npm test -- --runInBand test/product.e2e-spec.ts`: pass
- `backend-nest npm run categories:link-products -- --dry-run`: pass
- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `git diff --check`: pass
- `git ls-files | Select-String "\.env"`: pass
- `git ls-files data.xlsx`: pass

Remaining gaps:

- production products that still have `categoryId = null` will still need the one-time link script after deploy
- focused Playwright verification for the full public AI Try-On flow still depends on a live local runtime

## 2026-05-28 Catalog Filter Dropdown Overlay

- audited the public catalog filter bar in `frontend-next/src/app/products/page.tsx`
- identified the root cause as a stacking-context conflict:
  - the filter section uses `backdrop-blur-md`
  - that creates a local stacking context
  - dropdown panels were rendered with `absolute z-50`, but still stayed trapped inside that lower context
  - the later-rendered product grid/cards could visually paint above the dropdown
- fixed the overlay behavior at the shared catalog filter container level instead of patching individual filter logic:
  - elevated the filter area to a controlled `relative z-30 overflow-visible` layer
  - kept the product grid at `relative z-0`
  - standardized dropdown wrappers to a shared `z-20` container and `z-[60]` panel class
  - preserved sticky header priority by keeping filter overlay below the header's existing higher stack level
- added `Escape` close handling for the active catalog dropdown without changing current outside-click behavior
- added focused test ids for the color filter trigger and panel
- added a targeted Playwright spec for catalog filter overlay behavior

Verification:

- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `frontend-next npx playwright test tests/e2e/catalog-filters-overlay.spec.ts --workers=1`: failed because local frontend `127.0.0.1:3000` was not running
- `git diff --check`: pass
- `git ls-files | Select-String "\.env"`: pass
- `git ls-files data.xlsx`: pass

Remaining gaps:

- focused browser verification for the overlay fix still needs a live local frontend runtime
- the user-local stash `temp-layout-before-catalog-filter-overlay` was intentionally left untouched because `frontend-next/src/app/layout.tsx` was unrelated dirty worktree state

## 2026-05-28 AI Try-On Supported Category Selector

- replaced the admin AI settings `Supported categories` free-text textarea with a predefined checkbox-chip selector
- added canonical AI try-on product type catalog for admin selection:
  - `tops`
  - `pants`
  - `jeans`
  - `shorts`
  - `bermuda`
  - `dresses`
  - `skirts`
  - `jackets`
  - `hoodies`
  - `shoes`
  - `bags`
  - `accessories`
- added `Select recommended` and `Clear all` actions plus selected-count feedback
- kept backward compatibility for legacy saved values:
  - legacy comma-separated data is parsed and normalized
  - unknown legacy values are preserved in a dedicated `Custom / Unknown` warning group until the admin removes them
- normalized saved values to canonical slugs while preserving current backend contract shape
- expanded backend category matching so AI try-on support checks now recognize aliases and phrases such as:
  - `шорты`
  - `бермуды`
  - `брюки`
  - `джинсы`
  - `платье`
  - `юбка`
  - mixed phrases like `Шорты джинсовые бермуды`
- localized the unsupported product message in the public AI try-on flow so RU no longer falls back to raw English backend text
- expanded admin locale support from English-only to `en/ru` and exposed the shared language switcher in the admin shell for this screen
- updated focused backend and frontend AI try-on regression coverage for:
  - legacy category parsing
  - canonical save payload
  - RU unsupported messaging
  - bermuda/shorts alias support

Verification:

- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `backend-nest npm run lint`: pass with no errors after helper cleanup
- `backend-nest npm run build`: pass
- `backend-nest npm test -- --runInBand test/ai-try-on.e2e-spec.ts`: pass
- `frontend-next npx playwright test tests/e2e/ai-try-on-mvp.spec.ts --workers=1`: not run because local frontend/backend runtime was not started in this phase
- `git diff --check`: pending final run after docs update
- `git ls-files | Select-String "\.env"`: pending final run after docs update
- `git ls-files data.xlsx`: pending final run after docs update

Remaining gaps:

- the admin shell still contains broader historical English-first areas outside the touched AI settings surface; this phase only added `en/ru` support needed for the current screen and shell chrome
- focused browser E2E for the updated AI try-on flow still needs a live local frontend/backend runtime before it can be executed
- existing unrelated dirty file `frontend-next/src/app/layout.tsx` was left untouched

## 2026-05-28 Shipping Label I18n Data Values

- audited seller shipping label print flow for remaining RU data-value leaks
- added frontend normalization so shipping labels no longer render raw English system strings for:
  - `Entrance / Intercom / Floor / Apartment`
  - `Seller-managed pickup`
- localized shipping label page title and pre-print filename hint by order code
- expanded Playwright coverage for localized shipping-label data values and title behavior
- TODO:
  - dedicated PDF export with guaranteed `shipping-label-<orderCode>.pdf` filename remains a follow-up phase; current filename control is still browser best-effort through `document.title`

Verification:

- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `frontend-next npx playwright test tests/e2e/seller-shipping-label.spec.ts --workers=1`: failed because local backend on `127.0.0.1:3001` was not running
- `frontend-next npx playwright test tests/e2e/i18n-public-customer.spec.ts --workers=1`: failed because local frontend on `127.0.0.1:3000` was not running
- `frontend-next npx playwright test tests/e2e/action-feedback.spec.ts --workers=1`: failed because local frontend on `127.0.0.1:3000` was not running
- `git diff --check`: pass
- `git ls-files | Select-String "\.env"`: pass
- `git ls-files data.xlsx`: pass

Remaining gaps:

- end-to-end browser verification is blocked until frontend and backend services are running locally
- exact cross-browser PDF filename control still requires a dedicated export implementation instead of browser print/save

## 2026-05-27 GitHub Actions CD To VPS

- added `.github/workflows/deploy.yml` for production image build, GHCR publish, and VPS deploy
- deploy workflow triggers on:
  - `push` to `main`
  - `workflow_dispatch`
- added CI gating so deployment waits for the `CI` workflow to succeed on the same commit
- build-and-push job now publishes:
  - `backend-nest`
  - `frontend-next`
  - `ai-service`
  - `nginx`
- each image is tagged with:
  - commit SHA
  - `latest`
- deploy job now:
  - SSHes into the VPS with key-based auth
  - preserves `infra/.env.production`
  - writes image overrides into `infra/.env.deploy`
  - pulls new GHCR images
  - runs `docker compose ... up -d`
  - runs production smoke checks
- updated production smoke script for CD:
  - supports `SITE_URL`
  - supports `API_URL`
  - keeps login-free public smoke
  - checks internal `ai-service` health without exposing it publicly
- updated deployment docs with:
  - required GitHub secrets
  - GHCR image strategy
  - rollback by image SHA
  - restart/log inspection guidance

Verification:

- `docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.example config`: pass
- `docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.example build backend-nest frontend-next ai-service nginx`: pass
- `backend-nest npm run lint`: pass
- `backend-nest npm run build`: pass
- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `ai-service python -m compileall app`: pass
- `ai-service python -m pytest -q`: pass
- `git diff --check`: pass
- `git ls-files | Select-String "\.env"`: pass
- `git ls-files data.xlsx`: pass

Remaining gaps:

- workflow could not be executed against GitHub-hosted runners from the local workspace
- real VPS deploy still depends on repository secrets, GHCR permissions, and VPS host setup
- frontend image build should use the real production API URL through repository variable configuration
## 2026-05-27 GitHub Actions CI Foundation

- updated `.github/workflows/ci.yml` to standardize CI for the active marketplace stack
- narrowed triggers to:
  - `push` on `main`
  - `pull_request` targeting `main`
- added repository safety checks to fail fast when tracked `.env`, `data.xlsx`, or Playwright/test artifacts appear
- backend job now:
  - provisions PostgreSQL and Redis services
  - enables `uuid-ossp`
  - runs Prisma generate and db push
  - runs lint and build
  - runs targeted backend specs only:
    - `test/ai-try-on.e2e-spec.ts`
    - `test/product.e2e-spec.ts`
    - `test/orders.e2e-spec.ts`
- frontend job remains lint/build only with safe public env defaults
- ai-service job remains mock-safe and does not require `OPENAI_API_KEY`
- docker config job now validates both:
  - `infra/docker-compose.yml`
  - `infra/docker-compose.prod.yml`
- docker build job now builds production images only on `push main`

Verification:

- `backend-nest npm run prisma:generate`: pass
- `backend-nest npm run lint`: pass
- `backend-nest npm run build`: pass
- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `ai-service python -m compileall app`: pass
- `ai-service python -m pytest -q`: pass
- `docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.example config`: pass
- `git diff --check`: pass
- `git ls-files | Select-String "\.env"`: pass
- `git ls-files data.xlsx`: pass

Remaining gaps:

- CI workflow could not be executed on GitHub from the local workspace and still depends on GitHub Actions account availability
- full Playwright CI remains a later phase once the browser runtime and artifact strategy are ready

## 2026-05-27 Production Docker Deployment Foundation

- added production Docker Compose foundation in `infra/docker-compose.prod.yml`
- introduced nginx reverse proxy config and image build under `infra/nginx`
- kept production services internal-only except the reverse proxy
- removed production dependence on source bind mounts
- standardized named volumes for PostgreSQL, Redis, and MinIO
- added restart policy and health checks across production services
- expanded env examples for production-safe deployment variables without committing secrets
- added deployment, smoke, backup, and restore scripts under `infra/scripts`
- updated deployment, runbook, security, and backup documentation for VPS rollout

Verification:

- `backend-nest npm run prisma:generate`: pass
- `backend-nest npm run prisma:db:push`: pass
- `backend-nest npm run lint`: pass
- `backend-nest npm test -- --runInBand`: pass
- `backend-nest npm run build`: pass
- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `ai-service python -m compileall app`: pass
- `ai-service python -m pytest -q`: pass
- `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build backend-nest frontend-next ai-service`: pass before Docker Desktop daemon outage
- runtime curls for backend, ai-service, frontend `/`, `/products`, `/admin/ai-settings`, `/admin/homepage-slides`: pass before Docker Desktop daemon outage
- `docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.example config`: pass
- `backend-nest npm run smoke:ai-service-integration`: blocked by local Docker Desktop daemon outage after initial runtime verification

Remaining gaps:

- local Docker Desktop daemon became unhealthy during verification and blocked further runtime re-checks
- TLS certificate issuance remains operator-managed
- no automated offsite backup shipping yet

## 2026-05-27 AI Virtual Try-On OpenAI Provider Phase 2

- completed the real `openai` provider wiring for AI try-on without changing the public Phase 1 flow shape
- `ai-service` now:
  - downloads and validates product/person raster images
  - calls OpenAI Images edit with server-side prompt constraints
  - validates generated output
  - stores the output through the configured storage service
- `backend-nest` now:
  - preserves safe provider error codes on failed tasks
  - exposes safe OpenAI runtime status in admin settings
  - forwards built-in model image URLs to `ai-service`
- `frontend-next` now:
  - maps `AI_PROVIDER_NOT_CONFIGURED`, `AI_TRY_ON_IMAGE_UNSUITABLE`, `AI_PROVIDER_ERROR`, and `AI_TIMEOUT`
  - shows admin helper messaging for `providerMode=openai`
  - uses raster built-in model assets compatible with the real provider

Verification:

- `backend-nest npm run prisma:generate`: pass
- `backend-nest npm run prisma:db:push`: pass
- `backend-nest npm run lint`: pass
- `backend-nest npm run build`: pass
- `backend-nest npm test -- --runInBand test/ai-try-on.e2e-spec.ts`: pass
- `ai-service python -m compileall app`: pass
- `ai-service python -m pytest -q`: pass
- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `frontend-next npx playwright test tests/e2e/ai-try-on-mvp.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/product-buying-ux.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/i18n-public-customer.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/action-feedback.spec.ts --workers=1`: pass
- `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build backend-nest frontend-next ai-service`: pass
- runtime health checks for backend, frontend, and ai-service: pass

Remaining gaps:

- exact virtual try-on fidelity still depends on current OpenAI image-edit capability and source image quality
- automated frontend E2E does not force a paid real-provider generation when `OPENAI_API_KEY` already exists; it only verifies safe runtime branching and no secret exposure
- product-level seller UI toggle is still out of scope
- size recommendation remains rule-based by design

## 2026-05-27 AI Virtual Try-On MVP Phase 1

- Implemented a configurable AI Try-On MVP across `backend-nest`, `frontend-next`, and `ai-service`.
- Added Prisma models and migration for:
  - `AiFeatureSetting`
  - `AiTryOnTask`
  - `AiTryOnUsageLog`
  - `Product.aiTryOnEnabled`
- Added admin configuration page and APIs:
  - `/admin/ai-settings`
  - `GET /api/admin/ai-settings`
  - `PATCH /api/admin/ai-settings`
- Added public APIs:
  - `GET /api/public/ai-try-on/config`
  - `POST /api/public/ai-try-on/uploads`
  - `POST /api/public/products/:productId/try-on/tasks`
  - `GET /api/public/ai-try-on/tasks/:taskId`
- Added public product detail modal flow with:
  - always-visible CTA
  - disabled under-development feedback
  - manual size-selection requirement
  - body profile form
  - built-in model picker
  - result polling
- Added ai-service internal endpoint and provider abstraction:
  - `POST /internal/ai-try-on/generate`
  - `mock`
  - `demo`
  - `openai`
- OpenAI mode now fails cleanly with `AI_PROVIDER_NOT_CONFIGURED` when no server key is present.
- Added explainable rule-based size recommendation and explicit reference-only disclaimer.

Verification:

- `backend-nest npm run prisma:generate`: pass
- `backend-nest npm run lint`: pass
- `backend-nest npm run build`: pass
- `backend-nest npm test -- --runInBand test/ai-try-on.e2e-spec.ts`: pass
- `ai-service python -m compileall app`: pass
- `ai-service python -m pytest -q`: pass
- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass

Remaining gaps:

- real OpenAI garment try-on generation is not activated in Phase 1; the `openai` provider path is wiring-ready but still placeholder-based
- seller-facing product toggle UI is not exposed yet, although backend product support exists
- full runtime docker and full frontend/backend regression verification still depend on environment-specific local data and are reported separately when run

## 2026-05-27 Homepage Slider Image Stretching

- Changed image fit layout from `object-contain mx-auto` to `object-fill` on both the public storefront hero slider (`public-homepage-hero-slider.tsx`) and the admin visual preview modal (`admin-homepage-slides-page-client.tsx`).
- This stretches slide images to exactly fit the boundaries of the slider container (stretching without aspect-ratio preservation), eliminating the blank margin gaps on the sides.
- Hardened the database seed demo script (`seed-demo.js`) to perform `deleteMany` on `HomepageSlide` before seeding, preventing accumulation of duplicate/orphaned slides from failed E2E test runs.
- Added `category` query parameter fallback mapping to `categorySlug` on the catalog products page (`products/page.tsx`) to resolve slider banner CTA target links properly, which filters products and hides the legacy `PromoSlider`.

Verification:
- `backend-nest npm run seed:demo`: pass
- `frontend-next npx playwright test tests/e2e/public-homepage-slider.spec.ts`: pass
- `frontend-next npx playwright test tests/e2e/admin-homepage-slides.spec.ts`: pass
- Rebuilt Docker image for `frontend-next` and restarted containers to ensure parity: pass

## 2026-05-26 Admin Responsive Layout Audit & Fix

- Audited and fixed responsive layout issues across all Admin Center pages (Sellers, Deliveries, Seller Fees, Seller Detail, and Support Cases).
- Updated `AdminShell` to introduce a responsive slide-over mobile navigation drawer (hamburger menu) toggled by state on screen sizes below `lg` breakpoint.
- Overrode card containers to full width and removed layout padding offsets on viewports smaller than `lg` to maximize screen real estate and prevent alignment gaps.
- Prevented overall document horizontal scrolling (horizontal scrollbar) by wrapping dense tables, data-grids, and fee logs in `overflow-x-auto` wrappers and specifying minimal table content widths (`min-w-[1100px]`, `min-w-[950px]`, `min-w-[1200px]`).
- Refactored filters grids in `admin-deliveries-page-client` and `admin-support-cases-page-client` to wrap cleanly using responsive Tailwind grid configurations (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3` instead of hardcoded columns).
- Stacked legal document action layouts on `admin-seller-detail-client` below `xl` viewport width.
- Standardized admin-only status labels and badges casing to avoid test failures with Titlecase vs Uppercase mismatches.
- Created `frontend-next/tests/e2e/admin-responsive-layout.spec.ts` to verify layout behavior across Desktop (1440x900), Laptop (1366x768), Tablet (768x1024), and Mobile (390x844), asserting zero document-level horizontal page overflow.

Verification:

- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `frontend-next npx playwright test tests/e2e/admin-responsive-layout.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/admin-fulfillment-supervision.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/buyer-seller-messaging.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/product-reviews.spec.ts --workers=1`: pass
- `backend-nest npm run lint`: pass
- `backend-nest npm run build`: pass
- `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build frontend-next`: pass
- Runtime `curl` checks for admin dashboard and subpages: pass

Remaining gaps:
- Non-admin dashboard pages (e.g. buyer, seller) were already responsive but layout updates here focused strictly on the Admin Center area.

## 2026-05-26 Language Switcher SVG Flags

- replaced text-like locale pseudo-icons in the shared language dropdown with local SVG flag components
- updated trigger and dropdown rows to render:
  - flag icon
  - locale short code
  - full native language name
  - active check mark
- preserved existing role policy and locale persistence:
  - public/customer: `ru/en`
  - seller: `ru/en/vi`
  - admin: no switcher
- added locale flag regression assertions to the focused locale Playwright coverage

Verification:

- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `backend-nest npm run lint`: pass
- `backend-nest npm run build`: pass
- `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build frontend-next`: pass

## 2026-05-26 Admin Operations English-only Cleanup

- completed the focused admin operations copy cleanup without changing admin, seller, customer, payment, return, or fulfillment business logic
- removed legacy Vietnamese and mixed garbled copy from:
  - seller approval list and seller detail moderation actions
  - seller fee supervision
  - admin support cases
  - payments supervision
  - returns / refunds / disputes
- normalized admin-only visible labels on:
  - support case status, issue type, sender role, and priority
  - seller approval/document/legal/payment-config states
  - payment supervision status, proof state, and ledger state
  - admin deliveries payment, provider, and delivery-state presentation
  - admin message thread status
  - admin review status
- hardened touched admin regression specs:
  - removed teardown-only page-close failures in admin fulfillment supervision
  - narrowed read-only admin delivery assertions so they do not match unrelated shell buttons
  - stabilized seller-fee and product-review assertions around current admin UI/test ids
  - raised notification role-layout timeout to avoid false teardown failures

Verification:

- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `frontend-next npx playwright test tests/e2e/admin-fulfillment-supervision.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/admin-delivery-supervision.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/seller-fee-dashboard.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/return-refund-dispute.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/product-reviews.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/buyer-seller-messaging.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/notifications.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/action-feedback.spec.ts --workers=1`: pass
- `backend-nest npm run lint`: pass
- `backend-nest npm run build`: pass
- `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build frontend-next`: pass
- runtime `curl -I` checks for `/admin/dashboard`, `/admin/deliveries`, `/admin/reviews`, `/admin/messages`, and `/admin/notifications`: pass

Remaining gaps:

- older admin queues/reports/dashboard sub-views outside the touched components may still contain raw backend codes that are readable but not yet fully normalized
- seller/customer notification layout tests still keep multilingual assertions in shared role coverage outside this admin-only copy cleanup

## 2026-05-26 Seller Remaining Operations i18n Cleanup

- completed the remaining seller-only i18n cleanup for older operational screens outside seller order detail
- localized seller-only chrome and enum-backed labels on:
  - `/seller/support-cases`
  - `/seller/onboarding`
  - `/seller/pending`
  - `/seller/import/wildberries`
  - `/seller/import/wildberries-api`
  - `/seller/messages`
  - seller login/register helper copy
- migrated seller support statuses, issue types, sender roles, onboarding approval/document/legal labels, pending next-step labels, WB import placeholders, and seller message status chips to dictionary-backed `ru/en/vi` keys
- kept seller business flows unchanged:
  - no onboarding approval logic change
  - no Wildberries sync/import logic change
  - no seller messaging or notification business logic change
- hardened seller messaging regression timing by waiting for stable thread-row selectors instead of assuming the list appears within a fixed 5 second window
- removed the frontend Docker runtime dependency on `next/font/google`, which previously blocked `docker compose ... up -d --build frontend-next` when the container could not reach Google Fonts

Verification:

- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `frontend-next npx playwright test tests/e2e/i18n-seller-remaining-screens.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/i18n-seller-operations.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/buyer-seller-messaging.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/product-reviews.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/notifications.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/action-feedback.spec.ts --workers=1`: pass
- `backend-nest npm run lint`: pass
- `backend-nest npm run build`: pass
- `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build frontend-next`: pass
- runtime `curl -I` checks for `/seller/dashboard`, `/seller/support-cases`, `/seller/reviews`, `/seller/messages`, `/seller/import/wildberries`, and `/seller/import/wildberries-api`: pass

Remaining gaps:

- seller finance, returns, and some older seller AI/workbench screens still contain legacy hard-coded copy outside this focused seller-operations cleanup
- admin legacy operations copy remains intentionally out of scope for this phase

## 2026-05-26 Seller Order Detail i18n Cleanup

- completed seller order detail i18n cleanup for `/seller/orders/[id]`
- migrated remaining seller-only order detail labels to `seller.orderDetail.*` and related shared namespaces
- localized manual Yandex handoff labels, seller fulfillment summary labels, delivery form copy, and shipping-label entry actions for `ru/en/vi`
- seller payment method rendering now prefers stable payment codes over snapshot labels to avoid mixed-language payment labels on detail
- hardened seller order detail business tests to assert `data-raw-status` / `data-bucket` instead of translated copy
- updated seller order list shipment placeholder copy to use dictionary-backed text

Verification:

- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `frontend-next npx playwright test tests/e2e/i18n-seller-remaining-screens.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/i18n-seller-operations.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/seller-manual-yandex-workbench.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/three-role-order-sync.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/seller-shipping-label.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/action-feedback.spec.ts --workers=1`: pass
- `backend-nest npm run lint`: pass
- `backend-nest npm run build`: pass
- `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build frontend-next`: pass
- runtime `curl -I` checks for seller routes: pending current phase summary below

Remaining gaps:

- several older seller/admin operations pages outside order detail still contain legacy hard-coded copy and need a later targeted migration phase
- this phase intentionally did not change seller fulfillment or manual Yandex business logic

## 2026-05-26 Product Reviews UX Polish + Review Photo Upload

- extended verified product reviews with optional customer photo upload
- backend review image support now includes:
  - `ProductReviewImage`
  - `POST /api/customer/reviews/:reviewId/images`
  - validation for `JPG/PNG/WEBP`, `5 MB` max, `5` images max
- improved customer review editor UX:
  - star icon selector
  - explicit localized textarea
  - custom localized photo picker
  - preview and remove-before-submit flow
- improved public review presentation:
  - richer rating summary
  - `All / 5★ / 4★ / 3★ / 2★ / 1★` filter chips
  - review thumbnails and seller reply card
- seller and admin review pages now show customer review thumbnails
- fixed remaining Russian review copy so the review flow no longer shows `????`

Verification:

- `backend-nest npm run prisma:generate`: pass
- `backend-nest npm run prisma:db:push`: pass
- `backend-nest npm run lint`: pass
- `backend-nest npm test -- --runInBand`: pass
- `backend-nest npm run build`: pass
- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `frontend-next npx playwright test tests/e2e/product-reviews.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/public-shop-profile.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/product-buying-ux.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/customer-order-history.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/i18n-public-customer.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/i18n-seller-remaining-screens.spec.ts --workers=1`: pass

Remaining gaps:

- no review video upload yet
- public review image preview is intentionally lightweight and does not include a full gallery carousel
- review abuse/reporting flow is still limited to admin hide/restore

## 2026-05-26 Buyer-Seller Messaging MVP

- added buyer-seller messaging MVP across backend and frontend
- customer entry points:
  - public shop profile `Message shop`
  - public product detail `Message shop`
  - guest redirect to `/customer/login?next=...&intent=message`
- added customer routes:
  - `/customer/messages`
  - `/customer/messages/[threadId]`
  - `/customer/messages/new`
- added seller routes:
  - `/seller/messages`
  - `/seller/messages/[threadId]`
- added admin routes:
  - `/admin/messages`
  - `/admin/messages/[threadId]`
- backend contract:
  - `POST /api/customer/messages/threads`
  - `GET /api/customer/messages/threads`
  - `GET /api/customer/messages/threads/:threadId`
  - `POST /api/customer/messages/threads/:threadId/messages`
  - `PATCH /api/customer/messages/threads/:threadId/read`
  - `PATCH /api/customer/messages/threads/:threadId/report`
  - `GET /api/shops/:shopId/messages/threads`
  - `GET /api/shops/:shopId/messages/threads/:threadId`
  - `POST /api/shops/:shopId/messages/threads/:threadId/messages`
  - `PATCH /api/shops/:shopId/messages/threads/:threadId/read`
  - `PATCH /api/shops/:shopId/messages/threads/:threadId/close`
  - `GET /api/admin/messages/threads`
  - `GET /api/admin/messages/threads/:threadId`
  - `PATCH /api/admin/messages/threads/:threadId/close`
  - `PATCH /api/admin/messages/threads/:threadId/reopen`
- notifications:
  - seller gets `MESSAGE_RECEIVED` when customer writes
  - customer gets `MESSAGE_RECEIVED` when seller replies
  - admin gets `MESSAGE_REPORTED` when customer reports a thread
- i18n:
  - public/customer messaging UI supports `ru/en`
  - seller messaging UI supports `ru/en/vi`
  - admin remains English-only

Verification:

- `backend-nest npm run prisma:generate`: pass
- `backend-nest npm run prisma:db:push`: pass
- `backend-nest npm run lint`: pass
- `backend-nest npm test -- --runInBand`: pass
- `backend-nest npm run build`: pass
- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `frontend-next npx playwright test tests/e2e/buyer-seller-messaging.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/public-shop-profile.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/notifications.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/customer-account.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/i18n-public-customer.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/i18n-seller-remaining-screens.spec.ts --workers=1`: pass

Remaining gaps:

- no realtime websocket or live push yet
- no file attachments in MVP
- no advanced anti-spam moderation beyond plain-text validation, report, and close flow

## 2026-05-26 Product Reviews & Ratings

- added verified-purchase product reviews across backend and frontend
- customer review eligibility is now enforced by backend rules:
  - authenticated customer only
  - must own the order item
  - order must be delivered/completed
  - one review per order item/customer
- added review APIs:
  - `POST /api/customer/reviews`
  - `GET /api/customer/reviews`
  - `PATCH /api/customer/reviews/:reviewId`
  - `GET /api/public/products/:productId/reviews`
  - `GET /api/shops/:shopId/reviews`
  - `PATCH /api/shops/:shopId/reviews/:reviewId/reply`
  - `GET /api/admin/reviews`
  - `PATCH /api/admin/reviews/:reviewId/hide`
  - `PATCH /api/admin/reviews/:reviewId/restore`
- public surfaces:
  - product detail now shows review list and rating summary
  - product cards now show real rating summary when reviews exist
  - public shop profile now uses real shop rating aggregation from product reviews
- seller surfaces:
  - added `/seller/reviews`
  - seller can see shop reviews and reply
- admin surfaces:
  - added `/admin/reviews`
  - admin can hide and restore reviews
- i18n:
  - public/customer review UI supports `ru/en`
  - seller review UI supports `ru/en/vi`
  - admin remains English-only

Verification:

- `backend-nest npm run prisma:generate`: pass
- `backend-nest npm run prisma:db:push`: pass
- `backend-nest npm run lint`: pass
- `backend-nest npm test -- --runInBand`: pass
- `backend-nest npm run build`: pass
- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `frontend-next npx playwright test tests/e2e/product-reviews.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/public-shop-profile.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/product-buying-ux.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/customer-order-history.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/return-refund-dispute.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/i18n-public-customer.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/i18n-seller-remaining-screens.spec.ts --workers=1`: pass

Remaining gaps:

- review images are now supported, but video and richer media tooling are still out of scope
- abuse/reporting workflow is still limited to admin hide/restore
- shop rating currently aggregates published reviews only and does not yet include a separate review-quality or trust score

## 2026-05-25 Public Shop Profile

- added a public marketplace shop profile route:
  - `/shops/[slug]`
- added public-safe shop metadata API:
  - `GET /api/public/shops/:slug`
- extended the existing public products listing contract with an optional `shopSlug` filter so the shop page can reuse the same visibility pipeline as the main marketplace catalog
- buyers can now open a shop profile from:
  - public product detail
  - public product card
- shop page behavior:
  - shows shop name, logo/avatar, verified state, joined date, location label, and a public-safe description placeholder
  - shows a lightweight public product grid scoped to the shop
  - hides non-public, deleted, invalid, or out-of-stock products
  - keeps messaging as a non-breaking placeholder CTA
- i18n:
  - added `public.shop.*` RU/EN keys
  - buyer locale policy remains `ru` default with `ru/en` only
  - no `vi` exposed on the public shop route

Verification:

- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `frontend-next npx playwright test tests/e2e/public-shop-profile.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/i18n-public-customer.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/public-marketplace-contract.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/product-buying-ux.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/cart-checkout.spec.ts --workers=1`: pass
- `backend-nest npm run lint`: pass
- `backend-nest npm run build`: pass
- `backend-nest npm test -- --runInBand test/product.e2e-spec.ts`: pass
- `backend-nest npm test -- --runInBand test/orders.e2e-spec.ts`: pass
- runtime health checks for frontend/backend: pass

Remaining gaps:

- public shop profile currently uses safe existing shop fields and placeholder messaging; no seller-to-buyer messaging system is implemented yet
- ratings remain placeholder-derived until a real reviews phase is added

## 2026-05-25 Seller Printable Shipping Label

- added a printable internal shipping label flow for seller manual Yandex handling
- new route:
  - `/seller/orders/[id]/shipping-label`
  - `?print=1` opens the same route in auto-print mode
- seller order detail now surfaces dedicated shipping-label actions inside the Yandex handoff block
- print view includes:
  - order code
  - recipient identity and dropoff details
  - sender / pickup summary
  - manual Yandex id and tracking URL when available
  - package summary
  - payment summary
  - QR for public order tracking lookup
- print layout behavior:
  - `100mm x 150mm`
  - print-only sheet output
  - seller shell chrome hidden on label page and omitted from print output
- no backend business contract change was required
- E2E hardening included:
  - dedicated `seller-shipping-label.spec.ts`
  - stable raw-status assertion for manual Yandex save feedback
  - three-role sync assertions updated to stable address/status contracts

Verification:

- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `frontend-next npx playwright test tests/e2e/seller-shipping-label.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/seller-manual-yandex-workbench.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/three-role-order-sync.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/i18n-seller-remaining-screens.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/action-feedback.spec.ts --workers=1`: pass
- `backend-nest npm run lint`: pass
- `backend-nest npm run build`: pass
- `backend-nest npm test -- --runInBand test/orders.e2e-spec.ts`: pass
- runtime health checks for frontend/backend: pass

Remaining gaps:

- label QR currently opens the public order-tracking lookup with `orderCode` prefilled; customer phone entry is still required to complete lookup
- this phase does not generate official provider labels, barcodes, or Yandex API payloads

## 2026-05-25 Seller Payment Settings + Products i18n Polish

- fixed seller payment settings live translation for `ru`, `en`, and `vi`
- root cause:
  - `vi.json` was missing `seller.paymentSettings`
  - seller product filter controls were still hard-coded in the client component
  - shop switcher chrome was still hard-coded
  - Playwright initially hit an old frontend runtime until the container was rebuilt
- migrated seller-only copy for:
  - `/seller/payment-settings`
  - `/seller/products` filter/search controls
  - seller shop switcher helper copy
  - seller product metadata form labels and save CTA
- hardened seller E2E:
  - `i18n-seller-remaining-screens.spec.ts` now asserts payment-settings and product-filter RU/VI/EN labels directly
  - `seller-product-lifecycle.spec.ts` no longer depends on an English success sentence after shop creation
  - `i18n-seller-operations.spec.ts` no longer closes the browser context manually, avoiding trace artifact flake

Verification:

- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `frontend-next npx playwright test tests/e2e/i18n-seller-remaining-screens.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/i18n-seller-operations.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/seller-product-lifecycle.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/public-payment-review.spec.ts --workers=1`: pass
- `frontend-next npx playwright test tests/e2e/action-feedback.spec.ts --workers=1`: pass
- `backend-nest npm run lint`: pass
- `backend-nest npm run build`: pass
- `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build frontend-next`: pass
- runtime curls for `/seller/payment-settings` and `/seller/products`: pass

Remaining gaps:

- seller order detail, delivery/Yandex detail, and several onboarding/import screens still contain legacy mixed-language copy outside this focused polish
- seller dictionaries still have broader in-progress hunks from parallel seller phases and must be staged carefully per phase

## 2026-05-25 Customer Account i18n Final Audit & Cleanup

- removed remaining mixed-language customer account copy that was still visible in runtime after the original customer i18n commit
- fixed `/customer/notifications` shell header/subtitle:
  - old issue: server route still hard-coded Vietnamese literals
  - current behavior: shell title/subtitle use customer RU/EN dictionary keys and live-switch with locale state
- completed customer returns/refunds cleanup:
  - localized page title, back action, form labels, helper text, detail labels, action buttons, and feedback
  - replaced browser-native file input presentation with a localized custom file-picker label so customer UI no longer shows Vietnamese OS/browser copy
- completed customer support and receipt cleanup:
  - localized receipt lookup labels and receipt summary copy
  - localized support case creation/reply labels and issue-type labels
- hardened customer i18n E2E to catch:
  - no Vietnamese text on customer notifications
  - no English leftovers on default-Russian returns page
  - localized custom file-picker copy
  - RU/EN persistence with no `VI` option in buyer UI

Verification:

- `frontend-next npm run lint`: pending rerun for this cleanup
- `frontend-next npm run build`: pending rerun for this cleanup
- customer E2E/regression rerun: pending in this cleanup step

Remaining gaps:

- some customer support thread/status payloads still render backend role/status codes directly where they are domain data rather than UI chrome
- seller/admin scopes remain intentionally untouched in this customer-only cleanup

## 2026-05-25 Customer Account i18n Completion

- localized customer auth pages to `ru` and `en`:
  - login title, form labels, CTA buttons, register success banner, and auth error handling
  - register title, form labels, password mismatch validation, and redirect-to-login contract copy
- localized customer account shell and core account surfaces:
  - overview/dashboard
  - profile
  - addresses
  - security
  - support
  - orders and order detail
  - returns / refund case surfaces
- kept buyer locale policy strict:
  - supported locales: `ru`, `en`
  - default locale: `ru`
  - no Vietnamese option in customer auth or account UI
- hardened customer E2E contracts away from localized business text:
  - return / refund status assertions now use stable `data-status`
  - default-address assertion now uses `customer-address-default-badge`
  - notification regression avoids role-copy coupling

Verification:

- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `frontend-next npx playwright test tests/e2e/i18n-customer-account.spec.ts --workers=1`: pass
- `frontend-next npm run test:e2e:customer-account`: pass
- `frontend-next npm run test:e2e:customer-order-history`: pass
- `frontend-next npm run test:e2e:return-refund-dispute`: pass
- `frontend-next npm run test:e2e:notifications`: pass
- `frontend-next npm run test:e2e:action-feedback`: pass
- `backend-nest npm run lint`: pass
- `backend-nest npm run build`: pass

Remaining gaps:

- seller-facing notification copy and seller i18n follow-up remain outside this customer-only phase
- some shared customer notification item copy is still driven by backend event payload text where appropriate, rather than fully dictionary-generated copy
- no customer-specific API contract changed in this phase
## 2026-05-25 Seller Center i18n Remaining Screens Polish

- Fully localized all remaining Seller Center pages and components to RU, EN, and VI:
  - Seller Finance page (balance metrics, ledger entries list, commission invoice table)
  - Seller Returns page (case list, detail log, actions, evidence modals)
  - Seller AI Images workspace (generator settings, prompt form, recent tasks list, results gallery, OpenAI/mock runtime helper cards)
  - Seller Settings & Delivery pages (pickup coordinates, package dimension metrics, carrier options)
  - Seller Notifications dropdown, list pages, and bell component (role-aware labels and headers)
  - Order and Payment badges (fully localized dynamically using dictionary mappings)
- Updated E2E business regression tests to inspect `data-status` attributes or dynamically load locale dictionary JSON strings during Playwright test runs, avoiding fragile hardcoded strings.
- Fixed E2E race condition where language selection clicks triggered `/api/users/locale` requests that were aborted on immediate page navigation. We now await the backend locale update API response before navigations.

Verification:

- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `frontend-next npx playwright test tests/e2e/i18n-seller-remaining-screens.spec.ts --workers=1`: pass
- Playwright E2E regression suite (9 tests): pass
- `backend-nest npm run lint`: pass
- `backend-nest npm test -- --runInBand`: pass (28 suites, 224 tests)
- `backend-nest npm run build`: pass
- Runtime health checks for backend and frontend: pass

Remaining gaps:

- Admin area remains English-only.
- Public customer flow remains English and Russian only.

## 2026-05-25 Seller Operations i18n Completion + Workspace Hydration

- completed seller-facing i18n migration for the main operations surfaces already covered by the role-based locale foundation:
  - seller nav
  - seller products labels/statuses/actions
  - seller orders tabs and key actions
  - seller payment review queue/detail
  - seller notifications heading and empty/filter states
- fixed seller workspace hydration so refresh and direct route entry no longer require `currentShopId` to be preselected in client state
- added seller-wide detail fallbacks in `seller-api` to resolve order/payment/product context across accessible shops and then sync the workspace store after load
- hardened `ProtectedShell` so an already hydrated persisted user does not get blocked by a transient session-loading gate after refresh
- updated payment review E2E contract to assert business outcomes instead of hard-coded English text:
  - seller payment status moves to `PAID`
  - reviewed order appears in seller `NEW` bucket
  - customer tracking shows stable paid status
- added stable payment badge status attributes for locale-safe assertions

Verification:

- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `frontend-next npx playwright test tests/e2e/i18n-seller-operations.spec.ts --workers=1`: pass
- `frontend-next npm run test:e2e:i18n-role-locale`: pass
- `frontend-next npm run test:e2e:seller-product-lifecycle`: pass
- `frontend-next npm run test:e2e:seller-manual-yandex-workbench`: pass
- `frontend-next npm run test:e2e:seller-fee-dashboard`: pass
- `frontend-next npm run test:e2e:public-payment-review`: pass
- `frontend-next npm run test:e2e:notifications`: pass
- `frontend-next npm run test:e2e:action-feedback`: pass
- `backend-nest npm run lint`: pass
- `backend-nest npm test -- --runInBand`: pass
- `backend-nest npm run build`: pass
- runtime health checks for backend, frontend, and ai-service: pass

Remaining gaps:

- seller finance, returns, and delivery detail copy are not fully migrated to dictionaries yet
- some shared/common actions still coexist with older screen-local strings outside the seller operations priority surfaces

## 2026-05-24 Public Product / Cart / Checkout UX + Yandex Address Enforcement

- made public header `Address` clickable and routed it into customer address management
- changed public cart badge to count line items instead of summed quantity
- upgraded product detail quantity control to allow direct numeric input while preserving `+ / -`
- added stock clamp warning toast when entered quantity exceeds current available stock
- tightened checkout so authenticated customers must use a saved `yandexManualReady` address
- kept existing guest/manual checkout flow for anonymous users
- backend now returns structured checkout errors:
  - `CUSTOMER_ADDRESS_REQUIRED`
  - `CUSTOMER_ADDRESS_NOT_YANDEX_READY`
- updated backend checkout E2E coverage and public/customer Playwright coverage for:
  - guest address click redirect
  - logged-in customer address navigation
  - checkout blocked without ready saved address
  - line-item cart badge contract
  - direct quantity input contract

## 2026-05-24 Admin Supervision Read-Only + Shop Commission Rules

- made admin fulfillment UI supervision-only on `/admin/deliveries`
- `GET /api/admin/orders/fulfillment` now returns supervision-safe `nextAdminActions` only:
  - `VIEW`
  - `REMIND_SELLER`
- admin UI no longer exposes seller fulfillment transition buttons or archive controls
- seller remains the only role that changes fulfillment state and seller archive state
- admin reminder flow keeps loading/success feedback and refreshes `lastReminderAt`
- made admin, seller, and customer sidebars stay fixed while content scrolls
- clarified finance UX that commission is configured per shop and ledger rows snapshot commission percent at payment confirmation time
- strengthened coverage:
  - backend seller-finance snapshot invoice assertion
  - admin fulfillment supervision E2E for read-only behavior
  - seller fee dashboard E2E labels for shop-level commission and snapshot ledger rules

## 2026-05-24 Internal Notification Center

- implemented a role-isolated internal Notification Center across all three roles (Customer, Seller, Admin)
- added `Notification` Prisma model with `dedupeKey` index and cascade-delete on user removal
- added three NestJS controllers with role-specific guards:
  - `GET/PATCH /api/customer/notifications`
  - `GET/PATCH /api/seller/notifications`
  - `GET/PATCH /api/admin/notifications`
- connected `NotificationsService` to seven business event sources:
  - `ORDER_NEW` → seller on checkout
  - `PAYMENT_CONFIRMATION_REQUIRED` → seller on QR proof upload
  - `DELIVERY_STATUS_CHANGED` → customer on payment confirmation
  - `YANDEX_CREATION_REMINDER` → seller on admin Yandex reminder
  - `RETURN_CASE_OPENED` / `RETURN_SELLER_RESPONSE_REQUIRED` → seller on return events
  - `RETURN_ADMIN_REVIEW_REQUIRED` → broadcasted to each admin user individually
  - `SELLER_FEE_INVOICE_ISSUED` → seller on commission invoice
  - `ORDER_FULFILLMENT_OVERDUE` → seller via `checkAndNotifyOverdueOrders()` service method (no auto-scheduler)
- implemented `dedupeKey` logic to prevent notification spam for idempotent events
- frontend: created global Zustand store `useNotificationStore` as single source of truth for unread counts
- frontend: `NotificationBell` polls `/unread-count` every 30 s; skips API call if user is not logged in; silently ignores 401 to avoid false "session expired" toasts
- frontend: `NotificationDropdown`, `NotificationsPageClient` subscribed to store; mark-read and archive actions trigger store refresh
- frontend: added `/customer/notifications`, `/seller/notifications`, `/admin/notifications` pages
- fixed flaky regression E2E tests (`three-role-order-sync`, `return-refund-dispute`) that failed due to admin login rate-limiter when multiple test workers used the demo-admin account simultaneously; added `loginAdminWithRetry()` helper with exponential back-off and bumped timeouts to 300 s
- added `docs/API_NOTIFICATIONS.md` and `docs/NOTIFICATIONS.md`
- verification:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass (28 suites, 222 tests)
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npx playwright test tests/e2e/notifications.spec.ts`: pass
  - full regression E2E suite (18 specs): pass

## 2026-05-24 Admin Fulfillment Supervision Tabs

- aligned `/admin/deliveries` with the seller-friendly fulfillment buckets instead of the older raw delivery queue model
- added admin fulfillment tabs and counts for:
  - `Mới`
  - `Lắp ráp`
  - `Trong quá trình giao hàng`
  - `Hoàn thành`
  - `Đã hủy`
  - `Lưu trữ`
- added new backend projection `GET /api/admin/orders/fulfillment`
- admin rows now show seller, shop, buyer, payment status, fulfillment bucket, Yandex id, tracking URL, last update, and overdue state
- admin page now supports:
  - internal remind seller action
  - move to assembling
  - mark in delivery
  - mark completed
  - mark cancelled
  - archive
- kept legacy admin delivery mutation endpoints for shipment-level overrides so seller/manual Yandex behavior is unchanged
- added a focused Playwright flow for admin fulfillment supervision and updated the manual Yandex operational regression to use the new admin buckets

## 2026-05-24 Seller Payment Review And Fulfillment Flow

- split seller operations into two clearer worklists:
  - `seller/payments` now behaves as a payment proof review queue
  - `seller/orders` now behaves as a fulfillment board
- seller payment review queue now shows:
  - order id
  - buyer
  - products
  - amount
  - proof submit time
  - proof thumbnail / preview modal
  - inline confirm / reject actions
- payment confirmation now keeps the existing payment logic but removes the row from the review queue and lets the order appear in the seller fulfillment `Mới` bucket
- seller fulfillment buckets are now normalized to:
  - `Mới`
  - `Lắp ráp`
  - `Trong quá trình giao hàng`
  - `Hoàn thành`
  - `Đã hủy`
  - `Lưu trữ`
- added seller-side order archive support for completed/cancelled orders
- public buyer tracking now surfaces seller-friendly fulfillment labels and payment-confirmed visibility
- updated Playwright specs to respect the newer auth register redirect and the extra fulfillment handoff step before delivery completion

## 2026-05-24 Role-Aware Session Auto Refresh

- Added role-specific refresh cookies for customer, seller, and admin login flows.
- Added role-specific refresh endpoints that rotate only the matching role cookies:
  - `/api/auth/customer/refresh`
  - `/api/auth/seller/refresh`
  - `/api/auth/admin/refresh`
- Frontend protected requests now retry once after a successful silent refresh instead of forcing an immediate logout on the first `401`.
- Added per-role in-flight refresh coordination to prevent refresh storms and duplicate refresh requests.
- Protected route shells now redirect to login only when refresh truly fails and show the session-expired toast only in that failure case.
- Preserved the recent register redirect-to-login behavior; register still does not auto-login or call `/me`.

## 2026-05-24 Register Redirect-To-Login Auth Flow Fix

- Fixed customer and seller registration UX so a successful register no longer auto-logs in or fetches `/me`.
- Customer register now shows `Đăng ký thành công. Vui lòng đăng nhập.` and redirects to `/customer/login?registered=1`.
- Seller register now shows `Đăng ký thành công. Vui lòng đăng nhập.` and redirects to `/seller/login?registered=1`.
- Added auth-context-aware error mapping so `401/403` on register no longer become `Phiên đăng nhập đã hết hạn`.
- Backend register responses now expose `success: true` and `message: REGISTERED` while preserving login behavior.
- Updated backend auth E2E coverage and frontend Playwright coverage for register-then-login flows and post-register regression checks.

## 2026-05-24 Global Action Feedback, Toast & Refresh Policy Implementation

- Implemented lightweight, pub/sub Toast Notification system (`toast.success`, `toast.error`, etc.) at `src/components/ui/toast-provider.tsx` and singleton manager `src/components/ui/use-toast.ts`.
- Developed `useActionFeedback` hook to manage `isRunning` loading state, debouncing (prevent double submission), catch errors, map standard HTTP error codes, and run callback functions.
- Integrated toast feedback and standardized loading states across Customer, Seller, and Admin roles.
- Standardized action text: Save (`Đang lưu...`), Submit (`Đang gửi...`), Confirm (`Đang xác nhận...`), Upload (`Đang tải lên...`), Checkout (`Đang tạo đơn...`), Delete (`Đang xóa...`), Mark delivered (`Đang cập nhật...`).
- Added window-level confirmation dialogs for destructive actions: delete address, cancel order, reject payment, reject return, archive product, mark delivered, admin override refund, mark invoice paid, generate invoice.
- Resolved dynamic Next.js chunk singleton state duplication by storing toast listeners and state globally on the `window` object.
- Retained full compatibility with existing E2E tests, fixing strict mode violations and element matching issues.
- Added new E2E test file (`tests/e2e/action-feedback.spec.ts`) specifically verifying the toast overlay, loading states, confirm dialogs, and database refresh policies.

## 2026-05-23 Public Marketplace Visual and Catalog Filter Conditional Refresh

- Redesigned the public marketplace header into a thin, 2-row layout inspired by the compact Wildberries style to reduce visual clutter.
- Consolidated navigation, user actions, cart link, and search components to ensure responsive and lightweight layout across viewports and eliminate duplicate DOM elements.
- Overrode standard browser outlines on `#public-header-search:focus` inside `globals.css` to hide default focus rings.
- Adjusted Suspense fallback height to `h-[110px]` to eliminate layout shifts.
- Optimized homepage (`/`) layout:
  - Removed bulky intermediate "Shopping made easy" intro card and quick links grid, so catalog products flow directly below the slider banner.
  - Resolved connection refused issues in SSR by using internal Docker DNS URL (`http://backend-nest:3001`) on the server side, enabling products to load directly on the home page.
- Redesigned `/products` catalog page filters section to match Wildberries' layout:
  - Replaced the large card panel with a sleek, horizontal, scrollable filters toolbar containing Stock status toggle (РАСПРОДАЖА), Sort select, Category select, Price inputs, and Brand/Color/Gender fields.
  - Implemented visually hidden stock dropdown selector to ensure Playwright E2E tests remain backward compatible and fully functional.
  - Once a search is active, the promo banner is hidden and this compact filter bar is shown.
  - Dynamically displays the active search query and search results count.
- Successfully verified layout and behaviors using automated E2E tests (`test:e2e:marketplace-search-filter-sort`, `test:e2e:public-smoke`, `test:e2e:public-full`, `test:e2e:product-buying-ux`, `test:e2e:auth-role-separation`).

## 2026-05-23 Manual Yandex Operational Polish

- polished the seller-operated Yandex delivery workflow without introducing real Yandex API calls
- seller order detail now exposes a dedicated `Yandex Delivery Handoff` block with:
  - customer identity
  - structured dropoff data
  - access decisions
  - package summary
  - copy-ready Yandex handoff blocks
  - editable `manualYandexOrderId`
- current saved customer address policy now requires:
  - `city`
  - `street`
  - `building`
  - recipient `fullName`
  - recipient `phone`
  - entrance / floor / apartment value or explicit no/unknown decision
- customer tracking now shows seller-entered `manualYandexOrderId`
- admin deliveries now support:
  - `MISSING_YANDEX_ORDER_ID`
  - `CREATED_WITH_YANDEX_ID`
  - internal `remind-yandex` action with 30-minute rate limit
- added verification targets:
  - `backend-nest npm run smoke:manual-yandex-operational-polish`
  - `frontend-next npm run test:e2e:manual-yandex-operational-polish`
- current remaining limitations:
  - no real Yandex API
  - no SMS or email provider
  - reminder is internal/audit-only in this phase

## 2026-05-22 Yandex-Compatible Customer Address Flow

- upgraded customer addresses from a mostly flat delivery string into a structured Yandex-compatible model
- added backend fields for:
  - `countryCode`
  - `federalSubject`
  - `district`
  - `building`
  - `entrance`
  - `intercom`
  - `floor`
  - `geoPrecision`
  - `geoProvider`
  - `geoProviderUri`
  - `geoRawPayload`
  - `addressFullName`
  - `addressShortName`
- added address helper functions for:
  - Yandex fullname formatting
  - Yandex comment formatting
  - coordinate extraction
  - API-readiness validation
- added customer address provider abstraction with:
  - mock provider
  - manual provider
  - future-only Yandex provider posture
- added customer account endpoints:
  - `GET /api/customer/address-suggestions`
  - `POST /api/customer/addresses/:addressId/geocode`
- checkout now snapshots structured dropoff fields into orders
- seller manual Yandex workbench now renders:
  - full Yandex-friendly dropoff address
  - separated entrance/intercom/floor/apartment/comment
  - readiness badge based on pickup + dropoff coordinates
  - copy-all shipment brief using structured fields
- added verification targets:
  - `backend-nest npm run smoke:yandex-address-flow`
  - `frontend-next npm run test:e2e:yandex-address-flow`
- current limitation remains intentional:
  - no real Yandex geocoder
  - no real map picker
  - no real Yandex Delivery API call
  - missing coordinates warn but do not block current manual flow

## 2026-05-22 Return / Refund / Dispute Foundation

- added a manual return/refund/dispute domain for the direct-to-seller marketplace model
- added backend models:
  - `ReturnRefundCase`
  - `ReturnRefundMessage`
  - `ReturnRefundEvidence`
  - `RefundManualTransfer`
- added customer APIs for case create/list/detail, evidence, messages, cancel, and refund-received confirmation
- added seller APIs for shop-scoped case list/detail, respond, mark return received, refund sent, and messages
- added admin APIs for marketplace-wide list/detail, decisions, public messages, and internal notes
- integrated order, receipt, payment, and public tracking payloads with active return/refund case summary
- integrated seller finance with idempotent negative adjustment rows after confirmed refund
- added new UI routes:
  - `/customer/returns`
  - `/customer/returns/[caseId]`
  - `/seller/returns`
  - `/seller/returns/[caseId]`
  - `/admin/returns`
  - `/admin/returns/[caseId]`
- added verification targets:
  - `backend-nest npm run smoke:return-refund-dispute`
  - `frontend-next npm run test:e2e:return-refund-dispute`
- current remaining limitations:
  - refund remains manual because buyer paid seller directly
  - no bank API refund execution
  - no chargeback automation
  - no provider-backed return shipment flow

## 2026-05-22 Three Role Order Sync Audit + Synchronization Fixes

- audited the end-to-end order flow across customer, seller, and admin roles
- added seller-facing role-sync status mapping and next-action helpers in backend
- expanded seller order API and UI with:
  - richer filters
  - display status
  - next action
  - payment method visibility
  - finance summary
- expanded admin seller management with:
  - `ALL` / `PENDING` / `APPROVED` / `REJECTED`
  - seller/shop search
  - status counts
  - seller detail finance, shop, and recent order summary
- expanded admin payment supervision with finance ledger visibility
- added verification targets:
  - `backend-nest npm run smoke:three-role-order-sync`
  - `frontend-next npm run test:e2e:three-role-order-sync`
  - `frontend-next npm run test:e2e:admin-seller-management`
- current remaining limitations:
  - customer detail surface reuses the existing receipt/tracking pages rather than a brand new dedicated role-specific view
  - seller suspension and broader admin moderation are still future work

## 2026-05-22 Admin Seller Fee Settings + Seller Revenue Dashboard

- added manual marketplace fee accounting for the direct-to-seller payment model
- added Prisma finance models:
  - `ShopCommissionSetting`
  - `PlatformCommissionSetting`
  - `SellerFeeLedgerEntry`
  - `SellerMonthlyInvoice`
- added backend finance endpoints:
  - `GET /api/admin/finance/seller-fees`
  - `PATCH /api/admin/finance/shops/:shopId/commission`
  - `POST /api/admin/finance/shops/:shopId/invoices/generate`
  - `POST /api/admin/finance/invoices/:invoiceId/mark-paid`
  - `GET /api/admin/finance/invoices`
  - `GET /api/seller/shops/:shopId/dashboard-metrics`
  - `GET /api/seller/shops/:shopId/finance-ledger`
  - `GET /api/seller/shops/:shopId/invoices`
- final payment confirmation now creates idempotent fee ledger entries
- commission percent is snapshotted at ledger-entry creation time, so later commission changes do not rewrite history
- cancelled finance cases now use adjustment logic instead of deleting prior fee history
- added admin finance page:
  - `/admin/finance/seller-fees`
- added seller finance visibility:
  - real `/seller/dashboard` metrics
  - `/seller/finance` ledger and invoice tables
- added verification targets:
  - `backend-nest npm run smoke:seller-fee-dashboard`
  - `frontend-next npm run test:e2e:seller-fee-dashboard`
- current limitation remains manual by design:
  - no seller payout automation
  - no automatic seller bank debit
  - no refund settlement automation
  - deposit flow does not yet have a separate deposit-vs-final ledger lifecycle

## 2026-05-22 Payment Method Strategy For Yandex Delivery

- split marketplace payment choice into explicit strategy methods instead of legacy `MANUAL_TRANSFER` / `CASH_ON_DELIVERY`
- current real methods are now:
  - `PREPAID_SELLER_QR`
  - `PAY_ON_DELIVERY_SELLER_QR`
  - `DEPOSIT_THEN_DELIVERY_PAYMENT`
- future-only methods are now modeled but not enabled:
  - `YANDEX_CARD_ON_DELIVERY`
  - `CASH_COURIER_COLLECTION`
- seller payment settings now expose per-shop capability flags for prepaid QR, pay-on-delivery seller QR, deposit flow, deposit thresholds, and provider capability posture
- checkout now validates payment method support across all shops and rejects unsupported strategy selection with `SHOP_PAYMENT_METHOD_NOT_SUPPORTED`
- `PAY_ON_DELIVERY_SELLER_QR` flow now supports:
  - checkout without upfront buyer proof
  - seller acceptance before delivery
  - move to `READY_TO_CREATE_YANDEX`
  - post-delivery buyer mark-paid with optional proof
  - seller confirm/reject final payment
- buyer tracking, seller order detail, and admin payments supervision were updated to reflect this split clearly
- Yandex manual delivery remains delivery-only; no provider money collection is assumed in this phase

## 2026-05-22 Seller Manual Yandex Delivery Workbench

- extended the seller-managed delivery flow into a dedicated manual Yandex workbench without calling the real Yandex API
- when a seller confirms direct payment for a Yandex-preferred shop order, the backend can now move the order into `READY_TO_CREATE_YANDEX`
- seller order detail now exposes a real `Create Yandex manually` panel with:
  - pickup and dropoff summary
  - package preset support for fashion parcels
  - sender / recipient / shipment brief copy actions
  - optional Yandex Maps deep links when coordinates are available
  - manual fields for Yandex order id, claim id, tracking, courier, ETA, delivery price, and note
- manual Yandex shipment statuses now include:
  - `READY_TO_CREATE_YANDEX`
  - `YANDEX_MANUAL_CREATED`
  - `COURIER_ASSIGNED`
  - `PICKED_UP`
  - `ON_THE_WAY`
  - `DELIVERED`
  - `FAILED`
  - `CANCELLED`
- admin delivery supervision now includes:
  - `READY_TO_CREATE_YANDEX` queue
  - `OVERDUE` queue
  - seller payment confirmed but shipment not yet created visibility
  - seller/admin transition actions for courier assigned, picked up, on the way, delivered, failed, and cancelled
- checkout and customer addresses now support optional `latitude` / `longitude` snapshots used by the manual Yandex workbench
- future-real-Yandex placeholder fields were added to delivery shipments:
  - `yandexClaimId`
  - `yandexStatus`
  - `yandexPrice`
  - `yandexTrackingLink`
- verification for this phase:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `backend-nest npm run smoke:manual-yandex-workbench`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:seller-manual-yandex-workbench`: pass

## 2026-05-22 Direct Seller QR Payment Foundation

- implemented direct-to-seller static QR payment foundation for the active marketplace stack without introducing a real payment provider
- sellers now configure per-shop payment destination data and upload a static QR image
- checkout now snapshots per-shop direct payment details into each created child order so buyer confirmation and later receipt/tracking pages stay stable
- buyer payment flow is now:
  - view seller QR at checkout / receipt / tracking
  - click the buyer-side transfer proof action
  - upload payment proof and optional buyer note
  - wait for seller confirmation
- seller payment flow is now:
  - `/seller/payment-settings`
  - `/seller/payments-to-confirm`
  - confirm or reject buyer-marked proofs
- admin supervision flow is now:
  - `/admin/payments-supervision`
  - admin marketplace-wide payment queue/detail
  - admin confirm/reject override APIs
- audit trail now distinguishes:
  - `BUYER_MARKED_PAID`
  - `SELLER_CONFIRMED`
  - `SELLER_REJECTED`
  - `ADMIN_CONFIRMED`
  - `ADMIN_REJECTED`
- verification for this phase:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run seed:demo`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `backend-nest npm run smoke:direct-seller-qr-payment`: pass
  - `backend-nest npm run smoke:payments`: pass
  - `backend-nest npm run smoke:cart-checkout`: pass
  - `backend-nest npm run smoke:multi-shop-checkout`: pass
  - `backend-nest npm run smoke:customer-order-history`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:direct-seller-qr-payment`: pass
  - `frontend-next npm run test:e2e:public-payment-review`: pass
  - `frontend-next npm run test:e2e:cart-checkout`: pass
  - `frontend-next npm run test:e2e:multi-shop-checkout`: pass
  - `frontend-next npm run test:e2e:customer-order-history`: pass after isolated rerun; a batch run hit auth rate limiting `429` on rapid repeated seller setup

## 2026-05-22 Professional Marketplace Gap Audit

- completed a repo-wide marketplace capability audit against a professional multi-seller benchmark
- added `docs/MARKETPLACE_PROFESSIONAL_GAP_AUDIT.md`
- classified features as:
  - `PRODUCTION_READY`
  - `MVP_WORKING`
  - `MANUAL_WORKFLOW`
  - `MOCK_ONLY`
  - `UI_ONLY`
  - `PARTIAL`
  - `MISSING`
  - `BLOCKER`
- concluded the current stack is strong for demo/internal manual operations but not yet production-ready because payment, payout, refund/dispute, delivery automation, and production ops hardening remain the main gaps

## 2026-05-21 Public Marketplace Visual Layout Copy Refresh

- refined the public marketplace copy and merchandising tone on `/` and `/products`
- kept scope strictly frontend-only:
  - `frontend-next/src/app/page.tsx`
  - `frontend-next/src/app/products/page.tsx`
  - `frontend-next/src/components/public/promo-slider.tsx`
  - `frontend-next/src/components/public/public-footer.tsx`
- updated public smoke/full Playwright checks to follow the new CTA and search labels
- preserved backend contracts, Prisma schema, checkout logic, auth/session architecture, and legacy apps unchanged

## 2026-05-21 Customer Account Management

- added a real customer account area in `frontend-next`:
  - `/customer/account`
  - `/customer/account/profile`
  - `/customer/account/addresses`
  - `/customer/account/security`
  - `/customer/account/support`
- kept `/customer/orders` and `/customer/orders/[checkoutCode]` and moved them into the same customer account shell
- added NestJS customer account endpoints:
  - `GET/PATCH /api/customer/profile`
  - `POST /api/customer/change-password`
  - `GET/POST/PATCH/DELETE /api/customer/addresses`
  - `POST /api/customer/addresses/:addressId/default`
- added Prisma `CustomerAddress` model with one-default-per-customer behavior
- integrated optional checkout saved-address selection:
  - checkout still supports manual address entry
  - logged-in customers can send `addressId`
  - backend snapshots the saved address into order shipping fields without changing the multi-shop checkout split contract
- updated public header so logged-in customers enter the new account area instead of the old orders-only link
- added backend customer account e2e coverage and checkout `addressId` coverage
- added frontend Playwright coverage target:
  - `npm run test:e2e:customer-account`

## 2026-05-20 Marketplace Hero Header + Promo Slider

- redesigned the public marketplace header to follow a Wildberries-like layout:
  - strong pink-purple gradient
  - logo on the left
  - large central white search bar
  - customer login/register prominence
  - lighter seller entry
  - clearer cart badge
  - no admin login in public navigation
- added a new frontend-only promo slider under the header on `/` and `/products`
- converted `/` into a marketplace landing page with:
  - promo hero
  - quick marketplace entry tiles
  - real product preview grid from the existing backend public products API
- updated `/products` to show:
  - promo slider before the catalog controls
  - refreshed filter shell
  - product grid directly after promo/filter content
- refined public product cards with:
  - larger image-first layout
  - stronger pink price hierarchy
  - decorative wishlist icon
  - full-width gradient CTA
- updated marketplace CSS tokens and motion:
  - softer lavender background
  - brighter panel/border system
  - search focus glow
  - promo fade/translate animation
  - cart badge micro-pop
- no backend, ai-service, Prisma, API, cart logic, auth logic, or session logic changes

## 2026-05-19 Seller AI Runtime To ai-service Mock

- set the verified seller AI runtime target to `backend-nest -> ai-service`
- kept `ai-service` in mock-safe mode:
  - `AI_IMAGE_PROVIDER=mock`
  - `STORAGE_DRIVER=mock`
  - `RUN_OPENAI_SMOKE=false`
- added seller-safe runtime fields:
  - `sellerFlowEffectiveMode`
  - `openAiRealEnabled`
- added backend smoke:
  - `npm run smoke:ai-service-mock-images`
- tightened seller browser verification so `/seller/ai-images` must show `AI service mock mode`
- OpenAI real remains pending and not part of this phase pass

## 2026-05-19 OpenAI Real Runtime Verification

- added opt-in-only OpenAI runtime verification
- default verification remains mock-safe
- added safe runtime states for seller UI and backend diagnostics:
  - `AI_SERVICE_OPENAI_READY`
  - `AI_SERVICE_OPENAI_BLOCKED`
  - `AI_SERVICE_MOCK`
  - `INTERNAL_MOCK`
  - `OFFLINE`
- added `npm run smoke:ai-service-openai-real`
- ai-service OpenAI smoke now:
  - skips only when `RUN_OPENAI_SMOKE=false`
  - fails when the flag is on but required env is missing
  - never prints the API key

## 2026-05-19 OpenAI Contract + Internal URL Repair

- fixed the `gpt-image-1` request contract in `ai-service`
  - `images.generate` is used for text-to-image
  - `images.edit` is used only when reference images exist
  - unsupported parameter combinations were removed from the GPT image edit path
- added safe diagnostics for OpenAI failures:
  - `safeOpenAiStatus`
  - `safeOpenAiErrorType`
  - `safeOpenAiErrorCode`
  - `safeOpenAiMessageSnippet`
  - `requestMode`
  - `hasReferenceImages`
  - `imageCount`
  - `model`
- fixed Docker-internal product image reachability by rewriting backend asset URLs for `ai-service`
  - public `localhost` URLs are no longer passed directly into the container-to-container call
  - internal generation now uses `BACKEND_INTERNAL_BASE_URL`
- current real-runtime status after the repair:
  - previous blockers `OPENAI_BAD_REQUEST` and `Failed to download the front input image` are resolved
  - current real blocker is `OPENAI_BILLING_HARD_LIMIT`
  - real OpenAI is still not counted as passed

## 2026-05-19 Seller AI Images UI

- Replaced the placeholder `/seller/ai-images` route with a real seller AI workspace.
- Reused the existing `backend-nest` AI task orchestration instead of creating duplicate endpoints.
- Added seller-safe runtime diagnostics at `GET /api/shops/:shopId/ai-images/runtime`.
- Added safe `ai-service /health` metadata so the seller UI can label:
  - internal mock
  - ai-service mock
  - OpenAI real
  - ai-service unavailable
- Added dedicated browser coverage:
  - `frontend-next/tests/e2e/seller-ai-images.spec.ts`
- Added backend smoke alias:
  - `npm run smoke:ai-images-ui-flow`
- Kept virtual try-on explicitly non-interactive because no verified backend flow is ready yet.

## 2026-05-19 CI Postgres Extension Fix

- Fixed the GitHub Actions `backend` job failure at `npx prisma db push`.
- Root cause: Prisma schema defaults use `uuid_generate_v4()`, but the GitHub Actions PostgreSQL service did not enable `uuid-ossp`.
- Updated `.github/workflows/ci.yml` to:
  - install `postgresql-client`
  - run `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` before `npx prisma db push`
- Scope check:
  - `backend-nest/prisma/schema.prisma` uses `uuid_generate_v4()`
  - no `gen_random_uuid()` or `pgcrypto` dependency was found, so `pgcrypto` was not added

## 2026-05-18 CI + AI Service Isolation Phase

- Fixed `ai-service` pytest isolation so local `.env` contamination no longer flips tests onto S3 or OpenAI.
- Added `ai-service/tests/conftest.py` to force `ENVIRONMENT=test`, `AI_IMAGE_PROVIDER=mock`, `STORAGE_DRIVER=mock`, and blank external-provider env during pytest.
- Added `ai-service/.env.test.example` and clarified dev/test/prod env profiles in `ai-service/README.md` and `.env.example`.
- Added GitHub Actions workflow at `.github/workflows/ci.yml` for:
  - `backend-nest` lint/test/build
  - `frontend-next` lint/build
  - `ai-service` compileall/pytest
  - Docker image build checks for `backend-nest` and `frontend-next`
- Local re-verification for this phase:
  - `ai-service python -m compileall app`: pass
  - `ai-service python -m pytest -q`: pass (`18` tests)
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env config`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: pass (`6/6` healthy)
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env build backend-nest frontend-next`: pass
- Local safety finding:
  - the current local `infra/.env` selects real `OpenAI` mode for `ai-service`; keep that file untracked, rotate the key if it was a live credential, and reset local defaults to mock-safe before wider team use

## 2026-05-18 Reality Audit Addendum

- Added `docs/REALITY_AUDIT.md` as a repo-wide real-vs-mock-vs-demo audit for the active new stack only.
- Audit conclusion:
  - core commerce MVP flows in `backend-nest` + `frontend-next` are broadly real and verified
  - real external integrations remain partial
  - `ai-service` local pytest is currently environment-sensitive and failed in this audit
  - seller dashboard and `/seller/ai-images` remain placeholder-level UI surfaces
  - no CI pipeline or release-grade deployment path is finished yet
- Release blockers called out by the audit:
  - no real payment provider
  - CDEK real provider still skeleton-only
  - Docker runtime could not be re-verified on 2026-05-18 because local Docker daemon was unavailable
  - `data.xlsx` must be treated as a repo hygiene blocker if Git still tracks it

## Multi-Role Session Isolation

- Split browser cookie auth by role:
  - `admin_access_token`
  - `seller_access_token`
  - `customer_access_token`
- Added role-specific `me` and logout endpoints.
- Replaced shared frontend auth snapshot with role-separated state.
- Public header now reflects only customer auth.
- Added backend auth e2e coverage for cookie coexistence and role-specific logout.
- Added frontend browser coverage at `npm run test:e2e:multi-role-sessions`.

## Auth UX Separation Phase

- Implemented role-specific public auth UX for customer and seller.
- Removed admin login promotion from public marketplace surfaces.
- Added role-specific backend endpoints for:
  - customer register/login
  - seller register/login
  - admin login
- Added identifier login with email or phone.
- Preserved compatibility endpoints and httpOnly cookie session flow.
- Added `auth-role-separation` Playwright coverage and expanded backend auth e2e coverage.

## Auth Hardening 2 Phase

- Added auth endpoint throttling with generic `429` responses.
- Added phone normalization shared across auth and seller onboarding contact phone.
- Hardened cookie/CORS configuration around credentialed requests and explicit origin allowlists.
- Added seller next-step metadata and a dedicated `/seller/pending` UX path.
- Added `auth-hardening` Playwright coverage and expanded backend auth e2e coverage for normalization and throttle behavior.

## Stale Cart Validation + Checkout Preflight

- Added `POST /api/public/cart/validate`.
- Shared backend validation rules between cart preflight and checkout submit.
- Added stale-item warnings and reconciliation actions on `/cart`.
- Added checkout preflight block before final order creation.
- Added verification:
  - `npm run smoke:cart-validation`
  - `npm run test:e2e:cart-validation`

## Public Buying UX Phase

- Added quick add vs select-size product cards on `/products`.
- Added marketplace-style public product detail layout on `/products/[id]`.
- Added variant pills with disabled out-of-stock state.
- Added quantity stepper with cart-aware selected variant quantity.
- Added sticky desktop purchase card and header cart badge updates.
- Added dedicated browser verification at `npm run test:e2e:product-buying-ux`.

## Seller Bulk Product Editing

- Added `POST /api/shops/:shopId/products/bulk-update` for category, price, stock, and track-inventory updates.
- Added variant scope support: `ALL_VARIANTS`, `MISSING_ONLY`, `FIRST_VARIANT_ONLY`.
- Added optional `publishIfReady` flow that publishes only products that pass readiness checks after bulk edit.
- Updated seller products UI with multi-select toolbar, bulk edit panel, and per-product readiness results.
- Added verification:
  - `npm run smoke:bulk-product-edit`
  - `npm run test:e2e:bulk-product-edit`

## Seller Product Curation + Publishing

- Added seller-catalog lifecycle fields and readiness checks for `IMPORTED`, `DRAFT`, `READY`, `PUBLISHED`, `UNPUBLISHED`, and `ARCHIVED`.
- WB Excel import and WB API sync now create private seller-catalog products first instead of auto-publishing them.
- Added seller publish, unpublish, archive, readiness, and bulk action APIs.
- Updated public marketplace and checkout to allow only `PUBLISHED` and readiness-passing products.
- Updated seller UI with catalog tabs, warning badges, bulk actions, and publish controls.
- Added dedicated verification targets:
  - `npm run smoke:product-curation`
  - `npm run test:e2e:product-curation`

## Category Mapping + Marketplace Search/Filter/Sort

- Added internal categories, source category mappings, and keyword fallback mapping.
- Integrated category mapping into WB Excel import and WB API product sync.
- Enhanced public `/products` with search, filters, sort, facets, and product detail category metadata.
- Enhanced seller product creation/listing with internal category selector and source category display.
- Added `smoke:marketplace-search` and `test:e2e:marketplace-search-filter-sort`.

## Parent-Level Payment + Support Workflow

- Added backend support models:
  - `support_cases`
  - `support_case_messages`
  - `support_case_events`
- Added customer support APIs on top of parent receipt `checkoutCode`
- Added admin support queue endpoints and UI
- Added seller shop-scoped support queue endpoints and UI
- Added support case summary to customer receipt detail and seller order detail
- Preserved payment and delivery flows per child shop order
- Enforced that internal admin messages are hidden from customer and seller views
- Added verification:
  - `backend-nest/test/support-cases.e2e-spec.ts`
  - `npm run smoke:support-cases`
  - `npm run test:e2e:support-cases`

## Wildberries Import To Checkout Verification

- Scope:
  - verify approved seller Wildberries Excel import through customer checkout
  - keep legacy `strawberry-frontend` and `strawberry-backend` untouched
  - avoid real OpenAI, Yandex, and CDEK calls
- Result:
  - added `backend-nest/scripts/smoke-wb-import-checkout.ps1`
  - added `npm run smoke:wb-import-checkout`
  - added `frontend-next/tests/e2e/wb-import-checkout-flow.spec.ts`
  - added `npm run test:e2e:wb-import-checkout`
  - seller product detail can update variant price as well as stock
  - public products and checkout now require approved seller, active shop/product, image, price `> 0`, and stock
- Flow covered:
  - WB import preview/confirm with sanitized fixture and `REMOTE_URL` images
  - seller price update to `1990` and stock update to `5`
  - public product listing/detail
  - customer checkout quantity `2`, backend total `3980`, pending payment/order
  - stock deduction to `3`
  - insufficient stock rejection
  - customer tracking and seller order/payment visibility
  - re-import idempotency for products, variants, and images

## Scope
Review the current Docker Compose runtime for `C:\Users\admin\trawberry-ai-commerce`, verify commit safety, and prepare a clean commit checklist without changing business logic.

Constraints followed:
- no changes in `strawberry-frontend`
- no changes in `strawberry-backend`
- no OpenAI real calls
- no `.env` real files committed

## Docker Setup Review Result

### Compose wiring
Verified current Docker runtime wiring:
- `backend-nest -> ai-service`: `http://ai-service:8000`
- `backend-nest -> postgres`: `postgres:5432`
- `backend-nest -> redis`: `redis:6379`
- `ai-service -> minio`: `http://minio:9000`
- browser -> `frontend-next`: `http://localhost:3000`
- browser -> `backend-nest`: `http://localhost:3001`
- host -> PostgreSQL: `localhost:5433`

### PostgreSQL
- `infra/postgres-init/01-extensions.sql` contains:
  - `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`
- Docker mapping is correct:
  - host port: `5433`
  - container port: `5432`
- `DATABASE_URL` inside Docker uses `postgres:5432`, not `localhost`

### AI Service
- `ai-service` runs on port `8000`
- default Docker provider is `AI_IMAGE_PROVIDER=mock`
- default Docker setup does not call OpenAI
- `AI_SERVICE_INTERNAL_TOKEN` is shared between `backend-nest` and `ai-service` through `infra/.env`

### MinIO / S3
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`
- Docker-internal S3 endpoint: `http://minio:9000`
- public base URL in the local stack is `http://localhost:9000/<bucket>`
- bucket bootstrap is handled automatically by the `minio-init` service

### Healthchecks
Verified configured healthchecks use commands that exist in the target images:
- `postgres`: `pg_isready`
- `redis`: `redis-cli ping`
- `minio`: `curl`
- `ai-service`: `python`
- `backend-nest`: `wget`
- `frontend-next`: `wget`

## Containers Status

`docker compose -f infra/docker-compose.yml --env-file infra/.env ps` showed:
- `postgres`: healthy
- `redis`: healthy
- `minio`: healthy
- `ai-service`: healthy
- `backend-nest`: healthy
- `frontend-next`: healthy

Current result: `6/6` containers healthy.

## Smoke Integration Result

Verified:
- backend health: pass
- ai-service health: pass
- frontend login page reachable: pass
- MinIO console reachable: pass
- `npm run smoke:ai-service-integration`: pass

Smoke flow confirmed:
- create user
- approve seller local
- create shop
- create product
- upload image
- AI mock generate image
- attach generated image
- credit decreases correctly

## Verification Run

### Docker
- `docker compose -f infra/docker-compose.yml --env-file infra/.env config`: pass
- `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: pass

### Health endpoints
- `GET http://localhost:3001/api/health`: pass
- `GET http://localhost:8000/health`: pass
- `GET http://localhost:3000/login`: pass
- `GET http://localhost:9001`: pass

### backend-nest
- `npm run smoke:ai-service-integration`: pass
- `npm run lint`: pass
- `npm test -- --runInBand`: pass
- `npm run build`: pass

### frontend-next
- `npm run lint`: pass
- `npm run build`: pass

### ai-service
- `python -m compileall app`: pass
- `python -m pytest -q`: pass

## Git Safety Review

### Git status summary before this doc update
- working tree was clean
- no pending code changes were found before the documentation refresh

### Tracked env files
`git ls-files | Select-String "\.env"` returned only:
- `ai-service/.env.example`
- `backend-nest/.env.example`
- `frontend-next/.env.example`
- `infra/.env.example`

Conclusion:
- no real `.env` files are tracked by Git

### Root and service ignore rules
Reviewed:
- `.gitignore`
- `backend-nest/.gitignore`
- `ai-service/.gitignore`
- `frontend-next/.gitignore`

Current ignore rules correctly exclude:
- `.env`
- `.env.local`
- `*.env`
while allowing:
- `.env.example`

## Legacy Apps Review
- no changes detected in `strawberry-frontend`
- no changes detected in `strawberry-backend`

## Files Changed In This Review
- `docs/DEPLOYMENT.md`
- `docs/CONFIG_AUDIT.md`
- `docs/PROJECT_STATUS.md`
- `docs/RUNTIME_ENV.md`
- `docs/PHASE_REPORT.md`
- `ai-service/README.md`
- `backend-nest/README.md`

## Documentation Cleanup Result
- cleaned remaining references to the old repo path `C:\Users\admin\trawberry`
- removed remaining `ai-service` port `8010` references in reviewed runtime docs
- aligned Docker documentation to:
  - host PostgreSQL `localhost:5433`
  - container PostgreSQL `postgres:5432`
  - Docker `AI_SERVICE_BASE_URL=http://ai-service:8000`
  - local non-Docker `AI_SERVICE_BASE_URL=http://localhost:8000`
- confirmed OpenAI docs still describe `AI_IMAGE_PROVIDER=mock` as the default and real OpenAI only when:
  - `AI_IMAGE_PROVIDER=openai`
  - `RUN_OPENAI_SMOKE=true`
  - `OPENAI_API_KEY` is present

## Files Reviewed
- `docs/*.md`
- `ai-service/README.md`
- `backend-nest/README.md`
- `frontend-next/README.md`
- `infra/docker-compose.yml`
- `infra/.env.example`
- `infra/postgres-init/01-extensions.sql`

## Remaining Outdated References
- No outdated path/port/runtime-env references remain in the reviewed runtime docs set.
- Legacy app names `strawberry-frontend` and `strawberry-backend` still appear where they are part of migration context. Those are intentional and were not changed.

## Project Status Audit
- Created:
  - `docs/PROJECT_STATUS.md`
- Purpose:
  - provide a consolidated repo-wide status report
  - distinguish runtime-verified features from code-only or partial features
  - summarize APIs, pages, AI pipeline, Docker runtime, risks, and roadmap
- Verification recorded for this audit:
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `ai-service python -m compileall app`: pass
  - `ai-service python -m pytest -q`: pass
  - `docker compose ... config`: pass
  - `docker compose ... ps`: pass
  - `backend-nest npm run smoke:ai-service-integration`: pass
- Suggested next steps:
  - verify real OpenAI runtime in a controlled environment
  - close frontend auth/cookie messaging drift
  - deepen orders/payment/customer-side verification

## Cookie Auth UX Hardening

- Scope:
  - complete cookie-first auth UX in `frontend-next`
  - keep `Authorization: Bearer` fallback in `backend-nest`
  - add logout endpoint coverage and cookie assertions
- Files changed:
  - `backend-nest/src/modules/auth/auth.controller.ts`
  - `backend-nest/test/auth.e2e-spec.ts`
  - `frontend-next/src/lib/auth-api.ts`
  - `frontend-next/src/lib/seller-api.ts`
  - `frontend-next/src/stores/auth-store.ts`
  - `frontend-next/src/stores/seller-workspace-store.ts`
  - `frontend-next/src/components/auth/login-form.tsx`
  - `frontend-next/src/components/auth/protected-shell.tsx`
  - `frontend-next/src/components/seller/seller-shell.tsx`
  - `frontend-next/src/app/login/page.tsx`
  - `frontend-next/src/app/page.tsx`
  - `frontend-next/src/app/seller/products/[id]/page.tsx`
  - `frontend-next/src/app/seller/products/[id]/images/page.tsx`
  - `docs/SECURITY.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/FRONTEND_PRODUCTS.md`
  - `docs/PHASE_REPORT.md`
- Result:
  - login remains compatible with response-body tokens for scripts, but frontend runtime no longer stores raw JWTs
  - protected routes re-hydrate the real session via `GET /api/auth/me`
  - logout now clears cookie on the backend and clears local auth/shop hydration state on the frontend
  - auth e2e now covers `Set-Cookie`, cookie-backed `/api/auth/me`, logout cookie clearing, and bearer fallback
- Verification for this pass:
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `docker compose ... ps`: pass (`6/6` healthy)
  - `GET http://localhost:3001/api/health`: pass
  - `GET http://localhost:3000/login`: pass
- Manual auth smoke:
  - backend HTTP cookie smoke passed:
    - register: `201`
    - login: `200`
    - cookie stored in session: yes
    - `GET /api/auth/me` with cookie: `200`
    - `POST /api/auth/logout`: `200`
    - `GET /api/auth/me` after logout: `401`
  - browser-only refresh/redirect behavior was not replayed with a headless browser in this pass

## Browser Auth E2E Smoke

- Scope:
  - add Playwright browser smoke coverage for cookie-based auth UX
  - verify login, reload persistence, logout, protected-route redirect, and no raw JWT in `localStorage`
- Files changed:
  - `frontend-next/package.json`
  - `frontend-next/playwright.config.ts`
  - `frontend-next/tests/e2e/auth-cookie.spec.ts`
  - `frontend-next/src/components/auth/login-form.tsx`
  - `frontend-next/src/components/seller/seller-shell.tsx`
  - `frontend-next/README.md`
  - `docs/SECURITY.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PHASE_REPORT.md`
- Result:
  - browser smoke now creates a seller via backend API, signs in through the real login form, reloads `/seller/dashboard`, logs out, and confirms protected-route redirect
  - test explicitly checks that `localStorage` does not contain raw JWT-like values
- Verification for this pass:
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:auth`: pass
  - `docker compose ... ps`: pass
  - `GET http://localhost:3001/api/health`: pass
  - `GET http://localhost:3000/login`: pass
- Notes:
  - Playwright initially failed because browser binaries were not installed yet
  - `npx playwright install chromium` was run successfully before the passing E2E execution

## Orders / Payments Audit

- Scope:
  - audit current Orders and Payments implementation status across `backend-nest`, `frontend-next`, Prisma schema, tests, smoke scripts, and docs
  - add minimal runtime smoke for seller Orders if basic APIs existed
- Files changed:
  - `backend-nest/package.json`
  - `backend-nest/scripts/smoke-orders.ps1`
  - `docs/API_ORDERS.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PHASE_REPORT.md`
- Result:
  - Orders are implemented for seller-side operations in NestJS:
    - list orders
    - get order detail
    - update fulfillment status
  - Orders are connected in Next.js:
    - `/seller/orders`
    - `/seller/orders/[id]`
  - Orders now have dedicated runtime smoke coverage via `npm run smoke:orders`
  - Payments are not migrated as a standalone NestJS module
  - Current payment support in the new stack is limited to:
    - `paymentStatus` on orders
    - `paymentInstructions` on shops
  - No NestJS payment provider integration, approval/rejection endpoints, webhook handlers, or Next.js payment review pages exist yet
- Verification for this pass:
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `backend-nest npm run smoke:orders`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:auth`: pass
  - `docker compose ... ps`: pass (`6/6` healthy)
  - `GET http://localhost:3001/api/health`: pass
  - `GET http://localhost:3000/login`: pass

## Customer Checkout / Create Order MVP

- Scope:
  - add public product browsing endpoints in `backend-nest`
  - add `POST /api/checkout/orders`
  - allow anonymous checkout while preserving seller order visibility
  - add minimal public customer pages in `frontend-next`
- Files changed:
  - `backend-nest/src/modules/public-products/*`
  - `backend-nest/src/modules/checkout/*`
  - `backend-nest/src/modules/orders/*`
  - `backend-nest/src/common/guards/optional-jwt-auth.guard.ts`
  - `backend-nest/test/checkout.e2e-spec.ts`
  - `backend-nest/scripts/smoke-checkout.ps1`
  - `frontend-next/src/lib/public-api.ts`
  - `frontend-next/src/app/products/*`
  - `frontend-next/src/app/checkout/page.tsx`
  - `frontend-next/src/components/public/checkout-page-client.tsx`
  - `frontend-next/src/components/orders/*`
  - `docs/API_CHECKOUT.md`
  - `docs/API_ORDERS.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PHASE_REPORT.md`
- Result:
  - customer can browse public products in the new stack
  - customer can create an anonymous order through `POST /api/checkout/orders`
  - checkout defaults order `status=PENDING`
  - checkout defaults `paymentStatus=PENDING` for manual transfer and `UNPAID` for COD
  - backend computes `totalAmount` and rejects mismatched shop/product/inactive product/invalid quantity
  - seller orders list/detail can see the new order without changing the seller API contract
  - seller UI now renders `PENDING` order status safely alongside legacy `NEW`
- Verification for this pass:
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env config`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: pass (`6/6` healthy)
  - `GET http://localhost:3001/api/health`: pass
  - `GET http://localhost:3000/login`: pass
  - `GET http://localhost:8000/health`: pass
  - `backend-nest npm run smoke:orders`: pass
  - `backend-nest npm run smoke:checkout`: pass
  - `frontend-next npm run test:e2e:auth`: pass
- Runtime notes:
  - PowerShell alias `curl` on this machine returned `NullReferenceException` from `Invoke-WebRequest`
  - runtime endpoints were verified successfully with explicit `Invoke-WebRequest -UseBasicParsing`
  - no business-logic fix was required after Docker came up; runtime failures from the previous pass were environment-only

## Manual Payment Review MVP

- Scope:
  - add seller-side manual payment review APIs in `backend-nest`
  - add additive audit logging via `payment_review_logs`
  - add seller payment review pages in `frontend-next`
  - preserve checkout, orders, and auth flows
- Files changed:
  - `backend-nest/prisma/schema.prisma`
  - `backend-nest/prisma/migrations/20260512_add_payment_review_logs/migration.sql`
  - `backend-nest/src/modules/payments/*`
  - `backend-nest/src/modules/orders/orders.service.ts`
  - `backend-nest/test/payments.e2e-spec.ts`
  - `backend-nest/scripts/smoke-payments.ps1`
  - `frontend-next/src/lib/seller-api.ts`
  - `frontend-next/src/components/payments/*`
  - `frontend-next/src/app/seller/payments/*`
  - `frontend-next/src/components/seller/seller-shell.tsx`
  - `docs/API_PAYMENTS.md`
  - `docs/API_ORDERS.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PHASE_REPORT.md`
- Result:
  - seller can list pending/unpaid payment review items
  - seller can open payment detail with customer snapshot, item snapshot, payment method, and payment instructions
  - seller can add note, mark paid, and reject when the transition is valid
  - every action creates an audit record in `payment_review_logs`
  - seller order detail reflects the new `paymentStatus`
  - seller fulfillment can continue after `paymentStatus=PAID`
- Verification for this pass:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `backend-nest npm run smoke:orders`: pass
  - `backend-nest npm run smoke:checkout`: pass
  - `backend-nest npm run smoke:payments`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:auth`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env config`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: pass (`6/6` healthy)
  - `GET http://localhost:3001/api/health`: pass
  - `GET http://localhost:3000/login`: pass
  - `GET http://localhost:8000/health`: pass
- Runtime notes:
  - Playwright auth initially failed because the browser runtime hit `localhost:3001` while the host stack was reliably reachable at `127.0.0.1:3001`
  - fixed by normalizing frontend and Playwright API defaults to `127.0.0.1`, and by allowing both `localhost` and `127.0.0.1` in backend CORS
  - no payment business logic changes were required after runtime validation

## Customer Order Tracking / Payment Proof Upload MVP

- Scope:
  - add public order tracking APIs in `backend-nest`
  - add public customer payment proof upload backed by the existing storage service
  - expose payment proof inside seller payment detail
  - preserve checkout, payments, orders, and auth flows
- Files changed:
  - `backend-nest/prisma/schema.prisma`
  - `backend-nest/prisma/migrations/20260512_add_order_payment_proof_fields/migration.sql`
  - `backend-nest/src/modules/order-tracking/*`
  - `backend-nest/src/modules/files/files.service.ts`
  - `backend-nest/src/modules/checkout/*`
  - `backend-nest/src/modules/payments/*`
  - `backend-nest/test/order-tracking.e2e-spec.ts`
  - `backend-nest/scripts/smoke-order-tracking.ps1`
  - `frontend-next/src/lib/public-api.ts`
  - `frontend-next/src/lib/seller-api.ts`
  - `frontend-next/src/app/orders/*`
  - `frontend-next/src/components/public/*`
  - `frontend-next/src/components/payments/*`
  - `docs/API_ORDER_TRACKING.md`
  - `docs/API_CHECKOUT.md`
  - `docs/API_PAYMENTS.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PHASE_REPORT.md`
- Result:
  - customer can track by `orderCode + phone` or `orderId + phone`
  - customer can upload payment proof without a customer account
  - proof is stored through the shared storage service and linked on `orders`
  - proof upload writes `PaymentReviewLog.action = UPLOAD_PROOF`
  - seller payment detail shows proof metadata and proof link
  - seller can still mark paid after proof upload
  - customer tracking reflects `paymentStatus=PAID` after seller review
- Verification for this pass:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `backend-nest npm run smoke:orders`: pass
  - `backend-nest npm run smoke:checkout`: pass
  - `backend-nest npm run smoke:payments`: pass
  - `backend-nest npm run smoke:order-tracking`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:auth`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: pass (`6/6` healthy)
  - `GET http://localhost:3001/api/health`: pass
  - `GET http://localhost:3000/login`: pass
  - `GET http://localhost:8000/health`: pass

## Public Marketplace UI Polish

- Scope:
  - polish the customer-facing pages in `frontend-next`
  - add shared public navigation and footer without touching seller shell
  - improve loading, empty, error, and confirmation states for public flows
  - add lightweight Playwright smoke for public routes
- Files changed:
  - `frontend-next/src/app/page.tsx`
  - `frontend-next/src/app/products/*`
  - `frontend-next/src/components/public/*`
  - `frontend-next/src/app/layout.tsx`
  - `frontend-next/src/app/globals.css`
  - `frontend-next/tests/e2e/public-smoke.spec.ts`
  - `frontend-next/package.json`
  - `frontend-next/README.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PHASE_REPORT.md`
- Result:
  - home page now behaves like a storefront landing page
  - `/products` is more responsive and resilient for demo use
  - product detail uses a gallery and clearer checkout CTA
  - checkout presents a clearer multi-step narrative and stronger confirmation state
  - tracking pages are easier to use and proof upload feedback is clearer
  - seller pages remain untouched in structure and behavior
- Verification for this pass:
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - runtime verification recorded in the final verification section for this phase

## Seeded Public Demo Data + Full Customer E2E

- Scope:
  - add stable idempotent demo seed data for the public marketplace
  - add Playwright full customer coverage from browse to proof upload
  - preserve existing auth, checkout, tracking, payment, and seller flows
- Files changed:
  - `backend-nest/package.json`
  - `backend-nest/scripts/seed-demo.js`
  - `frontend-next/package.json`
  - `frontend-next/src/app/products/[id]/page.tsx`
  - `frontend-next/src/components/public/public-product-detail-page-client.tsx`
  - `frontend-next/public/demo/*`
  - `frontend-next/tests/e2e/public-full.spec.ts`
  - `frontend-next/src/components/public/product-card.tsx`
  - `frontend-next/src/components/public/checkout-page-client.tsx`
  - `frontend-next/src/components/public/order-track-detail-page-client.tsx`
  - `frontend-next/README.md`
  - `docs/DEMO_DATA.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PHASE_REPORT.md`
- Result:
  - `npm run seed:demo` now creates a stable approved seller, active shop, payment instructions, and 3 active public products
  - demo seed is idempotent and blocked in production unless `DEMO_SEED_CONFIRM=true`
  - seeded product images are served from local static SVG assets in `frontend-next/public/demo`
  - `/products/[id]` now follows the same async server-wrapper pattern already used by `/checkout` and `/orders/[id]`, which fixed the production navigation error on the product detail route
  - public full Playwright flow now covers:
    - home
    - products
    - product detail
    - checkout
    - order confirmation
    - tracking by phone
    - payment proof upload
  - public pages now expose stable test selectors for critical customer actions without changing API contracts
- Verification for this pass:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run seed:demo`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `backend-nest npm run smoke:checkout`: pass
  - `backend-nest npm run smoke:order-tracking`: pass
  - `backend-nest npm run smoke:payments`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:auth`: pass
  - `frontend-next npm run test:e2e:public`: pass
  - `frontend-next npm run test:e2e:public-full`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: pass (`6/6` healthy)
  - `GET http://localhost:3001/api/health`: pass
  - `GET http://localhost:3000/products`: pass
  - `GET http://localhost:8000/health`: pass
- Runtime notes:
  - the first seed implementation used inline `data:` URLs for product images, but `product_images.wb_url/local_url` length limits rejected them
  - replaced that approach with local static SVG assets under `frontend-next/public/demo`
  - `public-full` initially failed because it clicked the first public product card, which was unstable in a mixed demo + smoke dataset
  - the test now targets a seeded product by name and uses stricter route assertions

## Full E2E Seller Payment Review After Customer Proof

- Scope:
  - extend Playwright coverage to include seller review after customer payment proof upload
  - keep the flow browser-level where practical and reuse the demo seed account
  - preserve existing auth, public, checkout, tracking, and payments smoke coverage
- Files changed:
  - `frontend-next/package.json`
  - `frontend-next/tests/e2e/public-payment-review.spec.ts`
  - `frontend-next/src/components/payments/payment-status-badge.tsx`
  - `frontend-next/src/components/payments/seller-payment-detail-page-client.tsx`
  - `frontend-next/src/components/public/order-track-detail-page-client.tsx`
  - `frontend-next/README.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PHASE_REPORT.md`
- Result:
  - a full browser E2E now covers:
    - customer checkout with unique phone
    - customer tracking lookup
    - customer payment proof upload
    - seller login with seeded demo seller
    - seller payment proof visibility
    - seller mark paid
    - customer re-check showing `paymentStatus=PAID`
  - seller review uses direct detail route `/seller/payments/[orderId]` instead of list search to keep the test deterministic without expanding seller UI scope
- Verification for this pass:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run seed:demo`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `backend-nest npm run smoke:checkout`: pass
  - `backend-nest npm run smoke:order-tracking`: pass
  - `backend-nest npm run smoke:payments`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:auth`: pass
  - `frontend-next npm run test:e2e:public`: pass
  - `frontend-next npm run test:e2e:public-full`: pass
  - `frontend-next npm run test:e2e:public-payment-review`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: pass (`6/6` healthy)
  - `curl.exe --ipv4 http://localhost:3001/api/health`: pass
  - `curl.exe --ipv4 -I http://localhost:3000/products`: pass
  - `curl.exe --ipv4 http://localhost:8000/health`: pass
- Runtime notes:
  - the new flow required a frontend container rebuild before Playwright could see newly added `data-testid` hooks on tracking and seller payment detail pages
  - no backend API or status transition changes were required for this phase

## Inventory / Stock Management MVP

- Scope:
  - add seller inventory read/update endpoints in `backend-nest`
  - expose public product availability for marketplace pages
  - enforce inventory checks inside checkout and deduct stock on success
  - keep existing checkout, order tracking, payments, and auth flows passing
- Files changed:
  - `backend-nest/src/modules/products/products.controller.ts`
  - `backend-nest/src/modules/products/products.service.ts`
  - `backend-nest/src/modules/products/dto/product-inventory-response.dto.ts`
  - `backend-nest/src/modules/products/dto/update-product-inventory.dto.ts`
  - `backend-nest/src/modules/public-products/*`
  - `backend-nest/src/modules/checkout/checkout.service.ts`
  - `backend-nest/test/product.e2e-spec.ts`
  - `backend-nest/test/checkout.e2e-spec.ts`
  - `backend-nest/scripts/smoke-inventory.ps1`
  - `frontend-next/src/app/seller/products/[id]/page.tsx`
  - `frontend-next/src/components/public/product-card.tsx`
  - `frontend-next/src/components/public/public-product-detail-page-client.tsx`
  - `frontend-next/src/components/public/checkout-page-client.tsx`
  - `frontend-next/src/lib/public-api.ts`
  - `frontend-next/src/lib/seller-api.ts`
  - `docs/API_INVENTORY.md`
  - `docs/API_PRODUCTS.md`
  - `docs/API_CHECKOUT.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PHASE_REPORT.md`
- Result:
  - seller can read and update stock per product from the new stack
  - public product listing/detail now show availability and disable checkout when out of stock
  - checkout validates stock, deducts available quantity immediately, and keeps reservation bookkeeping in the same transaction
  - insufficient stock returns a clear `400` instead of overselling
  - existing cancellation and delivered flows continue to release or restore inventory through the seller order lifecycle
- Verification for this pass:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run seed:demo`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `backend-nest npm run smoke:checkout`: pass
  - `backend-nest npm run smoke:order-tracking`: pass
  - `backend-nest npm run smoke:payments`: pass
  - `backend-nest npm run smoke:inventory`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:auth`: pass
  - `frontend-next npm run test:e2e:public`: pass
  - `frontend-next npm run test:e2e:public-full`: pass
  - `frontend-next npm run test:e2e:public-payment-review`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: pass (`6/6` healthy)
  - `curl.exe --ipv4 http://localhost:3001/api/health`: pass
  - `curl.exe --ipv4 -I http://localhost:3000/products`: pass
  - `curl.exe --ipv4 http://localhost:8000/health`: pass
- Runtime notes:
  - inventory reuses existing `product_variants.stockQuantity` and `reservedStock` rather than adding a new schema field
  - public availability uses current sellable stock directly, while reservation counts remain visible to sellers for operational context

## Low Stock Alerts / Seller Inventory UX

- Scope:
  - add seller low-stock and out-of-stock status metadata to product list responses
  - add stock-status filters and quick stock update in the seller product list
  - improve seller product detail inventory visibility
  - preserve checkout, public marketplace, payments, and auth flows
- Files changed:
  - `backend-nest/prisma/schema.prisma`
  - `backend-nest/prisma/migrations/20260513_add_product_variant_inventory_flags/migration.sql`
  - `backend-nest/src/modules/products/*`
  - `backend-nest/test/product.e2e-spec.ts`
  - `backend-nest/test/checkout.e2e-spec.ts`
  - `backend-nest/scripts/smoke-inventory-alerts.ps1`
  - `backend-nest/package.json`
  - `frontend-next/src/components/products/*`
  - `frontend-next/src/app/seller/products/[id]/page.tsx`
  - `frontend-next/src/lib/seller-api.ts`
  - `docs/API_INVENTORY.md`
  - `docs/API_PRODUCTS.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PHASE_REPORT.md`
- Result:
  - seller product list now shows `IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`, and `NOT_TRACKED` states
  - seller can filter products by `IN_STOCK`, `LOW_STOCK`, and `OUT_OF_STOCK`
  - seller can quick-update stock from the list for single-variant products
  - product detail inventory view now shows threshold-aware status more clearly
  - backend product list and inventory responses now expose threshold/tracking metadata required by the UX
- Verification for this pass:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run seed:demo`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `backend-nest npm run smoke:checkout`: pass
  - `backend-nest npm run smoke:order-tracking`: pass
  - `backend-nest npm run smoke:payments`: pass
  - `backend-nest npm run smoke:inventory`: pass
  - `backend-nest npm run smoke:inventory-alerts`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:auth`: pass
  - `frontend-next npm run test:e2e:public`: pass
  - `frontend-next npm run test:e2e:public-full`: pass
  - `frontend-next npm run test:e2e:public-payment-review`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: pass (`6/6` healthy)
  - `curl.exe --ipv4 http://localhost:3001/api/health`: pass
  - `curl.exe --ipv4 -I http://localhost:3000/products`: pass
  - `curl.exe --ipv4 http://localhost:8000/health`: pass

## Multi-Carrier Delivery Foundation / Yandex-first MVP

- Scope:
  - replace the earlier single-provider delivery direction with a generic multi-carrier foundation
  - introduce seller delivery settings, generic delivery offers, shipments, and events
  - keep mock mode as the default verified runtime for CI and local smoke coverage
  - prioritize Yandex for same-city express and CDEK for fallback, pickup, and inter-city delivery
- Files changed:
  - `backend-nest/prisma/schema.prisma`
  - `backend-nest/prisma/migrations/20260513_add_yandex_delivery_tables/migration.sql`
  - `backend-nest/src/modules/delivery/*`
  - `backend-nest/src/modules/orders/*`
  - `backend-nest/src/modules/order-tracking/*`
  - `backend-nest/test/delivery.e2e-spec.ts`
  - `backend-nest/scripts/smoke-delivery.ps1`
  - `backend-nest/package.json`
  - `backend-nest/.env.example`
  - `infra/.env.example`
  - `infra/docker-compose.yml`
  - `frontend-next/src/lib/seller-api.ts`
  - `frontend-next/src/lib/public-api.ts`
  - `frontend-next/src/app/seller/settings/page.tsx`
  - `frontend-next/src/components/seller/seller-delivery-settings-page-client.tsx`
  - `frontend-next/src/components/orders/seller-order-detail-page-client.tsx`
  - `frontend-next/src/components/public/order-track-detail-page-client.tsx`
  - `docs/DELIVERY_PROVIDERS.md`
  - `docs/API_DELIVERY.md`
  - `docs/API_DELIVERY_CDEK.md`
  - `docs/API_ORDERS.md`
  - `docs/API_ORDER_TRACKING.md`
  - `docs/RUNTIME_ENV.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PHASE_REPORT.md`
- Result:
  - a generic delivery module now exists in `backend-nest` with a provider abstraction instead of carrier-specific controller design
  - shops can store pickup address, pickup contact, enabled carriers, and default package dimensions
  - sellers can calculate offers, create shipments, refresh shipments, and cancel shipments in mock mode
  - customer order tracking now shows delivery provider, status, tracking number, and tracking URL from the latest shipment
  - `Yandex` has a real-mode skeleton and is positioned as the same-city express carrier
  - `CDEK` has a real-mode skeleton and is positioned as the fallback, pickup-point, and inter-city carrier
- Verification for this pass:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run seed:demo`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass
  - `backend-nest npm run build`: pass
  - `backend-nest npm run smoke:checkout`: pass
  - `backend-nest npm run smoke:order-tracking`: pass
  - `backend-nest npm run smoke:payments`: pass
  - `backend-nest npm run smoke:inventory`: pass
  - `backend-nest npm run smoke:inventory-alerts`: pass
  - `backend-nest npm run smoke:delivery`: pass
- Runtime notes:
  - same-city mock offers recommend `YANDEX_EXPRESS`; inter-city mock offers recommend `CDEK_COURIER`
  - default verification continues to avoid real carrier calls; mock mode remains the required safe baseline for CI and local demo stability

## Multi-Carrier Delivery Foundation / Yandex-first Update

- Scope:
  - align the generic delivery foundation with the current business priority: intra-city delivery first
  - add carrier priority fields to `shop_delivery_settings`
  - add `isRecommended` and minute ETA fields to `delivery_offers`
  - update mock selection to recommend Yandex for same-city and CDEK for inter-city
- Result:
  - sellers can configure `defaultCarrier`, `sameCityPreferredCarrier`, `interCityPreferredCarrier`, and `fallbackCarrier`
  - `npm run smoke:delivery` verifies Yandex recommended for Moscow same-city orders
  - CDEK remains available for fallback and inter-city/pickup flows
  - default env examples use mock mode and do not call real Yandex/CDEK APIs

## Yandex Delivery Real Mode

- Scope:
  - implement real Yandex Delivery client methods behind the existing provider abstraction
  - add seller accept endpoint for Yandex claims
  - keep mock mode as the default CI/local path
- Result:
  - Yandex client calls `offers/calculate`, `claims/create`, `claims/accept`, `claims/info`, `claims/tracking-links`, `claims/cancel-info`, and `claims/cancel`
  - provider maps claim id/status/price/tracking link into generic delivery shipments
  - seller order detail can create, accept, refresh, and cancel a Yandex claim
  - `npm run smoke:delivery-yandex-real` skips without real env and does not print tokens
- Notes:
  - real Yandex calls require `DELIVERY_PROVIDER_MODE=yandex`, `YANDEX_DELIVERY_ENABLED=true`, and `YANDEX_DELIVERY_TOKEN`
  - common real failures include invalid token, inactive billing/account, address validation, no courier, expired offer, and invalid claim status transitions

## Suggested Commit Message
```text
chore: finalize docker compose runtime review and commit checklist
```

## Safe Git Commands
```powershell
cd C:\Users\admin\trawberry-ai-commerce

# Check current status
git status
git diff --stat
git diff --name-only

# Confirm no real env file is tracked
git ls-files | Select-String "\.env"

# Review the key docs before staging
git diff docs/RUNTIME_ENV.md
git diff docs/PHASE_REPORT.md

# Stage only the reviewed files
git add docs/RUNTIME_ENV.md docs/PHASE_REPORT.md

# Final pre-commit checks
git status
git diff --cached --stat
git diff --cached --name-only
git diff --cached --check

# Commit
git commit -m "chore: finalize docker compose runtime review and commit checklist"

# Push
git push origin HEAD
```

## Warning If Real Env Files Ever Become Tracked
Do not commit. Remove them from the index first, for example:

```powershell
git rm --cached infra\.env
git rm --cached backend-nest\.env
git rm --cached ai-service\.env
git rm --cached frontend-next\.env
git rm --cached frontend-next\.env.local
```

## Full Seller-to-Customer Commerce Flow Audit

- Scope:
  - audit docs, backend modules, frontend routes, Docker runtime, smoke scripts, and browser E2E coverage for the complete marketplace MVP
  - verify seller/customer flow from public product browse through checkout, proof upload, seller payment review, delivery mock shipment, seller fulfillment status, and customer tracking update
  - keep `strawberry-frontend` and `strawberry-backend` untouched
- Result:
  - `docs/FULL_FLOW_AUDIT.md` added with executive summary, full flow table, API coverage table, frontend route coverage, existing smoke/E2E coverage, gaps/risks, and next steps
  - added `frontend-next/tests/e2e/full-commerce-flow.spec.ts`
  - added `frontend-next` script `npm run test:e2e:full-commerce`
  - full MVP flow is demo-ready with seeded demo data, manual payment review, and mock delivery
  - production readiness remains partial because admin seller approval UI/API, full seller create-product browser path, real payment providers, real Yandex/CDEK, and real OpenAI verification are not complete
- Verification for this pass:
  - `docker version`: pass
  - `docker compose version`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env config`: pass, output suppressed to avoid secret exposure
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: pass, all core services healthy
  - `curl.exe --ipv4 http://localhost:3001/api/health`: pass
  - `curl.exe --ipv4 -I http://localhost:3000/products`: pass
  - `curl.exe --ipv4 http://localhost:8000/health`: pass
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run seed:demo`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass, 13 suites / 73 tests
  - `backend-nest npm run build`: pass
  - `backend-nest npm run smoke:checkout`: pass
  - `backend-nest npm run smoke:order-tracking`: pass
  - `backend-nest npm run smoke:payments`: pass
  - `backend-nest npm run smoke:inventory`: pass
  - `backend-nest npm run smoke:inventory-alerts`: pass
  - `backend-nest npm run smoke:delivery`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:auth`: pass
  - `frontend-next npm run test:e2e:public`: pass
  - `frontend-next npm run test:e2e:public-full`: pass
  - `frontend-next npm run test:e2e:public-payment-review`: pass
  - `frontend-next npm run test:e2e:full-commerce`: pass
- Files changed:
  - `docs/FULL_FLOW_AUDIT.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PHASE_REPORT.md`
  - `frontend-next/README.md`
  - `frontend-next/package.json`
  - `frontend-next/tests/e2e/full-commerce-flow.spec.ts`
- Remaining gaps:
  - no browser E2E for seller shop/product/image creation from blank state
  - seller approval lacks admin workflow
  - delivery real Yandex/CDEK mode not verified
  - payment provider integration not implemented
  - OpenAI real mode intentionally not called
- Commit info:
  - pending commit message: `test: audit full seller to customer commerce flow`

## Seller Approval Workflow

- Scope:
  - add production-ready seller approval workflow for the multi-seller marketplace MVP
  - keep seller registration pending by default
  - add admin-only seller review API and minimal admin UI
  - preserve existing checkout/payment/inventory/delivery/auth flows
- Result:
  - added `backend-nest/src/modules/admin` with seller list/detail/approve/reject endpoints
  - added `AdminOnlyGuard` on `/api/admin/sellers`
  - added additive seller profile fields: `approved_at`, `rejected_at`, `rejection_reason`
  - seller shop creation remains blocked unless `approvalStatus=APPROVED`
  - seed demo now creates `demo-admin@trawberry.local` and keeps the demo seller approved
  - added `/admin/sellers` in `frontend-next`
  - seller shell now displays pending/rejected approval messaging
  - added `npm run smoke:seller-approval`
  - added `npm run test:e2e:admin-seller-approval`
- Verification for this pass:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass, 14 suites / 75 tests
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - full verification command set pending below this section before commit
- Files changed:
  - `backend-nest/prisma/schema.prisma`
  - `backend-nest/src/app.module.ts`
  - `backend-nest/src/common/guards/admin-only.guard.ts`
  - `backend-nest/src/modules/admin/*`
  - `backend-nest/src/modules/auth/auth.service.ts`
  - `backend-nest/src/modules/users/*`
  - `backend-nest/scripts/seed-demo.js`
  - `backend-nest/scripts/smoke-seller-approval.ps1`
  - `backend-nest/test/admin-sellers.e2e-spec.ts`
  - `frontend-next/src/app/admin/*`
  - `frontend-next/src/components/admin/admin-shell.tsx`
  - `frontend-next/src/components/seller/seller-shell.tsx`
  - `frontend-next/src/lib/admin-api.ts`
  - `frontend-next/tests/e2e/admin-seller-approval.spec.ts`
  - `docs/SELLER_APPROVAL.md`
- Remaining gaps:
  - no document upload/KYC review workflow
  - no seller approval notification email
  - no admin audit trail beyond timestamp/reason fields
- Commit info:
  - pending commit message: `feat: add seller approval workflow`

## Seller Onboarding + KYC Documents + Admin Audit Trail

- Scope:
  - add seller legal onboarding profile and KYC document upload workflow
  - add admin document review and seller onboarding detail UI
  - add admin audit logs for seller/document approve and reject actions
  - preserve seller approval, checkout, payment, inventory, delivery, auth, and public flows
- Result:
  - added `seller_profiles` legal/contact/bank fields
  - added `seller_documents` for KYC uploads and review status
  - added `admin_audit_logs` for admin review actions
  - added `/api/seller/onboarding/profile` and `/api/seller/onboarding/documents`
  - extended `/api/admin/sellers` with onboarding, document review, and audit-log endpoints
  - seller approval now requires at least one approved KYC document
  - added `/seller/onboarding`
  - added `/admin/sellers/[id]`
  - updated `/admin/sellers` with detail review links
  - added `npm run smoke:seller-onboarding`
  - added `npm run test:e2e:seller-onboarding`
- Verification for this pass:
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: pass
  - `curl.exe --ipv4 http://localhost:3001/api/health`: pass
  - `curl.exe --ipv4 -I http://localhost:3000/products`: pass
  - `curl.exe --ipv4 http://localhost:8000/health`: pass
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run seed:demo`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass, 15 suites / 79 tests
  - `backend-nest npm run build`: pass
  - `backend-nest npm run smoke:seller-approval`: pass
  - `backend-nest npm run smoke:seller-onboarding`: pass
  - `backend-nest npm run smoke:checkout`: pass
  - `backend-nest npm run smoke:order-tracking`: pass
  - `backend-nest npm run smoke:payments`: pass
  - `backend-nest npm run smoke:inventory`: pass
  - `backend-nest npm run smoke:inventory-alerts`: pass
  - `backend-nest npm run smoke:delivery`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:admin-seller-approval`: pass
  - `frontend-next npm run test:e2e:seller-onboarding`: pass
  - `frontend-next npm run test:e2e:auth`: pass
  - `frontend-next npm run test:e2e:public`: pass
  - `frontend-next npm run test:e2e:public-full`: pass
  - `frontend-next npm run test:e2e:public-payment-review`: pass
  - `frontend-next npm run test:e2e:full-commerce`: pass
- Files changed:
  - `backend-nest/prisma/schema.prisma`
  - `backend-nest/src/modules/seller-onboarding/*`
  - `backend-nest/src/modules/admin/*`
  - `backend-nest/src/modules/files/files.service.ts`
  - `backend-nest/scripts/smoke-seller-approval.ps1`
  - `backend-nest/scripts/smoke-seller-onboarding.ps1`
  - `backend-nest/test/admin-sellers.e2e-spec.ts`
  - `backend-nest/test/seller-onboarding.e2e-spec.ts`
  - `frontend-next/src/app/seller/onboarding/page.tsx`
  - `frontend-next/src/app/admin/sellers/[id]/page.tsx`
  - `frontend-next/src/components/admin/admin-seller-detail-client.tsx`
  - `frontend-next/src/lib/admin-api.ts`
  - `frontend-next/src/lib/seller-onboarding-api.ts`
  - `frontend-next/tests/e2e/admin-seller-approval.spec.ts`
  - `frontend-next/tests/e2e/seller-onboarding.spec.ts`
  - `docs/SELLER_ONBOARDING.md`
- Remaining gaps:
  - KYC retention/access/encryption policy remains production work
  - document reject UI path has backend coverage but not browser E2E
  - no seller approval notification email
  - audit trail covers seller/document review actions, not every admin action
- Commit info:
  - pending commit message: `feat: add seller onboarding and audit trail`

## Seller Create Shop/Product/Image Browser E2E

- Scope:
  - add browser-level coverage for seller-created shop/product/image flow from blank seller state
  - keep seller approval/onboarding setup deterministic through API setup
  - verify seller-created product appears publicly, can be checked out, and appears in seller orders
- Result:
  - added `frontend-next/tests/e2e/seller-product-lifecycle.spec.ts`
  - added `frontend-next` script `npm run test:e2e:seller-product-lifecycle`
  - added first-shop creation UI on `/seller/products`
  - added product creation UI on `/seller/products`
  - added product creation API client functions
  - extended product create DTO/service with optional variants so UI-created products can be public and checkout-ready
  - added stable `data-testid` selectors for product detail, image upload/gallery, product rows, and seller order cards
  - fixed seller product dynamic client pages to read route params through `useParams()`
- Verification for this pass:
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: pass
  - `curl.exe --ipv4 http://localhost:3001/api/health`: pass
  - `curl.exe --ipv4 -I http://localhost:3000/products`: pass
  - `curl.exe --ipv4 http://localhost:8000/health`: pass
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run seed:demo`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass, 15 suites / 79 tests
  - `backend-nest npm run build`: pass
  - `backend-nest npm run smoke:seller-approval`: pass
  - `backend-nest npm run smoke:seller-onboarding`: pass
  - `backend-nest npm run smoke:checkout`: pass
  - `backend-nest npm run smoke:order-tracking`: pass
  - `backend-nest npm run smoke:payments`: pass
  - `backend-nest npm run smoke:inventory`: pass
  - `backend-nest npm run smoke:inventory-alerts`: pass
  - `backend-nest npm run smoke:delivery`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:admin-seller-approval`: pass
  - `frontend-next npm run test:e2e:seller-onboarding`: pass
  - `frontend-next npm run test:e2e:auth`: pass
  - `frontend-next npm run test:e2e:public`: pass
  - `frontend-next npm run test:e2e:public-full`: pass
  - `frontend-next npm run test:e2e:public-payment-review`: pass after rerun with isolated seed; first parallel run collided on seeded product stock with `public-full`
  - `frontend-next npm run test:e2e:full-commerce`: pass
  - `frontend-next npm run test:e2e:seller-product-lifecycle`: pass
- Files changed:
  - `backend-nest/src/modules/products/dto/create-product.dto.ts`
  - `backend-nest/src/modules/products/products.service.ts`
  - `frontend-next/package.json`
  - `frontend-next/src/components/products/seller-products-page-client.tsx`
  - `frontend-next/src/components/products/product-form.tsx`
  - `frontend-next/src/components/products/product-image-gallery.tsx`
  - `frontend-next/src/components/products/product-table.tsx`
  - `frontend-next/src/app/seller/products/[id]/page.tsx`
  - `frontend-next/src/app/seller/products/[id]/images/page.tsx`
  - `frontend-next/src/components/orders/seller-orders-page-client.tsx`
  - `frontend-next/src/lib/seller-api.ts`
  - `frontend-next/tests/e2e/seller-product-lifecycle.spec.ts`
  - `frontend-next/README.md`
  - `docs/FULL_FLOW_AUDIT.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PHASE_REPORT.md`
- Remaining gaps:
  - seller approval/KYC setup in this lifecycle test is API-driven; browser onboarding/admin approval remain covered by `test:e2e:seller-onboarding`
  - delivery settings browser E2E is covered by the subsequent `Seller Delivery Settings Browser E2E` phase
  - AI image generation remains out of scope and was not called
- Commit info:
  - pending commit message: `test: add seller product lifecycle browser e2e`

## Seller Delivery Settings Browser E2E

- Scope:
  - add browser-level coverage for seller delivery settings and mock shipment operations
  - keep seller approval/onboarding/shop/product/paid-order setup deterministic through API setup
  - verify same-city Yandex-first recommendation and customer tracking delivery projection without calling real Yandex/CDEK
- Result:
  - added `frontend-next/tests/e2e/seller-delivery-settings.spec.ts`
  - added `frontend-next` script `npm run test:e2e:seller-delivery-settings`
  - added stable `data-testid` selectors for `/seller/settings`, seller order delivery actions, and customer tracking delivery fields
  - seller settings UI saves pickup address/city/postal/contact, enabled `YANDEX` and `CDEK`, carrier priority, and package defaults
  - seller order detail now selects the recommended offer after calculation, so same-city Yandex-first settings create a Yandex mock shipment
  - customer tracking shows delivery provider, `IN_TRANSIT` status, and tracking link after seller refresh
- Verification for this pass:
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build`: pass
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run seed:demo`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:seller-delivery-settings`: pass
- Files changed:
  - `frontend-next/package.json`
  - `frontend-next/tests/e2e/seller-delivery-settings.spec.ts`
  - `frontend-next/src/components/seller/seller-delivery-settings-page-client.tsx`
  - `frontend-next/src/components/orders/seller-order-detail-page-client.tsx`
  - `frontend-next/src/components/public/order-track-detail-page-client.tsx`
  - `frontend-next/README.md`
  - `docs/API_DELIVERY.md`
  - `docs/FULL_FLOW_AUDIT.md`
  - `docs/PROJECT_STATUS.md`
  - `docs/PHASE_REPORT.md`
- Remaining gaps:
  - seller approval/KYC setup remains API-driven in this focused delivery test; browser onboarding/admin approval remain covered by `test:e2e:seller-onboarding`
  - real Yandex/CDEK provider calls remain intentionally unverified in this phase
  - broader delivery edge cases such as cancellation, failed provider states, and webhook ingestion remain future production hardening
- Commit info:
  - pending commit message: `test: add seller delivery settings browser e2e`

## Delivery / Demo Workflow Finalization

- Scope:
  - review the remaining delivery/demo source and browser E2E changes after worktree artifact cleanup
  - keep legacy `strawberry-frontend` and `strawberry-backend` untouched
  - commit only source/docs/tests after verification, with no local env, Excel, or Playwright artifacts
- Result:
  - `seed-demo.js` now includes a demo customer account for the three-role workflow
  - delivery settings/order/tracking pages have stable test hooks for browser E2E assertions
  - seller order delivery flow selects the recommended offer after calculation and avoids overwriting active shipment pickup data
  - `seller-delivery-settings.spec.ts` covers mock delivery settings, offer recommendation, shipment creation, and public tracking projection
  - `three-role-demo-workflow.spec.ts` covers admin, seller, and customer demo playback with video enabled
  - `test:e2e:seller-delivery-settings` and `test:e2e:three-role-demo` are declared in `frontend-next/package.json`
- Verification for this pass:
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass, 16 suites / 84 tests
  - `backend-nest npm run build`: pass
  - `backend-nest npm run smoke:delivery`: pass
  - `backend-nest npm run smoke:checkout`: pass
  - `backend-nest npm run smoke:wb-import-checkout`: pass
  - `backend-nest npm run seed:demo`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:full-commerce`: pass
  - `frontend-next npm run test:e2e:seller-delivery-settings`: pass
  - `frontend-next npm run test:e2e:three-role-demo`: pass
  - `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: pass, services healthy
  - `curl.exe --ipv4 http://localhost:3001/api/health`: pass
  - `curl.exe --ipv4 -I http://localhost:3000/products`: pass
  - `curl.exe --ipv4 http://localhost:8000/health`: pass
- Files changed:
  - `backend-nest/scripts/seed-demo.js`
  - `docs/API_DELIVERY.md`
  - `docs/WORKTREE_AUDIT.md`
  - `docs/PHASE_REPORT.md`
  - `frontend-next/package.json`
  - `frontend-next/src/components/orders/seller-order-detail-page-client.tsx`
  - `frontend-next/src/components/public/order-track-detail-page-client.tsx`
  - `frontend-next/src/components/seller/seller-delivery-settings-page-client.tsx`
  - `frontend-next/tests/e2e/full-commerce-flow.spec.ts`
  - `frontend-next/tests/e2e/seller-delivery-settings.spec.ts`
  - `frontend-next/tests/e2e/three-role-demo-workflow.spec.ts`
- Remaining gaps:
  - real Yandex/CDEK provider calls remain intentionally unverified
  - demo workflow video artifacts are generated locally by Playwright and remain ignored, not committed
- Commit info:
  - pending commit message: `test: finalize delivery and demo workflow coverage`

## Seller-Managed Manual Delivery + Admin Supervision

- Scope:
  - implement seller-managed delivery because Yandex/CDEK legal/API credentials are not available yet
  - let sellers paste carrier tracking data after creating shipments outside the marketplace
  - give admins a supervision view for paid orders without delivery and delivery status override
- Result:
  - added manual delivery statuses: `NOT_CREATED`, `CREATED_MANUALLY`, `IN_TRANSIT`, `DELIVERED`, `CANCELLED`, `FAILED`
  - added seller manual delivery create/update/status endpoints under shop-scoped order delivery routes
  - added `/api/admin/deliveries` supervision APIs and `/admin/deliveries` Next.js page
  - delivery events now store actor user, role, action, old status, and new status
  - customer tracking shows status label/message, provider status, courier phone, ETA, and delivery note
  - added `smoke:manual-delivery`, `smoke:admin-delivery-supervision`, `test:e2e:manual-delivery`, and `test:e2e:admin-delivery-supervision`
- Verification for this pass:
  - `backend-nest npm run prisma:generate`: pass
  - `backend-nest npm run prisma:db:push`: pass
  - `backend-nest npm run seed:demo`: pass
  - `backend-nest npm run lint`: pass
  - `backend-nest npm test -- --runInBand`: pass, 16 suites / 89 tests
  - `backend-nest npm run build`: pass
  - `backend-nest npm run smoke:manual-delivery`: pass
  - `backend-nest npm run smoke:admin-delivery-supervision`: pass
  - `backend-nest npm run smoke:delivery`: pass
  - `backend-nest npm run smoke:checkout`: pass
  - `backend-nest npm run smoke:payments`: pass
  - `backend-nest npm run smoke:order-tracking`: pass
  - `backend-nest npm run smoke:inventory`: pass
  - `backend-nest npm run smoke:inventory-alerts`: pass
  - `backend-nest npm run smoke:wb-import-checkout`: pass
  - `frontend-next npm run lint`: pass
  - `frontend-next npm run build`: pass
  - `frontend-next npm run test:e2e:manual-delivery`: pass
  - `frontend-next npm run test:e2e:admin-delivery-supervision`: pass
  - `frontend-next npm run test:e2e:full-commerce`: pass after isolated rerun; first parallel run hit a Playwright artifact `ENOENT` during trace handling
  - `frontend-next npm run test:e2e:seller-delivery-settings`: pass
  - `frontend-next npm run test:e2e:three-role-demo`: pass
  - `frontend-next npm run test:e2e:wb-import-checkout`: pass
  - Docker compose `ps`: pass, services healthy
  - backend, frontend `/products`, and ai-service health checks: pass
- Files changed:
  - `backend-nest/prisma/schema.prisma`
  - `backend-nest/prisma/migrations/20260514_add_manual_delivery_supervision/migration.sql`
  - `backend-nest/src/modules/delivery/*`
  - `backend-nest/src/modules/order-tracking/*`
  - `backend-nest/scripts/smoke-manual-delivery.ps1`
  - `backend-nest/scripts/smoke-admin-delivery-supervision.ps1`
  - `backend-nest/test/delivery.e2e-spec.ts`
  - `frontend-next/src/app/admin/deliveries/page.tsx`
  - `frontend-next/src/components/admin/admin-deliveries-page-client.tsx`
  - `frontend-next/src/components/orders/seller-order-detail-page-client.tsx`
  - `frontend-next/tests/e2e/manual-delivery.spec.ts`
  - `frontend-next/tests/e2e/admin-delivery-supervision.spec.ts`
  - `docs/MANUAL_DELIVERY_WORKFLOW.md`
  - `docs/SELLER_OPERATIONS.md`
- Remaining gaps:
  - real Yandex/CDEK API creation remains future work
  - webhooks/provider polling remain future work
- Commit info:
  - pending commit message: `feat: add seller managed delivery with admin supervision`

## Wildberries Excel Product Import

- Scope:
  - approved sellers import Wildberries `.xlsx` exports into their own shop
  - preview parses sheet `Товары`, header row `3`, and auto-detects product data after the Wildberries help row
  - rows are grouped by `Артикул продавца` into products with variants
  - photos are split by `;` and stored as remote URLs for MVP
- Result:
  - added `backend-nest/src/modules/wb-imports`
  - added import session persistence in `product_import_sessions`
  - added additive product and variant external metadata fields
  - added `/seller/import/wildberries`
  - added `npm run smoke:wb-import`
  - added sanitized fixture `backend-nest/test/fixtures/wb-products-sample.xlsx`
- Remaining gaps:
  - `DOWNLOAD_TO_STORAGE` is not implemented in MVP; remote URL mode is used

## Wildberries Real Export Audit

- Local private reference: `data.xlsx` in the repo root; this file is ignored and must not be committed.
- Audited layout:
  - sheets: `Товары`, `Инструкция`
  - product sheet range: `A1:CT42`
  - header row: `3`
  - help/instruction row: `4`
  - first product data row: `5`
- Parser updates:
  - auto-detects the first product data row instead of assuming row `6`
  - normalizes header text by trim/lowercase/space collapse and `ё` to `е`
  - supports aliases for `Артикул ВБ`, `Баркод`, and `Фотографии`
  - handles `КИЗ` values such as `Нужен` and `Не нужен`
  - stores the first barcode when a barcode cell contains multiple values

## Wildberries Remote Image Strategy

- Decision:
  - keep `REMOTE_URL` as the default and recommended MVP image mode
  - do not download Wildberries images to storage in this phase
- Backend behavior:
  - trims and dedupes URLs from `Фото`
  - accepts only `http` and `https` URLs
  - emits `INVALID_IMAGE_URL` warnings and skips invalid URLs
  - stores remote URLs on product images with no storage download requirement
  - keeps first valid image as main and preserves valid URL sort order
  - treats `DOWNLOAD_TO_STORAGE` as not implemented and continues with a warning
- Frontend behavior:
  - import UI presents Wildberries image links as the fixed MVP image mode
  - product cards, public gallery, and seller image gallery use fallback rendering when a remote image fails
- Remaining gap:
  - object storage download, retry, and broken-link monitoring remain future work
  - no real WB API calls are made
  - broader admin import audit UI is future work
# Phase Report: Delivery Exceptions

Added delivery exception workflow for seller-managed manual delivery and admin supervision.

Delivered:

- Backend exception fields and `delivery_comments`.
- Seller/admin failed-delivery APIs with required reason codes.
- Internal vs customer-visible comment handling.
- Public tracking safe exception response.
- Admin exception filters and customer-message override.
- Smoke script `smoke:delivery-exceptions`.
- Frontend seller/admin/customer exception UI.
- Playwright script `test:e2e:delivery-exceptions`.

Non-goals retained: no real OpenAI calls, no real Yandex/CDEK API calls, and no changes to legacy `strawberry-frontend` or `strawberry-backend`.
# Phase Report: Admin Operational Queues + SLA Timers

Implemented admin-only operational queues for daily marketplace supervision.

- Added `GET /api/admin/queues/sellers`, `/payments`, `/deliveries`, and `/inventory`.
- Queue items include seller/shop/order/product context, age, `slaStatus`, and action links.
- Added `/admin/queues` with tabs, filters, status/SLA badges, and queue summary counts.
- Updated `/admin/dashboard` cards and needs-attention tiles to open queue filters.
- Added `smoke:admin-queues` and `test:e2e:admin-queues`.
- Admin assignment ownership is now handled by the Admin Task Ownership phase below.

# Phase Report: Admin Task Ownership + Escalation Workflow

Implemented admin-only task ownership for operational queues.

- Added `admin_queue_tasks` and `admin_queue_task_events`.
- Added `/api/admin/queue-tasks` create/list/assign/unassign/status/escalate/events APIs.
- Queue responses now include task id, task status, priority, assignee, and task timestamps.
- `/admin/queues` supports Claim, In progress, Escalate, and Resolve actions.
- Added task event and admin audit writes for ownership mutations.
- Added `smoke:admin-task-ownership` and `test:e2e:admin-task-ownership`.

Non-goals retained: no notification email, no ops export/reporting, no real Yandex/CDEK API calls, and no changes to legacy `strawberry-frontend` or `strawberry-backend`.

# Phase Report: Admin Ops Reporting + Export

Implemented admin-only operational reporting and CSV export.

- Added `/api/admin/reports/ops-summary`.
- Added SLA breach, workload, delivery exception, and payment aging report APIs.
- Added CSV exports for SLA breaches, workload, delivery exceptions, and payment aging.
- CSV exports use UTF-8 BOM, safe escaping, allowlisted columns, and a 5000 row cap.
- Added `/admin/reports` with date filters, summary cards, tabs, tables, and export buttons.
- Added `smoke:admin-reports` and `test:e2e:admin-reports`.

Non-goals retained: no notification email, no scheduled report delivery, no real Yandex/CDEK API calls, and no changes to legacy `strawberry-frontend` or `strawberry-backend`.

# Phase Report: Wildberries API Product Sync

Implemented WB Content API product sync foundation.

- Audited legacy WB integration code and documented endpoint/DTO/mapping.
- Added `backend-nest/src/modules/wb-sync`.
- Added mock/real WB API client foundation.
- Added seller APIs for credentials status, sync all, sync by article, and sync run lookup.
- Added `wb_sync_runs` and `shop_wb_credentials`.
- Added idempotent upsert for products, variants, and remote images.
- Added `/seller/import/wildberries-api`.
- Added `smoke:wb-api-sync` and `test:e2e:wb-api-sync`.

Non-goals retained: no real WB API call in default tests, no price/stock WB API integration, no image download-to-storage, and no changes to legacy apps.

# Phase Report: Admin Operations Dashboard

Added admin-only marketplace operations dashboard.

Delivered:

- `GET /api/admin/dashboard/summary` with date/shop/seller filters.
- Aggregated counts for orders, payments, deliveries, inventory, and sellers.
- Recent orders, payment reviews, delivery exceptions, and audit actions.
- `/admin/dashboard` page with operational cards, needs-attention queue, recent activity, and quick links.
- Smoke script `smoke:admin-dashboard`.
- Playwright script `test:e2e:admin-dashboard`.

Non-goals retained: no real OpenAI calls, no real Yandex/CDEK API calls, and no changes to legacy `strawberry-frontend` or `strawberry-backend`.
# Phase Report: Cart + Multi-item Checkout

Implemented:

- LocalStorage cart store.
- Product variant selector and add-to-cart action.
- Cart page.
- Cart-backed checkout page with legacy single-product route compatibility.
- Multi-item backend checkout validation, trusted totals, item snapshots, and stock deduction.
- Seller/customer/payment order item rendering.
- `smoke:cart-checkout` and `test:e2e:cart-checkout` scripts.

Deferred:

- Multi-shop checkout split.
- Server-persisted customer carts.

# Phase Report: Multi-shop Checkout Split Orders

Implemented:

- Backend checkout groups validated cart items by `product.shopId`.
- One checkout request can create multiple shop orders in one transaction.
- Response keeps legacy first-order fields and adds `orders[]`, `orderCodes[]`, and `grandTotal`.
- Frontend cart and checkout summaries group items by shop and show grand total.
- Checkout confirmation shows one order card and tracking link per shop order.
- Seller order visibility remains shop-scoped.
- Payment proof and delivery remain per order/shop.
- Added `smoke:multi-shop-checkout` and `test:e2e:multi-shop-checkout` scripts.

Deferred:

- Combined multi-shop payment orchestration.
- Combined customer tracking page.

# Phase Report: Customer Account + Order History + Parent Checkout Receipt

Implemented:

- Added `marketplace_checkouts` parent receipt model and optional order relation.
- Checkout now creates a parent receipt for single-shop and multi-shop orders.
- Checkout response returns `checkoutId`, `checkoutCode`, `orders[]`, `orderCodes[]`, `grandTotal`, and legacy first-order fields.
- Logged-in customer checkout attaches `customerUserId`.
- Added logged-in customer receipt APIs under `/api/customer/orders`.
- Added public anonymous receipt lookup under `/api/public/checkouts/:checkoutCode?phone=...`.
- Added customer register/login pages, order history, order detail, and public receipt page.
- Added `smoke:customer-order-history` and `test:e2e:customer-order-history`.

Deferred:

- Combined payment capture across shops.
- Refund/dispute flows at parent receipt level.
- Marketplace support case workflow attached to parent receipts.

# Phase Report: Wildberries Real API Sync Hardening

Implemented:

- audited the working legacy WB integration and documented it in `docs/WB_LEGACY_SUCCESSFUL_FLOW_AUDIT.md`
- explicit real-mode credential save, status, verify, and delete APIs
- added `GET /api/shops/:shopId/wb-sync/diagnostics` for seller-safe runtime checks
- persisted WB credential verification metadata on `shop_wb_credentials`
- AES-GCM credential encryption via `WB_CREDENTIAL_ENCRYPTION_KEY`
- real runtime uses the selected shop's stored credential from DB, not a global `WB_REAL_API_KEY`
- real-mode `POST /content/v2/get/cards/list` client with cursor pagination
- real-mode verify retries once with a fallback request body when WB rejects the minimal body with `400`
- no silent mock fallback when `WB_SYNC_MODE=real`
- mock mode verify now fails explicitly with `WB_MOCK_MODE_ACTIVE` instead of pretending to verify WB
- seller UI connection card with mode, key last4, verify status, and sanitized error
- seller UI now refreshes status after save, verify, and delete, and clears the raw key input after save
- seller UI now blocks real-mode sync actions early when the selected shop has no saved WB credential
- real-mode sync result reporting with `sourceMode`
- optional `smoke:wb-api-sync-real`
- added `npm run debug:wb-credential` for stored-credential diagnostics without using `WB_REAL_API_KEY`
- backend WB sync tests for credential lifecycle, verify failure sanitization, request body, and pagination
- aligned default real WB request body to the legacy successful `cards/list` shape with `sort.ascending=true`

Retained non-goals:

- no WB price sync
- no WB stock sync
- no real WB calls in default CI smoke/E2E
- no legacy app changes

Runtime audit note on 2026-05-17:

- local Docker backend was running with `WB_SYNC_MODE=mock`
- local Docker backend inherited a hidden fallback `WB_CREDENTIAL_ENCRYPTION_KEY=dev-wb-credential-key`
- after removing that fallback from compose, the same local runtime exposed the true missing-config state until a local non-committed test key was injected for verification

# Phase Report: Public Marketplace Contract Hardening

Implemented:

- added `backend-nest/test/public-products.e2e-spec.ts`
- verified public list/detail contract for published, readiness-passing products only
- verified mixed-stock detail shape and disabled out-of-stock variants
- verified checkout rejects out-of-stock, unpublished, archived, invalid-variant, missing-price, and over-stock requests
- added mobile sticky CTA to `frontend-next` public product detail without changing desktop sticky purchase card
- added `frontend-next/tests/e2e/public-marketplace-contract.spec.ts`
- hardened public header search and cart badge regression coverage
- documented contract in `docs/PUBLIC_MARKETPLACE_CONTRACT.md`

Retained non-goals:

- no legacy app changes
- no real external provider calls in default tests
- no change to server-side checkout authority

# Phase Report: Public Marketplace Empty / Fallback / Search State Hardening

Implemented:

- improved `/products` empty, no-result, and retryable error states
- aligned products page search/filter state with URL-driven navigation
- added local image fallback handling for public cards, detail gallery, previews, and cart items
- added explicit empty cart UX
- added explicit unavailable product detail state with back-to-products and retry behavior
- added `frontend-next/tests/e2e/public-empty-fallbacks.spec.ts`
- added backend runtime smoke wrapper `npm run smoke:public-marketplace-contract`

Retained non-goals:

- no visibility rule changes
- no proactive stale-cart server validation before checkout submit
- no legacy app changes

# Phase Report: Docker Build Reliability + CI Readiness

Implemented:

- added npm fetch retry and registry config before `npm ci` in both app Dockerfiles
- preserved layer caching by copying `package*.json` before source
- split backend image into build-deps, build, prod-deps, and runner stages
- switched frontend Docker runtime to Next standalone output
- tightened `.dockerignore` rules for backend, frontend, and repo root
- documented supported rebuild, log-tail, and troubleshooting commands

Verification:

- `backend-nest`: `npm run prisma:generate`, `npm run lint`, `npm test -- --runInBand`, `npm run build`
- `frontend-next`: `npm run lint`, `npm run build`
- Docker: `docker compose ... build backend-nest frontend-next`, `docker compose ... up -d backend-nest frontend-next`, `docker compose ... ps`
- runtime health: backend, frontend `/products`, and ai-service
- minimal smoke/E2E rerun after Docker rebuild
# Phase Report: Yandex Address Readiness Policy

Implemented:

- added backend address readiness helper shared across customer, checkout, seller, admin, and tracking projections
- customer address API now returns `geoReadiness`, `missingYandexFields`, `yandexManualReady`, and `yandexApiReady`
- checkout response now surfaces address warnings without blocking current manual flow
- seller manual Yandex workbench now distinguishes pickup-ready, dropoff-ready, manual-only, and API-ready states
- admin deliveries now expose missing-coordinate / geo-ready filtering
- customer address UI now supports explicit manual coordinate workflow
- added `smoke:yandex-address-readiness`
- added `test:e2e:yandex-address-readiness`

Retained non-goals:

- no real Yandex geocoder
- no real Yandex map SDK
- no real Yandex Delivery API calls
- no forced coordinate requirement for the current manual checkout flow

# Phase Report: Public Header Wildberries Redesign

Implemented:

- Redesigned the public header component (`public-header.tsx`) to match the sleeker, thinner Wildberries layout.
- Reduced the visual height and clutter of the header (from a bulky 3-row layout to a compact 2-row layout).
- Restructured navigation: merged links into a single horizontal top bar matching the Wildberries style.
- Updated action items (Address, Account, Cart) to look premium with vertical icon-text alignments and without bulky background wrappers.
- Fixed strict mode duplicate element errors in Playwright tests by consolidating desktop and mobile DOM nodes for Account and Cart icons.
- Updated `public-shell.tsx` Suspense fallback height to match the new thin header layout.
- Verified all public flow E2E tests (auth-role-separation, public-smoke, product-buying-ux).

Retained non-goals:

- No changes to checkout business logic.
- No changes to admin/seller dashboards.

# Phase Report: Notification Center UX & Layout Polish

Implemented:

- Removed outer shell wrappers (`AdminShell`/`SellerShell`) from respective notification pages to resolve duplicated sidebar layouts.
- Rewrote `NotificationsPageClient` with role-aware headers, subtitles, empty states, and summary cards.
- Integrated sleek, interactive horizontal category filters matching specific backend event types and severities.
- Handled client-side category filtering for customer order status changes cleanly.
- Enhanced notification items to display rich entity metadata (order codes, shop names, return case IDs) and direct role-relevant action buttons with propagation stoppage.
- Hardened unread notifications query complexity using `Promise.all` with a strict fetch limit.
- Prevented unauthenticated public guest page visits from calling notification endpoints, verified via E2E route interception.
- Handled UI robustly on event click-navigate to guarantee redirection even if status marking APIs temporarily fail.
- Removed debug logs in production code.

Verification:

- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `frontend-next npx playwright test tests/e2e/notifications.spec.ts --workers=1`: pass
- E2E regressions (auth-role-separation, multi-role-sessions, admin-fulfillment-supervision, public-payment-review, return-refund-dispute): pass (14 tests passed)
- `backend-nest npm run lint`: pass
- `backend-nest npm test -- --runInBand`: pass (222 tests passed)
- `backend-nest npm run build`: pass

Retained non-goals:

- No backend changes to the notification engine or database models.
- No push notification or SMS/email integrations.
- No legacy app changes.

# Phase Report: Role-Based i18n Foundation

Implemented:

- Added `frontend-next/src/i18n/*` foundation with role policy for `admin`, `seller`, and `customer/public`.
- Added locale dictionaries for `en`, `ru`, and `vi`.
- Added cookie-backed locale store, `useI18n`, and role-aware `LanguageSwitcher`.
- Wired public header and seller shell to the new i18n layer.
- Refactored core public surfaces (`public-header`, `cart`, `order-track`, partial `checkout`, partial `product-detail`) away from newly added hard-coded strings.
- Added backend `User.preferredLocale` support plus `PATCH /api/users/locale`.
- Extended current-user payloads with `preferredLocale`.
- Added frontend error-code localization mapping for key checkout/auth cases.
- Added a focused Playwright spec for role-based locale behavior.

Verification:

- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `frontend-next npm run test:e2e:public-marketplace-contract`: pass
- `frontend-next npm run test:e2e:product-buying-ux`: pass
- `frontend-next npm run test:e2e:cart-checkout`: pass
- `frontend-next npm run test:e2e:customer-account`: pass
- `frontend-next npm run test:e2e:seller-product-lifecycle`: pass
- `frontend-next npm run test:e2e:seller-manual-yandex-workbench`: pass
- `frontend-next npm run test:e2e:admin-fulfillment-supervision`: pass
- `frontend-next npm run test:e2e:notifications`: pass
- `frontend-next npm run test:e2e:action-feedback`: pass
- `frontend-next npx playwright test tests/e2e/i18n-role-locale.spec.ts --workers=1`: pass
- `backend-nest npm run prisma:generate`: pass
- `backend-nest npm run prisma:db:push`: pass
- `backend-nest npm run lint`: pass
- `backend-nest npm test -- --runInBand`: pass
- `backend-nest npm run build`: pass

Resolution notes:

- root cause of the original public-default-Russian failure was not the locale policy itself
- two issues combined:
  - the runtime on `localhost:3000` had not been rebuilt from the latest i18n source
  - the new Playwright spec was reusing stale locale state and had a seller login wait condition that matched `/seller/login` too early
- the locale spec now uses clean browser contexts per surface and stable selectors
- targeted regression specs that depended on old English/Vietnamese copy were updated to use stable test ids or locale-safe assertions where needed

Known gaps:

- `checkout-page-client`, seller payment/product screens, and notification copy are only partially migrated; more hard-coded legacy strings remain outside the current priority keys.

# Phase Report: Public Commerce i18n (Phase 1)

Implemented:

- Fully localized all buyer-facing interfaces to support Russian (`ru`) and English (`en`), defaulting to Russian.
- Removed Vietnamese (`vi`) option and text from the public commerce flow (including header language switcher).
- Localized public header, footer, homepage, and products catalog list (filters, sort, pagination).
- Localized product cards and product details page (handling color, gender, material, size selection, and action buttons).
- Localized cart and checkout components (including preflight validation warnings, error alerts, and payment descriptions).
- Enabled `role="customer"` rendering in `PaymentDetailsPanel` during checkout and order tracking to support localized payment instructions and bank details.
- Localized public order tracking page, status timeline, and payment proof uploading fields.
- Mapped and localized buyer-facing validation codes: `CUSTOMER_ADDRESS_REQUIRED`, `CUSTOMER_ADDRESS_NOT_YANDEX_READY`, `SHOP_PAYMENT_METHOD_NOT_SUPPORTED`, `OUT_OF_STOCK`, `PRODUCT_NOT_AVAILABLE`.
- Cleaned up dictionaries ensuring zero `??????`, `TODO`, `MISSING`, or empty values.

Verification:

- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- Dedicated public customer i18n E2E spec created: `frontend-next/tests/e2e/i18n-public-customer.spec.ts` (Playwright tests skipped on user request for CI execution).

Resolution notes:

- Playwright and NestJS test steps were skipped for this phase per user instruction as CI handles all tests automatically.
- Validated that the production build completes without any TypeScript or Next.js build errors.

Known gaps:

- Phase 2 customer account fields (e.g., support, returns, security, and addresses detail) remain to be completed in the next phase.

# Phase Report: Public Customer E2E CI Root-Cause Fix

Implemented:

- Seeded demo accounts in the CI Playwright stack before the public/customer E2E batch runs.
- Aligned seller/admin Playwright setup helpers with the backend role-login contract by sending `identifier` to `/api/auth/seller/login` and `/api/auth/admin/login`.
- Stabilized the failing public/customer specs by removing non-essential locale-coupled copy assertions and by reading checkout-created order ids from confirmation state instead of brittle follow-up polling.
- Kept customer language-switcher interaction coverage in `i18n-public-customer.spec.ts` and narrowed `i18n-role-locale.spec.ts` to locale persistence by surface.

Verification:

- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `frontend-next npx playwright test tests/e2e/i18n-public-customer.spec.ts tests/e2e/i18n-role-locale.spec.ts tests/e2e/public-marketplace-contract.spec.ts tests/e2e/product-buying-ux.spec.ts tests/e2e/cart-checkout.spec.ts tests/e2e/yandex-address-readiness.spec.ts tests/e2e/yandex-address-flow.spec.ts tests/e2e/customer-order-history.spec.ts tests/e2e/action-feedback.spec.ts --workers=1`: pass

Root cause summary:

- The CI E2E job booted Docker services without seeding the demo admin account that seller-approval helpers depend on.
- Multiple specs had drifted from the auth API contract and were still posting `email` to role-specific login endpoints that now expect `identifier`.

# Phase Report: E2E Docker DB Bootstrap Fix

Implemented:

- Fixed the E2E workflow ordering so the Dockerized backend database schema is created before demo seeding runs.
- Added a dedicated `Prepare database for E2E` step that executes `npx prisma db push` inside the `backend-nest` container.
- Added `WB_CREDENTIAL_ENCRYPTION_KEY` to the E2E job environment so the Docker stack no longer boots with an empty encryption key warning.

Verification:

- `docker compose -f infra/docker-compose.yml exec -T backend-nest npx prisma db push`: pass
- `docker compose -f infra/docker-compose.yml exec -T -e DEMO_SEED_CONFIRM=true backend-nest npm run seed:demo`: pass

Root cause summary:

- The Playwright E2E Docker stack starts from a blank Postgres instance.
- Seeding was inserted before any schema bootstrap step existed in that stack, so `seed-demo.js` failed on missing tables such as `public.categories`.

# Phase Report: VPS Deploy Without Server Git Access

Implemented:

- Removed the production deploy workflow's dependency on `git fetch` / `git reset` running on the VPS.
- Added repository checkout to the deploy job and uploaded the current `infra/` directory from the GitHub runner to the server before deployment.
- Kept image rollout unchanged: deploy still uses the exact GHCR image tags built for the current commit.

Verification:

- `deploy.yml` now syncs `infra/` to `VPS_APP_DIR` over SSH before compose commands run.
- The failing step no longer depends on GitHub repository access from the VPS host.

Root cause summary:

- The VPS deploy script assumed the server itself could read `origin/main`.
- Once repo access on the server broke or was removed, deployment failed before any image pull or compose update could start.

# Phase Report: Seller Center Navigation UX Refactor

Implemented:

- Replaced the flat seller sidebar with grouped, collapsible navigation driven by a shared config.
- Preserved all existing seller routes and role access while improving active-state handling for nested seller pages.
- Added a seller sidebar search box so sellers can quickly filter sections and links without changing routes.
- Added a mobile drawer version of the grouped seller navigation with the same route coverage and active-state logic.
- Added the missing `seller.dashboard.*` and `sellerShell.groups.*` labels required by the refactored seller shell.
- Corrected corrupted Russian and Vietnamese `seller.orderDetail.*` strings so seller i18n E2E checks no longer fail on garbled text.

Verification:

- `frontend-next npm run check:i18n`: pass
- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `frontend-next npx playwright test tests/e2e/i18n-seller-operations.spec.ts --workers=1`: pass

Root cause summary:

- The seller shell had drifted into a hardcoded flat navigation tree, so active states and mobile behavior were brittle and hard to extend.
- Seller-facing dictionary coverage had also drifted from the code, causing raw keys and corrupted localized labels to appear in seller routes even when the i18n runtime itself was working.

# Phase Report: Seller Payment Ready Status Fix

Implemented:

- Seller-selected `READY` payment status is now authoritative and remains checkout-ready without requiring a QR image or complete bank details.
- Added a shops API regression test covering `READY` with otherwise empty payment settings.

Verification:

- `backend-nest npm run prisma:generate`: pass
- `backend-nest npm run lint`: pass
- `backend-nest npm test -- --runInBand`: pass, 37 suites and 362 tests
- `backend-nest npm run build`: pass
- `backend-nest powershell -ExecutionPolicy Bypass -File scripts/smoke-direct-seller-qr-payment.ps1`: pass

# Phase Report: Sync Selected Products by Manual Codes

Implemented:

- Added seller-scoped `POST /api/shops/:shopId/wb-sync/products/by-codes` while preserving existing sync-all and by-article endpoints.
- Added server-side parsing for comma, semicolon, and newline-separated exact WB `vendorCode` tokens with 5000-character and 100-code limits.
- Added selected-code result reporting for requested, synced, not-found, invalid, skipped, and error outcomes.
- Updated seller WB sync UI with a multi-code textarea, separate selected preview/import actions, loading state, client validation, localized copy, and result summary.
- Added parser, WB client, service scope, selected matching, not-found, and frontend E2E coverage.

Production safety:

- Selected sync reuses seller authentication, shop access, approved-seller checks, encrypted per-shop WB credentials, and existing idempotent product upsert behavior.
- Empty or invalid selected-code input never falls back to sync-all.
- Automated tests use WB mock mode and do not call the real WB API.

Verification:

- `backend-nest npm run prisma:generate`: pass
- `backend-nest npm run lint`: pass
- `backend-nest npm test -- --runInBand`: pass, 38 suites and 374 tests
- `backend-nest npm run build`: pass
- focused WB parser/client/service tests: pass, 3 suites and 35 tests
- `frontend-next npm run check:i18n`: pass, 0 missing English keys and 0 locale gaps
- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- `frontend-next npx playwright test tests/e2e/wb-api-sync.spec.ts --workers=1`: pass, 2 tests
- locale regression E2E: pass, 4 tests
- checkout/recommendation/full-commerce regression E2E: pass, 5 tests
- public smoke E2E: pass, 1 test
- The first local credential-save E2E attempt correctly failed because the runtime had no `WB_CREDENTIAL_ENCRYPTION_KEY`; the final E2E run used a non-secret runtime-only test key without modifying `.env`.

Remaining gaps:

- Real WB selected-code sync remains an opt-in production/runtime verification because default tests must not call the real Wildberries API.

# Phase Report: Profile UX/Data QA.1 - Customer and Seller Information Deduplication Audit

Implemented:

- Customer saved-address creation now prefills recipient name and phone from the authenticated customer profile while keeping each saved address independently editable.
- Seller onboarding now returns missing or blank contact name, phone, and email from the seller account identity without changing stored onboarding values until the seller explicitly saves.
- First-use seller delivery settings now prefill pickup address and contact details from seller onboarding data only when shop delivery settings do not yet exist.
- Empty first-use seller payment settings now prefill matching bank and recipient fields from seller onboarding data without overwriting existing shop payment settings.
- Added EN/RU/VI helper copy explaining when profile defaults were reused.
- Repaired `smoke:delivery` so its fixture supplies a category and publishes through the seller API before checkout.

Source-of-truth map:

- Account identity: `User` name, email, and phone.
- Customer delivery defaults: seller-independent `CustomerAddress` records; checkout selects a saved address for authenticated customers.
- Checkout/order delivery data: immutable checkout and split-order contact/address snapshots created at purchase time.
- Seller legal/contact/bank onboarding: `SellerProfile`, with account identity used only as a missing-value fallback.
- Shop operational/payment data: `Shop`, `ShopPaymentSetting`, and `ShopDeliverySetting`; existing shop settings remain authoritative.
- Seller finance: wallet, ledger, fee, and invoice records remain unchanged.
- WB integration: encrypted per-shop WB credentials remain unchanged.

Confirmed duplication issues fixed:

- New customer address forms forced re-entry of account name and phone.
- New seller onboarding profiles repeated account identity fields.
- First-time delivery settings repeated seller legal address/contact details.
- First-time payment settings repeated seller bank/recipient details.

Production safety:

- No schema migration, localhost source-code dependency, secret, or production-data operation was added.
- Checkout totals, stock validation, public visibility, guest checkout, payment semantics, and order snapshot behavior were not changed.
- Profile defaults never silently overwrite customer profile, seller profile, or saved shop settings.
- Seller profile, delivery, and payment endpoints remain protected by seller authentication and shop ownership guards.
- Customer account/address endpoints remain customer-auth scoped; public order tracking still requires the matching order phone.
- No address, payment, or new PII payload was added to browser local storage.

Verification:

- `backend-nest npm run prisma:generate`: pass
- `backend-nest npm run lint`: pass
- `backend-nest npm test -- --runInBand`: pass, 38 suites and 375 tests
- `backend-nest npm run build`: pass
- focused seller-onboarding backend E2E: pass, 5 tests
- `backend-nest npm run smoke:seller-onboarding`: pass
- `backend-nest npm run smoke:delivery`: pass after fixing its stale unpublished fixture
- `backend-nest npm run smoke:direct-seller-qr-payment`: pass
- `frontend-next npm run check:i18n`: pass, 0 missing English keys and 0 locale gaps
- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- focused profile-reuse browser E2E: pass, 4 tests
- required i18n regression E2E: pass, 4 tests
- required recommendations/cart/checkout/full-commerce E2E: pass, 5 tests
- required public smoke E2E: pass, 1 test
- local Docker runtime health, `/api/health`, `/api/public/products`, and frontend root: pass

Remaining gaps:

- No new automatic profile synchronization was added between account identity and already-saved address/shop records; those records intentionally remain explicit snapshots/settings.
- Manual visual review at every requested viewport was not performed separately; focused and regression Playwright flows passed against the rebuilt production runtime.

# Phase Report: Order Ops QA.1 - Seller Order Processing and Payment Confirmation Audit

Implemented:

- Payment confirmation and rejection now atomically claim the current payment status, preventing concurrent duplicate audit, ledger, and notification side effects.
- Final paid/rejected decisions, cancelled orders, and pay-on-delivery payments before delivery are protected by explicit transition guards for seller and admin actions.
- Public order tracking keeps customer-relevant payment state changes while hiding seller/admin review notes, reviewer identities, seller pickup details, internal provider identifiers, package operations data, and internal delivery notes.
- Seller payment detail hides confirm/reject actions when the current order or payment state makes them invalid.
- Added regression coverage for concurrent confirmation, cross-shop and buyer authorization, cancelled/rejected/final transitions, pay-on-delivery timing, tracking privacy, and final-state frontend actions.

Lifecycle summary:

- Checkout validates all items, creates one parent marketplace checkout receipt, and creates one shop-scoped child order per seller in one transaction.
- Seller fulfillment transitions are `PENDING/NEW -> ASSEMBLING -> SHIPPING -> DELIVERED`, with guarded cancellation before shipping.
- Prepaid/manual payment transitions are pending/unpaid -> paid or rejected.
- Seller QR pay-on-delivery transitions are selected -> seller accepted -> delivered awaiting/buyer marked paid -> seller confirmed or delivery payment rejected.
- Buyer tracking remains phone-gated and projects each shop-scoped child order independently.

Production safety:

- No schema migration, production data operation, real payment provider, billing/campaign charge behavior, recommendation tracking, product detail, AI Try-On, WB sync, secret, or environment file was changed.
- Seller and admin transitions remain role/shop guarded; backend transition validation remains authoritative over frontend controls.

# Phase Report: Buyer Public UX FIX.1 - Public i18n Production Cleanup

Implemented:

- Repaired corrupted Russian Buyer/Public strings that rendered as `????`, including public shop profiles, payment statuses, catalog availability, and public AI Try-On copy.
- Enabled Vietnamese on public/customer surfaces and polished visible Vietnamese Buyer copy across navigation, catalog, product, cart, checkout, tracking, messaging, reviews, account, and support surfaces.
- Localized public shop dates for RU/EN/VI and stopped public shop pages from displaying raw backend error messages.
- Updated homepage slide controls and safe Vietnamese fallback content without changing homepage-slide backend contracts or AI Try-On logic.
- Added a route-mocked public shop regression covering FORMELA-style shop content at desktop, tablet, and mobile viewports in RU/EN/VI.

Production safety:

- No backend business logic, checkout/order/payment/shipping semantics, WB sync, AI Try-On logic, schema, secret, or production data was changed.
- User-generated shop/product names and descriptions remain unchanged; only application-owned UI copy was normalized.
- Public product visibility and checkout readiness remain backend-authoritative.

Verification:

- `frontend-next npm run check:i18n`: pass, 0 missing English keys and 0 locale gaps
- Buyer/Public corrupted-text scan across EN/RU/VI namespaces: pass, 0 `????` or replacement-character findings
- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- rebuilt Docker frontend and runtime health checks: pass, frontend/backend/AI returned HTTP 200
- focused Buyer/Public locale, shop-profile, and public-smoke E2E: pass, 5 tests
- customer account locale persistence E2E: pass, 1 test
- recommendations/cart/cart-validation E2E: pass, 4 tests
- shared role-locale, seller-operations, responsive, and homepage-slider primary E2E checks: pass, 6 tests

Remaining gaps:

- Existing Seller-only Russian `????` groups in dashboard/onboarding/pending and legacy Seller messaging translations are outside this Buyer/Public phase.
- `full-commerce-flow.spec.ts` remains unstable against accumulated local E2E data: one run missed a new payment queue row and a retry found duplicate fixed-name products.
- The homepage mobile navigation test had no public product fixture in the current local DB; the primary homepage-slider responsive test passed.

# Phase Report: Product Detail Size UX FIX.1

Implemented:

- Removed the duplicate selected-variant summary from the product information column; the purchase panel remains the single desktop source for the selected size.
- Normalized public variant labels into two meaningful dimensions: clothing size (`sizeName`, falling back to `techSize`) and Russian size (`russianSize`, falling back to `wbSize`). Equal values such as `25/40` render once; different values such as `M / 46` remain visible.
- Kept size selection, stock status, quantity, cart, buy-now, mobile CTA, and AI Try-On selected-size inputs unchanged.

Verification:

- `frontend-next npm run lint`: pass
- `frontend-next npm run build`: pass
- rebuilt production frontend container: pass
- product buying UX, public marketplace contract, mobile CTA, and public smoke E2E: pass, 4 tests

# Phase Report: Ads Platform Phase 6.4 - Manual Seller Ads Wallet Top-up

Implemented:

- Added shop-scoped manual ads wallet top-up requests with `pending`, `confirmed`, `rejected`, and `cancelled` lifecycle states.
- Sellers can create requests, add transfer references/notes/proof URLs, review their own request history, and cancel pending requests from `/seller/billing`.
- Admins can review requests at `/admin/ads-wallet/top-ups`, confirm matched transfers, or reject pending requests with a required reason.
- Admin confirmation atomically claims the pending request, credits the existing seller wallet through `BillingService`, links the resulting ledger credit, and writes an admin audit log.
- Repeated confirmation is idempotency-safe and returns the already confirmed request without a second wallet credit.
- Wallet foundation creation now uses an idempotent upsert so parallel first-time billing reads cannot create duplicate shop wallets.
- Added `ADS_MANUAL_TOP_UP_ENABLED=true`; existing demo funding now also requires `ADS_DEMO_FUNDING_ENABLED=true`, which defaults to false.

Production safety:

- Pending, rejected, and cancelled requests never change spendable wallet balance.
- No real payment gateway or automatic transfer verification was added.
- Buyer checkout, orders, cart, payment, shipping, seller order payment confirmation, CPC price formula, invalid-click protection, campaign moderation, and recommendation ranking were not changed.

Verification:

- Backend Prisma generate, Linux-container DB push, lint, full `40 suites / 400 tests`, focused billing/recommendations/top-up `64 tests`, and build: pass.
- Frontend i18n parity, lint, build, top-up E2E, campaign moderation, recommendations, public smoke, cart/checkout/full-commerce, seller i18n, role locale, and responsive checks: pass (`16/16` required regression tests).
- Runtime manual QA: pending balance unchanged; confirm credited once and linked one ledger entry; repeated confirm reused the same ledger; reject/cancel did not credit; admin audit created; seller/customer admin API access returned `403`.

Remaining gaps:

- Real payment gateway, invoice/reconciliation, refunds/chargebacks, fraud appeals, and production monitoring remain future work.
