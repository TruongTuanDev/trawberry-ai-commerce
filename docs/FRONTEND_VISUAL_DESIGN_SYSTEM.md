# Frontend Visual Design System

## Overview
The Trawberry AI Commerce platform has been visually overhauled to implement a modern, professional, and "wow" aesthetic. The design system enforces a clear separation of visual identity between the Public Marketplace, Seller Center, and Admin Ops Dashboard.

## Visual Identities

### 1. Public Marketplace (Wildberries-inspired)
- **Theme**: Pink to purple gradients (`#CB11AB` to `#A100FF`).
- **Background**: Light lavender-gray (`#F7F7FA`) with white content cards.
- **Components**: 
  - Rounded cards (`rounded-2xl` and `rounded-[2rem]`).
  - Gradient headers and sticky checkout bars.
  - Interactive hover scaling and soft shadow elevations.
- **Key Files Updated**: `globals.css`, `public-shell.tsx`, `public-header.tsx`, `product-card.tsx`, `public-product-detail-page-client.tsx`, `cart-page-client.tsx`, `checkout-page-client.tsx`.

### 2. Seller Center (Professional Business)
- **Theme**: Clean, bright, and modern business dashboard.
- **Background**: Light/white panels with subtle gray borders (`var(--panel)`, `var(--border)`).
- **Components**: 
  - Standardized `SectionCard` with clear typography.
  - Removed all legacy "Migration" text to ensure a production-ready feel.
  - Active navigation states highlighted with gradients for continuity, but the overall container remains serious and clean.
- **Key Files Updated**: `seller-shell.tsx`, `seller-dashboard.tsx`, `seller-orders-page-client.tsx`.

### 3. Admin Ops Dashboard (Neutral/Dark Serious)
- **Theme**: Slate and indigo (dark/neutral serious).
- **Background**: Dark slate sidebar (`bg-slate-900`) with indigo active states (`bg-indigo-600`).
- **Components**:
  - Differentiated entirely from Public and Seller zones to reflect its operational focus.
  - "Marketplace Ops" labeling across navigation and headers.
- **Key Files Updated**: `admin-shell.tsx`, `admin-login/page.tsx`, `admin-dashboard-page-client.tsx`.

## Core CSS Utility Classes
- `.bg-gradient-primary`: Applies the primary Wildberries pink-to-purple background gradient.
- `.text-gradient-primary`: Applies the primary gradient to text elements.
- `.hover-card-effect`: Standardized hover animation for interactive cards.
- `.public-button-primary`: Reusable gradient button with hover and active states.
- `.public-button-secondary`: Reusable outline button matching the theme.

## Verification
- All UI changes were verified against the existing E2E test suite (Playwright).
- **No business logic, API contracts, `data-testid` selectors, or routing structures were modified during this UI overhaul.**
