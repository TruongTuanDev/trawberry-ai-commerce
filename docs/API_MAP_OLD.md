# API Map Old

## Scope
This file maps the current Angular frontend calls to the Spring Boot backend endpoints that are actively used by the UI.

Base assumption:

- Frontend calls are rooted at `environment.apiUrl`
- In local development this is typically proxied to Spring Boot under `/api`

## Auth

| Frontend file | Method | HTTP | Endpoint | Backend match | Notes |
| --- | --- | --- | --- | --- | --- |
| `core/auth/auth.service.ts` | `login` | `POST` | `/api/v1/auth/login` | `AuthController#login` | Shared login for all roles |
| `core/auth/auth.service.ts` | `register` | `POST` | `/api/v1/auth/register/customer` | `AuthController#registerCustomer` | Customer self-registration |
| `core/auth/auth.service.ts` | `registerSeller` | `POST` | `/api/v1/auth/register/seller` | `AuthController#registerSeller` | Seller onboarding |

## Public Catalog

| Frontend file | Method | HTTP | Endpoint | Backend match | Notes |
| --- | --- | --- | --- | --- | --- |
| `core/api/catalog-api.service.ts` | `getProducts` | `GET` | `/api/v1/public/catalog/products` | `CatalogPublicController#getProducts/search` | Query params: search, categoryId, shopSlug, brand, minPrice, maxPrice, inStock, sort, page, size |
| `core/api/catalog-api.service.ts` | `getProductBySlug` | `GET` | `/api/v1/public/catalog/products/{slug}` | `CatalogPublicController#getProductBySlug` | Product detail |
| `core/api/catalog-api.service.ts` | `getFilters` | `GET` | `/api/v1/public/catalog/filters` | `CatalogPublicController#getFilters` | Catalog filter metadata |
| `core/api/catalog-api.service.ts` | `getCategories` | `GET` | `/api/v1/public/catalog/categories` | `CategoryPublicController#getCategories` | Category tree/list |
| `core/api/catalog-api.service.ts` | `getReviews` | `GET` | `/api/v1/public/catalog/products/{slug}/reviews` | `ReviewPublicController#getReviews` | Query params: page, size |
| `core/api/catalog-api.service.ts` | `getRecommendations` | `GET` | `/api/v1/public/catalog/products/{slug}/recommendations` | `RecommendationPublicController#getRecommendations` | Query param: limit |
| `core/services/shipping.service.ts` | `getZones` | `GET` | `/api/v1/public/shipping/zones` | `PublicShippingController#getZones` | Public shipping zones |
| `core/services/shipping.service.ts` | `getMethods` | `GET` | `/api/v1/public/shipping/methods` | `PublicShippingController#getMethods` | Query param: zoneId |

## Customer Cart and Favorites

| Frontend file | Method | HTTP | Endpoint | Backend match | Notes |
| --- | --- | --- | --- | --- | --- |
| `core/services/cart.service.ts` | `load` | `GET` | `/api/v1/customer/cart` | `CartController#getCart` | Current customer cart |
| `core/services/cart.service.ts` | `addItem` | `POST` | `/api/v1/customer/cart/items` | `CartController#addItem` | Body: variantId, quantity |
| `core/services/cart.service.ts` | `updateItem` | `PUT` | `/api/v1/customer/cart/items/{itemId}` | `CartController#updateItem` | Body: quantity |
| `core/services/cart.service.ts` | `removeItem` | `DELETE` | `/api/v1/customer/cart/items/{itemId}` | `CartController#removeItem` | Remove cart item |
| `core/services/cart.service.ts` | `clear` | `DELETE` | `/api/v1/customer/cart` | `CartController#clearCart` | Clear whole cart |
| `core/services/favorites.service.ts` | `loadFavoriteIds` | `GET` | `/api/v1/customer/favorites/ids` | `CustomerFavoriteController#getFavoriteIds` | Used for fast favorite state |
| `core/services/favorites.service.ts` | `loadFavorites` | `GET` | `/api/v1/customer/favorites` | `CustomerFavoriteController#getFavorites` | Returns favorite products |
| `core/services/favorites.service.ts` | `add` | `POST` | `/api/v1/customer/favorites/{productId}` | `CustomerFavoriteController#addFavorite` | Toggle add |
| `core/services/favorites.service.ts` | `remove` | `DELETE` | `/api/v1/customer/favorites/{productId}` | `CustomerFavoriteController#removeFavorite` | Toggle remove |

## Customer Orders and Checkout

| Frontend file | Method | HTTP | Endpoint | Backend match | Notes |
| --- | --- | --- | --- | --- | --- |
| `core/services/order.service.ts` | `checkout` | `POST` | `/api/v1/customer/orders/checkout` | `CustomerOrderController#checkout` | Creates order(s) from cart or request payload |
| `core/services/order.service.ts` | `getOrders` | `GET` | `/api/v1/customer/orders` | `CustomerOrderController#getOrders` | Customer order history |
| `core/services/order.service.ts` | `getOrder` | `GET` | `/api/v1/customer/orders/{orderId}` | `CustomerOrderController#getOrder` | Order detail |
| `core/services/order.service.ts` | `uploadPaymentConfirmation` | `POST` | `/api/v1/customer/orders/{orderId}/payment-confirmation` | `CustomerOrderController#uploadPaymentConfirmation` | Multipart upload with receipt image |
| `core/services/order.service.ts` | `getTracking` | `GET` | `/api/v1/customer/orders/{orderId}/tracking` | `CustomerOrderController#getTracking` | Shipment tracking view |
| `core/services/order.service.ts` | `completeOrder` | `POST` | `/api/v1/customer/orders/{orderId}/complete` | `CustomerOrderController#completeOrder` | Marks order completed |
| `core/services/order.service.ts` | `reportNotReceived` | `POST` | `/api/v1/customer/orders/{orderId}/delivery-issues` | `CustomerOrderController#reportDeliveryIssue` | Body optionally contains note |
| `core/services/order.service.ts` | `submitReview` | `POST` | `/api/v1/customer/orders/{orderId}/items/{orderItemId}/review` | `CustomerOrderController#submitReview` | Post-purchase review |

## Seller Workspace and Shops

| Frontend file | Method | HTTP | Endpoint | Backend match | Notes |
| --- | --- | --- | --- | --- | --- |
| `core/services/shop.service.ts` | `getSellerWorkspace` | `GET` | `/api/v1/seller/workspace` | `SellerWorkspaceController#getWorkspace` | Approval state and current shop |
| `core/services/shop.service.ts` | `activateShop` | `POST` | `/api/v1/seller/workspace/shops/{shopId}/activate` | `SellerWorkspaceController#activateShop` | Sets current shop |
| `core/services/shop.service.ts` | `getSellerShops` | `GET` | `/api/v1/seller/shops` | `SellerShopController#getShops` | Seller's shops |
| `core/services/shop.service.ts` | `getShopDetail` | `GET` | `/api/v1/seller/shops/{shopId}` | `SellerShopController#getShop` | Shop detail |
| `core/services/shop.service.ts` | `createShop` | `POST` | `/api/v1/seller/shops` | `SellerShopController#createShop` | Shop create |
| `core/services/shop.service.ts` | `updateShop` | `PUT` | `/api/v1/seller/shops/{shopId}` | `SellerShopController#updateShop` | Shop settings update |
| `core/services/seller-dashboard.service.ts` | `getDashboardStats` | `GET` | `/api/v1/seller/shops/{shopId}/dashboard` | `SellerShopDashboardController#getDashboard` | Seller dashboard KPIs |

## Seller Catalog Management

| Frontend file | Method | HTTP | Endpoint | Backend match | Notes |
| --- | --- | --- | --- | --- | --- |
| `core/api/seller-product-api.service.ts` | `getProducts` | `GET` | `/api/v1/seller/shops/{shopId}/products` | `CatalogSellerController#getProducts` | Query params: page, size, search, wbId, categoryIds, visibility, inStock |
| `core/api/seller-product-api.service.ts` | `getShopCategories` | `GET` | `/api/v1/seller/shops/{shopId}/products/categories` | `CatalogSellerController#getCategories` | Seller-side categories |
| `core/api/seller-product-api.service.ts` | `getProductDetail` | `GET` | `/api/v1/seller/shops/{shopId}/products/{productId}` | `CatalogSellerController#getProductDetail` | Seller product detail |
| `core/api/seller-product-api.service.ts` | `updateMetadata` | `PUT` | `/api/v1/seller/shops/{shopId}/products/{productId}/metadata` | `CatalogSellerController#updateMetadata` | Product metadata update |
| `core/api/seller-product-api.service.ts` | `updatePricing` | `PUT` | `/api/v1/seller/shops/{shopId}/products/variants/{variantId}/pricing` | `CatalogSellerController#updateVariantPricing` | Single variant pricing |
| `core/api/seller-product-api.service.ts` | `updateInventory` | `PUT` | `/api/v1/seller/shops/{shopId}/products/variants/{variantId}/inventory` | `CatalogSellerController#updateVariantInventory` | Single variant inventory |
| `core/api/seller-product-api.service.ts` | `getPricingProducts` | `GET` | `/api/v1/seller/shops/{shopId}/products/pricing` | `CatalogSellerController#getPricingProducts` | Pricing grid |
| `core/api/seller-product-api.service.ts` | `bulkUpdateVariantPricing` | `POST` | `/api/v1/seller/shops/{shopId}/variants/bulk-pricing` | `CatalogVariantSellerController#bulkPricing` | Batch pricing update |
| `core/api/seller-product-api.service.ts` | `getInventoryVariants` | `GET` | `/api/v1/seller/shops/{shopId}/variants/inventory` | `CatalogVariantSellerController#getInventory` | Inventory grid |
| `core/api/seller-product-api.service.ts` | `bulkUpdateVariantInventory` | `POST` | `/api/v1/seller/shops/{shopId}/variants/bulk-inventory` | `CatalogVariantSellerController#bulkInventory` | Batch inventory update |

## Seller Orders, Payments, and Fulfillment

| Frontend file | Method | HTTP | Endpoint | Backend match | Notes |
| --- | --- | --- | --- | --- | --- |
| `core/api/seller-order-api.service.ts` | `getShopOrders` | `GET` | `/api/v1/seller/shops/{shopId}/orders` | `SellerOrderController#getOrders` | Query params: status, paymentStatus |
| `core/api/seller-order-api.service.ts` | `getShopPayments` | `GET` | `/api/v1/seller/shops/{shopId}/payments` | `SellerOrderController#getPayments` | Query params: page, size, search, status, fromDate, toDate |
| `core/api/seller-order-api.service.ts` | `getOrderDetails` | `GET` | `/api/v1/seller/shops/{shopId}/orders/{orderId}` | `SellerOrderController#getOrderDetail` | Seller order detail |
| `core/api/seller-order-api.service.ts` | `approvePayment` | `POST` | `/api/v1/seller/shops/{shopId}/orders/{orderId}/payment/approve` | `SellerOrderController#approvePayment` | Manual payment approval |
| `core/api/seller-order-api.service.ts` | `rejectPayment` | `POST` | `/api/v1/seller/shops/{shopId}/orders/{orderId}/payment/reject` | `SellerOrderController#rejectPayment` | Body may include reason |
| `core/api/seller-order-api.service.ts` | `updateFulfillmentStatus` | `PUT` | `/api/v1/seller/shops/{shopId}/orders/{orderId}/status` | `SellerOrderController#updateStatus` | Query param: status |
| `core/api/seller-shipment-api.service.ts` | `createShipment` | `POST` | `/api/v1/seller/shops/{shopId}/orders/{orderId}/ship` | `SellerShipmentController#createShipment` | Shipment creation |
| `core/api/seller-shipment-api.service.ts` | `updateShipmentStatus` | `PUT` | `/api/v1/seller/shops/{shopId}/shipments/{shipmentId}/status` | `SellerShipmentController#updateShipmentStatus` | Query param: newStatus |
| `core/api/seller-shipment-api.service.ts` | `getShopShipments` | `GET` | `/api/v1/seller/shops/{shopId}/shipments` | `SellerShipmentController#getShipments` | Seller shipment list |
| `core/api/seller-shipment-api.service.ts` | `getDeliveryIssues` | `GET` | `/api/v1/seller/shops/{shopId}/delivery-issues` | `SellerShipmentController#getDeliveryIssues` | Delivery issue queue |
| `core/api/seller-shipment-api.service.ts` | `updateDeliveryIssueStatus` | `PUT` | `/api/v1/seller/shops/{shopId}/delivery-issues/{issueId}/status` | `SellerShipmentController#updateDeliveryIssueStatus` | Body contains status |

## Seller Sync and External Integration

| Frontend file | Method | HTTP | Endpoint | Backend match | Notes |
| --- | --- | --- | --- | --- | --- |
| `core/api/seller-sync-api.service.ts` | `getSyncHealth` | `GET` | `/api/v1/seller/shops/{shopId}/sync/stats` | `SyncController#getStats` | Sync health dashboard |
| `core/api/seller-sync-api.service.ts` | `getSyncHistory` | `GET` | `/api/v1/seller/shops/{shopId}/sync/history` | `SyncController#getHistory` | Query param: limit |
| `core/api/seller-sync-api.service.ts` | `triggerFullSync` | `POST` | `/api/v1/seller/shops/{shopId}/sync/full` | `SyncController#triggerFullSync` | Full import job |
| `core/api/seller-sync-api.service.ts` | `triggerIncrementalSync` | `POST` | `/api/v1/seller/shops/{shopId}/sync/update` | `SyncController#triggerUpdateSync` | Frontend sends `syncType: INCREMENTAL` |
| `core/api/seller-sync-api.service.ts` | `updateSyncSettings` | `PUT` | `/api/v1/seller/shops/{shopId}/sync/settings` | `SyncController#updateSettings` | Interval and pause flag |
| `core/api/seller-wb-api.service.ts` | `getIntegration` | `GET` | `/api/v1/seller/shops/{shopId}/integration` | `WbIntegrationController#getIntegration` | Integration state |
| `core/api/seller-wb-api.service.ts` | `updateApiKey` | `PUT` | `/api/v1/seller/shops/{shopId}/api-key` | `WbIntegrationController#updateApiKey` | Updates Wildberries API key |

## Admin

| Frontend file | Method | HTTP | Endpoint | Backend match | Notes |
| --- | --- | --- | --- | --- | --- |
| `core/api/admin-api.service.ts` | `getPendingSellers` | `GET` | `/api/v1/admin/sellers/pending` | `SellerAdminController#getPendingSellers` | Pending approval queue |
| `core/api/admin-api.service.ts` | `approveSeller` | `POST` | `/api/v1/admin/sellers/{sellerProfileId}/approve` | `SellerAdminController#approveSeller` | Seller approval |
| `core/api/admin-api.service.ts` | `rejectSeller` | `POST` | `/api/v1/admin/sellers/{sellerProfileId}/reject` | `SellerAdminController#rejectSeller` | Body may include reason |

## Backend Endpoints Present but Not Evidently Used by Angular Services
- `/api/v1/public/shops/{shopSlug}`
- `/api/v1/public/shops/{shopSlug}/products`
- `/api/v1/public/catalog/products/by-wb-id/{nmId}`

These may be reserved for future use, legacy flows, or indirect usage outside the typed service layer.
