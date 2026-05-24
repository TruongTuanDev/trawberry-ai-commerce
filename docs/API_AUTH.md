# API Auth

## Scope
This document describes the migrated Auth module implemented in `backend-nest`, based on the current Spring Boot auth logic in `strawberry-backend`.

## Source Spring Boot Behavior

Auth logic reviewed from:
- `auth/controller/AuthController.java`
- `auth/service/AuthService.java`
- `common/security/JwtUtils.java`
- `common/security/UserDetailsServiceImpl.java`
- `common/security/UserDetailsImpl.java`
- `user/entity/User.java`
- `user/entity/Role.java`

### Current Spring Boot rules
- login via email + password
- password hashing via Spring `PasswordEncoder` using BCrypt
- roles in database:
  - `ADMIN`
  - `SELLER`
  - `CUSTOMER`
- seller registration creates `seller_profiles` row with `approval_status = PENDING`
- customer registration creates only `users` row
- no separate activation flow
- JWT subject is the user email
- Spring login response contains:
  - `accessToken`
  - `refreshToken` as dummy placeholder
  - `email`
  - `fullName`
  - `role`

## NestJS Migration

### Service location
- NestJS app: `backend-nest`
- Auth module: `src/modules/auth`

### Database mapping
NestJS Prisma maps to the existing `users` and `seller_profiles` tables without changing schema.

Relevant Prisma models:
- `User`
- `SellerProfile`

### Role handling
Canonical stored roles remain:
- `ADMIN`
- `SELLER`
- `CUSTOMER`

Compatibility note:
- request role `USER` is accepted by NestJS and normalized to `CUSTOMER`
- this keeps the old schema intact while allowing newer clients to send `USER`

## Endpoints

Base path:
- `/api/auth`

### Register flow policy
- public register endpoints create the account only
- frontend must not treat register as an authenticated session
- frontend must not call `/api/auth/*/me` immediately after register
- successful register redirects the user to the matching login screen
- login remains the only flow that is expected to establish role cookies for normal UI navigation

### POST `/api/auth/register`
Register a customer or seller.

Request body:
```json
{
  "email": "seller@example.com",
  "password": "password123",
  "fullName": "Seller One",
  "role": "SELLER"
}
```

Accepted roles:
- `SELLER`
- `CUSTOMER`
- `USER` -> normalized to `CUSTOMER`

Behavior:
- duplicate email -> `409 Conflict` with `EMAIL_ALREADY_EXISTS`
- duplicate phone -> `409 Conflict` with `PHONE_ALREADY_EXISTS`
- password is hashed with bcrypt
- seller registration creates `seller_profiles` row with `PENDING`
- customer registration does not create seller profile

Response:
```json
{
  "success": true,
  "message": "REGISTERED",
  "userId": "uuid",
  "accessToken": "jwt",
  "refreshToken": "jwt",
  "tokenType": "Bearer",
  "email": "seller@example.com",
  "fullName": "Seller One",
  "role": "SELLER",
  "status": "ACTIVE",
  "approvalStatus": "PENDING"
}
```

Notes:
- `accessToken` and `refreshToken` may still be present for backward compatibility, but the web frontend does not auto-login from register responses
- customer UI redirects to `/customer/login?registered=1`
- seller UI redirects to `/seller/login?registered=1`

### POST `/api/auth/login`
Authenticate user with email and password.

Request body:
```json
{
  "email": "customer@example.com",
  "password": "password123"
}
```

Behavior:
- user must exist
- bcrypt compare against `users.password_hash`
- blocked or invalid credentials -> `401 Unauthorized`

Response:
```json
{
  "userId": "uuid",
  "accessToken": "jwt",
  "refreshToken": "jwt",
  "tokenType": "Bearer",
  "email": "customer@example.com",
  "fullName": "Customer One",
  "role": "CUSTOMER",
  "status": "ACTIVE",
  "approvalStatus": null
}
```

### GET `/api/auth/me`
Return current authenticated user.

Header:
```http
Authorization: Bearer <access-token>
```

Response:
```json
{
  "id": "uuid",
  "email": "customer@example.com",
  "fullName": "Customer One",
  "phone": null,
  "role": "CUSTOMER",
  "status": "ACTIVE",
  "sellerProfileId": null,
  "currentShopId": null,
  "sellerApprovalStatus": null
}
```

### POST `/api/auth/refresh`
Exchange refresh token for a fresh token pair.

Request body:
```json
{
  "refreshToken": "jwt"
}
```

Response shape matches `register` and `login`.

## JWT Notes

### Access token
- signed with `JWT_ACCESS_SECRET`
- JWT subject is the user email to stay close to Spring Boot behavior
- payload also includes:
  - `userId`
  - `email`
  - `role`
  - `fullName`

### Refresh token
- signed with `JWT_REFRESH_SECRET`
- stateless for now
- no refresh-token persistence table yet

### Secret compatibility
NestJS auth attempts to support both:
- plain string secrets
- base64-encoded secrets like the Spring Boot implementation expects

## Tests

Auth regression coverage is implemented in:
- `backend-nest/test/auth.e2e-spec.ts`

Covered scenarios:
- register customer
- register seller with pending profile
- login returns JWT
- `/api/auth/me` returns authenticated user
- refresh returns new token pair

Run:
```bash
cd backend-nest
npm test -- --runInBand
```
