# Campaigns

## Phase 5.4 tuning interaction

Controlled ranking tuning presets do not change campaign lifecycle, CPC pricing, wallet mutation, billing ledger, budget enforcement, or seller campaign controls.

The Phase 5.4 sponsored multiplier is restricted to `0..1`. It can reduce an existing eligible sponsored contribution during an explicitly enabled tuning rollout, but it cannot increase sponsored boost beyond the current campaign, preset, organic-relevance, wallet, or budget guardrails.

Tuning preview never writes sponsored recommendation events, charges CPC, consumes campaign budget, or creates billing ledger rows.

## Phase 4.5 final V1 demo freeze

Phase 4.5 freezes the campaign feature set for final reporting and demo use.

Final V1 campaign demo checklist:

1. Log in as seller.
2. Open `/seller/billing`.
3. Add a small demo wallet credit when dev funding is enabled.
4. Open `/seller/campaigns`.
5. Create a draft campaign.
6. Add one or more published product targets from the same shop.
7. Set `cpc` billing mode and an optional `budgetLimit`.
8. Activate the campaign.
9. Open a public recommendation surface.
10. Click a sponsored recommendation.
11. Return to `/seller/campaigns`.
12. Show:
  - campaign status
  - budget
  - remaining budget
  - charged clicks
  - impressions or events when available
  - wallet blocked / budget exhausted state if relevant

Final V1 completed campaign-side features:

- campaign draft/create/edit/archive
- product targeting by seller shop
- activation safety checks
- bounded sponsored boost eligibility
- campaign spend tracking
- charged click visibility
- remaining budget visibility
- wallet blocked visibility
- budget exhausted visibility
- recent sponsored event visibility

Intentionally excluded from V1:

- auction bidding
- real seller funding
- invoice workflow
- fraud tooling
- advanced analytics
- campaign moderation workflow
- production finance review workflow

## Phase 4.3 V1 completion

Phase 4.3 completes the first demo-ready sponsored campaign loop for the active `backend-nest` + `frontend-next` stack.

Added in this phase:

- active campaign targets now feed sponsored recommendation ranking when all safety checks pass
- recommendation responses can include a safe public `sponsored` marker plus an opaque `trackingToken`
- sponsored recommendation events are attributed back to:
  - `campaignId`
  - `shopId`
  - `productId`
  - scenario type
  - billing mode
- CPC click charging now writes transactional `BillingLedgerEntry` rows
- campaign spend, charged clicks, remaining budget, wallet-blocked state, and budget-exhausted state are now computed and returned safely to seller tooling
- seller performance APIs now include:
  - `GET /api/seller/shops/:shopId/campaigns/:campaignId/performance`
  - `GET /api/seller/shops/:shopId/campaigns/:campaignId/events`
- seller UI at `/seller/campaigns` now shows:
  - budget limit
  - spent amount
  - remaining budget
  - billing mode
  - billable and charged click counts
  - recent sponsored event history

V1 behavior:

- only eligible active campaigns can influence sponsored ranking
- sponsored boost remains additive and bounded
- CPC charges happen on click only
- CPM impressions are tracked but not auto-charged yet
- `fixed` and `none` do not auto-charge
- insufficient wallet balance blocks charging
- exhausted budget blocks further sponsored serving for CPC campaigns
- public storefront pages never expose wallet balances or campaign billing internals

V1 demo flow:

1. Open `/seller/campaigns`
2. Create a draft campaign
3. Add one or more published product targets from the same shop
4. Set billing mode to `cpc`
5. Set an optional `budgetLimit`
6. Activate the campaign
7. If local demo funding is enabled, open `/seller/billing` and add a small demo wallet balance
8. Trigger recommendation impressions/clicks from public recommendation sections
9. Confirm `/seller/campaigns` shows spend and recent event activity
10. Confirm `/seller/billing` shows the corresponding ledger row for charged clicks

## Phase 4.4 demo readiness notes

Phase 4.4 does not change campaign lifecycle or recommendation serving rules. It adds a safer local demo path so campaign spend can be demonstrated without a real payment gateway.

Demo readiness additions:

- `/seller/billing` can now expose a local dev/demo funding action when:
  - `BILLING_DEV_TOOLS_ENABLED=true`
  - `NEXT_PUBLIC_BILLING_DEV_TOOLS_ENABLED=true`
- the funding action is explicitly labeled dev/demo only
- campaign performance and wallet deductions can now be shown end-to-end in a local V1 reporting demo

Still intentionally out of scope for V1:

- seller self-serve real top-up
- payment gateway funding
- invoices
- fraud systems
- advanced spend analytics

## Phase 4.1 scope

Phase 4.1 adds a campaign management foundation for the active `backend-nest` + `frontend-next` stack only.

Included:

- seller-managed sponsored campaign drafts
- seller-owned product targeting by shop
- safe lifecycle validation
- placeholder billing metadata for future spend and wallet integration
- internal read-only bridge method for future recommendation targeting

Explicitly not included:

- wallet balances
- billing ledger writes
- click charging
- impression charging
- budget deduction
- auction logic
- seller self-serve billing or invoice UI
- public recommendation payload changes

## Data model

### `SponsoredCampaign`

Safe persisted fields:

- `id`
- `shopId`
- `name`
- `description`
- `status`
  - `draft`
  - `active`
  - `paused`
  - `ended`
  - `archived`
- `scenarioTypes`
  - `home`
  - `similar`
  - `search`
- `startAt`
- `endAt`
- `budgetLimit`
- `billingMode`
  - `none`
  - `cpc`
  - `cpm`
  - `fixed`
- `maxBoost`
- `createdAt`
- `updatedAt`

### `SponsoredCampaignProduct`

Safe persisted fields:

- `id`
- `campaignId`
- `productId`
- `boost`
- `status`
  - `active`
  - `paused`
  - `removed`
- `createdAt`
- `updatedAt`

## Ownership model

- Campaigns are shop-scoped.
- Seller access follows the existing `shopId` guard pattern.
- Sellers can only create, update, list, or archive campaigns for shops they own.
- Sellers can only attach products that belong to the same shop.

## Status lifecycle

Allowed transitions:

- `draft -> active`
- `draft -> archived`
- `active -> paused`
- `active -> ended`
- `active -> archived`
- `paused -> active`
- `paused -> ended`
- `paused -> archived`
- `ended -> archived`

Rejected transitions include:

- `active -> draft`
- `ended -> active`
- any update from `archived`

## Activation rules

Campaign activation is blocked when any of these are true:

- no non-removed targets exist
- no active or paused targets exist
- target product does not belong to the seller shop
- target product is not public-safe
  - not `PUBLISHED`
  - not `ACTIVE`
  - archived
  - unpublished
- target boost exceeds campaign `maxBoost`
- `endAt < startAt`

## Seller APIs

All seller routes are shop-scoped and protected by the existing seller auth + shop access guard pattern.

- `GET /api/seller/shops/:shopId/campaigns`
- `POST /api/seller/shops/:shopId/campaigns`
- `GET /api/seller/shops/:shopId/campaigns/:campaignId`
- `PATCH /api/seller/shops/:shopId/campaigns/:campaignId`
- `POST /api/seller/shops/:shopId/campaigns/:campaignId/archive`
- `DELETE /api/seller/shops/:shopId/campaigns/:campaignId`
  - soft delete alias for archive
- `POST /api/seller/shops/:shopId/campaigns/:campaignId/targets`
  - add or update a product target
- `DELETE /api/seller/shops/:shopId/campaigns/:campaignId/targets/:targetId`
  - marks target as `removed`

## Seller UI

Internal seller-facing management route:

- `/seller/campaigns`

Current Phase 4.1 UI supports:

- campaign list
- campaign draft creation
- editing lifecycle-safe campaign fields
- add/update/remove product targets
- viewing placeholder billing metadata
- selecting suggested published products from the current shop

Current UI intentionally does not support:

- wallet balances
- spend graphs
- invoice history
- billing exports
- auction or bid management

## Billing placeholders

Campaign responses include a safe non-charging billing summary:

- `mode`
- `budgetLimit`
- `chargingEnabled: false`
- `spendTracked: false`
- explanatory notes

This is intentional. Phase 4.1 stores future-facing metadata only and does not charge sellers.

## Recommendation bridge

Phase 4.1 adds an internal read-only bridge method in the campaigns service:

- `getActiveRecommendationTargets(scenarioType, shopId?)`

Current purpose:

- provide a future integration point for recommendation ranking
- keep the bridge internal-only
- avoid changing public recommendation APIs in this phase

Current behavior:

- returns only active campaigns
- filters by scenario type
- returns only active public-safe products
- does not expose user, session, cookie, or private billing data

## Local QA

### Backend

1. Run `backend-nest npm run prisma:generate`
2. Run `backend-nest npm run prisma:db:push`
3. Run `backend-nest npm run lint`
4. Run `backend-nest npm test -- --runInBand`
5. Run `backend-nest npm run build`

### Frontend

1. Run `frontend-next npm run lint`
2. Run `frontend-next npm run build`
3. Open `/seller/campaigns`
4. Pick a seller shop
5. Create a draft campaign
6. Attach a published product target from the same shop
7. Move the campaign to `active`
8. Confirm billing placeholders remain non-charging
9. Confirm public pages do not expose campaign metadata

## Phase 4.2 wallet and ledger connection

Phase 4.2 now adds a billing foundation without enabling real charging yet.

Current campaign-to-billing relationship:

- campaign `budgetLimit` still remains a placeholder
- ledger rows may optionally reference a `campaignId`
- no campaign mutation automatically writes wallet or ledger data yet
- no campaign activation or ranking flow deducts spend yet

This keeps Phase 4.1 campaign ownership and lifecycle behavior intact while making future billing reconciliation possible.

## What Phase 4.3 should add

Phase 4.3 should connect sponsored impression and click attribution to campaigns plus the new wallet/ledger foundation without breaking current ownership or public recommendation contracts.

Recommended Phase 4.3 work:

- immutable sponsored attribution event model
- attribution-to-ledger settlement rules
- campaign-linked wallet mutations for billable events
- safe spend snapshots or derived budget usage views
- explicit reconciliation between:
  - campaign
  - campaign target
  - attribution event
  - wallet
  - billing ledger

Phase 4.3 should still keep public recommendation APIs backward compatible and avoid leaking private billing data.
