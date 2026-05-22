# Returns API

## Overview

These endpoints implement manual return, refund, and dispute handling for direct-to-seller payments.

The platform does not transfer money on behalf of the seller in this phase.

## Customer endpoints

- `GET /api/customer/returns`
- `GET /api/customer/returns/:caseId`
- `POST /api/customer/orders/:orderId/returns`
- `POST /api/customer/returns/:caseId/messages`
- `POST /api/customer/returns/:caseId/evidence`
- `POST /api/customer/returns/:caseId/confirm-refund-received`
- `POST /api/customer/returns/:caseId/cancel`

Rules:

- customer can only open a case for their own order
- active duplicate case for the same order is rejected
- requested amount cannot exceed paid product amount

## Seller endpoints

- `GET /api/shops/:shopId/returns`
- `GET /api/shops/:shopId/returns/:caseId`
- `POST /api/shops/:shopId/returns/:caseId/respond`
- `POST /api/shops/:shopId/returns/:caseId/mark-return-received`
- `POST /api/shops/:shopId/returns/:caseId/refund-sent`
- `POST /api/shops/:shopId/returns/:caseId/messages`

Rules:

- seller only sees cases for owned shops
- refund-sent creates a manual transfer record, not a bank transaction

## Admin endpoints

- `GET /api/admin/returns`
- `GET /api/admin/returns/:caseId`
- `POST /api/admin/returns/:caseId/decision`
- `POST /api/admin/returns/:caseId/messages`
- `POST /api/admin/returns/:caseId/internal-note`

Decision actions:

- `APPROVE`
- `REJECT`
- `REQUEST_MORE_EVIDENCE`
- `CLOSE`
- `OVERRIDE_REFUND_CONFIRMED`

## Response highlights

Case responses project:

- linked order, shop, customer, and seller summary
- messages
- evidence
- manual refund transfers
- platform fee adjustment amount
- latest finance adjustment linkage when present

## Finance integration

- refund confirmation can trigger `RETURN_REFUND_CONFIRMED` negative fee adjustment
- the original positive commission entry is kept for audit history
- no duplicate adjustment is created for the same case
