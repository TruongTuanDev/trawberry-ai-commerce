# Internal Notification Center

## Architecture

```
Backend (NestJS)                         Frontend (Next.js)
──────────────────────────────           ──────────────────────────────────────────
NotificationsModule                      useNotificationStore (Zustand)
  ├── CustomerNotificationsController       └── unreadCount[role]
  ├── SellerNotificationsController              ↑ polled every 30 s by NotificationBell
  └── AdminNotificationsController
         │
         │ injects
         ▼
  NotificationsService
    ├── create(dto)                        NotificationBell
    ├── list(userId, query)                  ├── reads unreadCount from store
    ├── markRead(id, userId)                 ├── fetches /unread-count on mount
    ├── markAllRead(userId)                  └── polls every 30 s (only when logged in)
    ├── archive(id, userId)
    └── checkAndNotifyOverdueOrders()      NotificationDropdown
                                             └── top 5 unread, links to full page
  PrismaService
    └── Notification model                 /[role]/notifications page
                                             └── full list with mark-read / archive
```

## Session isolation

Each controller is decorated with a **role-specific JWT guard**:

```ts
// CustomerNotificationsController
@UseGuards(CustomerJwtAuthGuard)
@Controller('api/customer/notifications')

// SellerNotificationsController
@UseGuards(SellerJwtAuthGuard)
@Controller('api/seller/notifications')

// AdminNotificationsController
@UseGuards(AdminJwtAuthGuard)
@Controller('api/admin/notifications')
```

The frontend uses role-prefixed helpers in `notifications-api.ts`:

```ts
export const notificationsApi = {
  customer: makeRoleApi('customer'),
  seller:   makeRoleApi('seller'),
  admin:    makeRoleApi('admin'),
};
```

A user with simultaneous Customer + Seller sessions will have entirely independent notification lists and unread counts.

---

## Database schema

```prisma
model Notification {
  id              String   @id @default(uuid())
  recipientUserId String
  type            String
  title           String
  body            String
  actionUrl       String?
  isRead          Boolean  @default(false)
  isArchived      Boolean  @default(false)
  dedupeKey       String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  recipient User @relation(fields: [recipientUserId], references: [id], onDelete: Cascade)

  @@index([recipientUserId, isRead, isArchived])
  @@index([recipientUserId, dedupeKey])
}
```

---

## Adding a new notification type

1. **Define the type string** (use `SCREAMING_SNAKE_CASE`) and add it to the table in `API_NOTIFICATIONS.md`.
2. **Inject `NotificationsService`** into the service that produces the event.
3. **Call `create()`** with a `dedupeKey` if the event can fire repeatedly for the same order/case:

```ts
await this.notifications.create({
  recipientUserId: order.sellerId,
  type: 'MY_NEW_TYPE',
  title: 'Something happened',
  body: `Order ${order.code} needs your attention.`,
  actionUrl: `/seller/orders/${order.id}`,
  dedupeKey: `my-new-type:${order.id}`,
});
```

4. **Add a nav link** (if needed) inside the appropriate shell component.
5. **Write an E2E test** verifying the bell increments after the triggering API call.

---

## Frontend global state

`useNotificationStore` (Zustand) at `frontend-next/src/stores/notification-store.ts`:

```ts
interface State {
  unreadCount: Record<Role, number>;
  fetchUnreadCount: (role: Role) => Promise<void>;
}
```

Any component that calls a mutation (mark-read, archive) **must** call `fetchUnreadCount(role)` afterwards to keep the bell badge in sync.

---

## Overdue order check

`NotificationsService.checkAndNotifyOverdueOrders()` is a **service method only** — it is not wired to any automatic scheduler in this phase. It can be called manually from an admin script or wired to a future `@nestjs/schedule` cron job.

Cutoffs (configurable in the service):
- Assembling → max **48 hours**
- In transit → max **120 hours**

Duplicate alerts are suppressed via `dedupeKey: overdue:<orderId>:<status>`.
