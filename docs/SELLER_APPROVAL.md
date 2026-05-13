# Seller Approval Workflow

Date: 2026-05-13

## Summary

Seller approval is now an explicit admin workflow in the new `backend-nest` and `frontend-next` stack.

Rules:
- seller registration creates a seller profile with `approvalStatus=PENDING`
- `PENDING` and `REJECTED` sellers cannot create shops
- `APPROVED` sellers can create shops and sell
- only `ADMIN` users can list, approve, or reject sellers
- non-admin users receive `403` on admin seller endpoints

## Data Model

Seller approval lives on `seller_profiles`:

- `approval_status`: `PENDING`, `APPROVED`, or `REJECTED`
- `approved_at`
- `rejected_at`
- `rejection_reason`
- existing compatibility fields: `reviewed_at`, `review_note`

## Admin API

All admin endpoints require:
- valid JWT cookie or bearer token
- `role=ADMIN`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/sellers?status=PENDING` | List sellers by approval status |
| `GET` | `/api/admin/sellers/:userId` | Get one seller review record |
| `POST` | `/api/admin/sellers/:userId/approve` | Approve seller |
| `POST` | `/api/admin/sellers/:userId/reject` | Reject seller |

Reject body:

```json
{
  "reason": "Business documents are incomplete."
}
```

`reason` is optional and limited to 500 characters.

Response shape:

```json
{
  "userId": "uuid",
  "email": "seller@example.com",
  "name": "Seller Name",
  "role": "SELLER",
  "sellerApprovalStatus": "APPROVED",
  "sellerApprovedAt": "2026-05-13T00:00:00.000Z",
  "sellerRejectedAt": null,
  "sellerRejectionReason": null
}
```

## Frontend

Admin UI:
- `/admin/sellers`
- tabs for `PENDING`, `APPROVED`, and `REJECTED`
- approve button
- reject modal with optional reason

Seller UX:
- pending sellers see: `Your seller account is awaiting approval.`
- rejected sellers see rejection status and reason when available
- shop creation remains blocked server-side unless seller is approved

## Demo Seed

`npm run seed:demo` creates:
- `demo-admin@trawberry.local` / `DemoAdmin123!`
- `demo-seller@trawberry.local` / `DemoSeller123!`

The demo seller is approved; the demo admin can review new sellers in `/admin/sellers`.

## Verification

Backend:
- `npm test -- --runInBand`
- `npm run smoke:seller-approval`

Frontend:
- `npm run test:e2e:admin-seller-approval`

The seller approval smoke covers:
- seller register -> `PENDING`
- pending seller cannot create shop
- admin lists pending sellers
- admin approves seller
- approved seller can create shop
- admin rejects another seller
- rejected seller cannot create shop
- non-admin cannot approve/reject
