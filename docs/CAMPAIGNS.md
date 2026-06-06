# Campaigns

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

## What Phase 4.2 should add

Phase 4.2 should connect this foundation to a seller wallet and billing ledger without breaking current ownership or lifecycle rules.

Recommended Phase 4.2 work:

- seller wallet balance model
- immutable billing ledger entries
- safe attribution event model for campaign clicks/impressions
- non-blocking spend snapshot fields per campaign
- budget consumption logic based on ledger writes, not ad hoc counters
- clear internal reconciliation between:
  - campaign
  - campaign target
  - wallet
  - ledger
  - attribution event

Phase 4.2 should still keep public recommendation APIs backward compatible.
