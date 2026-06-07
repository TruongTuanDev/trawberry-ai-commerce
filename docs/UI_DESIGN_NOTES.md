# professional frontend design system (Phase UI.1)

This document provides an overview of the design tokens, fonts, and refactored components introduced during Phase UI.1 for a professional commerce SaaS look.

## 1. Typography & Fonts

We loaded Google Fonts using Next.js `next/font/google` at the root layout wrapper:
- **UI Interface font**: `Inter` (sans-serif) for clean readability, accessible contrast, and professional dashboard widgets.
- **Data & Metric font**: `JetBrains Mono` (monospace) for prices, counts, ratings, and internal QA debug panels.

Font CSS variables (`--font-sans-app` and `--font-mono-app`) are automatically inherited across all public, seller, and admin routes.

## 2. Palette & Design Tokens

We replaced the neon magenta (`#cb11ab`) and purple-gradient style with a modern slate-indigo SaaS system:
- **Base Background**: `#f8fafc` (Tailwind slate-50).
- **Foreground Text**: `#0f172a` (Tailwind slate-900).
- **Border Accents**: `#e2e8f0` (Tailwind slate-200).
- **Brand Accent**: `#4f46e5` (Tailwind indigo-600) and `#3730a3` (indigo-800).
- **Secondary Base**: `#3b82f6` (Tailwind blue-500).
- **Primary Buttons/Headers Gradient**: `linear-gradient(90deg, var(--accent) 0%, var(--foreground) 100%)` (indigo-to-navy/slate).

## 3. Reusable Styling Foundations

We implemented CSS utility tokens in `app/globals.css`:
- `.glass-card`: Semi-transparent card with backdrop blur and slate borders.
- `.premium-badge`: Rounded badge for status indicators with success (emerald), warning (amber), and danger (red) variants.
- `.metric-card`: Structured dashboard block with subtle hover elevation.
- `.table-shell`: Wrapper for styling data tables with border-collapse and header styling.

## 4. Modified Sections

- **Public Storefront**: Modernized the `PublicHeader` search wrap, cart badge, and logo. Redesigned `ProductCard` price layouts, wishlist controls, and hover effects. Replaced hero gradients in fallback slides with slate-navy gradients.
- **Seller Portal**: Refactored the sponsored campaign dashboards, metrics boxes, forms input outlines, wallet summary badges, and transaction history ledger.
- **Admin Center**: Redesigned analytics performance tables, range presets, and internal QA movement comparisons (up/down badges).
