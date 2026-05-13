# Seller Onboarding + KYC Documents + Admin Audit Trail

Status: MVP implemented.

## Business Rule

Seller registration still creates a seller profile with `approvalStatus=PENDING`.

For this MVP, an admin can approve a seller only after at least one KYC document for that seller has status `APPROVED`. Pending and rejected sellers may update onboarding profile data and upload new documents. Pending and rejected sellers cannot create shops.

## Seller APIs

All seller onboarding endpoints require `JwtAuthGuard` and a seller account.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/seller/onboarding/profile` | Read current seller legal profile |
| `PUT` | `/api/seller/onboarding/profile` | Create/update legal, contact, and bank fields |
| `GET` | `/api/seller/onboarding/documents` | List current seller documents |
| `POST` | `/api/seller/onboarding/documents` | Upload one KYC document as multipart `file` |
| `DELETE` | `/api/seller/onboarding/documents/:documentId` | Delete own unreviewed pending document |

Document uploads allow PDF, JPG, PNG, and WEBP. The upload size is controlled by `MAX_KYC_DOCUMENT_SIZE_MB` and defaults to 10 MB.

## Admin APIs

All admin endpoints require `JwtAuthGuard` and `AdminOnlyGuard`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/sellers/:userId/onboarding` | View seller profile and approval status |
| `GET` | `/api/admin/sellers/:userId/documents` | List seller KYC documents |
| `POST` | `/api/admin/sellers/:userId/documents/:documentId/approve` | Mark one document approved |
| `POST` | `/api/admin/sellers/:userId/documents/:documentId/reject` | Mark one document rejected with optional reason |
| `GET` | `/api/admin/audit-logs?targetUserId=...` | View admin actions |

Existing seller approve/reject endpoints now write audit log entries:

- `SELLER_APPROVED`
- `SELLER_REJECTED`

Document review writes:

- `SELLER_DOCUMENT_APPROVED`
- `SELLER_DOCUMENT_REJECTED`

## Frontend

Seller page:

- `/seller/onboarding`
- legal type, legal name, INN, OGRN/OGRNIP, KPP, legal address
- contact name, phone, email
- optional bank fields
- document upload and document status list

Admin pages:

- `/admin/sellers`
- `/admin/sellers/[id]`

The admin detail page shows legal profile, documents, document review actions, seller approve/reject actions, and audit history.

## Verification

Primary commands:

- `backend-nest npm run smoke:seller-onboarding`
- `frontend-next npm run test:e2e:seller-onboarding`

The smoke flow registers a pending seller, saves onboarding profile, uploads a document, admin approves the document, admin approves the seller, verifies audit logs, and confirms the approved seller can create a shop.
