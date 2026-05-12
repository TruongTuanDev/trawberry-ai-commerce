# Frontend Products

## Scope
This document describes the seller product UI migrated from Angular to Next.js in `frontend-next`.

## Source Angular Screens Reviewed

Reviewed files:
- `strawberry-frontend/src/app/features/seller/products/product-list.component.ts`
- `strawberry-frontend/src/app/features/seller/products/product-detail.component.ts`
- `strawberry-frontend/src/app/features/seller/products/category-filter.component.ts`
- `strawberry-frontend/src/app/features/seller/products/seller-product.facade.ts`
- `strawberry-frontend/src/app/core/api/seller-product-api.service.ts`

## What Angular Was Doing

### Product list
- seller product table
- search by product name, WB ID, brand, vendor code
- visibility/status filter
- stock filter
- category filter sidebar
- infinite scroll pagination
- image thumbnail, price, status, action button

### Product detail
- editable metadata:
  - local title
  - local description
  - visibility
  - slug override
- read-only Wildberries identity block
- variant pricing and inventory section

### Image behavior
- Angular detail page mostly showed the lead image inside the detail view
- no clearly separated dedicated image route UX like the new Next.js version

## Next.js Migration

Location:
- `frontend-next`

## New Routes
- `/seller/products`
- `/seller/products/[id]`
- `/seller/products/[id]/images`

## API Integration

The new frontend uses the NestJS backend and calls:
- `GET /api/shops/:shopId/products`
- `GET /api/shops/:shopId/products/:productId`
- `PATCH /api/shops/:shopId/products/:productId`

The shop id comes from the seller workspace store and shop switcher.

## New Reusable Components

### `ProductFilters`
Location:
- `frontend-next/src/components/products/product-filters.tsx`

Responsibility:
- search input
- status filter
- apply button

### `ProductTable`
Location:
- `frontend-next/src/components/products/product-table.tsx`

Responsibility:
- responsive product listing
- product image thumbnail
- status badge
- in-stock state
- detail button
- edit button

### `ProductForm`
Location:
- `frontend-next/src/components/products/product-form.tsx`

Responsibility:
- edit local title
- edit local description
- edit SEO slug
- edit visibility
- submit PATCH request payload

### `ProductImageGallery`
Location:
- `frontend-next/src/components/products/product-image-gallery.tsx`

Responsibility:
- display image grid
- show main-image flag and sort order
- reusable on detail page and dedicated images page

## Workspace / Shop Selection

New store:
- `frontend-next/src/stores/seller-workspace-store.ts`

Purpose:
- load seller shops from NestJS
- persist current shop id
- power the shop switcher in seller layout

This is required because the NestJS product API is shop-scoped.

## UI Behavior

### `/seller/products`
- loads current seller shop from workspace store
- loads paginated product list from NestJS
- supports:
  - search
  - status filter
  - pagination
- responsive table/cards layout

### `/seller/products/[id]`
- loads product detail from the selected seller shop
- shows:
  - editable metadata form
  - Wildberries identity summary
  - variant overview
  - image gallery preview
- saves metadata via PATCH

### `/seller/products/[id]/images`
- uses seller product detail API to render the product gallery
- gives product media its own route in the Next.js seller center

## Differences vs Angular

### Preserved
- seller product list route
- product detail route
- editable local metadata flow
- product image presence in seller product management
- search and status filtering

### Changed
- Angular infinite scroll was replaced with explicit pagination controls
- category sidebar filter is not yet migrated in this pass
- variant editing is currently summarized read-only in Next.js
- image gallery now has its own dedicated route
- shop context is driven by a reusable seller workspace store

## Security / Auth Note
- frontend seller routes now rely on NestJS `httpOnly` cookie auth with `credentials: "include"`
- the frontend only persists lightweight UI hydration state in `localStorage`; raw JWT auth tokens are no longer stored there

## Verification

Expected checks:
```bash
cd frontend-next
npm run lint
npm run build
npm run dev
```

Relevant pages:
- `http://localhost:3000/seller/products`
- `http://localhost:3000/seller/products/<productId>`
- `http://localhost:3000/seller/products/<productId>/images`

## No Angular Changes
This migration does not delete or modify the Angular product screens in `strawberry-frontend`.
