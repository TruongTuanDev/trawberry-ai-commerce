# Admin Ops Reporting

Admin Ops Reporting adds read-only operational reports and CSV export for marketplace supervision.

## Scope

Reports cover:

- SLA breached queue tasks
- task ownership and workload by admin
- delivery exceptions
- pending payment aging
- overall operations summary

Email notifications and scheduled report delivery are not part of this phase.

## API

All endpoints are admin-only and use `JwtAuthGuard` plus `AdminOnlyGuard`.

- `GET /api/admin/reports/ops-summary`
- `GET /api/admin/reports/sla-breaches`
- `GET /api/admin/reports/workload`
- `GET /api/admin/reports/delivery-exceptions`
- `GET /api/admin/reports/payment-aging`

Common filters:

- `dateFrom`
- `dateTo`

Additional filters:

- `ops-summary`: `shopId`, `sellerId`, `assignedToUserId`
- `sla-breaches`: `entityType`, `assignedToUserId`, `page`, `limit`
- `delivery-exceptions`: `provider`, `reasonCode`, `shopId`, `page`, `limit`
- `payment-aging`: `ageBucket`, `shopId`, `page`, `limit`

Payment aging buckets:

- `0-4h`
- `4-24h`
- `24-72h`
- `72h+`

## CSV Export

CSV endpoints:

- `GET /api/admin/reports/sla-breaches.csv`
- `GET /api/admin/reports/workload.csv`
- `GET /api/admin/reports/delivery-exceptions.csv`
- `GET /api/admin/reports/payment-aging.csv`

CSV behavior:

- content type: `text/csv; charset=utf-8`
- includes UTF-8 BOM for Excel compatibility
- escapes commas, quotes, and newlines
- caps export rows at 5000
- does not export secrets, tokens, raw internal payloads, private files, or credentials

## Frontend

Admin route:

- `/admin/reports`

Sections:

- Ops Summary
- SLA Breaches
- Workload
- Delivery Exceptions
- Payment Aging

The page includes date range filters, summary cards, report tables, row links to admin work areas, and CSV export buttons.

## Verification

- Backend smoke: `npm run smoke:admin-reports`
- Frontend E2E: `npm run test:e2e:admin-reports`

The smoke flow creates a breached assigned task, a delivery exception, and a pending payment; then verifies JSON reports, CSV export, CSV escaping, and non-admin `403`.
