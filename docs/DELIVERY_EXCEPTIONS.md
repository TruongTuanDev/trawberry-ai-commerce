# Delivery Exceptions

Phase: seller-managed manual delivery exception workflow with admin supervision.

## Scope

Sellers still create real shipments outside the platform in Yandex/CDEK dashboards and then update tracking inside the marketplace. This phase adds exception handling on top of that manual operating model. No real Yandex/CDEK API or webhook calls are made.

## Statuses

Supported delivery shipment statuses:

- `CREATED_MANUALLY`
- `IN_TRANSIT`
- `DELIVERED`
- `CANCELLED`
- `FAILED`

`FAILED` and `CANCELLED` are exception statuses. A delivered shipment cannot be marked failed or cancelled. Sellers cannot mark failed/cancelled shipments delivered directly; admin transitions are recorded as overrides.

## Reason Codes

Required reason codes for failed/cancelled delivery exception actions:

- `CUSTOMER_UNAVAILABLE`
- `WRONG_ADDRESS`
- `COURIER_CANCELLED`
- `SELLER_CANCELLED`
- `CUSTOMER_CANCELLED`
- `DAMAGED_PACKAGE`
- `LOST_PACKAGE`
- `DELIVERY_TIMEOUT`
- `OTHER`

## Comments And Visibility

Delivery comments are stored in `delivery_comments`.

- `INTERNAL`: visible to seller/admin operations only.
- `CUSTOMER_VISIBLE`: safe to show on public order tracking.

Customer tracking never returns internal comments. Customer-visible comments require a non-empty message.

## Admin Supervision

Admin delivery supervision supports:

- `GET /api/admin/deliveries?exceptionOnly=true`
- `GET /api/admin/deliveries?status=FAILED`
- `GET /api/admin/deliveries?status=CANCELLED`
- `POST /api/admin/deliveries/:deliveryShipmentId/mark-failed`
- `POST /api/admin/deliveries/:deliveryShipmentId/comments`
- `PATCH /api/admin/deliveries/:deliveryShipmentId/customer-message`

Every state/comment/customer-message operation writes a delivery event audit row.

## Customer Tracking

Public tracking includes safe exception fields:

- `delivery.status`
- `delivery.failureReasonCode`, except unsafe `OTHER` is hidden.
- `delivery.customerVisibleMessage`
- `delivery.deliveryComments`, filtered to `CUSTOMER_VISIBLE`
- `trackingUrl`, when still available.

For failed/cancelled deliveries, the customer page shows an issue/cancelled notice, customer message, and support instruction.

## Future Yandex/CDEK Migration

When real provider APIs are introduced, map provider status webhooks into the same internal statuses and reason codes. Provider payloads should continue to be stored in event `rawPayload`; internal comments remain local-only and must not be sent to carriers or exposed to customers.
