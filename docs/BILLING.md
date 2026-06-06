# Billing

## Phase 4.5 final V1 demo freeze

Phase 4.5 freezes the wallet and ledger demo flow for final reporting.

Final V1 billing demo checklist:

1. Log in as seller.
2. Open `/seller/billing`.
3. Show wallet balance, reserved balance, and available balance.
4. Explain that the funding action is demo/dev only, not a real payment flow.
5. Add a small demo wallet credit when the dev flag is enabled.
6. Confirm the `Dev/demo funding` ledger entry appears.
7. Trigger a sponsored recommendation click from the public storefront.
8. Return to `/seller/billing`.
9. Show the campaign-linked charge row in the ledger.
10. Explain the wallet movement and how it connects to campaign spend.

Final V1 completed billing-side features:

- seller wallet summary
- reserved balance tracking
- available balance tracking
- immutable ledger history
- campaign-linked CPC charge rows
- safe local demo funding
- no leakage of user/session/private billing internals on public APIs

Intentionally excluded from V1:

- real payment gateway top-up
- invoices
- fraud controls
- automated finance review
- advanced billing analytics
- customer-facing billing changes

## Phase 4.4 V1 demo readiness and safe dev funding

Phase 4.4 makes the seller billing foundation demo-ready without introducing a real payment provider or changing checkout behavior.

Added in this phase:

- a dev/demo-only seller wallet funding path:
  - `POST /api/seller/shops/:shopId/billing/wallet/dev-credit`
- strict gating behind:
  - backend `BILLING_DEV_TOOLS_ENABLED=true`
  - frontend `NEXT_PUBLIC_BILLING_DEV_TOOLS_ENABLED=true`
- positive-amount-only validation
- max demo funding cap via:
  - `BILLING_DEV_TOOLS_MAX_CREDIT_AMOUNT`
- same-shop ownership enforcement for the current seller
- immutable `BillingLedgerEntry` creation with safe demo labeling:
  - `referenceType: dev_demo_funding`
  - `description: Dev/demo funding`
- seller billing UI guidance for:
  - current wallet state
  - demo funding
  - recent charged recommendation clicks

Still intentionally not included:

- real top-up flow
- payment gateway integration
- invoice generation for wallet funding
- customer-visible billing
- checkout or order payment changes

### Dev funding API behavior

- Disabled by default.
- Returns `404` when the backend flag is off.
- Only the current seller can fund their own shop wallet.
- Amount must be greater than `0`.
- Amount must not exceed the configured max cap.
- Writes wallet + ledger in one transaction through the existing billing service.
- Does not expose user id, session id, cookies, or internal metadata in the seller response.

### Safe seller response

The dev funding response keeps the same safe data model style:

- `wallet`
  - `id`
  - `shopId`
  - `balance`
  - `reservedBalance`
  - `availableBalance`
  - `currency`
  - `status`
  - `createdAt`
  - `updatedAt`
- `entry`
  - `id`
  - `walletId`
  - `shopId`
  - `type`
  - `amount`
  - `currency`
  - `balanceBefore`
  - `balanceAfter`
  - `reservedBefore`
  - `reservedAfter`
  - `referenceType`
  - `referenceId`
  - `description`
  - `campaign`
  - `createdAt`

### Local demo script

1. Set `BILLING_DEV_TOOLS_ENABLED=true` in the backend runtime.
2. Set `BILLING_DEV_TOOLS_MAX_CREDIT_AMOUNT=50000` or another safe local cap.
3. Set `NEXT_PUBLIC_BILLING_DEV_TOOLS_ENABLED=true` in the frontend runtime.
4. Open `/seller/billing`.
5. Pick the seller shop used for the sponsored campaign demo.
6. Use the demo funding panel to add a small safe amount, for example `250`.
7. Confirm a `Dev/demo funding` ledger row appears.
8. Open `/seller/campaigns` and confirm the campaign is active with `cpc` billing.
9. Trigger a sponsored recommendation click from the public storefront.
10. Return to `/seller/billing` and `/seller/campaigns` to confirm the charged click reduced wallet balance and increased campaign spend safely.

### Post-V1 roadmap

- real seller funding workflow
- payment gateway integration
- invoice and reconciliation tooling
- fraud controls and audit trails
- richer campaign analytics
- optional CPM batching and scheduled billing
## Phase 4.3 V1 completion

Phase 4.3 connects the seller wallet foundation to sponsored recommendation click charging.

Added in this phase:

- sponsored CPC clicks can debit the shop wallet transactionally
- each successful charge writes a `BillingLedgerEntry`
- ledger rows can reference the related campaign
- insufficient available balance prevents the charge and leaves the event safely tracked as uncharged
- campaign budget checks run before the CPC debit

Current V1 charging rules:

- `cpc`: charge on sponsored recommendation click
- `cpm`: record impression events only, no auto-charge yet
- `fixed`: stored only, no auto-charge
- `none`: no auto-charge

Current seller-visible outcome:

- `/seller/billing` now reflects campaign charge ledger entries
- `/seller/campaigns` shows campaign spend, charged click counts, remaining budget, and wallet-blocked/budget-exhausted states

Still not implemented:

- real top-up flow
- payment gateway
- invoices for this wallet layer
- CPM batching
- fraud prevention
- seller self-serve billing complexity beyond the current demo flow

## Phase 4.2 scope

Phase 4.2 adds seller wallet and billing ledger foundations for the active `backend-nest` + `frontend-next` stack only.

Included:

- shop-scoped seller wallet persistence
- transactional immutable billing ledger entries
- seller-visible wallet summary and ledger history
- safe future-facing campaign reference support on ledger rows

Explicitly not included:

- real top-up flow
- payment gateway integration
- invoice UI for this wallet layer
- automatic campaign spend charging
- sponsored impression charging
- sponsored click charging
- checkout or order payment deductions
- budget consumption enforcement

## Ownership model

- Billing is shop-scoped.
- Each seller shop can have at most one wallet.
- Sellers can only read wallet and ledger data for shops they already own through the existing seller auth and `ShopAccessGuard` pattern.
- Ledger rows can optionally reference a campaign from the same shop, but campaign charging is not active yet.

## Data model

### `SellerWallet`

Persisted fields:

- `id`
- `shopId`
- `balance`
- `reservedBalance`
- `currency`
- `status`
  - `active`
  - `frozen`
  - `closed`
- `createdAt`
- `updatedAt`

### `BillingLedgerEntry`

Persisted fields:

- `id`
- `walletId`
- `shopId`
- `campaignId`
- `type`
  - `credit`
  - `debit`
  - `reserve`
  - `release`
  - `refund`
  - `adjustment`
- `amount`
- `currency`
- `balanceBefore`
- `balanceAfter`
- `reservedBefore`
- `reservedAfter`
- `referenceType`
- `referenceId`
- `description`
- `metadata`
- `createdAt`

## Money precision rules

- Billing money values use Prisma `Decimal`.
- Wallet balances use `Decimal(14, 2)`.
- Ledger amounts and before/after snapshots use `Decimal(14, 2)`.
- Mutation inputs are rounded to two decimal places before persistence.
- Currency defaults to `RUB`.
- Cross-currency wallet mutations are rejected.

## Mutation safety rules

- Wallet and ledger writes happen in one transaction.
- Negative `reservedBalance` is never allowed.
- `reservedBalance` cannot exceed total wallet `balance`.
- Negative balance is blocked by default.
- Debit and reserve operations use available balance:
  - `availableBalance = balance - reservedBalance`
- Only `active` wallets currently allow mutations.

## Seller APIs

All seller billing routes are shop-scoped and protected by the existing seller auth plus `ShopAccessGuard`.

- `GET /api/seller/shops/:shopId/billing/wallet`
  - gets or creates the wallet foundation for the shop
- `GET /api/seller/shops/:shopId/billing/ledger`
  - returns seller-visible ledger entries ordered newest first

Current seller response shape is intentionally safe:

- wallet:
  - `id`
  - `shopId`
  - `balance`
  - `reservedBalance`
  - `availableBalance`
  - `currency`
  - `status`
  - `createdAt`
  - `updatedAt`
- ledger:
  - `id`
  - `walletId`
  - `shopId`
  - `type`
  - `amount`
  - `currency`
  - `balanceBefore`
  - `balanceAfter`
  - `reservedBefore`
  - `reservedAfter`
  - `referenceType`
  - `referenceId`
  - `description`
  - `campaign`
    - `id`
    - `name`
  - `createdAt`

Not exposed:

- user id
- session id
- cookies
- private auth payloads
- raw internal metadata

## Frontend

Internal seller-facing route:

- `/seller/billing`

Current Phase 4.2 UI shows:

- wallet balance
- reserved balance
- available balance
- currency
- wallet status
- ledger history table
- explicit messaging that this is billing foundation only

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
3. Open `/seller/billing`
4. Pick a seller shop
5. Confirm the wallet auto-creates on first load
6. Confirm the page clearly states that real charging is not active
7. Confirm the ledger table renders safely when empty
8. Confirm another seller cannot access a different shop wallet or ledger

## Phase 4.3 handoff

Phase 4.3 should connect sponsored impression and click attribution to this foundation without changing checkout or public payment behavior.

Recommended Phase 4.3 connection points:

- write immutable attribution events for sponsored impressions and clicks
- map billable attribution events to wallet ledger mutations
- keep wallet balance and reserved balance updates transactional with attribution settlement
- use campaign references plus safe `referenceType` / `referenceId` values for reconciliation
- keep public recommendation payloads free of wallet or billing internals
