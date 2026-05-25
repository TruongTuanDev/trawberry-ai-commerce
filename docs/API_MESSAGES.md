# Buyer-Seller Messaging API

## Purpose

Buyer-seller messaging is a controlled marketplace MVP for shop conversations between one customer and one shop.

This phase:

- allows a logged-in customer to start or continue a conversation with an active approved shop
- allows the seller who owns that shop to reply
- allows customer reporting and basic admin moderation
- creates notifications for new messages and reported threads

This phase does not include:

- realtime WebSocket delivery
- file attachments
- external contact enforcement beyond basic safe plain-text display

## Data model

### `ShopMessageThread`

- belongs to one `shopId`
- belongs to one seller user via `sellerId`
- belongs to one customer user via `customerId`
- optional context:
  - `productId`
  - `orderId`
- status:
  - `OPEN`
  - `CLOSED`
  - `REPORTED`
- tracks:
  - `lastMessageAt`
  - `lastCustomerReadAt`
  - `lastSellerReadAt`
  - `reportedAt`
  - `reportedReason`

### `ShopMessage`

- belongs to one thread
- sender role:
  - `CUSTOMER`
  - `SELLER`
  - `ADMIN`
- stores plain-text `message`
- optional `attachments` field exists in schema but MVP does not expose file upload UI

## Customer endpoints

### `POST /api/customer/messages/threads`

Creates a thread or reuses an existing open/reported thread for the same customer + shop + optional product/order context, then posts the first message.

#### Body

```json
{
  "shopId": "shop_123",
  "shopSlug": "demo-shop",
  "productId": "prod_123",
  "orderId": "order_123",
  "message": "Hello, is this item still available in another color?"
}
```

At least one of `shopId` or `shopSlug` must be provided.

### `GET /api/customer/messages/threads`

Lists the authenticated customer's threads with unread state and last message preview.

### `GET /api/customer/messages/threads/:threadId`

Returns one thread detail for the authenticated customer.

### `POST /api/customer/messages/threads/:threadId/messages`

Adds a new customer message to an existing thread.

### `PATCH /api/customer/messages/threads/:threadId/read`

Marks the thread as read for the current customer.

### `PATCH /api/customer/messages/threads/:threadId/report`

Marks the thread as `REPORTED` and stores an optional report reason.

## Seller endpoints

### `GET /api/shops/:shopId/messages/threads`

Lists threads for a seller-owned shop.

### `GET /api/shops/:shopId/messages/threads/:threadId`

Returns thread detail for that seller-owned shop.

### `POST /api/shops/:shopId/messages/threads/:threadId/messages`

Adds a seller reply.

### `PATCH /api/shops/:shopId/messages/threads/:threadId/read`

Marks the thread as read for the seller side.

### `PATCH /api/shops/:shopId/messages/threads/:threadId/close`

Closes the thread. Closed threads reject new messages.

## Admin endpoints

### `GET /api/admin/messages/threads`

Lists message threads. Supports filtering by status, including `REPORTED`.

### `GET /api/admin/messages/threads/:threadId`

Returns one thread detail for admin review.

### `PATCH /api/admin/messages/threads/:threadId/close`

Closes a thread.

### `PATCH /api/admin/messages/threads/:threadId/reopen`

Reopens a thread.

## Access rules

- guest users cannot create or read customer threads
- customer can access only their own threads
- seller can access only threads for shops they own
- admin can access admin endpoints only
- customer cannot message inactive or unapproved shops

## Validation and stable error codes

- `MESSAGE_THREAD_NOT_FOUND`
- `MESSAGE_SHOP_NOT_AVAILABLE`
- `MESSAGE_FORBIDDEN`
- `MESSAGE_EMPTY`
- `MESSAGE_TOO_LONG`
- `MESSAGE_THREAD_CLOSED`

Current validation rules:

- message body is trimmed
- empty messages are rejected
- message length max is `2000`
- UI renders plain text only

## Notification integration

When a customer sends a message:

- seller gets notification type `MESSAGE_RECEIVED`
- notification action URL: `/seller/messages/{threadId}`

When a seller replies:

- customer gets notification type `MESSAGE_RECEIVED`
- notification action URL: `/customer/messages/{threadId}`

When a customer reports a thread:

- admin gets notification type `MESSAGE_REPORTED`
- notification action URL: `/admin/messages/{threadId}`

## Non-goals

- no realtime push or websocket subscription
- no attachment upload UI
- no automatic phone/email redaction workflow
- no external chat provider integration
