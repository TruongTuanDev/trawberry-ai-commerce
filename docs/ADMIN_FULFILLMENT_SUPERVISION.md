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

Admin actions are derived from the fulfillment bucket:

- `NEW`
  - remind seller
  - move to assembling
- `ASSEMBLING`
  - remind seller
  - mark in delivery when a shipment exists
  - mark cancelled when a shipment exists
- `IN_TRANSIT`
  - mark completed
  - mark cancelled
- `COMPLETED`
  - archive
- `CANCELLED`
  - archive

Reminder is still internal only in this MVP. It creates an audit/reminder event and does not call SMS, email, or a real carrier API.

## API Contract

Primary admin listing endpoint:

- `GET /api/admin/orders/fulfillment`

Admin override endpoints used by the page:

- `POST /api/admin/orders/:orderId/move-to-assembling`
- `POST /api/admin/orders/:orderId/archive`
- `POST /api/admin/deliveries/:deliveryShipmentId/mark-in-transit`
- `POST /api/admin/deliveries/:deliveryShipmentId/mark-delivered`
- `POST /api/admin/deliveries/:deliveryShipmentId/cancel`
- `POST /api/admin/deliveries/:orderId/remind-yandex`

## Overdue Logic

- `NEW` and `ASSEMBLING` use `MANUAL_YANDEX_OVERDUE_MINUTES`
- `IN_TRANSIT` uses `ADMIN_IN_TRANSIT_OVERDUE_MINUTES`
- if `estimatedDeliveryAt` exists for an in-transit shipment, overdue is based on ETA first

## Guardrails

- no real Yandex API calls are introduced
- seller fulfillment flow remains the source of operational truth
- admin override does not create a separate lifecycle outside the shared order + delivery state
