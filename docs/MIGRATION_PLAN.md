# Migration Plan

## Scope
Phase 0 only documents the current system and proposes a migration path from:

- Angular SSR frontend to Next.js
- Spring Boot backend to NestJS
- monolithic image-related logic to a dedicated AI service for image generation and virtual try-on
- current infra toward PostgreSQL, Redis, BullMQ, and S3/MinIO aligned services

No business logic is changed in this phase.

## Current System Summary

### Frontend
- Primary app: Angular SSR application in `strawberry-frontend`
- Secondary app target: `projects/seller-portal` exists as a separate Angular application target, but the main business flows currently live in the primary app
- Main UI domains:
  - storefront
  - seller workspace
  - admin

### Backend
- Spring Boot monolith in `strawberry-backend`
- PostgreSQL is the system of record
- RabbitMQ is used for sync job orchestration
- Cloudinary is used for receipt and media upload
- API is grouped by:
  - `/api/v1/auth`
  - `/api/v1/public`
  - `/api/v1/customer`
  - `/api/v1/seller`
  - `/api/v1/admin`

## Existing Modules

### Frontend modules
- `core/auth`: login state, token persistence, role handling
- `core/api`: typed API clients for catalog, seller products, seller orders, seller shipments, seller sync, seller Wildberries, admin
- `core/services`: cart, orders, favorites, shipping, shops, seller dashboard, toast, shop context
- `features/storefront`: home, catalog, product detail, brand pages, auth, favorites, cart, checkout, payment confirmation, orders
- `features/seller`: workspace entry, create shop, dashboard, products, pricing, inventory, orders, payments, shipments, sync, settings
- `features/admin`: admin login, dashboard, seller approvals
- SSR runtime: `src/server.ts`, `src/main.server.ts`

### Backend modules
- `auth`: login, seller registration, customer registration, JWT
- `user`: user, role, status
- `seller`: seller profile, workspace, admin seller approval
- `shop`: shop CRUD, shop ownership, dashboard, public shop views
- `catalog`: categories, products, variants, images, characteristics, pricing, inventory, search, reviews, favorites, recommendations
- `cart`: cart and cart items
- `order`: checkout, orders, order items, payment confirmations, seller payment review
- `shipping`: zones, methods, rates, shipments, delivery issues, tracking
- `sync`: sync jobs, history, health, scheduler, RabbitMQ producer/consumer
- `wb`: Wildberries integration and import bridge
- `audit`: audit logs
- `common`: security, exception handling, crypto, Cloudinary adapter

## Key Angular to Spring Boot API Surface
Detailed map is in [API_MAP_OLD.md](./API_MAP_OLD.md).

High-level groups currently used by Angular:

- Auth
  - login
  - register customer
  - register seller
- Public catalog
  - product listing
  - product detail
  - filters
  - categories
  - reviews
  - recommendations
- Customer commerce
  - cart
  - checkout
  - orders
  - payment confirmation upload
  - delivery issue report
  - review submission
  - favorites
- Seller workspace
  - seller workspace status
  - shops CRUD and activation
  - dashboard
  - products, pricing, inventory
  - payments and order management
  - shipments and delivery issue handling
  - sync operations
  - Wildberries integration
- Admin
  - pending seller list
  - approve seller
  - reject seller

## Main Database Entities

### Identity and access
- `User`
- `SellerProfile`
- enums: `Role`, `UserStatus`

### Shop and seller workspace
- `Shop`
- `ShopWbIntegration`
- enum: `ShopStatus`

### Catalog
- `Category`
- `Product`
- `ProductVariant`
- `ProductVariantSku`
- `ProductImage`
- `ProductCharacteristic`
- `ProductTag`
- `Review`
- `FavoriteProduct`

### Customer cart and ordering
- `Cart`
- `CartItem`
- `Order`
- `OrderItem`
- `PaymentConfirmation`
- enums: `OrderStatus`, `PaymentStatus`

### Shipping and fulfillment
- `ShippingZone`
- `ShippingMethod`
- `ShippingRate`
- `Shipment`
- `DeliveryIssueReport`
- enums: `ShipmentStatus`, `DeliveryIssueStatus`

### Sync and operations
- `SyncJob`
- `SyncJobLog`
- `AuditLog`
- enums: `SyncStatus`, `SyncType`, `TriggerType`, `SyncLogLevel`

## Migration Principles

### Non-breaking rules
- Keep PostgreSQL as the shared source of truth in early phases
- Do not dual-rewrite business logic blindly; use a strangler pattern
- Prefer routing by module or route group, not mixed logic inside one request path
- Start with read-heavy modules before write-heavy modules
- Keep old Spring Boot endpoints alive until Next.js and NestJS replacements are proven
- Introduce new infra alongside the old stack before cutting traffic

### Target architecture
- `next-web`: customer, seller, and admin UIs in Next.js App Router
- `nest-api`: modular backend replacing Spring Boot domain-by-domain
- `ai-service`: isolated service for image generation and try-on workflows
- `postgres`: shared relational database during transition
- `redis`: cache, sessions if needed, and BullMQ transport
- `bullmq`: background jobs replacing RabbitMQ-bound sync jobs gradually
- `s3/minio`: object storage for receipts, catalog assets, AI outputs, try-on artifacts
- optional edge/proxy layer:
  - route `/api/v1/...` between old Spring and new Nest modules
  - route frontend pages between Angular and Next.js during cutover

## Recommended Migration Order

### Phase 0: Discovery and mapping
- Inventory current frontend modules, backend modules, APIs, and entities
- Produce migration docs and module boundaries
- Decide canonical domain names for Nest modules and Next app routes

### Phase 1: Platform foundation
- Create workspace-level architecture docs and contracts
- Stand up new shared infra:
  - PostgreSQL access policy
  - Redis
  - S3/MinIO
  - BullMQ
- Add a gateway or reverse proxy for controlled routing
- Set up observability and request correlation across old and new services

### Phase 2: Shared contracts and compatibility layer
- Freeze old API behavior by documenting request and response contracts
- Define NestJS DTOs that mirror existing Spring Boot responses first
- Introduce shared auth strategy:
  - either validate old JWTs in NestJS
  - or issue JWTs from a new auth layer while Spring accepts them during coexistence
- Add storage abstraction so Cloudinary-backed flows can later move to S3/MinIO

### Phase 3: Migrate public read paths first
- Move storefront read-only pages to Next.js:
  - home
  - catalog
  - product detail
  - brand pages
- Implement matching read endpoints in NestJS for:
  - catalog
  - categories
  - filters
  - recommendations
  - reviews read
- Keep writes on Spring Boot

Why first:
- lowest risk
- easiest SEO and SSR gains in Next.js
- no payment or order mutation involved

### Phase 4: Migrate customer account and low-risk writes
- Next.js:
  - login/register pages
  - favorites
  - cart
- NestJS:
  - auth compatibility
  - favorites
  - cart
- Keep checkout and order creation on Spring Boot until ordering logic is fully replicated

### Phase 5: Migrate seller read dashboards and shop management
- Next.js seller area:
  - workspace
  - shop switcher
  - dashboard
  - product list
  - inventory and pricing read views
- NestJS:
  - seller workspace
  - shops
  - dashboard
  - seller catalog read endpoints

Why before seller writes:
- seller UI can move incrementally while critical mutations stay on Spring

### Phase 6: Migrate catalog write management
- NestJS modules:
  - product metadata update
  - variant pricing update
  - variant inventory update
  - bulk pricing and bulk inventory
- Next.js seller UI for those flows
- Use database-backed parity checks and audit logs during coexistence

### Phase 7: Migrate orders, payment review, shipping
- NestJS modules:
  - checkout
  - customer orders
  - seller order operations
  - payment confirmation workflow
  - shipments
  - delivery issue handling
- Move receipt upload from Cloudinary adapter toward S3/MinIO abstraction

Why later:
- these are the highest-risk transactional modules
- they combine state transitions, seller review, and fulfillment

### Phase 8: Migrate sync and external integrations
- Replace RabbitMQ-driven sync orchestration with BullMQ where appropriate
- Rebuild Wildberries integration inside NestJS as a dedicated integration module
- Move scheduler logic and sync telemetry
- Keep sync writes idempotent and replayable

### Phase 9: Introduce AI service
- Build a separate `ai-service` instead of mixing with commerce APIs
- First responsibilities:
  - image generation jobs
  - try-on jobs
  - artifact storage in S3/MinIO
  - async status callbacks or polling
- Integrate from Next.js and NestJS through signed URLs and job IDs

Why separate:
- different scaling profile
- different dependencies
- easier GPU or model-specific deployment
- avoids contaminating commerce transaction paths

### Phase 10: Decommission old stack by module
- Cut traffic endpoint-by-endpoint or route-group-by-route-group
- Remove Angular pages after Next.js replacements are stable
- Remove Spring modules after NestJS parity and data validation are complete
- Keep the old database schema until the new schema strategy is proven in production

## Recommended NestJS Module Breakdown
- `auth`
- `users`
- `seller-profiles`
- `shops`
- `catalog`
- `categories`
- `favorites`
- `reviews`
- `cart`
- `orders`
- `payments`
- `shipping`
- `sync`
- `integrations/wildberries`
- `admin/seller-approvals`
- `audit`
- `storage`

## Recommended Next.js App Breakdown
- `(storefront)`
  - `/`
  - `/catalog`
  - `/products/[slug]`
  - `/brands/[brandName]`
  - `/favorites`
  - `/cart`
  - `/checkout`
  - `/orders`
- `(auth)`
  - `/login`
  - `/register`
  - `/seller/login`
  - `/seller/register`
  - `/admin/login`
- `(seller)`
  - `/seller`
  - `/seller/shops`
  - `/seller/shops/[shopId]/dashboard`
  - `/seller/shops/[shopId]/products`
  - `/seller/shops/[shopId]/inventory`
  - `/seller/shops/[shopId]/pricing`
  - `/seller/shops/[shopId]/orders`
  - `/seller/shops/[shopId]/payments`
  - `/seller/shops/[shopId]/shipments`
  - `/seller/shops/[shopId]/sync`
  - `/seller/shops/[shopId]/settings`
- `(admin)`
  - `/admin/dashboard`
  - `/admin/sellers`

## Highest-Risk Areas
- checkout and order state transitions
- manual payment confirmation and seller approval flow
- shipping and delivery issue state machine
- sync job orchestration and Wildberries integration
- auth token compatibility during coexistence
- file storage migration from Cloudinary to S3/MinIO

## Phase 0 Deliverables
- current module inventory
- Angular to Spring Boot API map
- main entity inventory
- proposed migration order
- phase report with checks run
