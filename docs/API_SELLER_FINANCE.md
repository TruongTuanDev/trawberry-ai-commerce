# Seller Finance API

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
