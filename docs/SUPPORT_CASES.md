# Support Cases

## Scope

Parent checkout receipts now support customer service workflow without changing existing payment and delivery endpoints.

Customers can open a case for:

- the full marketplace checkout receipt
- one child shop order inside that receipt

Issue types:

- `PAYMENT_PROOF`
- `DELIVERY_DELAY`
- `WRONG_ITEM`
- `DAMAGED_ITEM`
- `REFUND_REQUEST`
- `CANCEL_REQUEST`
- `OTHER`

Statuses:

- `OPEN`
- `IN_REVIEW`
- `WAITING_CUSTOMER`
- `WAITING_SELLER`
- `RESOLVED`
- `REJECTED`
- `CLOSED`

Customer APIs:

- `POST /api/customer/checkouts/:checkoutCode/support-cases`
- `GET /api/customer/support-cases`
- `GET /api/customer/support-cases/:caseId`
- `POST /api/customer/support-cases/:caseId/messages`

Admin APIs:

- `GET /api/admin/support-cases`
- `GET /api/admin/support-cases/:caseId`
- `PATCH /api/admin/support-cases/:caseId`
- `POST /api/admin/support-cases/:caseId/messages`

Seller APIs:

- `GET /api/shops/:shopId/support-cases`
- `GET /api/shops/:shopId/support-cases/:caseId`
- `POST /api/shops/:shopId/support-cases/:caseId/messages`

Visibility rules:

- customer can create cases only for their own `checkoutCode`
- checkout-level cases are visible to customer and admin
- seller sees only order-linked cases that match the seller's own shop
- internal admin messages are hidden from customer and seller

Verification:

- `backend-nest/test/support-cases.e2e-spec.ts`
- `npm run smoke:support-cases`
- `npm run test:e2e:support-cases`
