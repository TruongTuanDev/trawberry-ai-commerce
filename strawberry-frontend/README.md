# Strawberry Frontend

## Project Overview
`frontend/` contains the Angular frontend for the Strawberry e-commerce platform. It is the user-facing application that consumes the backend API and provides the storefront, seller workspace, and admin flows.

The project is configured as an Angular SSR application and is packaged for both local development and containerized deployment.

## Tech Stack
- Angular 21
- TypeScript
- Angular SSR
- Node.js
- npm
- RxJS
- Tailwind CSS v4
- Express
- Docker

## Application Areas
- Public storefront
  - home page, catalog, product detail, brand pages
  - cart, checkout, orders, payment confirmation
  - reviews and favorites
- Seller portal
  - seller workspace entry
  - dashboard, products, pricing, inventory
  - orders, payment review, shipments, sync, settings
- Admin interface
  - seller approval and admin operations

## Project Structure
```text
frontend/
├─ src/
│  ├─ app/
│  │  ├─ core/       Auth, API clients, services, guards, layout
│  │  ├─ features/   Storefront, seller, and admin feature areas
│  │  └─ shared/     Reusable UI components and shared helpers
│  ├─ environments/  Runtime environment values
│  ├─ server.ts      SSR Express server
│  ├─ main.ts        Browser bootstrap
│  └─ main.server.ts Server bootstrap
├─ public/           Static assets copied into the build
├─ projects/         Additional Angular application targets
├─ Dockerfile
├─ angular.json
├─ package.json
└─ proxy.conf.json
```

## Prerequisites
- Node.js 22 is recommended to match Docker and CI
- npm
- Backend API running locally or through Docker Compose

You do not need Angular CLI installed globally because the project scripts use the local CLI.

## Environment Configuration
The frontend uses [`src/environments/environment.ts`](./src/environments/environment.ts).

Current API configuration:

```ts
export const environment = {
  production: false,
  apiUrl: ''
};
```

How this works:
- In local development, `npm start` uses [`proxy.conf.json`](./proxy.conf.json) to proxy `/api` to `http://localhost:8080`
- In the SSR runtime, [`src/server.ts`](./src/server.ts) proxies `/api` requests to the backend container or backend host

If you run the frontend outside Docker, make sure the backend is reachable on `http://localhost:8080` or adjust the proxy/runtime setup accordingly.

## Install and Run Locally
From `frontend/`:

Install dependencies:

```bash
npm ci
```

Start the development server:

```bash
npm run start
```

Development URL:
- `http://localhost:4200`

The app expects the backend API to be available through the local proxy.

## Build
Build the production bundle:

```bash
npm run build
```

The build output is written under `dist/`. This project is configured with server output for SSR builds.

Additional useful script:

```bash
npm run watch
```

## Testing
Run the configured frontend tests:

```bash
npm test
```

The project uses Angular's unit test builder. There is no e2e script configured in `package.json`.

## API Integration
The frontend communicates with the backend through `/api/v1/**` endpoints.

Examples from the codebase:
- Auth: `/api/v1/auth/...`
- Public catalog: `/api/v1/public/catalog/...`
- Customer features: `/api/v1/customer/...`
- Seller features: `/api/v1/seller/...`
- Admin features: `/api/v1/admin/...`

Authentication is handled with Bearer tokens via the auth interceptor in [`src/app/core/interceptors/auth.interceptor.ts`](./src/app/core/interceptors/auth.interceptor.ts).

## Docker Support
The frontend includes an SSR-ready Docker image in [`Dockerfile`](./Dockerfile).

Build the image from the repository root:

```bash
docker build -t strawberry-frontend ./frontend
```

Run the container:

```bash
docker run --rm -p 4200:4000 \
  -e BACKEND_URL=http://host.docker.internal:8080 \
  strawberry-frontend
```

Notes:
- The container listens on port `4000`
- `BACKEND_URL` tells the SSR server where to proxy `/api` requests

For a full local setup, use Docker Compose from the repository root:

```bash
cp .env.example .env
docker compose --env-file .env -f infra/docker/docker-compose.yml up --build
```

## Common Issues
- **API requests fail in development**
  Make sure the backend is running on `http://localhost:8080` so the Angular dev proxy can forward `/api` requests.

- **CORS or proxy confusion**
  In local development, the preferred path is `npm run start` with `proxy.conf.json`, not hardcoding the backend URL in the frontend.

- **Node version mismatch**
  Use Node.js 22 to stay aligned with the Docker and CI environment.

- **Dependency installation errors**
  Remove `node_modules` and reinstall with `npm ci` if your lockfile and installed packages drift.

- **SSR container cannot reach the backend**
  Set `BACKEND_URL` correctly when running the frontend container by itself.
