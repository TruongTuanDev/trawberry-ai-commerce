# Seller Finance API

## 2026-06-07 Campaign Billing V1 Completion Phase 4.3

Seller finance now includes the first live sponsored campaign billing loop for recommendation CPC clicks.

Updated seller endpoints:

- `GET /api/seller/shops/:shopId/billing/wallet`
- `GET /api/seller/shops/:shopId/billing/ledger`
- `GET /api/seller/shops/:shopId/campaigns/:campaignId/performance`
- `GET /api/seller/shops/:shopId/campaigns/:campaignId/events`

New V1 behavior:

- sponsored recommendation CPC clicks can create transactional `debit` ledger rows
- campaign-linked spend is now visible through campaign performance summaries
- budget exhaustion and low-wallet states are surfaced safely to the seller

Campaign performance response summary now includes fields such as:

- `spentAmount`
- `budgetLimit`
- `remainingBudget`
- `billableImpressions`
- `billableClicks`
- `chargedClicks`
- `totalChargedEvents`
- `totalEvents`
- `servedAsSponsored`
- `budgetExhausted`
- `walletBlocked`
- `cpcAmount`

## 2026-06-07 Seller Billing Foundation Phase 4.2

Seller finance now includes a separate shop-scoped wallet and billing ledger foundation for future sponsored billing.

New seller billing endpoints:

- `GET /api/seller/shops/:shopId/billing/wallet`
- `GET /api/seller/shops/:shopId/billing/ledger`

Current behavior:

- wallet auto-creates on first access for an owned shop
- billing data is shop-scoped and seller-guarded
- responses expose only safe wallet and ledger fields
- no real charging, top-up, or spend deduction is active yet

Wallet response:

```json
{
  "id": "uuid",
  "shopId": "uuid",
  "balance": "0",
  "reservedBalance": "0",
  "availableBalance": "0",
  "currency": "RUB",
  "status": "active",
  "createdAt": "2026-06-07T10:00:00.000Z",
  "updatedAt": "2026-06-07T10:00:00.000Z"
}
```

Ledger response row:

```json
{
  "id": "uuid",
  "walletId": "uuid",
  "shopId": "uuid",
  "type": "credit",
  "amount": "100",
  "currency": "RUB",
  "balanceBefore": "0",
  "balanceAfter": "100",
  "reservedBefore": "0",
  "reservedAfter": "0",
  "referenceType": "manual_top_up",
  "referenceId": "seed-1",
  "description": "Seed wallet",
  "campaign": null,
  "createdAt": "2026-06-07T10:00:00.000Z"
}
```

Safety notes:

- money values use Prisma `Decimal`
- negative reserved balance is blocked
- negative balance is blocked by default
- wallet and ledger writes are designed to be transactional
- no checkout, order, or payment flow writes to this foundation yet

## 2026-05-22 Return / Refund / Dispute Foundation

Seller finance now projects refund adjustments for direct-to-seller payment flows.

New ledger behavior:

- original positive commission entry is preserved
- refund confirmation can create a negative adjustment row with:
  - `source=RETURN_REFUND_CONFIRMED`
  - `referenceCaseId=<returnRefundCaseId>`
- adjustment is idempotent per case

Operational meaning:

- admin seller-fee due decreases when refund adjustment is posted
- seller finance ledger shows both the original fee row and the reversal row

## 2026-05-22 Three Role Order Sync Addendum

Finance visibility is now part of the operational order sync:

- seller order detail can project latest ledger status and invoice status
- admin payment supervision can project ledger creation state
- seller-confirmed final payment remains the only valid trigger for ledger creation

This keeps customer payment confirmation, seller operations, and admin fee accounting aligned.

## Overview

These endpoints support manual marketplace fee accounting for direct-to-seller payment.

Fee calculation rule:

- `commissionAmount = confirmedProductRevenue * commissionPercent / 100`

Important constraints:

- only final confirmed order payments create fee ledger entries
- delivery fee is excluded from commission when stored separately
- ledger entries are idempotent per order + confirmation source
- changing commission later does not rewrite old ledger snapshots
- monthly period history is retained permanently
- admin configures commission per shop, not per order
- order-level `commissionPercent` is a read-only ledger snapshot once created

## Admin Endpoints

All admin finance endpoints require admin authentication.

### `GET /api/admin/finance/seller-fees`

Returns one finance summary row per shop:

```json
{
  "shopId": "uuid",
  "shopName": "Seller One Atelier",
  "sellerName": "Seller One",
  "sellerEmail": "seller1@example.com",
  "sellerPhone": "+79990000011",
  "ordersToday": 1,
  "revenueToday": "350",
  "ordersThisMonth": 4,
  "revenueThisMonth": "950",
  "confirmedRevenueThisMonth": "470",
  "commissionPercent": "3",
  "platformFeeDue": "14.1",
  "billingPeriod": "2026-05",
  "daysLeftInMonth": 9,
  "invoiceStatus": "ISSUED"
}
```

### `PATCH /api/admin/finance/shops/:shopId/commission`

Body:

```json
{
  "commissionPercent": 3
}
```

Behavior:

- closes the previous active commission setting for the shop
- creates a new active commission setting from now forward
- does not rewrite historical ledger rows
- affects only orders confirmed after the new setting becomes active

### `POST /api/admin/finance/shops/:shopId/invoices/generate`

Body:

```json
{
  "billingPeriod": "2026-05"
}
```

Behavior:

- groups current `PENDING` ledger rows for the shop + period
- creates or updates one monthly invoice per `shopId + billingPeriod`
- moves linked ledger rows to `INVOICED`

### `POST /api/admin/finance/invoices/:invoiceId/mark-paid`

Behavior:

- marks invoice `PAID`
- marks linked ledger rows `PAID`

### `GET /api/admin/finance/invoices`

Returns all monthly invoices with shop and seller contact summary.

## Seller Endpoints

All seller finance endpoints are shop-scoped and protected by `ShopAccessGuard`.

### `GET /api/seller/shops/:shopId/dashboard-metrics`

Returns:

```json
{
  "ordersToday": 1,
  "revenueToday": "350",
  "confirmedRevenueToday": "300",
  "ordersThisMonth": 4,
  "revenueThisMonth": "950",
  "confirmedRevenueThisMonth": "470",
  "pendingPaymentOrders": 2,
  "deliveryInProgressOrders": 1,
  "commissionPercent": "3",
  "estimatedPlatformFeeThisMonth": "14.1",
  "billingPeriod": "2026-05",
  "daysLeftInMonth": 9
}
```

### `GET /api/seller/shops/:shopId/finance-ledger`

Returns finance ledger rows:

```json
{
  "id": "uuid",
  "orderId": "uuid",
  "orderCode": "ORD-FIN-1001",
  "billingPeriod": "2026-05",
  "productRevenueAmount": "170",
  "deliveryFeeAmount": "30",
  "commissionPercent": "3",
  "commissionAmount": "5.1",
  "status": "PENDING",
  "source": "PREPAID_CONFIRMED",
  "createdAt": "2026-05-21T12:00:00.000Z",
  "updatedAt": "2026-05-21T12:00:00.000Z",
  "invoiceId": null
}
```

Invoice totals must be derived from these stored ledger rows and their snapshotted `commissionPercent` values.

### `GET /api/seller/shops/:shopId/invoices`

Returns seller-visible monthly invoices:

```json
{
  "id": "uuid",
  "sellerId": "uuid",
  "shopId": "uuid",
  "billingPeriod": "2026-05",
  "totalRevenue": "470",
  "totalCommission": "14.1",
  "status": "PAID",
  "dueDate": "2026-06-08T00:00:00.000Z",
  "issuedAt": "2026-05-22T10:00:00.000Z",
  "paidAt": "2026-05-22T10:10:00.000Z",
  "createdAt": "2026-05-22T10:00:00.000Z",
  "updatedAt": "2026-05-22T10:10:00.000Z"
}
```

## Ledger Sources

- `PREPAID_CONFIRMED`
- `DELIVERY_PAYMENT_CONFIRMED`
- `FINAL_PAYMENT_CONFIRMED`
- `ADMIN_ADJUSTMENT`

## Known Limitations

- no automatic seller bank debit
- no payout orchestration
- no refund settlement automation
- invoice generation is manual MVP
