# Trawberry AI Commerce

## Auth Separation Update

- Public marketplace promotes only customer login/register and seller register/login.
- Admin login is operational-only at `/admin-login`.
- Public pages do not show admin login links.
- Customer and seller registration accept email/password or phone/password.

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
Kích thước lý tưởng nhất (Tỷ lệ 2.57 : 1):

1800 × 700 px (Khuyên dùng cho độ nét cao trên màn hình Retina/4K).
1600 × 620 px hoặc 1232 × 480 px (Khít chuẩn xác tuyệt đối với màn hình desktop thông thường).
Tỷ lệ ảnh cho Mobile (Nếu upload ở trường Mobile Image URL):

900 × 1200 px hoặc 1080 × 1350 px (Tỷ lệ đứng 3:4 hoặc 4:5 để tối ưu không gian hiển thị trên màn hình điện thoại).