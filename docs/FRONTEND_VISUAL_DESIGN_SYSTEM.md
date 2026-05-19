# Frontend Visual Design System

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
