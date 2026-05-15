# Admin Task Ownership

Admin task ownership adds claim, assignment, status tracking, and escalation on top of operational queues.

## Scope

This phase covers admin-only ownership for queue items:

- pending seller approvals
- pending payment reviews
- paid orders without delivery
- delivery exceptions
- low-stock and out-of-stock inventory

No email or external notification is sent in this phase.

## Data Model

`admin_queue_tasks`

- `entityType`: `SELLER`, `PAYMENT`, `DELIVERY`, `INVENTORY`, or `ORDER`
- `entityId`: id of the underlying queue entity
- `assignedToUserId`: nullable admin owner
- `status`: `OPEN`, `IN_PROGRESS`, `WAITING_SELLER`, `WAITING_CUSTOMER`, `RESOLVED`, or `ESCALATED`
- `priority`: `LOW`, `NORMAL`, `HIGH`, or `URGENT`
- `slaStatus`: `OK`, `WARNING`, or `BREACHED`
- `title`, `summary`, `lastNote`
- `assignedAt`, `resolvedAt`, `escalatedAt`

`entityType + entityId` is unique so one active task record represents one operational item.

`admin_queue_task_events`

- records create, assign, unassign, status, and escalation changes
- stores actor, previous/new status, previous/new assignee, note, and timestamp

## API

All endpoints use `JwtAuthGuard` and `AdminOnlyGuard`.

- `GET /api/admin/queue-tasks`
- `POST /api/admin/queue-tasks`
- `POST /api/admin/queue-tasks/:taskId/assign`
- `POST /api/admin/queue-tasks/:taskId/unassign`
- `POST /api/admin/queue-tasks/:taskId/status`
- `POST /api/admin/queue-tasks/:taskId/escalate`
- `GET /api/admin/queue-tasks/:taskId/events`

Assignment accepts `assignedToUserId`. If omitted or set to `me`, the task is assigned to the current admin. The backend validates that the target user has role `ADMIN`; sellers and customers cannot be assigned.

## Queue Integration

Existing queue endpoints now include ownership fields when a task exists:

- `taskId`
- `taskStatus`
- `taskPriority`
- `assignedToUserId`
- `assignedToEmail`
- `assignedToName`
- `assignedAt`
- `escalatedAt`
- `resolvedAt`

Resolved tasks are hidden from default queue results. They remain available through `GET /api/admin/queue-tasks?status=RESOLVED`.

## Frontend

`/admin/queues` now shows:

- assignee column
- task status badge
- priority badge
- Claim, In progress, Escalate, Resolve actions

Queue items create a task lazily when an admin first claims or updates ownership. Assignment does not change the underlying seller, payment, delivery, order, or inventory status.

## Audit

Every ownership mutation writes:

- a task event in `admin_queue_task_events`
- an admin audit log row when the audit service is available

Queue reads remain read-only and do not create audit rows.

## Verification

- Backend smoke: `npm run smoke:admin-task-ownership`
- Frontend E2E: `npm run test:e2e:admin-task-ownership`

The smoke flow creates or finds an operational item, creates a task, assigns it to the current admin, moves it to `IN_PROGRESS`, escalates it, resolves it, verifies events, and confirms non-admin access is forbidden.
