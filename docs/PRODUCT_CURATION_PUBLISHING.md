# Product Curation + Publishing

Wildberries sync and Excel import now feed a private seller catalog first. They do not auto-publish products to the public marketplace.

## Lifecycle

- `IMPORTED`: created by WB API sync or WB Excel import, private by default
- `DRAFT`: seller-edited but still not ready
- `READY`: passes readiness checks and can be published
- `PUBLISHED`: visible on public marketplace and allowed in checkout
- `UNPUBLISHED`: previously public, now hidden from public marketplace
- `ARCHIVED`: hidden and removed from seller publishing workflow

## Sources

- `MANUAL`
- `WILDBERRIES_EXCEL`
- `WILDBERRIES_API`

## Seller Workflow

1. Import or sync products from Wildberries.
2. Review imported products in `/seller/products`.
3. Filter by `Imported`, `Needs review`, `Missing price`, `Missing stock`, `Missing category`, `Ready to publish`, `Published`, `Unpublished`, or `Archived`.
4. Update price, stock, category, images, and copy as needed.
5. Use seller bulk editing to fix category, price, and stock across multiple products at once.
5. Publish individual products or run bulk publish.
6. Unpublish or archive products when they should leave the marketplace.

## Bulk Editing

- `POST /api/shops/:shopId/products/bulk-update` updates category, price, stock, and inventory tracking in bulk.
- Variant scope supports `ALL_VARIANTS`, `MISSING_ONLY`, and `FIRST_VARIANT_ONLY`.
- `publishIfReady=true` is optional and never overrides readiness checks.
- Frontend `/seller/products` exposes bulk edit and bulk publish controls in the same seller catalog view.

## Readiness Rules

A product can publish only when:

- seller is approved
- shop is active
- product is not archived
- product has a title
- product has at least one image
- product has an internal category or preserved source category
- product has at least one active variant
- at least one active variant has price `> 0`
- at least one active variant has stock `> 0` when inventory tracking is enabled

Blocking reasons are returned as safe codes such as:

- `MISSING_PRICE`
- `MISSING_STOCK`
- `MISSING_CATEGORY`
- `MISSING_IMAGE`
- `NO_ACTIVE_VARIANT`
- `SELLER_NOT_APPROVED`
- `SHOP_INACTIVE`
- `PRODUCT_ARCHIVED`

## Public Marketplace Rules

`/api/public/products`, `/api/public/products/:productId`, and frontend `/products` only expose products that are:

- `catalogStatus=PUBLISHED`
- `visibility=ACTIVE`
- seller approved
- shop active
- checkout-ready according to readiness rules

## Checkout Rules

Checkout rejects:

- imported, draft, unpublished, or archived products
- products missing price
- products missing sellable stock
- products from inactive shops or unapproved sellers

## Verification

- Backend: `npm run smoke:product-curation`
- Frontend: `npm run test:e2e:product-curation`
- Bulk editing:
  - Backend: `npm run smoke:bulk-product-edit`
  - Frontend: `npm run test:e2e:bulk-product-edit`
