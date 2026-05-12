# frontend-next

Next.js frontend runs in parallel with the legacy Angular app in `strawberry-frontend`.

## Stack
- Next.js App Router
- TypeScript
- Tailwind CSS
- React Hook Form
- Zod
- fetch wrapper
- Zustand

## Routes
- `/`
- `/products`
- `/products/[id]`
- `/checkout`
- `/orders/track`
- `/orders/[id]`
- `/login`
- `/seller/dashboard`
- `/seller/products`
- `/seller/products/[id]`
- `/seller/products/[id]/images`
- `/seller/ai-images`
- `/seller/orders`
- `/seller/settings`

## Current features
- Public marketplace UI with:
  - polished home page
  - responsive product grid
  - product gallery and checkout CTA
  - order tracking and payment proof upload UI
- Seller center layout with sidebar, header, and shop switcher
- Login flow against NestJS auth
- Shop-scoped product list and detail pages
- Product images page with:
  - multi-image upload
  - gallery display
  - delete image action
  - Generate AI Image modal
  - AI task polling
  - attach generated image back into product gallery

## Local run

### 1. Install
```bash
npm install
```

### 2. Configure env
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Start dev server
```bash
npm run dev
```

Default URL:
- `http://localhost:3000`

## Auth note
- Seller login now uses NestJS `httpOnly` cookies.
- The frontend only keeps lightweight user/shop hydration state in `localStorage`.
- Raw JWT auth tokens are not stored in `localStorage`.

## Playwright auth smoke
With the Docker stack or local frontend/backend already running:

```bash
npm run test:e2e:auth
```

Defaults:
- frontend base URL: `http://localhost:3000`
- backend API URL for test registration: `http://localhost:3001`

Optional overrides:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000
PLAYWRIGHT_BACKEND_URL=http://localhost:3001
```

## Playwright public smoke
With the Docker stack or local frontend/backend already running:

```bash
npm run test:e2e:public
```

Current coverage:
- `/` loads
- `/products` loads
- first product detail opens when at least one product exists
- `/orders/track` loads

## Main files
- `src/app/login/page.tsx`
- `src/app/seller/layout.tsx`
- `src/app/seller/products/page.tsx`
- `src/app/seller/products/[id]/page.tsx`
- `src/app/seller/products/[id]/images/page.tsx`
- `src/lib/api.ts`
- `src/lib/seller-api.ts`

## Legacy safety
This project does not modify `strawberry-frontend`.
