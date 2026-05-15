# Admin Operational Queues

Admin operational queues turn dashboard counts into worklists for daily marketplace operations.

## Queues

- `GET /api/admin/queues/sellers`: seller approval review queue.
- `GET /api/admin/queues/payments`: manual payment review queue.
- `GET /api/admin/queues/deliveries`: paid orders without delivery, delivery exceptions, in-transit, delivered.
- `GET /api/admin/queues/inventory`: low-stock and out-of-stock product variants.

All endpoints are admin-only and return:

- `items`: queue rows with seller/shop/order/product context.
- `pagination`: page, limit, total, totalPages.
- `total`: total matching rows.
- `filters`: echoed query filters.
- `summary`: cheap counts for the queue family.

## SLA Timers

MVP thresholds are fixed constants in `AdminQueuesService`:

- Pending seller approval: warning after 24h, breached after 72h.
- Pending payment review: warning after 4h, breached after 24h.
- Paid without delivery: warning after 12h, breached after 24h.
- Delivery exception: warning immediately, breached after 24h.
- Low stock: warning.
- Out of stock: breached.

Each item includes `ageMinutes`, `ageHours`, and `slaStatus` as `OK`, `WARNING`, or `BREACHED`.

## Frontend

`/admin/queues` provides tabs for Sellers, Payments, Deliveries, and Inventory. Dashboard needs-attention cards link directly into the relevant queue tab and filter.

## Ownership

Admin ownership is now implemented through `admin_queue_tasks`.

Queue rows include ownership fields when a task exists:

- `taskId`
- `taskStatus`
- `taskPriority`
- `assignedToUserId`
- `assignedToEmail`
- `assignedToName`
- `assignedAt`
- `escalatedAt`
- `resolvedAt`

Admins can claim, assign, unassign, update status, escalate, and resolve queue tasks through `/api/admin/queue-tasks`. Resolved tasks are hidden from default queue views and remain queryable from the task API.

See `docs/ADMIN_TASK_OWNERSHIP.md`.

## Reporting

Queue SLA and ownership data feeds Admin Ops Reporting:

- SLA breached task report
- workload by assigned admin
- payment aging report
- delivery exception report

See `docs/ADMIN_REPORTING.md`.
