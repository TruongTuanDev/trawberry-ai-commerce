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

Dashboard cards link to existing operational pages:

- pending sellers: `/admin/sellers?status=PENDING`
- delivery exceptions: `/admin/deliveries?exceptionOnly=true`
- paid without delivery: `/admin/deliveries?paidWithoutDelivery=true`

## Operational Notes

The dashboard is a supervisory view, not a workflow editor. Admins still resolve seller approvals in `/admin/sellers` and delivery issues in `/admin/deliveries`.
