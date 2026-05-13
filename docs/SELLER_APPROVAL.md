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
- seller approval now requires at least one `APPROVED` KYC document

## Data Model

Seller approval lives on `seller_profiles`:

- `approval_status`: `PENDING`, `APPROVED`, or `REJECTED`
- `approved_at`
- `rejected_at`
- `rejection_reason`
- existing compatibility fields: `reviewed_at`, `review_note`

KYC review adds:
- `seller_documents`
- `admin_audit_logs`

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
| `GET` | `/api/admin/sellers/:userId/onboarding` | View seller onboarding profile |
| `GET` | `/api/admin/sellers/:userId/documents` | View seller KYC documents |
| `POST` | `/api/admin/sellers/:userId/documents/:documentId/approve` | Approve one KYC document |
| `POST` | `/api/admin/sellers/:userId/documents/:documentId/reject` | Reject one KYC document |
| `GET` | `/api/admin/audit-logs?targetUserId=...` | View admin audit trail |

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
- `/admin/sellers/[id]`
- tabs for `PENDING`, `APPROVED`, and `REJECTED`
- approve button
- reject modal with optional reason
- seller onboarding detail, document review, and audit timeline

Seller UX:
- pending sellers see: `Your seller account is awaiting approval.`
- rejected sellers see rejection status and reason when available
- `/seller/onboarding` lets sellers submit legal profile and KYC documents
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
- `npm run smoke:seller-onboarding`

Frontend:
- `npm run test:e2e:admin-seller-approval`
- `npm run test:e2e:seller-onboarding`

The seller approval smoke covers:
- seller register -> `PENDING`
- pending seller cannot create shop
- seller submits onboarding profile and KYC document
- admin approves a KYC document
- admin lists pending sellers
- admin approves seller
- approved seller can create shop
- admin rejects another seller
- rejected seller cannot create shop
- non-admin cannot approve/reject
