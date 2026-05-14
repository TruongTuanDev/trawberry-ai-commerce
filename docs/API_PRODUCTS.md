# API Products

## Wildberries Excel Import

Seller WB import endpoints live under shop scope:

- `POST /api/shops/:shopId/imports/wildberries/preview`
- `POST /api/shops/:shopId/imports/wildberries/confirm`
- `GET /api/shops/:shopId/imports/wildberries/:importId`

The preview endpoint accepts multipart `.xlsx` uploads from the Wildberries export sheet `Товары`. Header row is `3`; product rows are auto-detected after the Wildberries help row, with the audited real export starting data at row `5`. Rows sharing `Артикул продавца` are grouped into one product with multiple variants.

Confirm import upserts products by `shopId + sellerSku`, variants by barcode or size tuple, and remote images by URL. Only approved sellers can import into shops they own. See `docs/WILDBERRIES_EXCEL_IMPORT.md` for the full mapping and smoke flow.

## Scope
This document describes the migrated seller product module implemented in `backend-nest`, based on the current Spring Boot catalog/product implementation in `strawberry-backend`.

## Source Spring Boot Review

Reviewed files:
- `catalog/entity/Product.java`
- `catalog/entity/ProductImage.java`
- `catalog/entity/ProductVariant.java`
- `catalog/entity/Category.java`
- `shop/entity/Shop.java`
- `catalog/controller/CatalogSellerController.java`
- `catalog/service/CatalogService.java`
- `catalog/repository/ProductRepository.java`

Reviewed database migrations:
- `V5__create_products.sql`
- `V6__create_product_images_and_characteristics.sql`
- `V7__create_product_variants_and_skus.sql`
- `V18__add_product_ratings.sql`
- `V19__create_categories_table.sql`
- `V20__refine_product_schema.sql`
- `V22__create_product_tags_table.sql`
- `V23__add_product_indices.sql`

## Existing Spring Boot Behavior

### What exists today
Spring Boot currently provides seller product APIs for:
- shop-scoped product listing with filtering
- shop-scoped product detail
- metadata update
- variant pricing update
- variant inventory update
- pricing and inventory management views

### What does not exist as direct seller CRUD in Spring Boot
There is no direct seller API today for:
- `POST` create product
- `PATCH` full product update endpoint
- `DELETE` product endpoint

## Database Mapping

The NestJS implementation maps to the existing schema and does not change or drop existing tables.

### Tables used
- `shops`
- `categories`
- `products`
- `product_images`
- `product_variants`

### Prisma models added or refined
- `Shop`
- `Category`
- `Product`
- `ProductImage`
- `ProductVariant`

### Important compatibility rules
- The old schema keeps Wildberries-managed fields such as `wb_title`, `wb_description`, `wb_nm_id`
- Local seller-managed fields remain on the same table:
  - `local_title`
  - `local_description`
  - `seo_slug`
  - `visibility`
- Product ownership remains shop-scoped via `products.shop_id`
- Access control is enforced by `ShopAccessGuard`

## NestJS Endpoints

Base path:
- `/api/shops/:shopId/products`

All endpoints below require:
- JWT auth
- `ShopAccessGuard`

This means a user cannot operate on products from a shop they do not own unless they are admin.

## GET `/api/shops/:shopId/products`

List products for a shop.

### Query params
- `page`
- `size`
- `search`
- `status`
- `visibility`
- `inStock`
- `stockStatus`
- `categoryId`

`status` is treated as an alias of `visibility`.
`stockStatus` supports `IN_STOCK`, `LOW_STOCK`, and `OUT_OF_STOCK`.

### Response
```json
{
  "items": [
    {
      "id": "uuid",
      "shopId": "uuid",
      "wbNmId": "1001",
      "title": "Seller Title",
      "wbTitle": "WB Title",
      "localTitle": "Seller Title",
      "brand": "Brand",
      "visibility": "ACTIVE",
      "seoSlug": "seller-title",
      "categoryName": "Sneakers",
      "wbVendorCode": "SKU-1",
      "mainImage": "https://example.com/image.jpg",
      "inStock": true,
      "stockQuantity": 2,
      "lowStockThreshold": 5,
      "trackInventory": true,
      "stockStatus": "LOW_STOCK",
      "variantCount": 1,
      "primaryVariantId": "uuid"
    }
  ],
  "meta": {
    "page": 1,
    "size": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

## POST `/api/shops/:shopId/products`

Create a new product in a seller shop.

### Request body
```json
{
  "wbNmId": 100001,
  "wbTitle": "Wildberries Product Title",
  "localTitle": "Editable Seller Title",
  "wbDescription": "Source description",
  "localDescription": "Seller description",
  "categoryId": 10,
  "visibility": "ACTIVE",
  "images": [
    {
      "wbUrl": "https://example.com/main.jpg",
      "isMain": true,
      "sortOrder": 0
    }
  ]
}
```

### Notes
- `wbNmId` is required because the old schema enforces it
- `wbTitle` is required because the old schema enforces it
- if `categoryId` is supplied, it must exist in `categories`
- duplicate `wbNmId` within the same shop is rejected

## GET `/api/shops/:shopId/products/:productId`

Get one product inside the seller shop.

### Response
Returns shop, category, images, and variants in one payload.

Variant inventory fields now include:
- `stockQuantity`
- `reservedStock`
- `lowStockThreshold`
- `trackInventory`
- `stockStatus`

## Inventory Endpoints

Seller inventory is now exposed separately from the main product metadata update flow.

### `GET /api/shops/:shopId/products/:productId/inventory`

Returns product-level and variant-level inventory summary:
- `totalStockQuantity`
- `totalReservedStock`
- `totalLowStockThreshold`
- `trackInventory`
- `stockStatus`
- `totalAvailableQuantity`
- `inStock`
- `variants[]`

### `PATCH /api/shops/:shopId/products/:productId/inventory`

Updates `stockQuantity` for a variant.

Request body:

```json
{
  "variantId": "uuid",
  "stockQuantity": 5
}
```

Notes:
- `variantId` is optional when the product has a single active variant
- this endpoint is intended for quick seller stock corrections without editing the rest of the product payload
- cross-shop access is rejected with `403`

## Public Product Availability

Public product responses now include:
- `inStock`
- `availableQuantity`

This is used by the customer marketplace UI to:
- show stock badges
- disable checkout for out-of-stock products
- clamp quantity selection to the current available amount

## PATCH `/api/shops/:shopId/products/:productId`

Update one product inside the seller shop.

### Supported fields
- `wbNmId`
- `wbTitle`
- `wbDescription`
- `brand`
- `categoryId`
- `categoryName`
- `wbVendorCode`
- `wbVideoUrl`
- `wbNeedKiz`
- `subjectId`
- `wholesaleEnabled`
- `wholesaleQuantum`
- `length`
- `width`
- `height`
- `weightBrutto`
- `dimensionsValid`
- `localTitle`
- `localDescription`
- `seoSlug`
- `visibility`
- `localTags`

## DELETE `/api/shops/:shopId/products/:productId`

Delete one product inside the seller shop.

### Behavior
- product must belong to the target shop
- shop access must pass
- relies on existing database relations and cascade rules

## Validation

DTO validation is implemented with `class-validator` on:
- `CreateProductDto`
- `UpdateProductDto`
- `ListShopProductsQueryDto`

## Access Control

All seller product CRUD routes are protected with:
- `JwtAuthGuard`
- `ShopAccessGuard`

Guard behavior:
- seller can only access shops owned by their seller profile
- admin can access all shops
- seller cannot access another seller's shop

## Tests

Test file:
- `backend-nest/test/product.e2e-spec.ts`

Covered scenarios:
- list with pagination and status filter
- list with stock-status filter
- detail for accessible shop
- create product
- update product
- delete product
- inventory detail and stock update
- forbid access to another seller's shop

Run:
```bash
cd backend-nest
npm test -- --runInBand
```

## Runtime Smoke

Local product smoke can be run with:

```bash
cd backend-nest
npm run smoke:products
```

What it verifies:
- seller register
- local seller approval bootstrap for smoke only
- login
- shop create
- product create
- product list with search and pagination
- product detail
- product update
- product delete

Why seller approval is bootstrapped in smoke:
- current business rule only allows `APPROVED` sellers to create shops
- Product CRUD is shop-scoped, so smoke must first create a shop
- this smoke step updates `seller_profiles.approval_status` in the local development database only
- no legacy Spring Boot code or schema is changed

## No Spring Boot Changes

This migration does not modify:
- Spring Boot product entities
- Spring Boot controllers or services
- Flyway migrations
- existing PostgreSQL schema
