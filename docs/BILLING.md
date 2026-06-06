# Billing

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
