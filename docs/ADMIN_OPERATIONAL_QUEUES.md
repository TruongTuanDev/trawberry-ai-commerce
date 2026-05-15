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

Admin assignment ownership is not included in this phase. The recommended next step is an `admin_queue_assignments` table with entity type, entity id, assigned admin, status, and timestamps.
