# API Customer Account

## Customer Profile

### `GET /api/customer/profile`

- Auth: customer session required
- Response:

```json
{
  "id": "uuid",
  "name": "Customer Name",
  "email": "customer@example.com",
  "phone": "+79990000001",
  "role": "CUSTOMER",
  "createdAt": "2026-05-21T00:00:00.000Z"
}
```

### `PATCH /api/customer/profile`

- Auth: customer session required
- Body:

```json
{
  "name": "Customer Name",
  "email": "customer@example.com",
  "phone": "+79990000001"
}
```

- Rules:
  - only updates the current customer
  - email is normalized to lowercase
  - phone is normalized with the shared phone utility
  - duplicate email/phone are rejected
  - role is not mutable
  - password hash is never returned

## Change Password

### `POST /api/customer/change-password`

- Auth: customer session required
- Body:

```json
{
  "currentPassword": "password123",
  "newPassword": "newPassword456"
}
```

- Rules:
  - current password must match
  - new password is hashed with bcrypt
  - current and new password cannot be identical
  - session architecture is unchanged; this phase does not force logout-all

## Saved Addresses

### `GET /api/customer/addresses`

- Auth: customer session required
- Response:

```json
{
  "items": [
    {
      "id": "uuid",
      "fullName": "Customer Name",
      "phone": "+79990000001",
      "country": "RU",
      "city": "Moscow",
      "region": "Moscow",
      "street": "Tverskaya 10",
      "apartment": "12",
      "postalCode": "101000",
      "comment": "Call before delivery",
      "isDefault": true,
      "createdAt": "2026-05-21T00:00:00.000Z",
      "updatedAt": "2026-05-21T00:00:00.000Z"
    }
  ]
}
```

### `POST /api/customer/addresses`

- Auth: customer session required
- Body:

```json
{
  "fullName": "Customer Name",
  "phone": "+79990000001",
  "city": "Moscow",
  "region": "Moscow",
  "street": "Tverskaya 10",
  "apartment": "12",
  "postalCode": "101000",
  "comment": "Call before delivery"
}
```

- Rules:
  - first address becomes default automatically
  - country defaults to `RU`
  - phone/full name/city/region/street are validated

### `PATCH /api/customer/addresses/:addressId`

- Auth: customer session required
- Partial update allowed
- Customer can update only their own address

### `DELETE /api/customer/addresses/:addressId`

- Auth: customer session required
- Deletes only the current customer's address
- If the deleted address was default and another address exists, the earliest remaining address becomes default

### `POST /api/customer/addresses/:addressId/default`

- Auth: customer session required
- Makes the selected address the only default address for that customer

## Checkout Integration

### `POST /api/checkout/orders`

- Existing contract remains valid
- New optional field:

```json
{
  "addressId": "uuid"
}
```

- Rules:
  - requires an authenticated customer
  - address must belong to the current customer
  - backend snapshots the saved address into order shipping fields
  - manual address checkout remains supported when `addressId` is absent
