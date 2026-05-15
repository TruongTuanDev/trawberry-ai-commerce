# Admin Operations Dashboard

Phase: marketplace operations dashboard for the multi-seller admin role.

## Scope

The dashboard gives admins a daily health view across orders, payments, seller-managed delivery, inventory, sellers, and recent activity. It does not call real Yandex/CDEK APIs and does not change the seller-managed manual delivery operating model.

## API

`GET /api/admin/dashboard/summary`

Security:

- `JwtAuthGuard`
- `AdminOnlyGuard`
- non-admin users receive `403`

Filters:

- `dateFrom`
- `dateTo`
- `shopId`
- `sellerId`

Default range is `ALL_TIME` when no date filter is supplied. Recent lists are capped at 5 records.

## Metrics

The response groups counts into:

- `orders`: total, pending, paid, paid without delivery, in transit, delivered, cancelled/failed delivery.
- `payments`: pending, paid, rejected/failed.
- `deliveries`: not created, created, in transit, delivered, delivered today, delivered this week, failed, cancelled, exceptions.
- `inventory`: low stock and out of stock variants.
- `sellers`: pending, approved, rejected, sellers with paid orders but no delivery.
- `recent`: latest orders, payment reviews, delivery exceptions, and admin audit logs.

## Frontend

Admin UI route:

- `/admin/dashboard`

Admin navigation now includes:

- Dashboard
- Sellers
- Deliveries
- Operational queues
- Queue task ownership actions from Operational queues

Dashboard cards now link to operational queues:

- pending sellers: `/admin/queues?tab=sellers&status=PENDING`
- pending payments: `/admin/queues?tab=payments&status=PENDING`
- delivery exceptions: `/admin/queues?tab=deliveries&status=EXCEPTION`
- paid without delivery: `/admin/queues?tab=deliveries&status=PAID_WITHOUT_DELIVERY`
- low stock: `/admin/queues?tab=inventory&status=LOW_STOCK`

## Operational Notes

The dashboard is a supervisory view. `/admin/queues` provides the daily worklists and action links into seller approval, payment detail, delivery supervision, and product detail pages.

Queue task ownership is handled from `/admin/queues`, where admins can claim work, mark it in progress, escalate it, and resolve it.

See `docs/ADMIN_OPERATIONAL_QUEUES.md` for queue API details and SLA thresholds. See `docs/ADMIN_TASK_OWNERSHIP.md` for ownership and escalation.
