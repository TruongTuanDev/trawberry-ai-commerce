# Trawberry AI Commerce

## Safe WB nmID Diagnostic

To check whether a rotated WB Content API token can see specific `Артикул WB / nmID` values without syncing or modifying products:

```powershell
cd backend-nest
$env:WB_API_KEY="PASTE_ROTATED_TOKEN_HERE"
npm run diagnose:wb-nmids -- 955686992 982708059
Remove-Item Env:WB_API_KEY
```

The script never prints or persists the token. Treat any WB token previously pasted into chat as compromised and rotate it before use.

## GitHub Actions CD

GitHub Actions CD is prepared in `.github/workflows/deploy.yml`.

CD scope:

- `push` to `main`
- `workflow_dispatch`
- wait for CI success on the same commit
- build and push production images to GHCR
- SSH to VPS and deploy with `infra/docker-compose.prod.yml`
- run post-deploy smoke checks

Required GitHub secrets:

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`
- `VPS_APP_DIR`
- optional `VPS_PORT`
- optional `VPS_KNOWN_HOSTS`
- optional `GHCR_PAT`

GHCR note:

- GitHub Actions uses `GITHUB_TOKEN` to push images to GHCR during `build-and-push`.
- If GHCR packages are private, set `GHCR_PAT` with at least `read:packages` so the VPS can `docker login` and pull deploy images.

Recommended GitHub variable:

- `DEPLOY_NEXT_PUBLIC_API_URL=https://api.yourdomain.ru`

## VPS First Deploy

Operator-first first-deploy docs:

- [docs/VPS_SETUP.md](/c:/Users/admin/trawberry-ai-commerce/docs/VPS_SETUP.md)
- [docs/DEPLOYMENT.md](/c:/Users/admin/trawberry-ai-commerce/docs/DEPLOYMENT.md)
- [docs/PRODUCTION_RUNBOOK.md](/c:/Users/admin/trawberry-ai-commerce/docs/PRODUCTION_RUNBOOK.md)

Production env template:

- [infra/.env.production.example](/c:/Users/admin/trawberry-ai-commerce/infra/.env.production.example)

## GitHub Actions CI

GitHub Actions CI is now prepared for the active marketplace stack in `.github/workflows/ci.yml`.

Workflow scope:

- `push` to `main`
- `pull_request` to `main`
- backend targeted verification with PostgreSQL and Redis
- frontend lint/build
- ai-service compile/pytest with mock-safe env
- Docker compose config validation
- production Docker image build on `push main`

CI safety defaults:

- no real `.env` required
- no paid OpenAI smoke
- no production secrets required
- no real Wildberries or carrier API calls in default CI

## Frontend i18n Guardrails

The active frontend i18n contract now has two safety layers:

- `src/i18n/translate.ts` falls back to English first, then to a human-readable label instead of exposing raw keys like `seller.dashboard.title`
- `npm run check:i18n` audits all `t("...")` / `translate(..., "...")` usages in `frontend-next/src` and fails when any used key is missing from `en.json`

Recommended local check:

```bash
cd frontend-next
npm run check:i18n
```

## Category Backfill Script

When historical products still have `categoryName` / `sourceCategoryName` but no linked `categoryId`, run:

```bash
cd backend-nest
npm run categories:sync
```

The script is idempotent. It creates missing `Category` rows by normalized name, links products to those categories, and refreshes the mirrored `product.categoryName` field without deleting old data.

If production already has the correct `Category` rows and only needs to attach legacy products without creating anything new, run:

```bash
cd backend-nest
npm run categories:link-products -- --dry-run
npm run categories:link-products
```

This exact-match script only links products with `categoryId = null` by matching `Product.categoryName` first and `Product.sourceCategoryName` second against existing `Category.name`.

## Production Deployment Foundation

Production artifacts for VPS deployment are now included:

- `infra/docker-compose.prod.yml`
- `infra/nginx/nginx.conf`
- `infra/nginx/Dockerfile`
- `infra/scripts/deploy.sh`
- `infra/scripts/smoke-production.sh`
- `infra/scripts/backup-postgres.sh`
- `infra/scripts/restore-postgres.sh`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION_RUNBOOK.md`
- `docs/SECURITY_CHECKLIST.md`
- `docs/BACKUP_RESTORE.md`

Production compose guarantees:

- no source bind mounts for app services or nginx config
- named volumes for PostgreSQL, Redis, and MinIO
- only the reverse proxy is public
- backend, ai-service, PostgreSQL, Redis, and MinIO stay internal
- health checks and `restart: unless-stopped` across the stack
- MinIO bucket bootstrap is handled by `infra/minio-init/init-buckets.sh`, including public-read bootstrap for the AI Try-On bucket

Production sizing:

- Recommended: `8 vCPU`, `16 GB RAM`, `200 GB NVMe`
- Minimum: `4 vCPU`, `8 GB RAM`, `100 GB`

Basic production flow:

```bash
cd /opt/trawberry-ai-commerce
cp infra/.env.example infra/.env.production
vi infra/.env.production
./infra/scripts/deploy.sh
```

## Auth Separation Update

- Public marketplace promotes only customer login/register and seller register/login.
- Admin login is operational-only at `/admin-login`.
- Public pages do not show admin login links.
- Customer and seller registration accept email/password or phone/password.

## Recommendation Flags

Recommendation Phase 1 is additive and can be disabled safely with:

- `RECOMMENDATIONS_ENABLED`
- `PUBLIC_RECOMMENDATIONS_ENABLED`
- `RECOMMENDATION_TRACKING_ENABLED`

Expected behavior when flags are off:

- no storefront recommendation sections
- no client tracking calls
- backend tracking endpoints no-op safely
- backend recommendation endpoints return empty lists

Marketplace/e-commerce stack đang được migrate sang kiến trúc mới:

- `frontend-next`: Next.js frontend
- `backend-nest`: NestJS API
- `ai-service`: FastAPI AI image service
- `infra`: Docker Compose cho Postgres, Redis, MinIO, app services
Database:
cd backend-nest
npm run prisma:studio

## 1. URLs mặc định

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001`
- Backend Swagger: `http://localhost:3001/api/docs`
- AI service health: `http://localhost:8000/health`

## 2. Chạy nhanh bằng Docker

Từ thư mục gốc:

```powershell
cd C:\Users\admin\trawberry-ai-commerce
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build
```

Kiểm tra runtime:

```powershell
docker compose -f infra/docker-compose.yml --env-file infra/.env ps
curl.exe --ipv4 http://localhost:3001/api/health
curl.exe --ipv4 -I http://localhost:3000/products
curl.exe --ipv4 http://localhost:8000/health
```

## 3. Seed dữ liệu demo

Từ `backend-nest`:

```powershell
cd C:\Users\admin\trawberry-ai-commerce\backend-nest
npm install
npm run prisma:generate
npm run prisma:db:push
npm run seed:demo
```

Seed là idempotent cho local/demo use.

## 4. Tài khoản 3 role

### Admin

- Email: `demo-admin@trawberry.local`
- Password: `DemoAdmin123!`

Đăng nhập tại:

- `http://localhost:3000/admin-login`

Màn hình chính:

- `/admin/dashboard`
- `/admin/sellers`
- `/admin/queues`
- `/admin/reports`
- `/admin/deliveries`
- `/admin/support-cases`

### Seller

- Email: `demo-seller@trawberry.local`
- Password: `DemoSeller123!`

Đăng nhập tại:

- `http://localhost:3000/seller/login`

Màn hình chính:

- `/seller/dashboard`
- `/seller/products`
- `/seller/orders`
- `/seller/payments`
- `/seller/settings`
- `/seller/support-cases`
- `/seller/import/wildberries`
- `/seller/import/wildberries-api`

### Customer

Customer có thể dùng public flow anonymous, nhưng để test order history / receipt / support thì nên đăng ký account mới.

Đăng ký / đăng nhập:

- `http://localhost:3000/customer/register`
- `http://localhost:3000/customer/login`

Customer and seller registration now accept:

- email + password
- or phone + password

Trang chính:

- `/products`
- `/cart`
- `/checkout`
- `/customer/orders`
- `/orders/track`

Gợi ý account local:

- Email: `customer1@example.com`
- Password: `password123`

## 5. Demo flow ngắn theo 3 role

### Customer flow

1. Mở `/products`
2. Thêm sản phẩm vào cart
3. Checkout tại `/cart` / `/checkout`
4. Nhận `checkoutCode` và các `orderCode`
5. Xem receipt tại `/customer/orders/[checkoutCode]`
6. Tạo support case nếu cần

### Seller flow

1. Login seller
2. Vào `/seller/orders`
3. Mở order detail
4. Xem items, payment, delivery
5. Vào `/seller/support-cases` để xử lý case gắn shop/order của mình

### Admin flow

1. Login admin
2. Vào `/admin/support-cases`
3. Lọc / mở case
4. Cập nhật status, priority
5. Gửi public message hoặc internal note

## 6. Chạy local không dùng Docker

### Backend

```powershell
cd C:\Users\admin\trawberry-ai-commerce\backend-nest
npm install
npm run prisma:generate
npm run prisma:db:push
npm run seed:demo
npm run start:dev
```

### Frontend

```powershell
cd C:\Users\admin\trawberry-ai-commerce\frontend-next
npm install
npm run dev
```

### AI service

Chỉ cần khi test AI image flow. Checkout/order/support không phụ thuộc vào việc gọi OpenAI thật.

## 7. Scripts hữu ích

### Backend

```powershell
cd backend-nest
npm run smoke:checkout
npm run smoke:cart-checkout
npm run smoke:multi-shop-checkout
npm run smoke:customer-order-history
npm run smoke:support-cases
```

### Frontend

```powershell
cd frontend-next
npm run test:e2e:cart-checkout
npm run test:e2e:multi-shop-checkout
npm run test:e2e:customer-order-history
npm run test:e2e:notifications
npm run test:e2e:support-cases
npm run test:e2e:visual-search
```

## 8. Cấu trúc repo

- `frontend-next`: app customer/seller/admin hiện tại
- `backend-nest`: API, checkout, orders, payments, delivery, support cases
- `ai-service`: AI image mock/provider service
- `infra`: compose, init, local infra config
- `docs`: tài liệu phase và audit
- `strawberry-frontend`: legacy Angular app, không sửa
- `strawberry-backend`: legacy Spring Boot app, không sửa

## 9. Lưu ý an toàn

- Không commit `.env` thật
- Không commit secrets / API keys
- Không commit `data.xlsx`
- Không sửa `strawberry-frontend` và `strawberry-backend` nếu đang làm theo stack mới

## 10. Tài liệu chi tiết

- `backend-nest/README.md`
- `frontend-next/README.md`
- `docs/PROJECT_STATUS.md`
- `docs/AUTH_ROLE_SEPARATION.md`
- `docs/FULL_FLOW_AUDIT.md`
- `docs/MULTI_SHOP_CHECKOUT.md`
- `docs/CUSTOMER_ACCOUNTS_ORDER_HISTORY.md`
- `docs/SUPPORT_CASES.md`

## 11. Docker build reliability

The supported Docker path now builds app artifacts inside the images:

- `backend-nest` builds `dist` during image build
- `frontend-next` builds `.next/standalone` during image build
- manual `docker cp` of host build artifacts is no longer part of the release path

Useful commands:

```powershell
cd C:\Users\admin\trawberry-ai-commerce
docker compose -f infra/docker-compose.yml --env-file infra/.env build backend-nest frontend-next
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d backend-nest frontend-next
docker compose -f infra/docker-compose.yml --env-file infra/.env logs -f backend-nest frontend-next
```

See `docs/DOCKER_BUILD_RELIABILITY.md` for troubleshooting and CI-readiness notes.

## 12. AI Try-On

Phase 1 AI Try-On is wired end-to-end and Phase 2 adds the real OpenAI provider path:

- admin config UI: `/admin/ai-settings`
- public product detail CTA: `/products/[id]`
- backend public APIs:
  - `GET /api/public/ai-try-on/config`
  - `POST /api/public/ai-try-on/uploads`
  - `POST /api/public/products/:productId/try-on/tasks`
  - `GET /api/public/ai-try-on/tasks/:taskId`
- ai-service internal endpoint:
  - `POST /internal/ai-try-on/generate`

Provider modes:

- `mock`
- `demo`
- `openai`

OpenAI readiness:

- keep API keys only in `ai-service`
- set admin provider mode to `openai`
- configure `OPENAI_API_KEY`
- optionally configure `AI_TRY_ON_OPENAI_MODEL`
- optionally configure `AI_TRY_ON_PROVIDER_TIMEOUT_SECONDS`
- optionally configure `AI_TRY_ON_OUTPUT_SIZE`
- rebuild/restart services

Phase 2 note:

- `openai` mode now calls the real OpenAI Images edit path from `ai-service`
- `mock` and `demo` remain the stable local/demo modes
- the API key must never be exposed to the frontend or committed to the repo
- real try-on output quality still depends on provider capability and source image quality
Kích thước lý tưởng nhất (Tỷ lệ 2.57 : 1):

1800 × 700 px (Khuyên dùng cho độ nét cao trên màn hình Retina/4K).
1600 × 620 px hoặc 1232 × 480 px (Khít chuẩn xác tuyệt đối với màn hình desktop thông thường).
Tỷ lệ ảnh cho Mobile (Nếu upload ở trường Mobile Image URL):

900 × 1200 px hoặc 1080 × 1350 px (Tỷ lệ đứng 3:4 hoặc 4:5 để tối ưu không gian hiển thị trên màn hình điện thoại).
## CI note for public/customer E2E

- The GitHub Actions Playwright public/customer batch seeds demo accounts before running E2E:
  - `docker compose -f infra/docker-compose.yml exec -T -e DEMO_SEED_CONFIRM=true backend-nest npm run seed:demo`
- This is required because seller-approval setup in the Dockerized E2E flow depends on the demo admin account being present.

## Deploy note for VPS workflow

- The GitHub Actions deploy workflow uploads the repository `infra/` directory to the VPS over SSH before running production `docker compose`.
- The VPS no longer needs `git fetch` access to the GitHub repository for routine deployments.

## Delivery smoke fixture note

- `backend-nest npm run smoke:delivery` creates a category-ready product and publishes it through the seller API before checkout.
- This keeps the smoke aligned with the public marketplace rule that checkout accepts only published, readiness-complete products.
