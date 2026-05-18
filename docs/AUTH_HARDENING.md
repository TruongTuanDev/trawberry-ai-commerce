# Auth Hardening

Phase: rate limiting, cookie/CSRF posture review, phone normalization, and seller pending UX.

## Rate limiting

- `POST /api/auth/customer/login`: 5 attempts / 1 minute / IP + identifier
- `POST /api/auth/seller/login`: 5 attempts / 1 minute / IP + identifier
- `POST /api/auth/admin/login`: 5 attempts / 5 minutes / IP + identifier
- `POST /api/auth/customer/register`: 3 attempts / 1 minute / IP + identifier
- `POST /api/auth/seller/register`: 3 attempts / 1 minute / IP + identifier
- Legacy `POST /api/auth/login` and `POST /api/auth/register` are also throttled
- Throttle responses return `429 Too Many Requests` with a generic message

Persistent account lockout is intentionally not implemented in this phase.

## Phone normalization

- Trim whitespace
- Remove spaces, hyphens, and parentheses
- Preserve a leading `+`
- Normalize `8XXXXXXXXXX` to `+7XXXXXXXXXX`
- Normalize plain `7XXXXXXXXXX` to `+7XXXXXXXXXX`
- Other digit-only values are stored as `+<digits>`
- Reject numbers shorter than 10 digits or longer than 15 digits

Normalization is applied on:

- customer register/login
- seller register/login
- seller onboarding contact phone
- duplicate phone checks

## Cookie and CSRF posture

- Auth cookie remains `httpOnly`
- Default cookie policy remains `SameSite=lax`
- `AUTH_COOKIE_SECURE=true` is expected for HTTPS production
- `AUTH_COOKIE_SAME_SITE=none` is ignored unless `AUTH_COOKIE_SECURE=true`
- Frontend always uses `credentials: "include"`
- CORS no longer accepts `*` when credentials are enabled
- Use `CORS_ALLOWED_ORIGINS` to declare explicit trusted origins

This phase does not add a separate CSRF token system. Current protection relies on:

- `SameSite` cookies
- explicit CORS allowlist
- no wildcard credentialed origins

## Seller pending UX

- Sellers now expose:
  - `sellerApprovalStatus`
  - `sellerRejectionReason`
  - `sellerOnboardingComplete`
  - `sellerNextStep`
- `sellerNextStep` values:
  - `COMPLETE_ONBOARDING`
  - `WAIT_FOR_APPROVAL`
  - `CONTACT_SUPPORT`
  - `APPROVED`
- Seller redirect behavior:
  - incomplete -> `/seller/onboarding`
  - pending review -> `/seller/pending`
  - rejected -> `/seller/pending`
  - approved -> `/seller/dashboard`

## Known limitations

- No persistent DB-backed account lockout yet
- Admin hidden route remains fixed at `/admin-login`
- Phone-only accounts still use internal synthetic email persistence because `users.email` remains required
