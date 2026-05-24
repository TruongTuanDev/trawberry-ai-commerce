# Frontend Visual Design System

## Seller Center i18n Addendum

- Seller Center now follows role-based locale policy:
  - default `ru`
  - switchable to `en` and `vi`
- Shared seller operational UI should pass translated labels from feature callers into shared UI components rather than hard-code role copy inside generic controls.
- Non-i18n E2E contracts should prefer stable attributes such as `data-testid` and raw status attributes instead of localized success copy.
- Payment review/status surfaces now expose stable status contracts for tests through badge-level attributes, so locale changes do not break business-flow verification.

## Public Marketplace Header / Slider Layout

- Public marketplace now uses a Wildberries-inspired top structure on `/` and `/products`.
- Header stays in the public zone only and never exposes admin login.
- Main visual order:
  - gradient pink-purple header
  - large search-first navigation row
  - promo slider / hero banner directly under header
  - product grid immediately below promo
- Product data remains real backend data from the existing public products API.
- Promo content is static frontend-safe marketing content only.

## Public Copy Direction

- Hero, promo, and footer copy now use concise shopper-facing English instead of mixed internal/demo wording.
- Homepage CTA language is intentionally direct:
  - `Shop now`
  - `Track order`
  - `View all products`
- Catalog filter labels now prioritize customer comprehension over internal terminology:
  - `Search products`
  - `Stock status`
  - `Min price`
  - `Max price`
- Empty/error states use marketplace language that fits a real storefront instead of migration/demo phrasing.

## Color Palette

- Primary gradient: `linear-gradient(90deg, #CB11AB 0%, #A100FF 100%)`
- Background: `#F4F2FB`
- Panel: `#FFFFFF`
- Panel strong: `#F3F0F8`
- Border: `#E7DFF0`
- Accent soft: `#FDE7F8`
- Cart badge highlight: `#FFCF33`

## Components Changed

- `frontend-next/src/components/public/public-header.tsx`
  - redesigned to a large marketplace header with logo, menu button, oversized search, customer entry, seller entry, and cart badge
- `frontend-next/src/components/public/promo-slider.tsx`
  - new client-side promo slider with static slides, auto-rotate, dots, and arrow controls
- `frontend-next/src/app/page.tsx`
  - home page now behaves like a marketplace landing page with promo-first layout and public product preview grid
- `frontend-next/src/app/products/page.tsx`
  - catalog page now shows promo slider before filters and grid while keeping existing search/filter logic intact
- `frontend-next/src/components/public/product-card.tsx`
  - cards now use larger image emphasis, stronger price hierarchy, cleaner badges, and full-width gradient CTA
- `frontend-next/src/components/public/public-shell.tsx`
  - updated marketplace background and sticky-header fallback height
- `frontend-next/src/app/globals.css`
  - updated marketplace palette, shadow system, search focus glow, promo animation, and cart badge micro-animation

## Interaction Rules

- Search remains URL-driven and routes to `/products`.
- Cart, auth, session, and checkout behavior are unchanged.
- Decorative wishlist icon in cards is UI-only and has no fake backend logic.
- Product cards still respect current variant-selection rules:
  - multi-variant products route to detail selection
  - single-variant products can quick-add as before

## Verification

- No backend, API contract, database, or business logic changes were introduced in this visual phase.
- Required verification for this phase is tracked in `docs/PHASE_REPORT.md` and `docs/PROJECT_STATUS.md`.
