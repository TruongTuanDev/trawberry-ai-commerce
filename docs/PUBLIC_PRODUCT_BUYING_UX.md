# Public Product Buying UX

Date: 2026-05-17

Scope: `frontend-next` + `backend-nest` public marketplace only. Legacy apps `strawberry-frontend` and `strawberry-backend` remain untouched.

## Summary

Public buying UX is now closer to a modern marketplace detail flow:

- product cards show image, price, shop/category context, stock badge, and quick cart CTA
- products with one sellable variant support direct `В корзину`
- products with multiple variants route to detail with `Выбрать размер`
- detail page uses a three-column layout with:
  - left gallery and vertical thumbnails
  - middle product info, variant pills, and specs
  - right sticky purchase card with price, quantity stepper, add to cart, and buy now
- if an item is already in cart, the UI now shows `В корзине` state and variant quantity
- cart badge in the public header updates from the shared Zustand cart store

## Variant And Quantity Rules

- first in-stock variant is preselected when available
- out-of-stock variants are rendered but disabled
- quantity defaults to `1`
- quantity cannot go below `1`
- tracked variants cannot exceed current `availableQuantity`
- when a selected variant already exists in cart, the detail stepper reflects cart quantity and edits the cart directly

## Add To Cart And Buy Now

- `Добавить в корзину` adds the selected variant to local cart state
- after add, the button changes to `В корзине`
- `Купить сейчас` reuses the same variant/quantity selection, keeps normal cart behavior, and then opens `/checkout`
- backend checkout validation is unchanged: trusted price and stock are still recalculated server-side

## Public API Fields Used

`GET /api/public/products` and `GET /api/public/products/:productId` now expose enough data for buying UX:

- product:
  - `name`
  - `description`
  - `brand`
  - `color`
  - `gender`
  - `composition`
  - `sellerSku`
  - `categoryName`
  - `sourceCategoryName`
  - `price`
  - `oldPrice`
  - `inStock`
  - `availableQuantity`
  - `averageRating`
  - `feedbackCount`
- variants:
  - `id`
  - `sizeName`
  - `russianSize`
  - `techSize`
  - `wbSize`
  - `sellerSku`
  - `price`
  - `originalPrice`
  - `stockQuantity`
  - `lowStockThreshold`
  - `trackInventory`
  - `inStock`
  - `availableQuantity`
- shop:
  - `id`
  - `name`
  - `slug`
  - `logoUrl`
  - `paymentInstructions`

## Verification

Target UX verification currently passes with:

- `frontend-next npm run lint`
- `frontend-next npm run build`
- `frontend-next npm run test:e2e:product-buying-ux`
- `frontend-next npm run test:e2e:cart-checkout`
- `frontend-next npm run test:e2e:multi-shop-checkout`
- `frontend-next npm run test:e2e:marketplace-search-filter-sort`
