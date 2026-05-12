# backend-nest

NestJS backend runs in parallel with the legacy `strawberry-backend` Spring Boot service.

## Stack
- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- Redis
- BullMQ
- JWT auth
- Swagger/OpenAPI
- class-validator

## Core modules
- `auth`
- `users`
- `shops`
- `products`
- `product-images`
- `files`
- `ai-images`

## Available APIs
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `GET /api/users/me`
- `GET /api/shops`
- `GET /api/shops/:shopId`
- `GET /api/shops/:shopId/products`
- `POST /api/shops/:shopId/products`
- `GET /api/shops/:shopId/products/:productId`
- `PATCH /api/shops/:shopId/products/:productId`
- `DELETE /api/shops/:shopId/products/:productId`
- `GET /api/shops/:shopId/products/:productId/images`
- `POST /api/shops/:shopId/products/:productId/images`
- `DELETE /api/shops/:shopId/products/:productId/images/:imageId`
- `POST /api/files/upload-url`
- `POST /api/ai-images/generate`
- `POST /api/ai-images/try-on`
- `POST /api/shops/:shopId/products/:productId/ai-images/tasks`
- `GET /api/shops/:shopId/ai-images/tasks`
- `GET /api/shops/:shopId/ai-images/tasks/:taskId`
- `POST /api/shops/:shopId/ai-images/tasks/:taskId/retry`
- `POST /api/shops/:shopId/products/:productId/images/:imageId/attach`

## Local run

### 1. Install
```bash
npm install
```

### 2. Configure env
Create `.env` if needed:

```env
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/strawberry?schema=public
JWT_SECRET=change-me-local-secret
JWT_EXPIRES_IN=7d
REDIS_HOST=localhost
REDIS_PORT=6379
AI_WORKER_MODE=ai-service
AI_SERVICE_BASE_URL=http://localhost:8000
AI_SERVICE_INTERNAL_TOKEN=local-internal-token
AI_SERVICE_TIMEOUT_MS=120000
STORAGE_DRIVER=local
MAX_IMAGE_SIZE_MB=10
```

Notes:
- Default port is `3001` so it does not conflict with Spring Boot on `8080`.
- If you are using the Docker PostgreSQL from `infra/docker-compose.yml`, the host port is `5433`.
- Inside Docker, `DATABASE_URL` must use `postgres:5432`, not `localhost`.
- `STORAGE_DRIVER=local` is the bootstrap default for product image upload.
- Local uploaded files are served from `/uploads/*`.
- AI image task tables are defined in `prisma/migrations/20260510_add_ai_image_tables/migration.sql`.
- Local non-Docker runtime should use `AI_SERVICE_BASE_URL=http://localhost:8000`.
- Docker runtime should use `AI_SERVICE_BASE_URL=http://ai-service:8000`.
- Prisma maps existing legacy tables and does not change Spring Boot business logic.

### 3. Generate Prisma client
```bash
npm run prisma:generate
```

### 4. Start dev server
```bash
npm run start:dev
```

## Swagger
- `http://localhost:3001/api/docs`

## Product image upload
- Uses `JwtAuthGuard + ShopAccessGuard`
- Persists metadata into legacy `product_images`
- Stores files locally by default under `uploads/products/:shopId/:productId`
- Keeps legacy Spring Boot repo untouched

## AI image tasks
- NestJS only creates tasks, checks credits, and enqueues BullMQ jobs.
- Worker calls the separate `ai-service` over `POST /internal/ai-images/generate`.
- Built-in retry and timeout handling are applied for the AI service call.
- If `BULLMQ_DISABLED=true`, the task is still created and local asynchronous processing is triggered inside NestJS for bootstrap testing.
