# Manual Yandex Operational Polish

## Scope

This phase hardens the seller-operated manual Yandex workflow without calling the real Yandex API.

It focuses on three operational gaps:

- seller handoff quality when copying delivery data into Yandex manually
- customer address completeness for manual Yandex delivery
- admin supervision when sellers have not created Yandex delivery in time

## Seller handoff block

Seller order detail now exposes a dedicated `Yandex Delivery Handoff` block with:

- customer name and phone
- order code
- payment method and payment status
- structured dropoff address
- entrance / intercom / floor / apartment decisions
- courier comment
- latitude / longitude
- geo readiness badge
- package preset, dimensions, weight, item count, and declared value

Copy actions now support:

- recipient block
- address block
- courier details
- full Yandex handoff block

The seller can also save:

- `manualYandexOrderId`
- `trackingUrl`
- `deliveryPrice`
- `courierName`
- `courierPhone`
- `estimatedDeliveryAt`

## Customer structured address policy

Current manual Yandex checkout now expects a clearer address decision model.

Base fields required for Yandex manual readiness:

- `city`
- `street`
- `building`
- recipient `fullName`
- recipient `phone`

Operational detail decisions required:

- `entrance` or `noEntrance=true`
- `floor` or `noFloor=true`
- `apartment` or `noApartment=true`

This does not require the customer to invent fake data. The customer can explicitly confirm that a field is not applicable or unknown.

## Customer tracking visibility

Once the seller saves `manualYandexOrderId`, customer tracking shows:

- `Mã vận đơn Yandex`
- `Theo dõi Yandex` button when `trackingUrl` exists

If the seller has not entered the ID yet, tracking shows that the shop is still creating the Yandex delivery.

No internal Yandex raw payload is exposed to the customer.

## Admin overdue and reminder behavior

Admin deliveries now support manual Yandex operational filters:

- `READY_TO_CREATE_YANDEX`
- `OVERDUE`
- `MISSING_YANDEX_ORDER_ID`
- `CREATED_WITH_YANDEX_ID`

Admin can also trigger:

- `POST /api/admin/deliveries/:orderId/remind-yandex`

Current MVP reminder behavior is internal only:

- creates an `AdminAuditLog` reminder event
- is visible in seller order detail
- does not send real SMS or email
- is rate-limited to once every 30 minutes per order

## Limitations

- no real Yandex API call
- no real SMS or email provider
- no automatic seller acknowledgement flow yet
- reminder is an internal operational event, not an external notification
