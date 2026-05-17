# Public Marketplace Empty States

Date: 2026-05-18

Scope: `frontend-next` public marketplace fallback UX only.

## Products Listing

- `/products` now distinguishes between:
  - no public products at all: `Пока нет товаров`
  - no results for current search/filter set: `Không tìm thấy sản phẩm phù hợp`
- no-result state includes active search/filter summary chips
- empty and no-result states both expose:
  - `Clear filters`
  - `Back home`
- load failure now shows an error card with retry and clear-filters actions

## Search State

- header search keeps `q` visible after navigation
- filters continue to live in the URL
- clearing filters resets the route to `/products`
- search-driven remount keeps page state aligned with URL params

## Image Fallbacks

- product cards use local SVG fallback imagery when product media is missing or broken
- product detail gallery uses the same local fallback for:
  - main image
  - thumbnails
  - preview strip
- cart item imagery now also uses the same safe fallback path
- fallback is local and does not depend on remote placeholder services

## Cart Empty State

- `/cart` now shows a dedicated empty state with:
  - headline
  - short checkout-safe explanation
  - `Continue shopping`
- checkout CTA is not rendered when the cart is empty
- stale cart items no longer wait until final submit to surface issues; cart preflight now warns inline

## Product Unavailable State

- `/products/[id]` now renders a friendly unavailable page for public 404/unpublished/hidden cases
- generic fetch errors still show retry
- out-of-stock state remains disabled in purchase controls and is surfaced explicitly when no visible variant is purchasable

## Verification

- `npm run test:e2e:public-empty-fallbacks`
- `npm run test:e2e:public-marketplace-contract`
