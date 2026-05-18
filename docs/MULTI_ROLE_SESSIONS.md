# Multi-Role Sessions

## Summary

The same browser can now hold `ADMIN`, `SELLER`, and `CUSTOMER` sessions at the same time without role overwrite.

## Role cookies

- `admin_access_token`
- `seller_access_token`
- `customer_access_token`
- Legacy compatibility cookie remains `access_token` for the shared `/api/auth/login` flow only.

## Backend routing rules

- `GET /api/auth/admin/me` reads only `admin_access_token`
- `GET /api/auth/seller/me` reads only `seller_access_token`
- `GET /api/auth/customer/me` reads only `customer_access_token`
- `POST /api/auth/admin/logout` clears only admin cookies
- `POST /api/auth/seller/logout` clears only seller cookies
- `POST /api/auth/customer/logout` clears only customer cookies
- `POST /api/auth/logout-all` clears all role cookies

Bearer fallback remains enabled for automation and smoke scripts.

## Frontend rules

- Admin shell hydrates only `adminUser`
- Seller shell hydrates only `sellerUser`
- Customer account/public header hydrate only `customerUser`
- Public marketplace header never surfaces admin or seller session state as customer auth

## Verification

- Backend: `backend-nest/test/auth.e2e-spec.ts`
- Frontend: `frontend-next/tests/e2e/multi-role-sessions.spec.ts`
