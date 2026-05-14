# Seller-Managed Manual Delivery Workflow

Current delivery operations use a seller-managed model with admin supervision.

## Operating Model

- Sellers create the real Yandex, CDEK, or other carrier shipment outside the marketplace in the carrier dashboard.
- Sellers paste delivery provider, tracking number, tracking URL, courier phone, ETA, and notes into the seller order detail page.
- The marketplace stores delivery status and tracking data, but does not call real Yandex or CDEK APIs in this phase.
- Admins monitor every shop from `/admin/deliveries` and can intervene when support requires it.

## Seller Flow

1. Seller receives a paid order.
2. Seller creates the shipment manually in Yandex/CDEK.
3. Seller opens `/seller/orders/:id`.
4. Seller fills Manual Delivery:
   - provider: `YANDEX`, `CDEK`, or `MANUAL`
   - tracking number
   - tracking URL
   - courier phone
   - estimated delivery time
   - delivery note
5. Seller saves delivery. Status becomes `CREATED_MANUALLY`.
6. Seller can mark `IN_TRANSIT`, mark `DELIVERED`, or cancel before delivery.

Seller validation:
- order must be `paymentStatus=PAID`
- order must belong to the current shop
- delivered shipments cannot be cancelled by the seller
- tracking URL must be a valid URL when provided

## Admin Supervision

Admins use `/admin/deliveries` to filter:

- paid orders without delivery
- `CREATED_MANUALLY`
- `IN_TRANSIT`
- `DELIVERED`
- `CANCELLED`
- `FAILED`
- provider/shop/seller/date/search filters through API

Admin can override delivery status when support needs it. Every admin action writes a delivery event with actor, role, old status, new status, and note.

## Customer Tracking

Public order tracking now shows:

- provider
- internal status and customer-facing message
- provider status
- tracking number and tracking link
- courier phone
- estimated delivery
- seller/admin delivery note

## Migration Path

When Yandex/CDEK credentials and legal setup are ready, keep the manual fields as fallback and progressively switch seller actions to provider-backed API creation/refresh. Admin supervision remains the control plane for exceptions.
# Delivery Exceptions Addendum

Seller-managed manual delivery now supports exception reporting. Sellers can mark a manual delivery `FAILED` with a required reason code, optional internal reason text, and optional customer-visible message. Internal notes and comments remain visible only to seller/admin users.

Admin supervision can filter `FAILED`/`CANCELLED` deliveries, add internal comments, and update the customer-visible message shown on public tracking. Real Yandex/CDEK API integration remains a future phase; provider webhooks should map into the same internal status and reason-code model.
