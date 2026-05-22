# Three Role Order Sync Audit

Date: `2026-05-22`

## Summary

This audit verifies one marketplace order across `Customer`, `Seller`, and `Admin` in the active stack only.

Outcome:

- customer receipt/history visibility: working
- seller order queue and next-action visibility: working after this phase
- admin seller filtering/search/summary visibility: working after this phase
- admin payment to finance sync: working, including ledger visibility on payment review rows

Known posture:

- payment remains direct-to-seller and manual
- Yandex remains manual workbench only
- finance ledger remains manual invoice MVP

## Matrix

| Step | Customer sees | Seller sees | Admin sees | Backend state | Status | Gap |
|---|---|---|---|---|---|---|
| Checkout created | receipt / order history | new shop order row | payment and delivery can be supervised from admin queues | child order linked to shop and checkout | OK | none |
| Prepaid QR selected | QR instructions and payment status | order in `NEW` / waiting proof | admin payment row after proof upload | `paymentStatus=PENDING`, proof later moves to `BUYER_MARKED_PAID` | OK | none |
| Buyer uploads prepaid proof | proof accepted and waiting seller review | seller payment queue shows order | admin payment supervision shows row | `paymentProofStatus=BUYER_MARKED_PAID` | OK | none |
| Seller confirms prepaid payment | paid status and later delivery timeline | next action becomes prepare/create Yandex | admin sees paid status and ledger state | `paymentStatus=PAID`, finance ledger created idempotently | OK | none |
| COD via seller QR selected | pay-on-delivery instruction | seller can accept without upfront proof | admin can later supervise delivered-awaiting-payment | `paymentStatus=PAY_ON_DELIVERY_SELECTED` | OK | none |
| Seller accepts COD | no buyer proof required yet | ready for Yandex | admin can see ops movement via payments/delivery | `SELLER_ACCEPTED_PAY_ON_DELIVERY`, `READY_TO_CREATE_YANDEX` | OK | none |
| Seller creates manual Yandex | delivery timeline visible | manual Yandex workbench state | admin delivery supervision row | shipment `YANDEX_MANUAL_CREATED` | OK | none |
| Delivered awaiting COD payment | buyer told to pay seller directly | seller sees wait-for-payment next action | admin payment supervision can filter unpaid delivered rows | `DELIVERED_AWAITING_PAYMENT` | OK | none |
| Buyer marks delivery paid | tracking says seller review pending | seller sees confirm final payment action | admin sees buyer-marked-delivery-paid queue | `BUYER_MARKED_DELIVERY_PAID` | OK | none |
| Seller confirms final payment | final paid state | payment completed | finance row visible in admin finance | `SELLER_CONFIRMED_DELIVERY_PAYMENT` + ledger row | OK | none |
| Admin seller management | n/a | n/a | seller tabs, counts, search, detail summary | seller approval and shop/finance summary | OK | suspend flow still future |

## Findings

### Confirmed synchronized now

- customer checkout immediately creates seller-visible shop orders
- seller payment confirmation creates fee-ledger rows without duplication
- admin payment supervision now exposes ledger status, fee amount, and invoice status
- admin seller list now supports:
  - `PENDING`
  - `APPROVED`
  - `REJECTED`
  - `ALL`
  - search by seller email / phone / name / shop name
- seller orders now expose:
  - display status
  - status bucket
  - next action
  - payment method
  - latest finance summary

### Remaining gaps

- no dedicated seller tab yet for `Cancelled`; backend bucket exists, UI tabs currently focus on active ops
- admin seller suspension remains future work
- customer order detail still relies on existing receipt/tracking surfaces; this phase did not add a new dedicated customer-only order-status component
- payment and delivery remain manual operations, not provider-driven

## Required operational hooks

- fee ledger creation point:
  - prepaid QR -> seller confirmed prepaid payment
  - pay on delivery seller QR -> seller confirmed delivery payment
  - deposit then delivery -> seller confirmed final payment
- admin visibility point:
  - buyer marked paid
  - seller confirmed
  - seller rejected
  - delivered awaiting payment
  - ledger created or missing

## Verification targets for this phase

- backend smoke: `npm run smoke:three-role-order-sync`
- frontend e2e:
  - `npm run test:e2e:three-role-order-sync`
  - `npm run test:e2e:admin-seller-management`
