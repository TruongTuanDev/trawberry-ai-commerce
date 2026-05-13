# Demo Data

## Purpose

Provide stable seeded marketplace data for customer demos and Playwright public E2E runs in the new stack.

## Command

Run from `backend-nest`:

```bash
npm run seed:demo
```

## Safety Rules

- the seed is idempotent
- the seed refuses to run in `NODE_ENV=production` unless `DEMO_SEED_CONFIRM=true`
- only demo-safe local credentials and public placeholder image data are created

## Seeded Records

- seller account:
  - email: `demo-seller@trawberry.local`
  - password: `DemoSeller123!`
  - role: `SELLER`
  - approval status: `APPROVED`
- admin account:
  - email: `demo-admin@trawberry.local`
  - password: `DemoAdmin123!`
  - role: `ADMIN`
  - intended for `/admin/sellers` seller approval demos and E2E
- shop:
  - slug: `demo-marketplace-shop`
  - status: `ACTIVE`
  - payment instructions: present
- products:
  - at least 3 active public products
  - stable title, slug, price, description, brand, category
  - active priced variants
  - local static SVG placeholder images served from `frontend-next/public/demo`

## Intended Usage

- run before `frontend-next npm run test:e2e:public-full`
- run before manual public marketplace demos
- safe to re-run after local DB resets
