# Customer Account Management

## Scope

- Added a real customer account area in `frontend-next`:
  - `/customer/account`
  - `/customer/account/profile`
  - `/customer/account/addresses`
  - `/customer/account/security`
  - `/customer/account/support`
- Kept `/customer/orders` and `/customer/orders/[checkoutCode]` as the existing order-history and receipt surfaces.
- Did not modify legacy `strawberry-frontend` or `strawberry-backend`.

## Backend

- New NestJS customer account API group under `/api/customer`.
- Customer-only endpoints now cover:
  - profile read/update
  - password change
  - address CRUD
  - default address management
- Saved addresses are stored in Prisma model `CustomerAddress`.
- Only one default address is allowed per customer.
- First saved address becomes default automatically.

## Frontend

- Public header now routes logged-in customers to `/customer/account`.
- Customer account shell includes:
  - overview
  - profile
  - addresses
  - orders
  - security
  - support
  - logout
- Profile UI hides synthetic email from phone-only accounts and lets the customer add a real email later.
- Address UI supports create, edit, delete, and set-default actions with backend-backed validation.
- Security UI changes password through the real backend endpoint.

## Checkout Integration

- Checkout keeps the existing manual-address flow for guests and customers.
- Logged-in customers with saved addresses can now choose a saved address in checkout.
- Checkout payload supports optional `addressId`.
- When `addressId` is sent:
  - backend loads the address owned by the current customer
  - backend snapshots the saved address into the order shipping fields
  - existing cart, stock, multi-shop split, and receipt flows stay unchanged

## Guardrails

- Seller and admin sessions cannot use customer account endpoints.
- Customer account work does not change seller/admin session architecture.
- Customer order history remains under the existing customer receipt flow.
- No external API calls were added for this phase.

## Known Limitations

- Customer support remains attached to receipt/order flows, not a new standalone inbox.
- Saved addresses currently snapshot into order shipping text plus customer contact fields; there is no separate normalized shipping-address table on orders yet.
- Customer login/register redirect behavior still lands on the existing customer orders flow for compatibility; the new account dashboard is reached from the public header and direct routing.
