# Public Shops API

## Purpose

Public shop profile pages let marketplace buyers open a seller shop from public product surfaces and view:

- public-safe shop metadata
- active approved shop identity
- public product count
- public product grid filtered by the same visibility rules as `/api/public/products`

This is an internal marketplace public profile feature. It does not expose private seller contact data, warehouse details, finance data, or internal notes.

## Endpoints

### `GET /api/public/shops/:slug`

Returns public-safe shop metadata for one active approved shop.

#### Response

```json
{
  "shop": {
    "id": "shop_123",
    "slug": "demo-shop",
    "name": "Demo Shop",
    "displayName": "Demo Shop",
    "description": null,
    "logoUrl": null,
    "bannerUrl": null,
    "isVerified": true,
    "approvedAt": "2026-05-25T10:00:00.000Z",
    "productCount": 4,
    "ratingAverage": 4.8,
    "ratingCount": 23,
    "joinedAt": "2026-05-01T08:00:00.000Z",
    "locationLabel": "Moscow"
  }
}
```

#### 404 behavior

Returns `404` when:

- the shop slug does not exist
- the shop is not active
- the seller approval is not `APPROVED`

### `GET /api/public/products?shopSlug=:slug`

Uses the existing public products endpoint and adds an optional `shopSlug` filter for public shop profile grids.

## Public visibility rules

Public shop profile products reuse the marketplace public visibility policy:

- product must be in the public/published catalog
- product readiness must pass
- active variant with valid price
- stock must be greater than zero
- shop must stay active
- seller approval must stay approved
- deleted or invalid products must not appear

## Privacy / non-goals

The public shop profile must not expose:

- seller private phone or email
- full pickup/private warehouse address
- finance or commission data
- payment proof images
- internal admin or seller notes

Messaging is placeholder-only in this phase. Reviews and ratings are placeholder-safe until a dedicated review phase is implemented.
