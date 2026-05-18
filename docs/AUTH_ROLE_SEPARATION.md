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
- Seller:
  - `POST /api/auth/seller/register`
  - `POST /api/auth/seller/login`
- Admin:
  - `POST /api/auth/admin/login`
- Shared compatibility:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`

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
  - pending/rejected -> `/seller/onboarding`
- `ADMIN` -> `/admin/dashboard`

## Security notes

- Hidden admin route is a UX/privacy measure only.
- Real security remains:
  - role-aware login endpoints
  - `JwtAuthGuard`
  - admin-only / seller-only route guards
- Public registration never accepts `ADMIN`.
