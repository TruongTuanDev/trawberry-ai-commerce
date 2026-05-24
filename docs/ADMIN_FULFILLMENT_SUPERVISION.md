# Admin Fulfillment Supervision

## Scope

Admin supervision now uses the same seller-friendly fulfillment buckets as the seller board:

- `Mới`
- `Lắp ráp`
- `Trong quá trình giao hàng`
- `Hoàn thành`
- `Đã hủy`
- `Lưu trữ`

Route:

- `/admin/deliveries`

The route name stays the same to avoid breaking bookmarks and dashboard links, but the page now renders fulfillment supervision instead of the older raw delivery queue model.

## Admin View Model

Each row shows:

- order code
- seller
- shop
- buyer
- payment status
- fulfillment label
- Yandex manual order id
- tracking URL when present
- age in current bucket
- overdue badge

## Actions

Admin delivery supervision is now read-only for fulfillment state ownership.

Admin can:

- view the queue
- filter and search
- inspect overdue orders
- inspect payment status
- inspect Yandex id and tracking URL
- remind the seller to continue operations

Admin must not change seller fulfillment status from `/admin/deliveries`.

`nextAdminActions` from `GET /api/admin/orders/fulfillment` is restricted to supervision-safe values:

- `VIEW`
- `REMIND_SELLER`

Seller remains the only role that performs the operational transitions below:

- `NEW -> ASSEMBLING`
- `ASSEMBLING -> IN_TRANSIT`
- `IN_TRANSIT -> COMPLETED`
- `IN_TRANSIT -> CANCELLED`
- `COMPLETED|CANCELLED -> ARCHIVED`

Reminder is still internal only in this MVP. It creates an audit/reminder event and does not call SMS, email, or a real carrier API.

## API Contract

Primary admin listing endpoint:

- `GET /api/admin/orders/fulfillment`

Admin page endpoint used by the page:

- `POST /api/admin/deliveries/:orderId/remind-yandex`

Emergency or compatibility override endpoints may still exist in the backend, but they are intentionally not exposed in the admin UI.

## Overdue Logic

- `NEW` and `ASSEMBLING` use `MANUAL_YANDEX_OVERDUE_MINUTES`
- `IN_TRANSIT` uses `ADMIN_IN_TRANSIT_OVERDUE_MINUTES`
- if `estimatedDeliveryAt` exists for an in-transit shipment, overdue is based on ETA first

## Guardrails

- no real Yandex API calls are introduced
- seller fulfillment flow remains the source of operational truth
- admin supervision does not create a separate lifecycle outside the shared order + delivery state
