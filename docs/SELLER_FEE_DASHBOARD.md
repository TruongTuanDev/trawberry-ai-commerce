# Seller Fee Dashboard

## Scope

This phase adds manual marketplace fee accounting for the direct-to-seller payment model.

The marketplace does not collect buyer money in this phase. Buyers pay sellers directly by QR/SBP or pay on delivery through seller QR instructions. Because of that, platform fee collection is ledger-based instead of gateway-settlement-based.

## Core Model

- confirmed buyer payment creates seller revenue for finance purposes
- platform commission is calculated from confirmed product revenue only
- delivery fee is excluded from commission when it is stored separately
- historical month data is never reset or deleted
- each ledger entry snapshots the commission percent at the moment of final payment confirmation

## Supported Confirmation Sources

Ledger entries are created only when the order reaches final confirmed payment:

- `PREPAID_SELLER_QR`
  - create ledger entry when seller confirms prepaid payment
- `PAY_ON_DELIVERY_SELLER_QR`
  - create ledger entry when seller confirms delivery payment
- `DEPOSIT_THEN_DELIVERY_PAYMENT`
  - create ledger entry when final payment is confirmed

Cancelled or reversed finance situations do not delete history. The system writes adjustment entries instead.

## Admin Capabilities

Route:

- `/admin/finance/seller-fees`

Admin can:

- review shops with seller contact info
- review orders today / month
- review revenue today / month
- review confirmed revenue this month
- set commission percent per shop
- see current billing period and days left in month
- generate a monthly invoice manually
- mark an invoice paid manually

If a shop has no shop-specific commission setting, the platform default commission setting is used.

## Seller Capabilities

Routes:

- `/seller/dashboard`
- `/seller/finance`

Seller can:

- see orders today
- see revenue today
- see orders this month
- see revenue this month
- see confirmed revenue today / month
- see estimated platform fee this month
- see pending payment order count
- see delivery-in-progress order count
- review fee ledger history
- review invoice history

## Ledger and Invoice Status

Ledger entry statuses:

- `PENDING`
- `INVOICED`
- `PAID`
- `WAIVED`
- `CANCELLED`

Invoice statuses:

- `DRAFT`
- `ISSUED`
- `PAID`
- `OVERDUE`
- `CANCELLED`

## Current Limitations

- invoice generation and mark-paid are manual admin actions
- no automatic debit from seller bank account
- no payout or seller balance automation
- no refund reconciliation automation yet
- `DEPOSIT_THEN_DELIVERY_PAYMENT` still shares the current final-confirmation path and does not yet model a separate deposit ledger lifecycle

## Verification

- `backend-nest npm run smoke:seller-fee-dashboard`
- `frontend-next npm run test:e2e:seller-fee-dashboard`
