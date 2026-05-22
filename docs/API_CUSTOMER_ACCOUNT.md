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

Saved addresses now support a Yandex-compatible structured model.

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
      "country": "Russia",
      "countryCode": "RU",
      "federalSubject": "Moscow",
      "city": "Moscow",
      "district": "Tverskoy District",
      "street": "Tverskaya",
      "building": "10",
      "entrance": "2",
      "intercom": "45B",
      "floor": "7",
      "apartment": "12",
      "postalCode": "101000",
      "comment": "Call before delivery",
      "latitude": "55.7558",
      "longitude": "37.6176",
      "geoPrecision": "BUILDING",
      "geoProvider": "MOCK",
      "addressFullName": "Moscow, Tverskaya, 10",
      "addressShortName": "Tverskaya 10",
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
  "country": "Russia",
  "countryCode": "RU",
  "city": "Moscow",
  "district": "Tverskoy District",
  "street": "Tverskaya",
  "building": "10",
  "entrance": "2",
  "intercom": "45B",
  "floor": "7",
  "apartment": "12",
  "postalCode": "101000",
  "comment": "Call before delivery",
  "latitude": 55.7558,
  "longitude": 37.6176
}
```

- Rules:
  - first address becomes default automatically
  - `country=Russia` and `countryCode=RU` are the current defaults
  - phone, full name, city, street, and building are validated
  - if the user still enters `street` as `Tverskaya 10`, the backend tries to split the building number for backward compatibility
  - coordinates are optional in the current MVP; missing coordinates are stored with `geoPrecision=UNKNOWN`

### `PATCH /api/customer/addresses/:addressId`

- Auth: customer session required
- Partial update allowed
- Customer can update only their own address

### `GET /api/customer/address-suggestions?query=&city=Moscow`

- Auth: customer session required
- Returns deterministic suggestions from the configured address provider
- Default phase providers:
  - `MOCK`
  - `MANUAL`
- Real Yandex geocoder is future-only and not called by default tests

Example response:

```json
{
  "items": [
    {
      "label": "Moscow, Tverskaya, 12",
      "city": "Moscow",
      "street": "Tverskaya",
      "building": "12",
      "latitude": 55.765369,
      "longitude": 37.605192,
      "geoPrecision": "BUILDING",
      "geoProvider": "MOCK"
    }
  ]
}
```

### `POST /api/customer/addresses/:addressId/geocode`

- Auth: customer session required
- Re-runs provider geocoding for an existing saved address
- In current mock/manual mode this stores deterministic Moscow coordinates or preserves manual coordinates

Address responses now also include:

- `geoReadiness`
- `missingYandexFields`
- `yandexManualReady`
- `yandexApiReady`

Example:

```json
{
  "geoReadiness": {
    "hasStructuredAddress": true,
    "hasCoordinates": false,
    "geoPrecision": "UNKNOWN",
    "isYandexManualReady": true,
    "isYandexApiReady": false,
    "missingFields": ["coordinates"]
  },
  "missingYandexFields": ["coordinates"],
  "yandexManualReady": true,
  "yandexApiReady": false
}
```

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
  - backend also snapshots structured dropoff fields used by the manual Yandex workbench
  - manual address checkout remains supported when `addressId` is absent
