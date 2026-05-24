# API – Internal Notification Center

## Overview

Each role has its own isolated notification endpoint group, protected by the corresponding session guard.

| Role     | Base path                   | Guard                    |
|----------|-----------------------------|--------------------------|
| Customer | `/api/customer/notifications` | `CustomerJwtAuthGuard` |
| Seller   | `/api/seller/notifications`   | `SellerJwtAuthGuard`   |
| Admin    | `/api/admin/notifications`    | `AdminJwtAuthGuard`    |

---

## Endpoints

### `GET /{role}/notifications`

Returns a paginated list of notifications for the authenticated user.

**Query params**

| Param    | Type    | Default | Description                                   |
|----------|---------|---------|-----------------------------------------------|
| `page`   | number  | `1`     | 1-indexed page number                         |
| `limit`  | number  | `20`    | Items per page (max 100)                      |
| `unread` | boolean | –       | If `true`, returns only unread notifications  |

**Response `200`**

```json
{
  "data": [
    {
      "id": "uuid",
      "type": "ORDER_NEW",
      "title": "New order received",
      "body": "You have a new order ORD-...",
      "actionUrl": "/seller/orders/uuid",
      "isRead": false,
      "isArchived": false,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20,
  "unreadCount": 5
}
```

---

### `GET /{role}/notifications/unread-count`

Returns only the unread count. Used by `NotificationBell` for lightweight polling.

**Response `200`**

```json
{ "unreadCount": 5 }
```

---

### `PATCH /{role}/notifications/:id/read`

Marks a single notification as read.

**Response `200`**

```json
{ "success": true }
```

---

### `PATCH /{role}/notifications/read-all`

Marks all of the authenticated user's notifications as read.

**Response `200`**

```json
{ "success": true, "updated": 12 }
```

---

### `PATCH /{role}/notifications/:id/archive`

Archives a single notification (hides it from default list views).

**Response `200`**

```json
{ "success": true }
```

---

## Notification types

| Type                            | Recipient | Trigger                                                         |
|---------------------------------|-----------|-----------------------------------------------------------------|
| `ORDER_NEW`                     | Seller    | Customer completes checkout                                     |
| `PAYMENT_CONFIRMATION_REQUIRED` | Seller    | Customer uploads QR payment proof                               |
| `DELIVERY_STATUS_CHANGED`       | Customer  | Seller / admin confirms payment                                 |
| `YANDEX_CREATION_REMINDER`      | Seller    | Admin sends Yandex delivery reminder                            |
| `RETURN_CASE_OPENED`            | Seller    | Customer opens a return/refund/dispute case                     |
| `RETURN_SELLER_RESPONSE_REQUIRED` | Seller  | Customer sends message or uploads evidence on an existing case  |
| `RETURN_ADMIN_REVIEW_REQUIRED`  | Admin(s)  | Case is escalated (seller rejects after customer disputes)      |
| `SELLER_FEE_INVOICE_ISSUED`     | Seller    | Platform issues a commission fee invoice                        |
| `ORDER_FULFILLMENT_OVERDUE`     | Seller    | `checkAndNotifyOverdueOrders()` detects a late assembly/transit |

---

## Deduplication

`NotificationsService.create()` accepts an optional `dedupeKey`. If a non-archived notification with the same `recipientUserId` + `dedupeKey` already exists, the call is a no-op (returns the existing record). This prevents bell-spam for recurring events like polling-based overdue checks.

---

## Guest / unauthenticated behaviour

- The `NotificationBell` component checks the auth store before fetching. If `user` is `null`, no API call is made.
- If the API returns `401` (e.g. expired session), the bell is hidden silently — no "session expired" toast is shown.
