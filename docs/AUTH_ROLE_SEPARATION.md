# Auth Role Separation

Phase: public auth UX separation for customer, seller, and admin.

## Goals

- Public marketplace exposes customer and seller auth clearly.
- Admin login stays operational-only and is not linked from public marketplace navigation.
- Customer and seller registration are public.
- Admin cannot register publicly.
- Cookie-based auth remains the primary runtime auth flow.

## Public routes

- Customer:
  - `/customer/login`
  - `/customer/register`
- Seller:
  - `/seller/login`
  - `/seller/register`
- Admin:
  - `/admin-login`
  - hidden from public header, footer, home, products, cart, and checkout

Compatibility routes still exist:

- `/login`: staff compatibility login for seller/admin
- `/seller-login`: compatibility alias for seller login

## Backend auth endpoints

- Customer:
  - `POST /api/auth/customer/register`
  - `POST /api/auth/customer/login`
  - `GET /api/auth/customer/me`
  - `POST /api/auth/customer/logout`
- Seller:
  - `POST /api/auth/seller/register`
  - `POST /api/auth/seller/login`
  - `GET /api/auth/seller/me`
  - `POST /api/auth/seller/logout`
- Admin:
  - `POST /api/auth/admin/login`
  - `GET /api/auth/admin/me`
  - `POST /api/auth/admin/logout`
- Shared compatibility:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
  - `POST /api/auth/logout-all`
  - `GET /api/auth/me`

## Session isolation

- Same browser can keep admin, seller, and customer sessions in parallel.
- Role cookies are isolated:
  - `admin_access_token`
  - `seller_access_token`
  - `customer_access_token`
- Public header only consumes customer auth state.
- Admin login remains hidden from public marketplace UI.

## Identifier rules

- Login accepts `identifier` as email or phone.
- Legacy email-only payloads still work on `/api/auth/login`.
- Registration requires at least one of:
  - `email`
  - `phone`
- `users.phone` is unique.
- The current schema still requires a stored email; phone-only registration uses an internal synthetic email for persistence, while UI and auth flow remain phone-based.

## Redirect rules

- `CUSTOMER` -> `/customer/orders`
- `SELLER`:
  - approved -> `/seller/dashboard`
  - onboarding incomplete -> `/seller/onboarding`
  - waiting approval -> `/seller/pending`
  - rejected -> `/seller/pending`
- `ADMIN` -> `/admin/dashboard`

## Hardening follow-up

- Auth endpoints are throttled with role-specific limits.
- Phone identifiers are normalized before lookup and duplicate checks.
- Seller session payloads now expose `sellerNextStep` and `sellerOnboardingComplete`.
- Internal synthetic email storage remains implementation detail for phone-only accounts.

## Security notes

- Hidden admin route is a UX/privacy measure only.
- Real security remains:
  - role-aware login endpoints
  - role-specific JWT guards
  - admin-only / seller-only / customer-only route guards
- Public registration never accepts `ADMIN`.
