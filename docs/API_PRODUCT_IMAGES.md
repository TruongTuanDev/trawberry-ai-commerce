# API Product Images

Product image upload and gallery management module for the new `Next.js + NestJS` architecture.

## Scope
- seller-managed product images
- local storage or S3/MinIO-compatible storage
- product-scoped access under seller shops
- metadata needed for future AI image / try-on flows

## Auth and Access
- Auth: `Bearer access token`
- Guards: `JwtAuthGuard + ShopAccessGuard`
- Scope: every endpoint is constrained by `shopId + productId`

Each request verifies:
- user is logged in
- user has access to the target `shopId`
- target product belongs to that shop

## Database Mapping

Primary table:
- `product_images`

Extended metadata is stored with additive columns only:
- `storage_key`
- `original_name`
- `mime_type`
- `size`
- `image_type`
- `updated_at`

Compatibility notes:
- existing columns `wb_url`, `local_url`, `is_main`, `sort_order`, `created_at` are preserved
- schema change is additive and does not remove or rename legacy fields
- local development was synchronized with `prisma db push`
- a SQL migration file exists for tracked environments:
  - `backend-nest/prisma/migrations/20260510_add_product_image_metadata/migration.sql`

## Storage

Supported drivers:
- `STORAGE_DRIVER=local`
- `STORAGE_DRIVER=s3`

Fallback:
- `FILE_STORAGE_DRIVER` is still accepted for backward compatibility

### Local storage
- files are stored under `UPLOAD_ROOT/products/:shopId/:productId/*`
- public URL is served from `/uploads/*`

### S3 / MinIO
- implemented via `@aws-sdk/client-s3`
- expected envs:
  - `S3_ENDPOINT`
  - `S3_REGION`
  - `S3_ACCESS_KEY_ID`
  - `S3_SECRET_ACCESS_KEY`
  - `S3_BUCKET`
  - `S3_PUBLIC_BASE_URL`

## Validation
- allowed mime types:
  - `image/jpeg`
  - `image/png`
  - `image/webp`
- max size:
  - `MAX_IMAGE_SIZE_MB`
  - default `10`

## Response Shape

```json
{
  "id": "uuid",
  "shopId": "uuid",
  "productId": "uuid",
  "url": "http://localhost:3001/uploads/products/shop-id/product-id/file.jpg",
  "wbUrl": "http://localhost:3001/uploads/products/shop-id/product-id/file.jpg",
  "localUrl": "http://localhost:3001/uploads/products/shop-id/product-id/file.jpg",
  "storageKey": "products/shop-id/product-id/file.jpg",
  "originalName": "file.jpg",
  "mimeType": "image/jpeg",
  "size": 12345,
  "imageType": "FRONT",
  "isMain": true,
  "sortOrder": 0,
  "createdAt": "2026-05-10T17:00:00.000Z",
  "updatedAt": "2026-05-10T17:00:00.000Z"
}
```

`imageType` values:
- `ORIGINAL`
- `AI_GENERATED`
- `MODEL_REFERENCE`
- `FRONT`
- `BACK`
- `DETAIL`

## Endpoints

Base path:
- `/api/shops/:shopId/products/:productId/images`

### `GET /api/shops/:shopId/products/:productId/images`
Returns all images for a product in the current seller shop.

Ordering:
- main image first
- then `sortOrder`
- then `createdAt`

### `POST /api/shops/:shopId/products/:productId/images`
Uploads one or more product images.

Request:
- `multipart/form-data`
- field name: `files`
- optional field: `imageType`

Behavior:
- validates mime type and file size
- stores file through selected storage driver
- inserts metadata into `product_images`
- first image becomes `isMain=true` when the product has no images yet

### `PATCH /api/shops/:shopId/products/:productId/images/:imageId`
Updates image metadata.

Supported fields:
- `imageType`
- `sortOrder`
- `isMain`

Behavior:
- when `isMain=true`, all other product images are automatically switched to `false`
- when the current main image is unset or deleted, another image is promoted when possible

### `DELETE /api/shops/:shopId/products/:productId/images/:imageId`
Deletes image metadata and stored file.

Behavior:
- deletes from `product_images`
- deletes local file or S3 object when storage key is known
- if deleted image was main, another image is promoted when available

## Frontend
- Page: `/seller/products/[id]/images`
- Current capabilities:
  - upload multiple images
  - image gallery
  - set main image
  - change `imageType`
  - delete image
  - loading and error states
  - AI button remains available for the later AI flow

## Tests

Backend test file:
- `backend-nest/test/product-images.e2e-spec.ts`

Covered:
- upload images
- list images
- update metadata
- set main image
- delete image
- reject unsupported mime type
- reject oversized file
- forbid cross-shop access

Run:

```bash
cd backend-nest
npm test -- --runInBand
```

## Runtime Smoke

```bash
cd backend-nest
npm run smoke:product-images
```

Smoke verifies:
- seller register
- local seller approval bootstrap
- login
- create shop
- create product
- upload product images
- list product images
- set main image
- update image metadata
- delete image
- verify cross-shop access returns `403`

## Legacy Safety
- no changes under `strawberry-frontend`
- no changes under `strawberry-backend`
- no legacy table or column was removed
