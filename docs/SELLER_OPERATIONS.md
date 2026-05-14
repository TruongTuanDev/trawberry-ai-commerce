# Seller Operations

## Manual Delivery

The current carrier operating model is seller-managed delivery with admin supervision.

Seller steps:
1. Confirm the order payment is marked `PAID`.
2. Create the real shipment in Yandex, CDEK, or another carrier dashboard.
3. Open the order in seller center.
4. Save provider, tracking number, tracking URL, courier phone, ETA, and delivery note.
5. Move delivery through `CREATED_MANUALLY`, `IN_TRANSIT`, and `DELIVERED`.

Rules:
- sellers cannot create delivery for unpaid orders
- sellers cannot access orders outside their own shop
- sellers cannot cancel a delivered shipment
- tracking URLs must be valid URLs when present

Admin monitors exceptions from `/admin/deliveries`, especially paid orders without delivery.
