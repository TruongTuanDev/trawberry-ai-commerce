# Full Commerce Flow Audit

## WB Selected nmID Real Lookup Fix Addendum

- verified a direct read-only WB Cards List diagnostic finds nmIDs `955686992` and `982708059` on the first descending page
- confirmed the app bug was selected-sync ordering/pagination rather than token access or missing WB cards
- verified the built app `WbApiClientService` now finds both nmIDs with exact `String(card.nmID)` matching after scanning 1 page / 100 cards
- verified selected lookup keeps a stable page size after an early match so a remaining nmID is not skipped by a false last-page condition
- verified no sync-all action, database write, product persistence, or unrelated commerce business logic was used during real API QA

## Seller Production UX and WB nmID Selected Sync Addendum

- verified Seller desktop and mobile navigation no longer render the sidebar search while preserving grouped navigation and active-route behavior
- verified Seller WB sync and AI image screens do not expose internal mock/simulation controls or wording; mock responses are blocked as unavailable on Seller production surfaces
- verified selected WB sync accepts numeric `Артикул WB / nmID`, exact-matches only `card.nmID`, and does not match an unrelated card whose `vendorCode` happens to equal the requested nmID
- verified invalid-only selected input fails before card retrieval and selected sync never falls back to sync-all
- verified real selected sync uses WB Cards List retrieval plus local exact nmID filtering; sync-all remains unchanged
- verified product import remains private by default and public marketplace readiness, checkout, order, cart, payment, shipping, campaign billing, recommendations, and AI Try-On business rules are unchanged
- automated verification used safe mocks and did not call the real WB API or OpenAI API

## AI Try-On Real Demo Models Addendum

- verified the public AI Try-On modal no longer depends on silhouette placeholder model cards
- verified the built-in model catalog is now a shared backend-to-frontend contract with 10 real assets
- verified the backend still validates `selectedModelId` against the shared built-in model list
- verified the worker path needed an asset-origin fix:
  - built-in model image URLs are frontend public assets
  - worker-side ai-service requests should not resolve those relative paths against the backend host
  - the worker now resolves them against `FRONTEND_URL` / `PUBLIC_SITE_URL`
- verified non-goals:
  - no business-rule change to AI Try-On eligibility
  - no paid OpenAI smoke
  - no removal of the custom user photo upload path

## AI Try-On Product Availability Sync Addendum

- verified the admin AI settings flow previously updated only the settings row and not the denormalized `products.ai_try_on_enabled` gate
- verified this created a real false-negative path in production:
  - admin selected category ids in AI settings
  - `supportedCategories` persisted correctly
  - products in those categories still had `aiTryOnEnabled = false`
  - public AI Try-On requests remained blocked as unsupported
- verified the active fix updates settings and product availability together in one backend transaction
- verified the new synchronization policy:
  - selected category ids => matching products enabled
  - non-selected or null category ids => matching products disabled
  - empty supported-category selection => eligible public-ready products with images enabled
- verified the admin UI now receives a synchronization summary and can confirm the product availability refresh to the operator
- verified non-goals:
  - no paid OpenAI smoke
  - no direct production SQL requirement for the main admin save path
  - no seller/catalog business rule rewrite outside AI Try-On availability

## AI Try-On Category Id Support Addendum

- verified the active AI Try-On settings contract can store category ids and not only legacy category slugs
- verified the runtime gate must treat `product.categoryId` as the primary fast-path when admin settings already contain ids such as `1010` or `1040`
- verified legacy unsynced products still require a bridge:
  - if `product.categoryId` is null
  - but `product.categoryName` or `product.sourceCategoryName` matches an existing `Category.name`
  - runtime should still resolve that category and avoid a false unsupported result
- added a conservative operational script `npm run categories:link-products` for exact-match linking of legacy products to existing categories without creating new categories

## Catalog Filter Dropdown Overlay Addendum

- verified the catalog/search filter row renders multiple inline dropdowns from a shared page-level implementation in `frontend-next/src/app/products/page.tsx`
- verified the overlay issue was caused by stacking context, not filter business logic:
  - filter bar blur styling created a local stacking context
  - dropdown panels were visually constrained below later sibling product content
- verified the fix is UI-layer-only:
  - no catalog filtering logic change
  - no search param contract change
  - no product-card data contract change
  - no header routing/session/cart behavior change
- verified non-goals:
  - no backend change
  - no portal migration required for this fix
  - no public design-system rewrite

## AI Try-On Supported Category Selector Addendum

- verified admin AI settings no longer depend on free-text category entry for the primary workflow
- verified canonical supported-category slugs remain the persisted contract even after the admin UI change
- verified backward compatibility for legacy values:
  - comma-separated stored strings are parsed
  - aliases normalize to canonical slugs
  - unknown legacy values can be preserved intentionally instead of being dropped silently
- verified backend product support checks now match category aliases and phrase-like names, including Russian apparel names
- verified the public AI try-on unsupported-product state now maps by error code to localized EN/RU copy instead of rendering the raw backend English message
- verified non-goals:
  - no paid OpenAI smoke
  - no seller catalog/category business-rule rewrite
  - no legacy app changes
  - no change to backend authority over public AI try-on eligibility

## Customer Auth I18n Addendum

- verified customer login/register no longer surface mixed-language raw backend strings in the public UI
- verified expired customer sessions now redirect through the customer login path with localized EN/RU messaging
- verified customer auth error mapping covers:
  - invalid credentials
  - duplicate email
  - duplicate phone
  - network failure
  - expired or invalid customer session
  - invalid phone/email/password validation cases
- verified frontend API base URL normalization now strips duplicated `/api` suffixes and avoids insecure client fallback on HTTPS pages
- verified targeted browser coverage exists for customer auth i18n through:
  - `tests/e2e/customer-auth-i18n.spec.ts`
  - `tests/e2e/i18n-public-customer.spec.ts`
- residual audit note:
  - additional customer account screens still need a wider pass to remove direct `error.message` rendering outside the auth-specific scope

## GitHub Actions CD To VPS Addendum

- verified the active release path now supports a dedicated CD workflow separate from CI
- verified deploy flow is image-based and GHCR-backed:
  - `backend-nest`
  - `frontend-next`
  - `ai-service`
  - `nginx`
- verified deployment is gated on successful CI for the same commit
- verified the VPS deploy path:
  - does not overwrite `infra/.env.production`
  - does not delete persistent volumes
  - does not run `docker system prune -a`
  - does not expose `ai-service` publicly
- verified image selection is override-based through `infra/.env.deploy`, leaving the production env file stable
- verified production smoke remains login-free and OpenAI-free after deploy
- verified rollback guidance now exists for:
  - previous image SHA selection
  - compose restart using prior image tags
  - database restore caveat when schema compatibility is broken

## GitHub Actions CI Foundation Addendum

- verified the active marketplace stack now has a dedicated GitHub Actions workflow for the current delivery path only:
  - `backend-nest`
  - `frontend-next`
  - `ai-service`
  - `infra`
- verified CI does not require production secrets or a real `.env` file
- verified CI defaults remain mock-safe:
  - no paid OpenAI smoke
  - no real Wildberries API sync
  - no real delivery provider calls
- verified backend CI isolates to targeted specs instead of the broader unstable full suite
- verified compose validation covers both:
  - local compose contract
  - production compose contract
- verified production Docker image build is separated and runs only on `push main`
- verified repository safety checks now fail if tracked git content includes:
  - `.env`
  - `data.xlsx`
  - Playwright/test artifacts

## Production Docker Deployment Foundation Addendum

- verified the active release path now has a dedicated production compose file separate from local development compose
- verified production topology keeps only the reverse proxy public while `backend-nest`, `ai-service`, PostgreSQL, Redis, and MinIO remain Docker-internal
- verified named persistence volumes are defined for:
  - PostgreSQL
  - Redis
  - MinIO
- verified production compose avoids source bind mounts for application services
- verified health checks exist for:
  - frontend
  - backend
  - ai-service
  - PostgreSQL
  - Redis
  - MinIO
- verified deployment runbooks now cover:
  - VPS sizing
  - firewall and SSH guidance
  - domain mapping
  - HTTPS options
  - backup and restore
  - AI Try-On production-safe defaults
- verified non-goals:
  - no commerce business rule change
  - no new payment provider
  - no public exposure of internal services
  - no secret material committed into git

## AI Try-On OpenAI Provider Phase 2 Addendum

- verified `openai` mode now routes from `frontend-next` to `backend-nest` to `ai-service` and into the real OpenAI image-edit provider path
- verified provider secrets remain isolated to `ai-service`
- verified admin settings expose only safe runtime state, never the raw API key
- verified failed provider states map to stable customer-safe error codes:
  - `AI_PROVIDER_NOT_CONFIGURED`
  - `AI_TRY_ON_IMAGE_UNSUITABLE`
  - `AI_PROVIDER_ERROR`
  - `AI_TIMEOUT`
- verified mock/demo try-on modes still complete locally and preserve Phase 1 demo stability
- verified built-in model references are now raster PNG assets so they are consumable by the real provider path
- verified task polling continues to expose stored result image metadata and failed-task diagnostics without crashing the public product flow
- verified non-goals:
  - no promise of perfect garment fidelity or size accuracy
  - no frontend-side OpenAI calls
  - no secret exposure in public/customer/admin responses

## AI Try-On MVP Addendum

- verified public product detail now exposes an AI Try-On CTA without opening a new tab
- verified disabled state remains user-visible and returns under-development feedback instead of hiding the CTA
- verified enabled state requires an explicit size click before the modal opens, preserving existing product purchase flow behavior
- verified modal flow includes:
  - body profile fields
  - built-in model picker
  - optional customer reference upload
  - consent gating
  - product preview
  - result polling
- verified backend is the source of truth for:
  - enable/disable
  - provider mode
  - supported categories
  - consent requirement
  - guest/customer daily limits
  - task status and result metadata
- verified ai-service now owns provider selection for try-on generation with `mock`, `demo`, and `openai` paths
- verified OpenAI API keys remain server-side only and are not exposed through the frontend
- verified size recommendation is deterministic and explainable rather than opaque AI-only sizing
- verified current non-goals:
  - no real garment try-on OpenAI pipeline in Phase 1
  - no seller Center product toggle UI yet
  - no promise of fit accuracy beyond reference guidance

## Admin Operations English-only Cleanup Addendum

- verified admin operations UI remains English-only after the cleanup
- verified cleanup scope is presentation-only:
  - no seller/customer locale policy expansion
  - no payment, fulfillment, Yandex, return, or moderation business logic change
- verified admin-only visible raw states now map to readable English labels on:
  - `/admin/sellers`
  - `/admin/sellers/[id]`
  - seller fee supervision
  - `/admin/deliveries`
  - payments supervision
  - returns / refunds / disputes
  - `/admin/messages`
  - `/admin/reviews`
  - `/admin/support-cases`
- verified touched admin regressions remain stable without depending on mutable human copy where a selector or raw status contract is safer:
  - seller fee dashboard assertion aligned to current English UI
  - admin delivery supervision read-only assertions narrowed to delivery-page scope
  - admin fulfillment supervision no longer fails on teardown-only manual page close
  - product reviews empty-state assertion now tolerates duplicated shell rendering by using the first matching test id
  - notifications role-layout test timeout increased to avoid false negatives during multi-role setup
- verified runtime admin route smoke checks returned healthy responses for:
  - `/admin/dashboard`
  - `/admin/deliveries`
  - `/admin/reviews`
  - `/admin/messages`
  - `/admin/notifications`

## Seller Remaining Operations i18n Cleanup Addendum

- verified seller remaining operational screens now live-switch correctly in `ru`, `en`, and `vi`:
  - `/seller/support-cases`
  - `/seller/onboarding`
  - `/seller/pending`
  - `/seller/import/wildberries`
  - `/seller/import/wildberries-api`
  - `/seller/messages`
  - `/seller/reviews`
- verified cleanup scope is UI-only:
  - support-case status and sender-role rendering changed to dictionary-backed labels
  - onboarding/pending approval and next-step chrome changed to dictionary-backed labels
  - Wildberries import pages changed only visible placeholders and headings, not import/sync behavior
  - seller message list status chips changed only visible labels, not thread ownership or reply flow
- verified seller messaging business regression remains selector-based rather than locale-text based
- verified frontend Docker runtime now builds without external Google Fonts fetches, removing a non-business runtime blocker from seller route verification
- verified no customer/public or admin behavior was expanded in this phase

## Product Reviews UX Polish + Review Photo Upload Addendum

- verified review flow now supports optional customer review photos
- verified review business rules remain unchanged:
  - verified purchase only
  - delivered/completed order only
  - one review per order item/customer
- verified customer review UX:
  - star-icon rating input
  - explicit required comment text
  - custom localized photo picker
  - preview and remove-before-submit
- verified public product review rendering now includes:
  - aggregate summary card
  - star filter chips
  - review image thumbnails
  - seller reply block
- verified moderation effect:
  - hidden reviews remove both text and images from public surfaces
  - restored reviews become public again
  - hidden reviews do not affect public aggregates
- verified seller/admin internal review visibility:
  - seller review list shows customer photo thumbnails
  - admin review moderation list shows customer photo thumbnails

## Buyer-Seller Messaging MVP Addendum

- buyers can now start a conversation with a shop from:
  - public shop profile
  - public product detail
- guest behavior is verified:
  - guest click redirects to customer login with `next` and `intent=message`
- authenticated customer flow is verified:
  - create thread
  - read thread list and detail
  - send follow-up messages
  - report thread
- seller flow is verified:
  - seller can only access threads for owned shops
  - seller sees unread customer thread state
  - seller can reply
  - seller can close a thread
- admin moderation flow is verified:
  - admin can list reported threads
  - admin can open thread detail
  - admin can close or reopen a thread
- notification flow is verified:
  - seller receives `MESSAGE_RECEIVED` after customer message
  - customer receives `MESSAGE_RECEIVED` after seller reply
  - admin receives `MESSAGE_REPORTED` after customer report
- verified non-goals:
  - no realtime websocket
  - no file attachments UI
  - no external messaging provider
  - no private seller contact exposure through the public shop profile CTA

## Product Reviews & Ratings Addendum

- customers can now create verified product reviews only after a delivered/completed purchase
- verified review eligibility is enforced by backend order ownership and order-item checks
- public product detail now shows:
  - real review list
  - verified purchase badge
  - seller reply when present
  - rating summary aggregated from published reviews only
- public product cards now show real rating summary when available
- public shop profiles now use real aggregated review ratings instead of placeholder-only rating state
- seller can now view and reply to reviews from `/seller/reviews`
- admin can now moderate reviews from `/admin/reviews` by hiding or restoring them
- hidden reviews are removed from public product and shop aggregates
- no fake ratings are generated anywhere in this flow

## Public Shop Profile Addendum

- buyers can now open a public shop profile route at `/shops/[slug]` from marketplace product surfaces
- public shop profile reads only public-safe data from active approved shops
- verified shop product grid behavior:
  - uses the same public visibility rules as the marketplace catalog
  - excludes hidden, invalid, deleted, or out-of-stock products
  - reuses the existing public product list contract through `shopSlug`
- verified public-safe metadata:
  - shop name
  - slug
  - logo/avatar when present
  - verification state
  - joined date
  - pickup city / location label when public-safe
  - placeholder-safe rating summary
- verified non-goals:
  - no private seller phone/email exposure
  - no warehouse/private full address exposure
  - no finance, commission, or payment-proof exposure
  - no real messaging implementation

## Seller Printable Shipping Label Addendum

- seller order detail now supports an internal printable shipping label flow for manual Yandex operations
- verified route:
  - `/seller/orders/[id]/shipping-label`
- verified print behavior:
  - label preview centered on screen
  - seller shell/sidebar/header hidden from the print page output
  - print stylesheet targets `100mm x 150mm`
- verified label payload sources:
  - existing seller order detail API
  - existing seller delivery detail data
  - existing seller delivery settings data for pickup origin context
- verified label content:
  - order code
  - recipient name/phone/address snapshot
  - sender/pickup summary
  - manual Yandex id when present
  - payment method/status
  - package summary
  - QR to public tracking lookup
- verified business isolation:
  - no order lifecycle mutation was added
  - no payment review logic changed
  - no real Yandex API call or official provider label generation was introduced

## Seller Payment Settings + Products i18n Addendum

- seller payment settings now render role-based localized copy in `ru`, `en`, and `vi` on the active frontend runtime
- seller product list filter toolbar is now a client-subscribed locale surface:
  - search placeholder
  - status filter
  - stock-state filter
  - apply-filters CTA
- seller shop switcher helper text now follows seller locale state
- seller product metadata form no longer exposes hard-coded English labels for local title/description, SEO slug, visibility, and save states
- no seller business logic changed:
  - product visibility/readiness rules remain unchanged
  - product delete/update logic remains unchanged
  - payment-settings save/upload behavior remains unchanged

## Customer Account i18n Cleanup Addendum

- customer notifications route now uses customer-shell dictionary keys for the page frame instead of server-hard-coded Vietnamese text
- customer returns/refunds now use localized RU/EN UI chrome for:
  - page frame
  - form labels
  - helper text
  - detail metrics
  - case actions
  - file upload trigger/empty filename state
- customer order detail support section and public receipt lookup now render localized account-level labels while preserving existing API and business behavior
- no checkout, return/refund, support, or session business logic changed in this cleanup

## Customer Account i18n Addendum

- customer auth and account surfaces now follow the buyer locale policy:
  - supported locales: `ru`, `en`
  - default locale: `ru`
  - no Vietnamese option in buyer UI
- verified customer-localized surfaces:
  - `/customer/login`
  - `/customer/register`
  - `/customer/account`
  - `/customer/account/addresses`
  - `/customer/account/security`
  - `/customer/account/support`
  - `/customer/orders`
  - `/customer/orders/[checkoutCode]`
  - `/customer/returns`
- customer business flows remain locale-agnostic in regression coverage:
  - account management uses stable field and badge test ids
  - return / refund status assertions use raw `data-status`
  - notification regression checks role-level visibility and actions instead of localized copy bodies
- no customer backend contract or business rule changed:
  - register still redirects to `/customer/login?registered=1`
  - session refresh behavior is unchanged
  - checkout address readiness rules remain backend-authoritative
  - order, return, refund, and support flows preserve existing business logic

## Seller Workspace Hydration Addendum

- seller operational pages now tolerate direct deep links and page refreshes without assuming `currentShopId` is already present in the client workspace store
- seller detail flows resolve the owning shop from seller-accessible detail APIs and then synchronize the workspace store after the payload is loaded
- verified restored paths:
  - seller payment review detail from direct URL
  - seller orders board after refresh with persisted locale
  - seller finance dashboard metrics after login/refresh
  - seller product detail and images routes in lifecycle E2E
- locale switching remains orthogonal to auth/session/shop hydration:
  - seller default `ru`
  - seller switch `ru -> vi -> en` persists after refresh
  - no regression to payment/order/delivery contracts was observed in required seller regression suites

## Admin Fulfillment Supervision Addendum

- admin supervision now follows the same normalized fulfillment buckets already released on the seller side
- `/admin/deliveries` is now an order-level fulfillment board instead of primarily a raw delivery queue
- admin can search by seller, shop, order, and buyer while also filtering by payment status, delivery status, provider, date range, and overdue state
- admin still reuses shipment-level override endpoints for in-delivery, delivered, and cancelled transitions, so seller and admin act on the same delivery state
- internal seller reminders for missing manual Yandex creation remain available and are still non-external audit events only

## Seller Payment Review And Fulfillment Addendum

- seller proof review is now an explicit queue instead of an incidental state mixed into the fulfillment board
- seller confirmation of payment proof still drives the same backend payment transition, but the UI now immediately removes the item from the review queue and treats the order as fulfillment-ready
- seller fulfillment buckets now map raw order + delivery states into operational buckets:
  - `NEW`
  - `ASSEMBLING`
  - `IN_TRANSIT`
  - `COMPLETED`
  - `CANCELLED`
  - `ARCHIVED`
- buyer public order tracking now shows a friendlier fulfillment label instead of only raw internal status values
- archived seller orders are kept in the same order domain instead of creating a separate storage flow

## Session Auto Refresh Addendum

- protected customer, seller, and admin routes now tolerate expired role access cookies when the matching role refresh cookie is still valid
- the frontend retries a protected request once after silent refresh and only redirects to login after refresh failure
- refresh is role-aware and role-isolated:
  - customer refresh uses only customer refresh cookies
  - seller refresh uses only seller refresh cookies
  - admin refresh uses only admin refresh cookies
- register flow remains separate from session establishment and still redirects to login without auto-login

## Register To Login Flow Addendum

- customer register now creates the account, shows a success toast, and redirects to `/customer/login?registered=1`
- seller register now creates the account, shows a success toast, and redirects to `/seller/login?registered=1`
- no frontend auto-login happens after register
- no immediate `/api/auth/customer/me` or `/api/auth/seller/me` call is part of the successful register path
- unauthorized session messaging is now reserved for session restoration and protected-route checks, not public registration forms

## Global Action Feedback, Toast & Refresh Policy Addendum

- Implemented a global Toast Notification system with action-level visual overlays (`toast-success`, `toast-error`).
- Standardized visual action feedback states (`isRunning`) and Vietnamese loading labels: Save (`Đang lưu...`), Submit (`Đang gửi...`), Confirm (`Đang xác nhận...`), Upload (`Đang tải lên...`), Checkout (`Đang tạo đơn...`), Delete (`Đang xóa...`), Mark delivered (`Đang cập nhật...`).
- Added window-level confirmation dialogs (`window.confirm`) to protect critical/destructive actions (delete address, cancel order, reject payment/return, archive product, mark delivered, override refund, mark invoice paid, generate invoice).
- Enforced strict UX policies: success actions trigger immediate page data refreshes, preventing stale UI.
- Integrated error maps to translate generic HTTP status codes (401, 403, 409, 429, 500) into friendly Vietnamese notifications.
- Resolved dynamic Next.js chunk singleton state duplication by storing toast listeners and state globally on the `window` object.
- Patched all affected Playwright E2E tests (`customer-account.spec.ts`, `return-refund-dispute.spec.ts`, `seller-fee-dashboard.spec.ts`) to handle confirm dialogs and avoid strict mode violations.
- Verification targets: `test:e2e:action-feedback`, `test:e2e:customer-account`, `test:e2e:seller-fee-dashboard`, `test:e2e:return-refund-dispute`, `test:e2e:three-role-demo`, `test:e2e:public-full`, and `test:e2e:marketplace-search-filter-sort`.

## Return / Refund / Dispute Addendum

- customer can now open a return/refund/dispute case from order detail
- seller can review case context, respond, request evidence, reject, or mark refund sent
- admin can review marketplace-wide return cases and issue a decision
- manual refund transfer confirmation now feeds finance adjustment logic
- seller fee due decreases only after refund confirmation, not merely after approval

## Three Role Order Sync Addendum

- customer checkout visibility, seller order visibility, and admin supervision are now explicitly tied together through role-aware status projection
- seller order list/detail now surfaces the next operational action instead of raw internal-only status combinations
- admin seller management now exposes status tabs, search, counts, and seller finance/order summary
- admin payment supervision now shows whether seller final confirmation has already generated a finance ledger row
- finance hook remains:
  - prepaid seller QR -> ledger on seller confirmed prepaid payment
  - pay on delivery seller QR -> ledger on seller confirmed delivery payment
  - deposit then delivery -> ledger on seller confirmed final payment

## Seller Manual Yandex Delivery Workbench Addendum

- direct-seller payment confirmation can now move Yandex-preferred orders into `READY_TO_CREATE_YANDEX`
- seller order detail now supports a manual Yandex workbench instead of only a generic manual tracking form
- seller can save:
  - pickup / dropoff / package context
  - manual Yandex order id / claim id
  - courier identity
  - ETA and delivery price
  - note and tracking link
- seller/admin can move manual Yandex shipment states through:
  - `YANDEX_MANUAL_CREATED`
  - `COURIER_ASSIGNED`
  - `PICKED_UP`
  - `ON_THE_WAY`
  - `DELIVERED`
  - `FAILED`
  - `CANCELLED`
- admin supervision now has two important manual-ops queues:
  - `READY_TO_CREATE_YANDEX`
  - `OVERDUE`
- buyer tracking now shows a simpler manual Yandex timeline instead of only raw provider status

## Customer Account Management Addendum

- customer profile, password change, and saved-address management are now implemented in the active new stack
- logged-in customers now have a dedicated account area at `/customer/account`
- existing customer order history and parent receipt detail remain intact and are linked from the same account shell
- checkout now supports optional saved-address selection through `addressId` without removing the manual-address path
- seller/admin sessions still do not gain access to customer account functionality

## Auth UX Separation Addendum

- Public `/`, `/products`, `/cart`, and `/checkout` now expose customer and seller entry points only.
- Admin login remains operational at `/admin-login` and is intentionally absent from public marketplace navigation.
- Customer auth flow:
  - register/login by email or phone
  - redirect to `/customer/orders`
- Seller auth flow:
  - register/login by email or phone
  - redirect to `/seller/onboarding` until approved, then `/seller/dashboard`
- Compatibility staff login `/login` still works for seller/admin test flows.

## Cart Reliability Addendum

- Added backend preflight endpoint `POST /api/public/cart/validate`.
- `/cart` now catches stale items before customer enters final checkout submit.
- `/checkout` reruns preflight immediately before order creation.
- Final checkout validation remains server-side and authoritative.

## Public Buying UX Addendum

Date: 2026-05-17

- public marketplace card/detail UX was upgraded to a Wildberries-inspired marketplace layout without copying assets
- `/products` now exposes clear quick-cart vs select-size behavior
- `/products/[id]` now uses:
  - gallery thumbnails
  - size pills with disabled out-of-stock variants
  - quantity stepper
  - sticky purchase card
  - `Добавить в корзину`
  - `Купить сейчас`
- cart and checkout domain flow stayed the same; only public buying ergonomics changed
- focused verification pass:
  - `npm run test:e2e:product-buying-ux`
  - `npm run test:e2e:cart-checkout`
  - `npm run test:e2e:multi-shop-checkout`
  - `npm run test:e2e:marketplace-search-filter-sort`

Date: 2026-05-13

Scope: `frontend-next`, `backend-nest`, `ai-service`, and Docker runtime. Legacy apps `strawberry-frontend` and `strawberry-backend` were intentionally not modified.

## Seller Catalog Curation Addendum

- WB import and WB API sync no longer publish products directly to the public marketplace.
- Imported products now land in seller catalog status `IMPORTED`.
- Seller must review readiness and explicitly publish products before they appear on `/products` or become checkout-eligible.
- Unpublish and archive remove products from public listing and checkout immediately.
- Seller bulk editing now covers category, price, stock, and optional `publishIfReady` from `/seller/products`.

## Category Mapping + Search/Filter/Sort

- Category mapping preserves WB source category while adding internal `categoryId`.
- Unmapped categories produce `UNMAPPED_CATEGORY` warnings.
- Public catalog search/filter/sort is verified by `smoke:marketplace-search` and `test:e2e:marketplace-search-filter-sort`.
- Price sorting uses the minimum active variant price; checkout still recalculates totals.

## 1. Executive Summary

Overall result: **PASS for the current MVP/demo flow; PARTIAL for production readiness**.

The practical seller-to-customer path is now verifiable end to end in the new stack: public product browse, checkout, stock deduction, order tracking, payment proof upload, seller payment review, mark paid, mock delivery shipment, seller status update, and customer tracking refresh all pass through automated checks.

Seller-managed manual delivery is now supported for the current no-credentials operating model: sellers create shipments in Yandex/CDEK dashboards outside the system, paste tracking data into seller order detail, and admins supervise paid orders without delivery from `/admin/deliveries`.

Wildberries import is also covered end to end by `npm run smoke:wb-import-checkout` and `npm run test:e2e:wb-import-checkout`: approved seller import, `REMOTE_URL` images, seller price/stock update, public catalog eligibility, customer checkout, stock deduction, order tracking, seller order/payment visibility, and re-import idempotency.

Strong points:
- Docker runtime is healthy for frontend, backend, AI service, Postgres, Redis, and MinIO.
- Backend module tests and smoke scripts cover checkout, order tracking, payments, inventory, low-stock alerts, and mock delivery.
- Browser E2E now covers auth cookies, public catalog, public checkout/proof, seller payment review, and full commerce payment/delivery/fulfillment.
- Secrets are kept out of tracked files by current `git ls-files` checks; `.env` files are ignored.

Still missing or partial:
- Seller approval admin API/UI and KYC onboarding are now implemented; production readiness still needs notification workflows, retention policy, and broader admin audit coverage.
- Seller create shop/product/product-image and delivery settings now have focused browser E2E coverage; full-commerce still uses API setup where that keeps the broader end-to-end scenario deterministic.
- Real payment provider integration is not implemented; manual transfer review is the verified path.
- Real Yandex/CDEK modes are skeleton/optional and were not called. Mock delivery is the verified default.
- OpenAI real image generation was not called during this audit by design.

Demo readiness: **Yes, demo-ready for the MVP using Docker, seeded demo data, manual payment, and mock delivery.**

## 2. Full End-to-End Flow Table

| Step | Actor | UI route/API endpoint | Status | Verification evidence | Notes |
|---|---|---|---|---|---|
| Seller register | Seller | `POST /api/auth/register`, `/login` | PASS | `backend-nest` tests; `npm run test:e2e:auth` registers via API and logs in through UI | Register creates active seller user with seller profile pending approval. |
| Seller approval | Admin | `/admin/sellers`, `/admin/sellers/[id]`, `/api/admin/sellers` | PASS | `npm run smoke:seller-approval`; `npm run smoke:seller-onboarding`; `npm run test:e2e:admin-seller-approval`; `npm run test:e2e:seller-onboarding` | Admin can list, review KYC, approve documents, approve sellers, reject sellers, and audit actions. Approval requires at least one approved KYC document. |
| Seller login | Seller | `/login`, `POST /api/auth/login` | PASS | `npm run test:e2e:auth`; `npm run test:e2e:full-commerce` | `httpOnly` auth cookie verified; no raw JWT in localStorage. |
| Seller create shop | Seller | `/seller/products`, `POST /api/shops` | PASS | `npm run test:e2e:seller-product-lifecycle`; backend tests | Browser E2E creates the seller's first shop from UI after API-only seller approval setup. |
| Seller onboarding/KYC | Seller/Admin | `/seller/onboarding`, `/admin/sellers/[id]`, onboarding/document APIs | PASS | `npm run smoke:seller-onboarding`; `npm run test:e2e:seller-onboarding`; backend Jest | Seller saves legal profile, uploads document, admin reviews document, audit log records review. |
| Seller delivery settings | Seller | `/seller/settings`, `GET/PATCH /api/shops/:shopId/delivery/settings` | PASS | `npm run smoke:delivery`; `npm run test:e2e:seller-delivery-settings`; `npm run test:e2e:full-commerce` API setup | Focused browser E2E saves and reloads pickup, carrier priority, and package defaults from UI. |
| Seller create product | Seller | `/seller/products`, `POST /api/shops/:shopId/products` | PASS | `npm run test:e2e:seller-product-lifecycle`; backend tests | Browser E2E creates a unique active product with initial price/stock variant. |
| Seller upload product image | Seller | `/seller/products/[id]/images`, `POST /api/shops/:shopId/products/:productId/images` | PASS | `npm run test:e2e:seller-product-lifecycle`; product image tests | Browser E2E uploads a PNG product image and verifies gallery card. |
| Seller inventory update | Seller | `/seller/products/[id]`, `PATCH /api/shops/:shopId/products/:productId/inventory` | PASS | `npm run smoke:inventory`; `npm run smoke:inventory-alerts`; `npm run test:e2e:seller-product-lifecycle` | Browser E2E updates stock before customer checkout. |
| Public product listing | Customer | `/products`, `GET /api/public/products` | PASS | `npm run test:e2e:public`; `npm run test:e2e:public-full`; `npm run test:e2e:full-commerce`; `npm run test:e2e:seller-product-lifecycle` | Search and product card selection verified, including seller-created product. |
| Product detail | Customer | `/products/[id]`, `GET /api/public/products/:productId` | PASS | `npm run test:e2e:public-full`; `npm run test:e2e:full-commerce`; `npm run test:e2e:seller-product-lifecycle` | Product heading, quantity, checkout CTA verified. |
| Customer checkout | Customer | `/checkout`, `POST /api/checkout/orders` | PASS | `npm run smoke:checkout`; `npm run test:e2e:public-full`; `npm run test:e2e:full-commerce`; `npm run test:e2e:seller-product-lifecycle` | Backend recalculates totals. |
| Stock deduction | System | Checkout transaction, public product API | PASS | `npm run smoke:inventory`; `npm run test:e2e:full-commerce` compares `availableQuantity` before/after | Atomic update protects against oversell. |
| Customer order tracking | Customer | `/orders/track`, `/orders/[id]`, `GET /api/public/orders/track` | PASS | `npm run smoke:order-tracking`; public/full/full-commerce E2E | Phone verification required. |
| Customer payment proof upload | Customer | `/orders/[id]`, `POST /api/public/orders/:orderId/payment-proof` | PASS | `npm run smoke:order-tracking`; public-full; public-payment-review; full-commerce | Upload is stored and visible to seller. |
| Seller orders list/detail | Seller | `/seller/orders`, `/seller/orders/[id]`, `GET /api/shops/:shopId/orders` | PASS | `npm run test:e2e:full-commerce`; `npm run test:e2e:seller-product-lifecycle`; `npm run smoke:checkout` seller visibility | Lifecycle E2E verifies seller sees order created for seller-created product. |
| Seller payment queue/detail | Seller | `/seller/payments`, `/seller/payments/[orderId]`, `GET /api/shops/:shopId/payments` | PASS | `npm run smoke:payments`; `npm run test:e2e:public-payment-review`; full-commerce | Payment proof link verified. |
| Seller mark paid | Seller | `POST /api/shops/:shopId/payments/:orderId/mark-paid` | PASS | `npm run smoke:payments`; payment-review E2E; full-commerce | Audit log created. |
| Delivery calculate/create/refresh | Seller | `/seller/orders/[id]`, delivery endpoints | PASS | `npm run smoke:delivery`; `npm run test:e2e:seller-delivery-settings`; `npm run test:e2e:full-commerce` | Browser E2E verifies same-city Yandex recommendation and mock shipment create/refresh. |
| Seller-managed manual delivery | Seller/Admin | `/seller/orders/[id]`, `/admin/deliveries`, manual delivery endpoints | PASS | `npm run smoke:manual-delivery`; `npm run smoke:admin-delivery-supervision`; `npm run test:e2e:manual-delivery`; `npm run test:e2e:admin-delivery-supervision` | Seller pastes Yandex/CDEK tracking data; admin monitors paid-without-delivery and can override status. |
| Customer sees delivery tracking | Customer | `/orders/[id]` | PASS | `npm run smoke:delivery`; `npm run test:e2e:seller-delivery-settings`; `npm run test:e2e:full-commerce` | Customer sees provider, `IN_TRANSIT`, and tracking link after seller refresh. |
| Seller order status update | Seller | `/seller/orders/[id]`, `PATCH /api/shops/:shopId/orders/:orderId/status` | PASS | `npm run test:e2e:full-commerce` | Full E2E updates to `ASSEMBLING` then `SHIPPING`. |
| Logout/session refresh | Seller | `/login`, `/seller/dashboard`, `POST /api/auth/logout` | PASS | `npm run test:e2e:auth` | Refresh/reload and protected redirect verified. |

## 3. API Coverage Table

| Method | Endpoint | Module | Auth required? | Tested by | Status |
|---|---|---|---|---|---|
| POST | `/api/auth/register` | Auth | No | Backend tests; `test:e2e:auth` setup | PASS |
| POST | `/api/auth/login` | Auth | No | Backend tests; auth/full-commerce E2E | PASS |
| POST | `/api/auth/refresh` | Auth | Refresh token | Backend tests | PASS |
| POST | `/api/auth/logout` | Auth | Cookie/session | `test:e2e:auth` | PASS |
| GET | `/api/auth/me` | Auth | Yes | Frontend auth bootstrap; tests | PASS |
| GET | `/api/users/me` | Users | Yes | Backend tests | PASS |
| POST | `/api/shops` | Shops | Yes | Backend tests | PASS |
| GET | `/api/shops` | Shops | Yes | Full-commerce setup; frontend seller shell | PASS |
| GET | `/api/shops/:shopId` | Shops | Yes + shop access | Backend tests | PASS |
| GET | `/api/shops/:shopId/products` | Products | Yes + shop access | Backend tests; frontend seller pages | PASS |
| POST | `/api/shops/:shopId/products` | Products | Yes + shop access | Backend tests | PASS |
| GET | `/api/shops/:shopId/products/:productId` | Products | Yes + shop access | Backend tests; seller product UI | PASS |
| PATCH | `/api/shops/:shopId/products/:productId` | Products | Yes + shop access | Backend tests; seller product UI | PASS |
| DELETE | `/api/shops/:shopId/products/:productId` | Products | Yes + shop access | Backend tests | PASS |
| GET | `/api/shops/:shopId/products/:productId/inventory` | Products | Yes + shop access | `smoke:inventory` | PASS |
| PATCH | `/api/shops/:shopId/products/:productId/inventory` | Products | Yes + shop access | `smoke:inventory`; `smoke:inventory-alerts` | PASS |
| GET | `/api/shops/:shopId/products/:productId/images` | Product images | Yes + shop access | Backend tests; seller image UI | PASS |
| POST | `/api/shops/:shopId/products/:productId/images` | Product images | Yes + shop access | Backend tests | PASS |
| PATCH | `/api/shops/:shopId/products/:productId/images/:imageId` | Product images | Yes + shop access | Backend tests | PASS |
| DELETE | `/api/shops/:shopId/products/:productId/images/:imageId` | Product images | Yes + shop access | Backend tests | PASS |
| GET | `/api/public/products` | Public products | No | Public/full/full-commerce E2E | PASS |
| GET | `/api/public/products/:productId` | Public products | No | Public/full/full-commerce E2E | PASS |
| POST | `/api/checkout/orders` | Checkout | Optional | `smoke:checkout`; public/full/full-commerce E2E | PASS |
| GET | `/api/public/orders/track` | Order tracking | No, phone required | `smoke:order-tracking`; E2E | PASS |
| GET | `/api/public/orders/:orderId/track` | Order tracking | No, phone required | Public/full/full-commerce E2E | PASS |
| POST | `/api/public/orders/:orderId/payment-proof` | Order tracking | No, phone required | `smoke:order-tracking`; E2E | PASS |
| GET | `/api/shops/:shopId/orders` | Orders | Yes + shop access | `smoke:checkout`; full-commerce E2E | PASS |
| GET | `/api/shops/:shopId/orders/:orderId` | Orders | Yes + shop access | `smoke:payments`; full-commerce E2E | PASS |
| PATCH | `/api/shops/:shopId/orders/:orderId/status` | Orders | Yes + shop access | Full-commerce E2E | PASS |
| GET | `/api/shops/:shopId/payments` | Payments | Yes + shop access | `smoke:payments`; payment pages | PASS |
| GET | `/api/shops/:shopId/payments/:orderId` | Payments | Yes + shop access | `smoke:payments`; payment-review/full-commerce E2E | PASS |
| POST | `/api/shops/:shopId/payments/:orderId/mark-paid` | Payments | Yes + shop access | `smoke:payments`; E2E | PASS |
| POST | `/api/shops/:shopId/payments/:orderId/reject` | Payments | Yes + shop access | Backend tests; `smoke:payments` | PASS |
| POST | `/api/shops/:shopId/payments/:orderId/notes` | Payments | Yes + shop access | `smoke:payments` | PASS |
| GET | `/api/shops/:shopId/delivery/settings` | Delivery | Yes + shop access | `smoke:delivery`; seller settings UI | PASS |
| PATCH | `/api/shops/:shopId/delivery/settings` | Delivery | Yes + shop access | `smoke:delivery`; full-commerce setup | PASS |
| POST | `/api/shops/:shopId/orders/:orderId/delivery/offers` | Delivery | Yes + shop access | `smoke:delivery`; full-commerce E2E | PASS |
| POST | `/api/shops/:shopId/orders/:orderId/delivery/shipments` | Delivery | Yes + shop access | `smoke:delivery`; full-commerce E2E | PASS |
| GET | `/api/shops/:shopId/orders/:orderId/delivery` | Delivery | Yes + shop access | `smoke:delivery`; order detail UI | PASS |
| POST | `/api/shops/:shopId/orders/:orderId/delivery/shipments/:shipmentId/refresh` | Delivery | Yes + shop access | `smoke:delivery`; full-commerce E2E | PASS |
| POST | `/api/shops/:shopId/orders/:orderId/delivery/shipments/:shipmentId/accept` | Delivery | Yes + shop access | Backend tests | PASS |
| POST | `/api/shops/:shopId/orders/:orderId/delivery/shipments/:shipmentId/cancel` | Delivery | Yes + shop access | Backend tests; smoke coverage | PASS |
| POST | `/api/files/upload-url` | Files | Yes | Backend module review | PARTIAL |
| GET | `/api/seller/onboarding/profile` | Seller onboarding | Seller | Backend Jest; `test:e2e:seller-onboarding` | PASS |
| PUT | `/api/seller/onboarding/profile` | Seller onboarding | Seller | Backend Jest; `smoke:seller-onboarding`; `test:e2e:seller-onboarding` | PASS |
| GET | `/api/seller/onboarding/documents` | Seller onboarding | Seller | Backend Jest; `smoke:seller-onboarding` | PASS |
| POST | `/api/seller/onboarding/documents` | Seller onboarding | Seller | Backend Jest; `smoke:seller-onboarding`; `test:e2e:seller-onboarding` | PASS |
| DELETE | `/api/seller/onboarding/documents/:documentId` | Seller onboarding | Seller | Backend Jest | PASS |
| GET | `/api/admin/sellers/:userId/onboarding` | Admin onboarding | Admin | Backend Jest; `smoke:seller-onboarding`; `test:e2e:seller-onboarding` | PASS |
| GET | `/api/admin/sellers/:userId/documents` | Admin onboarding | Admin | Backend Jest; frontend admin detail | PASS |
| POST | `/api/admin/sellers/:userId/documents/:documentId/approve` | Admin onboarding | Admin | Backend Jest; `smoke:seller-onboarding`; `test:e2e:seller-onboarding` | PASS |
| POST | `/api/admin/sellers/:userId/documents/:documentId/reject` | Admin onboarding | Admin | Backend Jest | PASS |
| GET | `/api/admin/audit-logs?targetUserId=...` | Admin audit logs | Admin | Backend Jest; `smoke:seller-onboarding`; `test:e2e:seller-onboarding` | PASS |

## 4. Frontend Coverage Table

| Route | Purpose | Tested by | Status | Notes |
|---|---|---|---|---|
| `/login` | Seller login | `test:e2e:auth`, full-commerce | PASS | Cookie login verified. |
| `/seller/dashboard` | Seller landing shell | `test:e2e:auth` | PASS | KPI content remains partly placeholder. |
| `/seller/products` | Seller product list/create/inventory alerts | `test:e2e:seller-product-lifecycle`; backend smoke | PASS | Browser E2E creates first shop and product from this page. |
| `/seller/products/[id]` | Seller product detail/inventory | `test:e2e:seller-product-lifecycle`; backend smoke | PASS | Browser E2E updates stock from detail UI. |
| `/seller/products/[id]/images` | Seller product image gallery/upload/AI attach | `test:e2e:seller-product-lifecycle`; backend tests | PASS | Browser E2E uploads product image; AI attach remains separately covered by API/module paths. |
| `/seller/orders` | Seller order queue | Full-commerce E2E; seller-product-lifecycle E2E | PASS | Search and detail navigation verified; lifecycle test verifies seller-created product order appears. |
| `/seller/orders/[id]` | Seller order detail, delivery, status update | Full-commerce E2E; seller-delivery-settings E2E | PASS | Delivery calculate/create/refresh and status update verified. |
| `/seller/payments` | Seller payment queue | Frontend build; payment module smoke | PARTIAL | Detail flow is browser-tested; list smoke is API-level. |
| `/seller/payments/[orderId]` | Seller payment detail/review | Payment-review E2E; full-commerce E2E | PASS | Proof visibility and mark-paid verified. |
| `/seller/onboarding` | Seller onboarding/KYC | `test:e2e:seller-onboarding` | PASS | Legal profile and document upload verified. |
| `/admin/sellers` | Admin seller queue | `test:e2e:admin-seller-approval` | PASS | Seller queue, filters, and review entry point verified. |
| `/admin/sellers/[id]` | Admin seller onboarding detail | `test:e2e:seller-onboarding` | PASS | Profile, documents, approve actions, and audit timeline verified. |
| `/products` | Public catalog | Public/full/full-commerce E2E | PASS | Search and card navigation verified. |
| `/products/[id]` | Public product detail | Public-full/full-commerce E2E | PASS | Quantity and checkout CTA verified. |
| `/checkout` | Customer checkout | Public-full/full-commerce E2E | PASS | Manual-transfer order creation verified. |
| `/orders/track` | Public tracking lookup | Public smoke/payment-review | PASS | Lookup by order code + phone verified. |
| `/orders/[id]` | Public tracking detail/proof/delivery | Public-full/payment-review/full-commerce E2E | PASS | Payment, proof, delivery, and order status verified. |
| `/seller/settings` | Seller delivery settings | `test:e2e:seller-delivery-settings`; delivery API smoke | PASS | Browser E2E saves/reloads pickup, carrier priority, enabled carriers, and package defaults. |

## 5. Existing Smoke/E2E Coverage

| Script | Current coverage | Gaps | Status |
|---|---|---|---|
| `npm run smoke:checkout` | Seller auth/setup, product/order creation, anonymous checkout, seller order visibility | Browser UI not included | PASS |
| `npm run smoke:order-tracking` | Checkout, public tracking, proof upload, seller proof visibility, mark paid, tracking sees paid | Browser UI not included | PASS |
| `npm run smoke:payments` | Pending payment list/detail, note, mark paid, audit log, cross-shop guard | Browser UI not included | PASS |
| `npm run smoke:inventory` | Inventory read/update, checkout stock deduction, insufficient stock, cross-shop guard | Browser UI not included | PASS |
| `npm run smoke:inventory-alerts` | Low/out/in-stock filters and stock status changes | Browser UI not included | PASS |
| `npm run smoke:delivery` | Delivery settings, Yandex-first mock offers, paid order shipment create/refresh, customer tracking delivery projection | Real Yandex/CDEK not included | PASS |
| `npm run smoke:seller-approval` | Seller registration pending, pending create-shop blocked, KYC document precondition, admin approve/reject, non-admin blocked | Browser UI only covered separately | PASS |
| `npm run smoke:seller-onboarding` | Seller profile save, document upload, admin onboarding view, document approve, seller approve, audit log, approved seller creates shop | Uses storage abstraction; no real external KYC provider | PASS |
| `npm run test:e2e:auth` | Browser login, cookie persistence, logout, protected redirect, no JWT localStorage | Does not create shop/product | PASS |
| `npm run test:e2e:admin-seller-approval` | Browser admin queue approval path | Uses API setup for KYC document precondition | PASS |
| `npm run test:e2e:seller-onboarding` | Browser seller onboarding submit/upload plus admin document/seller approval and audit view | Does not test document reject UI path in browser | PASS |
| `npm run test:e2e:public` | Public routes load and basic navigation | No checkout/payment | PASS |
| `npm run test:e2e:public-full` | Public browse/detail/checkout/tracking/proof | No seller review | PASS |
| `npm run test:e2e:public-payment-review` | Customer proof, seller payment detail, mark paid, customer sees paid | No delivery/status update | PASS |
| `npm run test:e2e:full-commerce` | Public browse/detail/checkout, stock deduction, proof, seller orders, seller payment review, mark paid, delivery create/refresh, seller status update, customer sees paid/delivery/shipping | Uses API setup for delivery settings and seeded product data | PASS |
| `npm run test:e2e:seller-product-lifecycle` | API creates/approves seller, then browser creates shop/product/image, updates stock, finds product publicly, checks out, tracks order, and verifies seller order queue | Seller approval/KYC is API setup to keep this test focused on seller operations UI | PASS |
| `npm run test:e2e:seller-delivery-settings` | API creates approved seller/shop/product/paid same-city order, then browser saves delivery settings, calculates recommended Yandex offer, creates/refreshes mock shipment, and verifies customer tracking delivery projection | Seller approval/KYC and paid order setup are API-driven to keep this test focused on delivery UI | PASS |

## 6. Gaps / Risks

- Browser E2E now creates a seller shop/product/image through UI and separately verifies seller delivery settings plus order delivery operations through UI. Seller registration/onboarding/admin approval is API setup in those focused tests; those UI paths are covered by `test:e2e:seller-onboarding`.
- Seller approval now has admin UI/API and KYC document review. Remaining production gaps are KYC retention/access policy, notifications, and wider admin audit coverage.
- Product image upload browser coverage exists for the seller lifecycle path; remaining image risks are production storage policy, moderation, and larger asset edge cases.
- Delivery real providers were not verified. Default verified mode is mock; Yandex/CDEK credentials and account/billing/address edge cases remain unproven.
- Payment is manual-review only. There is no real payment provider, capture, reconciliation, refund, or webhook path.
- OpenAI real mode was not called. Existing docs still treat mock/local-safe AI verification as the baseline; real OpenAI may be blocked by billing/quota in a separate environment.
- Inventory deducts at checkout and releases/restores through seller lifecycle paths, but multi-cart reservations, warehouse inventory, and inventory history ledger are not implemented.
- Order/payment data is demo-grade. Production hardening still needs idempotency keys, rate limits, audit retention policy, and stronger fraud/payment-proof validation.

## 7. Recommended Next Steps

1. Define KYC production retention, object access, encryption, and deletion policy.
2. Harden order/payment/inventory with idempotency keys, concurrency-focused tests, and payment-proof validation rules.
3. Add real Yandex mode verification only when a valid token, billing, and safe test addresses are available.
4. Add CI/CD to run backend tests/smoke and frontend Playwright against Docker.
5. Prepare VPS deployment with secret manager/env injection and non-demo seed strategy.
6. Revisit real AI/OpenAI and try-on only after core commerce and deployment are stable.

## Verification Commands Run

## Wildberries Excel Import Addition

- New seller flow:
  - open `/seller/import/wildberries`
  - upload WB `.xlsx`
  - preview products, variants, images, warnings, and errors
  - confirm import
  - imported products appear in `/seller/products`
- Isolation:
  - endpoints are guarded by JWT + shop access
  - service additionally requires seller role and `APPROVED` seller profile
  - confirm uses the saved import session for the same seller and shop
- Idempotency:
  - product match by seller SKU / external product id / WB nm id
  - variant match by barcode or size tuple
  - image match by URL

- `docker version`: PASS
- `docker compose version`: PASS
- `docker compose -f infra/docker-compose.yml --env-file infra/.env config`: PASS, output suppressed to avoid secret exposure
- `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build`: PASS
- `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`: PASS, all six core services healthy
- `curl.exe --ipv4 http://localhost:3001/api/health`: PASS
- `curl.exe --ipv4 -I http://localhost:3000/products`: PASS, HTTP 200
- `curl.exe --ipv4 http://localhost:8000/health`: PASS
- `backend-nest npm run prisma:generate`: PASS
- `backend-nest npm run prisma:db:push`: PASS
- `backend-nest npm run seed:demo`: PASS
- `backend-nest npm run lint`: PASS
- `backend-nest npm test -- --runInBand`: PASS, 13 suites / 73 tests
- `backend-nest npm run build`: PASS
- `backend-nest npm run smoke:checkout`: PASS
- `backend-nest npm run smoke:order-tracking`: PASS
- `backend-nest npm run smoke:payments`: PASS
- `backend-nest npm run smoke:inventory`: PASS
- `backend-nest npm run smoke:inventory-alerts`: PASS
- `backend-nest npm run smoke:delivery`: PASS
- `frontend-next npm run lint`: PASS
- `frontend-next npm run build`: PASS
- `frontend-next npm run test:e2e:auth`: PASS
- `frontend-next npm run test:e2e:public`: PASS
- `frontend-next npm run test:e2e:public-full`: PASS
- `frontend-next npm run test:e2e:public-payment-review`: PASS
- `frontend-next npm run test:e2e:full-commerce`: PASS
- `frontend-next npm run test:e2e:seller-product-lifecycle`: PASS
- `frontend-next npm run test:e2e:seller-delivery-settings`: PASS
# Delivery Exception Audit Addendum

Delivery exception operations write `delivery_events` audit rows:

- seller mark failed
- seller/admin comment added
- admin mark failed
- admin customer-visible message update
- admin status override

Internal comments are stored in `delivery_comments` with `visibility=INTERNAL`; customer-facing messages/comments use `CUSTOMER_VISIBLE`. Public tracking only reads customer-safe fields.
# Admin Dashboard Audit Addendum

Admin operations dashboard is read-only and admin-only. It aggregates operational counts from orders, payments, delivery shipments, inventory variants, seller profiles, delivery exceptions, payment review logs, and admin audit logs.

The dashboard does not create audit rows because it does not mutate state. It exposes existing latest admin audit actions for operational context.

# Admin Operational Queues Audit Addendum

Admin operational queues are read-only and admin-only. They expose seller, payment, delivery, and inventory worklists with SLA age calculations but do not mutate marketplace state.

No audit rows are created by queue reads. Follow-up actions still happen through existing seller approval, payment review, delivery supervision, and product/inventory flows, which keep their existing audit/event behavior.

# Admin Task Ownership Audit Addendum

Admin queue task ownership is admin-only and mutates only operational task metadata. It does not change the underlying seller, payment, order, delivery, or inventory business status by itself.

Ownership mutations create `admin_queue_task_events` rows and admin audit logs for:

- task creation
- assignment/reassignment
- unassignment
- status changes
- escalation

Only users with role `ADMIN` can be assigned to tasks. Sellers and customers receive `403` from task APIs through the admin guard.

# Admin Ops Reporting Audit Addendum

Admin Ops Reporting is read-only and admin-only. It exposes operational aggregates and row-level reports for SLA breaches, workload, delivery exceptions, and payment aging.

CSV exports use explicit column allowlists and do not include secrets, tokens, raw provider payloads, internal private files, or customer-invisible internal comments. CSV values are escaped for commas, quotes, and newlines and are capped at 5000 rows per export.

No audit rows are created by report reads or exports.

# Wildberries API Sync Audit Addendum

Legacy WB API code was audited read-only from `strawberry-backend/src/main/java/com/strawberry/ecommerce/wb`; no legacy files were changed.

New WB API sync lives only in `backend-nest` and `frontend-next`. Tests and smoke use mock mode and do not call the real Wildberries API. WB API keys are shop-scoped, never returned to clients, never logged, and real credential storage requires `WB_CREDENTIALS_ENCRYPTION_KEY`.
# Cart Checkout Audit Update

Phase Cart + Multi-item Checkout is implemented in the new stack only:

- `frontend-next` owns a localStorage cart, groups cart/checkout summary by shop, and submits multi-shop carts for split-order checkout.
- `backend-nest` accepts multi-item checkout payloads and recalculates trusted totals.
- Seller order detail, payment detail, and customer tracking render multiple order items.
- Legacy `strawberry-backend` and `strawberry-frontend` were not modified.

Future audit item: design an optional marketplace parent order for combined receipts/support. Current behavior automatically splits multi-shop carts into per-shop orders.

# Multi-shop Checkout Audit Update

- Backend `POST /api/checkout/orders` accepts items from multiple shops, validates all items before writes, creates a parent marketplace checkout receipt, creates one order per shop in one transaction, and returns `checkoutCode`, `orders[]`, `orderCodes[]`, and `grandTotal`.
- Existing single-order fields remain in the checkout response for backward compatibility.
- Seller order/payment queues remain shop-scoped, so sellers only see their own split order.
- Customer tracking remains per order code plus phone, while receipt lookup is available by checkout code plus phone.
- Logged-in customers can access `/customer/orders` and `/customer/orders/[checkoutCode]`.
- Verification targets: `backend-nest npm run smoke:customer-order-history`, `backend-nest npm run smoke:multi-shop-checkout`, `frontend-next npm run test:e2e:customer-order-history`, and `frontend-next npm run test:e2e:multi-shop-checkout`.

# Support Cases Audit Addendum

- Customer can open checkout-level and order-level support cases from `/customer/orders/[checkoutCode]`.
- Admin triages and replies from `/admin/support-cases`.
- Seller reads and replies from `/seller/support-cases`.
- Internal admin notes are never returned to customer or seller responses.
- Seller visibility remains constrained to the linked shop/order.
- Verification targets: `backend-nest/test/support-cases.e2e-spec.ts`, `backend-nest npm run smoke:support-cases`, and `frontend-next npm run test:e2e:support-cases`.

# Wildberries Real API Sync Audit Addendum

- Real WB sync is now explicit and shop-scoped:
  - `WB_SYNC_MODE=real`
  - saved encrypted credential per shop
  - `POST /api/shops/:shopId/wb-sync/credentials/verify`
- Real mode calls `POST /content/v2/get/cards/list` and paginates with WB cursor fields `updatedAt` and `nmID`.
- Real mode does not fall back to mock data after credential or API failure.
- Seller UI at `/seller/import/wildberries-api` now shows mode, connection state, `keyLast4`, verify status, and last sanitized error.
- Optional runtime verification is `backend-nest npm run smoke:wb-api-sync-real` with local env `WB_REAL_API_KEY`.

# Wildberries Selected-Code Sync Audit Addendum

- Seller UI at `/seller/import/wildberries-api` keeps sync-all separate and adds manual selected-code preview/import.
- `POST /api/shops/:shopId/wb-sync/products/by-codes` parses numeric WB nmIDs server-side, exact-matches `card.nmID`, and returns a structured normalized/matched/invalid/not-found summary without sync-all fallback.
- Input is capped at 5000 characters and 100 unique codes; empty or over-limit input cannot fall back to sync-all.
- Existing seller authentication, approved-seller check, `ShopAccessGuard`, per-shop encrypted WB credential, and product upsert behavior are reused.
- Automated tests stay in WB mock mode and do not call the real Wildberries API.

# Public Marketplace Contract Hardening Audit Addendum

- public visibility remains gated by `PUBLISHED` plus readiness
- fully out-of-stock tracked products are hidden from public list/detail
- mixed-stock products expose disabled out-of-stock variants safely in public detail
- checkout continues to reject invalid variant, unpublished, archived, missing-price, and over-stock requests
- header search, cart badge, and mobile sticky CTA now have dedicated regression coverage

# Public Marketplace Empty / Fallback Audit Addendum

- `/products` now distinguishes catalog-empty from search/filter no-result states
- no-result state exposes current filter summary and clear-filters action
- public and cart image fallback no longer depends on a remote placeholder provider
- product detail unavailable state is explicit for hidden/unpublished/nonexistent products
- mobile sticky CTA remains reachable without masking the fallback states above it

# Role-Based i18n Audit Addendum

- locale policy is now role-aware in `frontend-next` and does not expose admin locale switching in public navigation
- preferred locale can be stored in backend user state and in cookie fallback
- public/customer and seller locale switching is designed to avoid touching auth, cart, checkout, and order identifiers
- checkout/backend business rules remain source-of-truth and unchanged by locale switching
- dedicated locale E2E coverage is now passing after rebuilding the runtime and isolating locale state per browser context
- public runtime default is Russian when no user preference and no locale cookie exist
- seller runtime supports `ru -> vi -> en` switching with persistence
- admin runtime remains English-only with no language switcher

# Locale Switcher UX Audit Addendum

- seller and buyer/customer locale switching now use the same dropdown interaction model instead of always-visible pills
- live switch remains client-side, immediate, and cookie/profile-backed
- customer/public surfaces still do not expose `vi`
- seller surfaces still expose `ru/en/vi`
- auth, protected shell, cart, and notification bell flows were left unchanged by the switcher redesign

# Marketplace Final UX & Cleanup Audit Addendum

- dirty worktree cleanup preserved only active-stack marketplace stabilization changes and removed the unrelated deleted workspace artifact from the phase scope
- seller shipping-label regression root cause was auth compatibility drift on `/login`; seller/admin compatibility login now reapplies the role-specific cookie path before redirecting into protected workspaces
- customer locale switching audit found duplicate canonical locale-switcher ids across public and account shells; the customer-safe canonical id is now single-instance again
- seller locale switching audit found the dropdown menu could sit under page action bars on product operations screens; seller shell header stacking now keeps the locale menu above content
- runtime route checks for `/products`, `/shops/demo-shop`, `/customer/messages`, `/seller/messages`, `/admin/messages`, and `/seller/orders` returned healthy HTML from the rebuilt runtime
- focused marketplace UX regressions for reviews, messaging, public shops, shipping label, action feedback, notifications, and role-based locale behavior are now passing against the current runtime
- seller order detail now live-switches correctly in `ru/en/vi`, and its business E2E contracts use raw status attributes instead of translated labels

# Shipping Label Print Audit Addendum

- printable seller shipping labels now expose size-aware routes via `/seller/orders/[id]/shipping-label?size=75x120|100x150|a6`
- seller order detail and the label page both keep the same selected size, with client-side persistence only; no fulfillment or Yandex business logic changed
- the print DOM is constrained to a single internal marketplace label container, and the label keeps sender, recipient, address/access, manual Yandex reference, order code, and QR data visible in the supported sizes
- the label now also renders a thermal-printer-friendly barcode strip and internal sorting code derived from live order identifiers rather than mock data
- the latest polish layer remaps raw failure-like shipment states into print-friendly handoff states and surfaces delivery type, created-at, postal-code, and sender-phone fields for warehouse operations without touching routing or fulfillment logic
- the label continues to state that it is not an official Yandex label

# Admin-managed Public Homepage Image Slider Audit Addendum

- **Aesthetics & Visuality**: Public homepage hero slider now uses rich image visuals (desktop and mobile specific) instead of generic text/cards. Visual enhancements include a dark gradient overlay for text readability, interactive micro-animations (hover pause, dot states), and glassmorphic navigation arrows.
- **Admin Management Operations**: Admin can view, create, edit, delete, toggle active status, reorder (via up/down buttons), upload JPG/PNG/WEBP desktop/mobile assets (up to 5MB, no SVG/video), and view a visual slide preview.
- **Publish Window Logic**: Public display of slides is strictly gated by `isActive = true` and current time matching the publish window (between `startsAt` and `endsAt` if set). Invalid publish windows (startsAt > endsAt) are rejected by backend validation.
- **Graceful Fallback**: If no active slides exist within their publish windows, the homepage displays a premium styled fallback banner using localized English/Russian texts without breaking the homepage layout.
- **Responsive Layout**: Slides are fully responsive. Mobile viewports display the `imageMobileUrl` (or fall back to `imageDesktopUrl`), and no horizontal overflow is present on either public storefront or admin console views.

# Catalog Dropdown Overlay And WB Category Facet Audit Addendum

- public catalog filter overlays now stay above suggestion chips and the product grid via the shared filter-row stacking treatment; the bug source was the filter bar stacking context combined with sibling grid painting below it
- the public catalog filter row now includes a visible `Category / Категория` dropdown that reuses the same overlay behavior as sort, color, brand, price, and other filter popovers
- public category facets are now derived from public-ready products only and prefer WB source category data when available:
  - `sourceCategoryName` is the primary display label
  - `subjectId` becomes the stable canonical slug as `wb-subject-<subjectId>` when present
  - internal category name/slug and mapped `categoryName` remain fallbacks for non-WB or legacy products
- public `categorySlug` filtering no longer depends solely on internal `category.slug`; it now matches through the same canonical category resolver and also tolerates legacy slug-style links
- current frontend/runtime verification for the overlay flow still needs a stable Playwright-visible public catalog state before the new UI interaction test can pass end-to-end

# Catalog CategoryName Audit Addendum

- public catalog category facets now use `Product.categoryName` as the source of truth for category labels and counts on marketplace-visible products
- null or empty `categoryName` values are excluded from the public category dataset, so the dropdown only represents real visible catalog categories
- category filtering now compares against the normalized `categoryName` value itself, which keeps Russian names such as `Шорты` intact instead of requiring WB-subject-derived slugs to exist in the database

# Category Source Of Truth Audit Addendum

- the active marketplace stack now treats the normalized `Category` relation as the primary category source for catalog filters, admin AI supported category selection, and AI Try-On runtime checks
- `Product.categoryName` and `Product.sourceCategoryName` remain compatibility mirrors only; they are still read as fallback inputs when a legacy product has not yet been linked to `Category`
- seller/manual product create-update paths and WB import/sync flows now route category assignment through `CategoriesService.resolveCategoryAssignment(...)`, which can reuse an existing category or create one safely by normalized name
- Admin AI Settings now consumes a real admin category list with product counts and saves selected category ids when a category match exists, while preserving unmapped legacy values separately instead of silently dropping them
- AI Try-On support evaluation now expands stored category ids back into related category names/slugs and still understands legacy alias strings, so a saved admin selection and a product category relation stay consistent even during legacy backfill
- a one-time `npm run categories:sync` backfill is available to migrate historical products that still only hold denormalized category text into linked `Category` rows without deleting old data

# Backend Production Start Path Audit Addendum

- the production backend container failure was caused by an entrypoint mismatch, not by Prisma or database readiness
- NestJS compiles this repository to `dist/src/main.js`, while the production container had been starting `node dist/main`
- the production bootstrap path is now aligned in both `backend-nest/package.json` and `backend-nest/Dockerfile`, while preserving the existing `prisma db push` pre-start behavior

# Customer And Seller Information Reuse Audit Addendum

- `User` remains the account identity source for name, email, and phone.
- `CustomerAddress` remains the customer delivery-default source; new address forms now use account name/phone only as editable defaults.
- Authenticated checkout continues to select a delivery-ready saved address, while guest checkout continues to accept explicit contact/address input.
- Checkout and split orders continue to store purchase-time contact, address, price, and item snapshots; profile edits do not rewrite historical orders.
- `SellerProfile` remains the seller legal/contact/bank onboarding source, with `User` identity used only when onboarding contact fields are missing or blank.
- Existing `ShopPaymentSetting` and `ShopDeliverySetting` records remain authoritative. Seller onboarding data is used only for first-use form prefill.
- Seller delivery/payment APIs remain shop-owner guarded, customer profile/address APIs remain customer scoped, and public tracking remains phone-gated.
- No new full-address, payment, or contact data is stored in local storage, and no public API response was expanded with private profile data.

# Order Ops QA.1 Audit Addendum

- Multi-shop checkout continues to create one parent checkout receipt and one shop-scoped child order per seller in a single transaction; sellers only process their own child orders and items.
- Seller order fulfillment remains guarded as `PENDING/NEW -> ASSEMBLING -> SHIPPING -> DELIVERED`; seller payment confirmation is a separate guarded workflow.
- Prepaid/manual payments can move from pending/unpaid to paid or rejected. Seller QR pay-on-delivery moves from selected to seller accepted, then after delivery to buyer marked paid/seller confirmed or delivery payment rejected.
- Seller/admin payment confirmation and rejection now atomically claim the observed payment status before audit-log, seller-ledger, and customer-notification side effects.
- Final paid/rejected decisions cannot be reversed directly, cancelled orders cannot be marked paid directly, and delivery payment cannot be finalized before delivery.
- Public tracking still requires the exact order phone. It exposes customer-relevant status, tracking, payment instructions, proof, and customer-visible delivery messages, but suppresses seller/admin review notes and identities plus internal delivery/provider/pickup/package fields.
- Campaign charging, recommendation attribution/tracking, seller wallet behavior, product detail, AI Try-On, and WB sync are unchanged by this audit.

# Buyer Public UX FIX.1 Audit Addendum

- Public/customer locale support is now `ru/en/vi`; switching remains cookie/local-storage/profile backed and does not alter cart, auth, checkout, order, payment, or shipping identifiers.
- The public shop route `/shops/[slug]` now renders application-owned labels and joined dates in the selected locale and maps load failures to localized safe copy instead of exposing backend messages.
- Buyer/Public dictionary scans report no corrupted `????` or replacement-character strings across EN/RU/VI.
- Public homepage Vietnamese content uses localized generic slide fallback text because the existing admin slide contract stores only RU/EN fields.
- A mocked FORMELA-style shop regression verifies RU/EN/VI copy and no horizontal overflow at 390, 768, and 1440 pixel widths.
- Public product readiness, visibility, price, stock, checkout splitting, payment review, fulfillment, WB sync, and AI Try-On execution logic remain unchanged.
