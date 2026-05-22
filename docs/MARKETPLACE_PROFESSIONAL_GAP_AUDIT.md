# Marketplace Professional Gap Audit

Audit date: 2026-05-22

Scope reviewed:
- `backend-nest`
- `frontend-next`
- `ai-service`
- `infra`
- `docs`
- `.github/workflows/ci.yml`

Out of scope for modification:
- `strawberry-backend`
- `strawberry-frontend`

Status legend:
- `PRODUCTION_READY`
- `MVP_WORKING`
- `MANUAL_WORKFLOW`
- `MOCK_ONLY`
- `UI_ONLY`
- `PARTIAL`
- `MISSING`
- `BLOCKER`

## Executive Summary

- Current app level: strong multi-seller marketplace MVP with unusually broad coverage for local/demo and internal operations.
- Demo readiness: yes.
- Internal operations readiness: yes, with manual SOPs.
- Production launch readiness: no.
- Overall professional marketplace readiness score: `46/100`.

Readiness breakdown:
- Buyer journey: `64/100`
- Seller journey: `58/100`
- Admin operations: `61/100`
- Catalog governance: `62/100`
- Checkout/order core: `67/100`
- Payment readiness: `18/100`
- Delivery readiness: `34/100`
- Security/compliance readiness: `52/100`
- DevOps/production readiness: `43/100`
- Growth features readiness: `20/100`

The system is already beyond a toy demo. Auth, seller onboarding, seller catalog curation, public marketplace, cart validation, multi-shop split checkout, customer account, support cases, manual payment review, manual delivery supervision, and admin ops all have real code paths plus meaningful backend and browser verification. The main gap is not breadth. The main gap is production-grade operational depth: real payment execution, seller finance, refund/dispute lifecycle, automated delivery integration, richer admin controls, compliance posture, and production platform hardening.

Update on 2026-05-22 after the seller finance phase:

- seller finance is no longer fully missing
- the stack now has:
  - shop commission settings
  - platform default commission
  - seller fee ledger entries
  - manual monthly invoices
  - seller dashboard metrics and seller finance UI
- remaining finance blocker is now narrower:
  - no payout execution
  - no seller balance / reserve management
  - no refund reconciliation automation
  - no bank auto-debit or settlement automation

### Top 10 Blockers

1. No real payment provider, webhook ingestion, settlement, retry, reconciliation, refund, or dispute execution.
2. Seller finance is incomplete: no commission engine, payout ledger, payout workflow, or seller balance accounting.
3. Returns/refunds are not implemented as a real order/payment lifecycle.
4. Delivery remains mostly manual or provider-skeleton based; no real automated Yandex/CDEK production loop is verified.
5. No production-grade category administration UI and limited catalog governance tooling.
6. No admin platform settings for fees, commissions, payout policy, or policy controls.
7. No notification backbone for email/SMS/Telegram or operational event delivery.
8. CSRF posture is still cookie-policy based; no synchronizer token or equivalent stronger protection.
9. Monitoring, alerting, backups, rollback, and production migration strategy are still partial.
10. Marketplace growth essentials are missing: reviews, ratings, wishlist, campaigns, coupons, seller storefront, loyalty.

### Top 10 Quick Wins

1. Add a dedicated refund/cancel domain model before real payment integration.
2. Add seller finance pages for balance, reserve, fees, and pending payouts even before real payout automation.
3. Add admin category and mapping UI on top of existing backend APIs.
4. Add seller KPI dashboard backed by live data instead of placeholder-style summaries.
5. Add customer self-service cancellation rules for early-order states.
6. Add attachments to support cases and refund evidence handling.
7. Add notification event abstraction even if first delivery channel is email-only.
8. Add CSRF hardening and admin/seller audit coverage expansion.
9. Add monitoring/error tracking/backups/runbook docs for VPS production.
10. Add reviews/ratings and wishlist to improve real buyer retention before advanced AI work.

## Feature Matrix

| Area | Feature | Status | Evidence | Risk | Priority | Recommended action |
|---|---|---:|---|---|---|---|
| Customer | Register/login | `MVP_WORKING` | `auth` module, `auth.e2e-spec.ts`, `auth-role-separation.spec.ts` | Medium | High | Keep flow; add password reset and stronger account recovery. |
| Customer | Multi-role session separation | `MVP_WORKING` | `auth-cookie.service.ts`, `multi-role-sessions.spec.ts` | Low | Medium | Keep; add broader session observability. |
| Customer | Profile/account/security | `MVP_WORKING` | `customer-account` module, `customer-account.spec.ts`, docs | Medium | High | Add password reset, email verification, account deletion policy. |
| Customer | Saved addresses | `MVP_WORKING` | `CustomerAddress`, checkout `addressId`, customer account E2E | Medium | High | Add normalized shipping-address history on orders. |
| Customer | Order history/receipt | `MVP_WORKING` | `customer-orders` module, `customer-order-history.spec.ts` | Medium | High | Add cancellation/refund states and payment timeline. |
| Customer | Public order tracking | `MVP_WORKING` | `order-tracking` module, public/full E2E | Medium | High | Add stronger anti-abuse and notification hooks. |
| Customer | Support cases | `MVP_WORKING` | `support-cases` module, smoke/E2E/docs | Medium | High | Add attachments, SLA, refund linkage, assignment workflow. |
| Customer | Cart + stale validation | `MVP_WORKING` | `cart-validation.service.ts`, cart validation E2E/docs | Low | High | Add idempotency key and stronger concurrency-focused tests. |
| Customer | Guest + logged-in checkout | `MVP_WORKING` | checkout module, public/full/cart/multi-shop E2E | Medium | High | Add payment orchestration and cancel policy. |
| Customer | Search/filter/sort | `MVP_WORKING` | public-products API, `marketplace-search-filter-sort.spec.ts` | Low | Medium | Keep; add search analytics and synonym handling later. |
| Customer | Product detail UX | `MVP_WORKING` | `public-product-detail-page-client.tsx`, `product-buying-ux.spec.ts` | Low | Medium | Keep; add richer merchandising later. |
| Customer | Reviews/ratings/questions | `PARTIAL` | `averageRating`/`feedbackCount` display only; no review domain found | High | Medium | Build review/question models, moderation, and submission flows. |
| Customer | Wishlist/favorites | `MISSING` | no backend/frontend capability found | Medium | Medium | Add favorites table and buyer save-for-later UX. |
| Customer | Notifications email/SMS | `MISSING` | no notification module/provider found | High | High | Add event-driven notification service. |
| Seller | Register/login | `MVP_WORKING` | auth module/tests | Medium | High | Add password reset and login anomaly controls. |
| Seller | Onboarding/KYC | `MVP_WORKING` | seller onboarding docs/tests/admin seller review | Medium | High | Add retention/access policy and notification workflow. |
| Seller | Seller approval | `MVP_WORKING` | admin sellers APIs/UI/tests | Medium | High | Add suspension/reactivation and broader compliance actions. |
| Seller | Shop creation/basic settings | `MVP_WORKING` | `shops` module, seller lifecycle tests, seller settings | Medium | High | Add richer public shop profile and legal/business settings. |
| Seller | WB API credentials per shop | `MVP_WORKING` | `wb-sync` service/docs/tests | Medium | High | Re-verify real mode and add sync observability/history UI. |
| Seller | WB import/sync | `PARTIAL` | `wb-imports`, `wb-sync`, smoke/E2E/docs | High | High | Real-mode runtime verification, sync history, diff preview, retry tooling. |
| Seller | Excel import | `MVP_WORKING` | `wb-import` module/tests/docs | Medium | Medium | Add file governance and large-file operational limits. |
| Seller | Private catalog vs public publish | `MVP_WORKING` | products/public-products modules, product curation docs/tests | Low | High | Keep strict gating; add moderation queue later. |
| Seller | Readiness/publish workflow | `MVP_WORKING` | product curation tests/docs | Medium | High | Add moderation/audit explanations and quality scoring. |
| Seller | Product images | `MVP_WORKING` | product-images module/tests/UI | Medium | Medium | Add image QA rules and moderation queue. |
| Seller | Bulk edit stock/price/category | `MVP_WORKING` | bulk update APIs, smoke/E2E/docs | Medium | Medium | Add bulk validation preview/export. |
| Seller | Inventory alerts | `MVP_WORKING` | inventory smokes, admin queues, seller product pages | Medium | Medium | Add notification hooks and reorder workflows. |
| Seller | Order management | `MVP_WORKING` | orders module, full-commerce, seller lifecycle, docs | Medium | High | Add cancel/return/refund operations and richer timelines. |
| Seller | Delivery ops | `MANUAL_WORKFLOW` | `SELLER_OPERATIONS.md`, manual delivery E2E, delivery module | High | High | Real provider execution or formal manual SOP tooling. |
| Seller | Payment review | `MVP_WORKING` | payments module, smoke/E2E/docs | Medium | High | Replace manual proof review with provider-backed settlement later. |
| Seller | Support case handling | `MVP_WORKING` | seller support case APIs/UI/E2E | Medium | High | Add deadlines, attachments, canned responses. |
| Seller | Analytics/dashboard KPI | `PARTIAL` | seller area exists; strong KPI coverage not evidenced | Medium | Medium | Build live revenue/orders/conversion/refund metrics. |
| Seller | Finance/payouts | `MISSING` | no payout or seller balance domain found | Blocker | Critical | Add ledger, reserve, fee, payout batch, payout state machine. |
| Seller | Commission/fees | `MISSING` | no commission engine/settings found | Blocker | Critical | Add fee model and settlement calculation. |
| Seller | Returns/refunds handling | `MISSING` | no seller refund/return workflow found | Blocker | Critical | Add seller response flow integrated with support/payments/orders. |
| Seller | Campaigns/promotions | `MISSING` | no promotion domain found | Medium | Low | Add after payment/delivery foundation. |
| Seller | Notification center | `MISSING` | no seller notifications inbox found | Medium | Medium | Add event inbox + email first. |
| Admin | Admin login hidden from public nav | `MVP_WORKING` | public header/auth separation docs/tests | Low | Medium | Keep. |
| Admin | Dashboard/queues/reports | `MVP_WORKING` | admin dashboard/queues/reports modules, smoke/E2E/docs | Medium | High | Add deeper operational actions and alerting. |
| Admin | Seller approval/KYC review | `MVP_WORKING` | admin sellers + audit logs + tests | Medium | High | Add suspension/blacklist/compliance review tooling. |
| Admin | Delivery supervision | `MVP_WORKING` | admin deliveries + exceptions docs/tests | Medium | High | Add provider event ingestion and root-cause metrics. |
| Admin | Support case management | `MVP_WORKING` | admin support APIs/UI/E2E | Medium | High | Add SLA engine, assignment automation, escalation policy. |
| Admin | Payment review | `PARTIAL` | admin sees payment queues in ops, no dedicated admin payment action UI | High | High | Decide whether admin should act directly on payments/refunds. |
| Admin | Refund/dispute management | `MISSING` | no refund execution flow or dispute tooling found | Blocker | Critical | Add refund, partial refund, escalation, seller liability handling. |
| Admin | Category mapping management | `PARTIAL` | backend categories APIs exist; frontend admin UI not evidenced | High | High | Build admin UI for categories and mappings. |
| Admin | User management | `PARTIAL` | auth/users exist; no broad admin user-management UI found | Medium | Medium | Add search, status change, support actions, lockout. |
| Admin | Product moderation | `PARTIAL` | publish readiness exists; moderation workflow not full | Medium | High | Add moderation queue, reject reasons, seller remediation loop. |
| Admin | Seller violation/suspension | `MISSING` | no violation/suspension workflow evidenced | High | High | Add seller enforcement controls. |
| Admin | Audit trail | `PARTIAL` | seller/doc approval and queue task logs exist; not platform-wide | Medium | High | Expand audit logs to payment, delivery, support, settings, catalog moderation. |
| Admin | Platform settings | `MISSING` | no settings domain for fees/policies/providers found | High | High | Add admin-configurable operational settings. |
| Admin | Commission/fee settings | `MISSING` | no evidence found | Blocker | Critical | Add fee catalog and policy versioning. |
| Admin | Payout management | `MISSING` | no evidence found | Blocker | Critical | Add payout operations before real launch. |
| Admin | Broadcast/notification tools | `MISSING` | no evidence found | Medium | Medium | Add notification campaigns only after event pipeline exists. |
| Admin | Fraud/risk review | `MISSING` | no evidence found | High | Medium | Add after payment provider and refund flows exist. |
| Catalog | Category tree | `MVP_WORKING` | categories module/docs/tests | Medium | High | Add admin UI and governance tools. |
| Catalog | WB -> internal mapping | `MVP_WORKING` | category-mapping e2e/docs | Medium | High | Add mapping maintenance UX and bulk tools. |
| Catalog | Attributes/spec normalization | `PARTIAL` | variants/images/basic fields exist; rich attribute normalization not evidenced | Medium | High | Add attribute schema per category. |
| Catalog | Variants/size/color | `MVP_WORKING` | products/public products/product buying UX | Medium | High | Add richer attribute filtering and seller validation. |
| Catalog | SEO fields/slugs | `PARTIAL` | fields exist; strong SEO ops not evidenced | Low | Low | Add seller/admin slug and SEO workflows later. |
| Catalog | Duplicate detection/idempotency | `MVP_WORKING` | WB import docs mention idempotent upsert by seller SKU | Medium | Medium | Add duplicate reporting/admin cleanup tools. |
| Catalog | Moderation/quality score | `PARTIAL` | readiness warnings exist; no full moderation scoreflow | Medium | High | Add quality score and moderation queue. |
| Orders | Multi-shop split + parent receipt | `MVP_WORKING` | checkout/customer orders docs/tests | Medium | High | Add parent-level payment/refund orchestration. |
| Orders | Stock deduction transactionality | `MVP_WORKING` | checkout docs/tests/transactions | Medium | High | Add dedicated concurrency stress tests. |
| Orders | Idempotency keys | `MISSING` | no idempotency key support evidenced | High | High | Add checkout/payment/delivery idempotency before production. |
| Orders | Cancellation policy | `PARTIAL` | seller status update allows some cancel paths; customer/self-service absent | High | High | Define cancel windows, restock rules, payment interactions. |
| Orders | Refund/return lifecycle | `MISSING` | support issue type exists, no order/payment lifecycle | Blocker | Critical | Add returns, RMAs, refund statuses, restock/disposal rules. |
| Orders | Invoice/receipt compliance | `PARTIAL` | parent receipt exists; tax/legal invoicing not evidenced | Medium | Medium | Add compliant invoice/receipt generation per market. |
| Payments | Manual proof upload/review | `MVP_WORKING` | payments/order tracking docs/tests | High | High | Keep only as bridge mode, not final production model. |
| Payments | Provider abstraction/webhooks | `MISSING` | docs explicitly say absent | Blocker | Critical | Add provider abstraction, webhooks, transaction ledger. |
| Payments | Refund/partial refund | `MISSING` | no implementation evidenced | Blocker | Critical | Add refund domain before launch. |
| Payments | Reconciliation | `MISSING` | no evidence found | Blocker | Critical | Add settlement and reconciliation pipeline. |
| Payments | Payout to sellers | `MISSING` | no evidence found | Blocker | Critical | Add seller settlement and payout controls. |
| Payments | Commission/fee calculation | `MISSING` | no evidence found | Blocker | Critical | Add fee engine tied to payouts. |
| Delivery | Mock mode | `MOCK_ONLY` | delivery docs, smoke default | Low | Medium | Keep for tests only. |
| Delivery | Yandex real | `PARTIAL` | provider/client skeleton and optional smoke | High | High | Run controlled real verification and finish operational hardening. |
| Delivery | CDEK real | `PARTIAL` | skeleton only by docs | High | High | Implement real create/track/cancel lifecycle. |
| Delivery | Seller-managed manual mode | `MANUAL_WORKFLOW` | manual delivery docs/tests | High | High | Formalize SOPs or automate carriers. |
| Delivery | Customer-visible tracking | `MVP_WORKING` | order tracking UI/module/tests | Medium | High | Add notifications and provider-sync automation. |
| Delivery | Shipping quote and SLA automation | `PARTIAL` | offer calculation exists in delivery module | Medium | Medium | Add real provider verification and fee policies. |
| Support | Case open/threading | `MVP_WORKING` | support-cases module/docs/tests | Medium | High | Add attachments and triage automation. |
| Support | Internal notes | `MVP_WORKING` | support docs + admin hidden messages | Low | Medium | Keep. |
| Support | Refund/dispute execution | `MISSING` | support only labels issue type | Blocker | Critical | Link support cases to payment/order resolution engine. |
| Support | SLA/assignment automation | `PARTIAL` | admin queue/task ownership exists, not support-specific | Medium | Medium | Add support queue SLA and assignee model. |
| AI | Seller AI image generation | `PARTIAL` | ai-images module, ai-service docs, seller AI E2E | Medium | Medium | Good seller utility; keep behind cost controls. |
| AI | Mock AI runtime | `MOCK_ONLY` | `AI_SERVICE_MOCK` docs/tests | Low | Medium | Keep for safe test path. |
| AI | OpenAI real | `PARTIAL` | opt-in docs/tests only | Medium | Low | Verify later after commerce blockers. |
| AI | AI SEO/title/description | `MISSING` | no evidence found | Low | Low | Nice-to-have after launch blockers. |
| AI | Try-on | `PARTIAL` | service contract hints; `tryOnReady=false` in health | Medium | Low | Treat as future R&D, not near-term launch. |
| Security | Role isolation/password hashing/rate limit | `MVP_WORKING` | auth/security docs/tests | Medium | High | Keep and expand around recovery. |
| Security | CSRF posture | `PARTIAL` | docs explicitly call it partial | High | High | Add synchronizer token or equivalent hardened pattern. |
| Security | KYC document access | `PARTIAL` | seller/admin constraints exist; retention policy absent | High | High | Define retention, purge, access review, audit policy. |
| Security | Secret management/.env safety | `MVP_WORKING` | `.env.example`, repo hygiene docs | Medium | High | Move to managed secrets in production. |
| Security | Admin permissions/RBAC depth | `PARTIAL` | admin-only guards exist, fine-grained RBAC not evidenced | Medium | Medium | Add role/permission matrix before team scale. |
| DevOps | Docker Compose local runtime | `MVP_WORKING` | deployment docs, health checks, current runtime | Medium | High | Separate production compose/helm/ansible path later. |
| DevOps | CI basic | `MVP_WORKING` | `.github/workflows/ci.yml` | Medium | High | Add smoke/E2E subset, docker runtime checks, deployment gates. |
| DevOps | Monitoring/error tracking | `MISSING` | no evidence found | High | High | Add logs, metrics, tracing, alerting. |
| DevOps | Backups/restore | `MISSING` | no evidence found | Blocker | Critical | Add DB backup/restore SOP before production. |
| DevOps | Rollback/deployment pipeline | `PARTIAL` | CI exists, no real deploy/rollback automation found | High | High | Add release pipeline and rollback runbook. |
| Growth | Coupons/promotions/campaigns | `MISSING` | no evidence found | Low | Low | After launch blockers. |
| Growth | Seller ads/recommendations | `MISSING` | no evidence found | Low | Low | Later growth phase. |
| Growth | Seller storefront/brand pages | `MISSING` | no evidence found | Medium | Medium | Good after payments/logistics are real. |
| Growth | Reviews/wishlist/loyalty | `MISSING` | no evidence found | Medium | Medium | Important for retention after checkout foundation. |
| Growth | CMS/banners/category landing pages | `PARTIAL` | promo slider exists, no CMS/backoffice | Low | Low | Add after merchandising needs mature. |

## Marketplace Flow Coverage

### Buyer Journey

- Register/login: covered and working, but still missing password reset, email verification, and stronger recovery controls.
- Browse/search/filter/sort: strong MVP and one of the best-covered parts of the app.
- Product detail: good MVP, variant-aware, mobile-friendly, real backend data.
- Cart: real and validated against backend.
- Checkout: real multi-shop split checkout with authoritative backend validation.
- Payment: manual only. This is the biggest buyer-side production gap.
- Delivery tracking: real customer-visible tracking exists, but delivery creation and status progression are still largely manual/provider-skeleton based.
- Support/refund: support case messaging exists; refund execution does not.

Buyer verdict:
- Enough for demo/internal pilot: yes.
- Enough for professional production marketplace: no.

Main buyer gaps versus Wildberries/Ozon/Amazon/Shopee:
- no real online payment
- no returns/refunds lifecycle
- no reviews/ratings/questions submission
- no wishlist/favorites
- no notifications
- no self-service cancellation rules
- no loyalty/coupon/promotion features

### Seller Journey

- Register/onboarding/approval: real and verified.
- Import/sync products: strong MVP, especially private-catalog-to-public pattern.
- Curate/publish: real and valuable.
- Manage stock/price: real.
- Receive orders: real.
- Fulfill delivery: only partly real; current operating model is manual/seller-managed.
- Handle payment/support: payment review and support reply exist; settlement/refund do not.
- Analytics/finance: weak.

Seller verdict:
- Seller can operate a shop for demo/internal manual ops: yes.
- Seller can operate a professional real commercial shop end to end: no.

Main seller gaps:
- finance, balances, fees, payouts
- refund/return handling
- richer KPI dashboard
- promotions/campaigns
- notification center
- public storefront/branding controls

### Admin Journey

- Approve sellers / review KYC: real.
- Supervise orders/payments/deliveries: partially real, especially as ops visibility.
- Support/disputes: support visible; disputes/refunds not fully operable.
- Reports/export: decent MVP.
- Platform configuration: weak.

Admin verdict:
- Enough to supervise a manual MVP marketplace: mostly yes.
- Enough to operate a professional marketplace at scale: no.

Main admin gaps:
- refund/dispute tooling
- payout tooling
- fee/commission settings
- category UI
- seller enforcement/suspension
- broader RBAC and audit coverage
- fraud/risk controls

## Missing Production Features

### Must-have before real launch

- real payment provider abstraction and webhook handling
- transaction ledger and reconciliation
- commission and fee engine
- seller balance and payout workflow
- refund and partial refund lifecycle
- return/dispute workflow
- real or formalized delivery execution model
- idempotency keys for checkout/payment/provider callbacks
- monitoring, backups, restore, rollback
- stronger CSRF/compliance posture

### Should-have soon

- admin category/category-mapping UI
- seller KPI and finance dashboard
- customer cancellation policy and status visibility
- support attachments and evidence workflow
- notifications via email first
- seller enforcement/suspension controls
- broader audit logging
- richer attribute normalization and moderation

### Nice-to-have later

- reviews/ratings/questions
- wishlist/favorites
- seller storefronts and brand pages
- coupons/promotions/campaigns
- loyalty/cashback
- recommendations and personalization
- AI SEO/content helpers

## Payment Readiness

Verdict: `BLOCKER`

Current state:
- manual transfer proof upload exists
- seller payment review exists
- admin visibility exists in ops reporting/queues
- no provider integration exists
- no webhook handling exists
- no refund lifecycle exists
- no payout lifecycle exists
- no commission/fee engine exists

For Russia-market launch, the next realistic step is not "add any provider quickly". The next realistic step is:
1. define a payment domain model with transaction, attempt, provider event, settlement, refund, fee, payout
2. integrate one primary provider for card/bank transfer collection
3. keep current manual proof flow only as fallback/offline mode

Recommended provider direction for Russian market:
- use a local/acquiring-compatible payment abstraction first
- keep provider choice configurable behind a provider adapter
- do not couple parent marketplace receipt logic directly to one gateway callback shape

Minimum payment foundation needed:
- `payment_transactions`
- `payment_attempts`
- `payment_provider_events`
- `refunds`
- `seller_ledger_entries`
- `payout_batches`
- idempotent webhook/event processing

## Delivery Readiness

Verdict: `PARTIAL`

Current state:
- manual seller-managed delivery is the true working operating mode
- mock provider path is the safe verified default
- Yandex real path is coded but not positioned as production-proven here
- CDEK real path is still skeleton/partial
- customer tracking exists
- admin supervision and exception views exist

Practical recommendation:
- if launch is near, choose one explicit mode:
  - manual delivery with strict SOPs and operational staffing
  - or one real provider path first, likely Yandex for intra-city
- use CDEK second for inter-city and pickup points after the first provider is stable

Missing for production:
- provider-grade shipment lifecycle
- webhook/polling ingestion
- return shipment logic
- cancellation synchronization
- delivery fee policy
- SLA breach automation

## Seller Operations Readiness

Verdict: `PARTIAL`

Strongest seller capabilities:
- onboarding/KYC/approval
- catalog import/curation
- publish readiness gating
- bulk stock/price/category management
- order visibility
- payment review

Weakest seller capabilities:
- finance and payouts
- returns/refunds
- promotions
- advanced analytics
- notifications

Conclusion:
- seller operations are strong for a curated marketplace MVP
- not yet sufficient for a seller to run a serious business entirely through the platform

## Customer Experience Readiness

Verdict: `PARTIAL`

Strongest buyer capabilities:
- real browse/search/filter/sort
- real product detail/cart/checkout
- multi-shop checkout and customer order history
- saved address support
- support case messaging

Weakest buyer capabilities:
- no real payment rails
- no returns/refunds
- no reviews/wishlist/notifications
- no loyalty/promotions

Conclusion:
- buyer UX is credible for demo and pilot usage
- not yet competitive with professional marketplaces

## Security/Compliance Readiness

Verdict: `PARTIAL`

Strengths:
- role isolation
- per-role cookies
- password hashing
- auth throttling
- cookie security flags
- KYC access scoping
- additive audit logging in several admin/payment areas

Main gaps:
- CSRF hardening remains partial
- no broader data retention/deletion policy
- no documented KYC retention schedule
- no fine-grained RBAC matrix
- no evidence of production monitoring/audit review process
- no evidence of privacy/data-subject operational tooling

Security blockers:
- not an immediate code-red vulnerability from evidence reviewed
- but launch-grade compliance and operational security are not finished

## DevOps/Deployment Readiness

Verdict: `PARTIAL`

What exists:
- Dockerfiles
- Docker Compose
- health checks
- basic GitHub Actions CI
- seed demo
- many smoke scripts
- strong automated regression coverage for an MVP

What is missing:
- production deployment pipeline
- backup/restore runbook
- monitoring/alerting
- rollback strategy
- production database migration strategy documentation with rollback rules
- environment promotion strategy

Can it deploy to a VPS now?
- technically yes
- operationally not safely enough for a professional marketplace launch

## Recommended Roadmap

### Phase 1 - Launch blockers

- payment foundation:
  - provider abstraction
  - payment transactions
  - webhook/event ingestion
  - reconciliation
- refund/dispute/return domain:
  - refund states
  - partial refund support
  - return merchandise workflow
  - seller/admin/customer visibility
- seller finance:
  - commission rules
  - seller balance ledger
  - payout batches
  - payout admin tools
- delivery launch strategy:
  - choose manual-SOP-first or Yandex-first
  - define one production-ready path
- idempotency/concurrency hardening:
  - checkout idempotency key
  - payment/provider idempotency
  - callback replay safety
- production ops foundation:
  - monitoring
  - backups
  - restore drills
  - rollback runbook

### Phase 2 - Seller and customer experience

- seller KPI dashboard
- customer cancellation rules
- support attachments and evidence
- notification foundation
- admin category UI
- product moderation queue
- richer catalog attribute normalization

### Phase 3 - Real integrations

- real payment provider
- Yandex real production path
- CDEK real production path
- controlled WB real verification and sync observability
- OpenAI real image generation hardening

### Phase 4 - Compliance, security, scale

- CSRF strengthening
- broader audit logs
- admin RBAC
- KYC retention/access policy
- privacy/data deletion operations
- performance profiling and scaling plan

### Phase 5 - Growth, AI, automation

- reviews/ratings/questions
- wishlist/favorites
- seller storefronts
- campaigns/coupons/promotions
- loyalty/cashback
- recommendations
- seller AI SEO/content helpers

## Evidence Reviewed

Docs:
- `docs/REALITY_AUDIT.md`
- `docs/FULL_FLOW_AUDIT.md`
- `docs/SECURITY.md`
- `docs/DEPLOYMENT.md`
- `docs/API_PAYMENTS.md`
- `docs/DELIVERY_PROVIDERS.md`
- `docs/SUPPORT_CASES.md`
- `docs/AI_SERVICE.md`
- `docs/CUSTOMER_ACCOUNT.md`
- `docs/SELLER_OPERATIONS.md`
- `docs/CART_CHECKOUT.md`
- `docs/API_ORDERS.md`
- `docs/PROJECT_STATUS.md`
- `docs/PHASE_REPORT.md`

Backend modules:
- `backend-nest/src/modules/auth`
- `backend-nest/src/modules/customer-account`
- `backend-nest/src/modules/customer-orders`
- `backend-nest/src/modules/checkout`
- `backend-nest/src/modules/delivery`
- `backend-nest/src/modules/orders`
- `backend-nest/src/modules/payments`
- `backend-nest/src/modules/products`
- `backend-nest/src/modules/public-products`
- `backend-nest/src/modules/seller-onboarding`
- `backend-nest/src/modules/support-cases`
- `backend-nest/src/modules/categories`
- `backend-nest/src/modules/wb-imports`
- `backend-nest/src/modules/wb-sync`
- `backend-nest/src/modules/admin`
- `backend-nest/src/modules/ai-images`

Backend tests and smoke surface:
- `backend-nest/test/auth.e2e-spec.ts`
- `backend-nest/test/checkout.e2e-spec.ts`
- `backend-nest/test/customer-account.e2e-spec.ts`
- `backend-nest/test/delivery.e2e-spec.ts`
- `backend-nest/test/orders.e2e-spec.ts`
- `backend-nest/test/payments.e2e-spec.ts`
- `backend-nest/test/public-products.e2e-spec.ts`
- `backend-nest/test/seller-onboarding.e2e-spec.ts`
- `backend-nest/test/support-cases.e2e-spec.ts`
- `backend-nest/test/wb-import.e2e-spec.ts`
- `backend-nest/test/wb-sync.e2e-spec.ts`
- `backend-nest/test/wb-product-sync.e2e-spec.ts`
- backend smoke scripts listed in `backend-nest/package.json`

Frontend routes and E2E:
- `frontend-next/tests/e2e/auth-role-separation.spec.ts`
- `frontend-next/tests/e2e/multi-role-sessions.spec.ts`
- `frontend-next/tests/e2e/cart-checkout.spec.ts`
- `frontend-next/tests/e2e/customer-account.spec.ts`
- `frontend-next/tests/e2e/customer-order-history.spec.ts`
- `frontend-next/tests/e2e/manual-delivery.spec.ts`
- `frontend-next/tests/e2e/multi-shop-checkout.spec.ts`
- `frontend-next/tests/e2e/product-buying-ux.spec.ts`
- `frontend-next/tests/e2e/public-full.spec.ts`
- `frontend-next/tests/e2e/public-marketplace-contract.spec.ts`
- `frontend-next/tests/e2e/public-smoke.spec.ts`
- `frontend-next/tests/e2e/seller-ai-images.spec.ts`
- `frontend-next/tests/e2e/seller-delivery-settings.spec.ts`
- `frontend-next/tests/e2e/seller-onboarding.spec.ts`
- `frontend-next/tests/e2e/seller-product-lifecycle.spec.ts`
- `frontend-next/tests/e2e/support-cases.spec.ts`

Infrastructure:
- `infra/docker-compose.yml`
- `.github/workflows/ci.yml`
- env example files in `infra`, `backend-nest`, `frontend-next`, `ai-service`
