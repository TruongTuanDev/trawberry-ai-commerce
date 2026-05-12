# Deployment

Tài liệu này mô tả cách chạy kiến trúc mới bằng Docker Compose, song song với hệ thống Spring Boot/Angular cũ.

## Services
- `frontend-next`: Next.js seller center trên `http://localhost:3000`
- `backend-nest`: NestJS API trên `http://localhost:3001`
- `ai-service`: FastAPI AI service trên `http://localhost:8010`
- `postgres`: PostgreSQL trên `localhost:5432`
- `redis`: Redis trên `localhost:6379`
- `minio`: S3-compatible object storage trên `http://localhost:9000`
- `minio console`: MinIO Console trên `http://localhost:9001`

## Files
- Compose file: [infra/docker-compose.yml](C:\Users\admin\trawberry\infra\docker-compose.yml)
- Compose env example: [infra/.env.example](C:\Users\admin\trawberry\infra\.env.example)
- Backend env example: [backend-nest/.env.example](C:\Users\admin\trawberry\backend-nest\.env.example)
- Frontend env example: [frontend-next/.env.example](C:\Users\admin\trawberry\frontend-next\.env.example)
- AI service env example: [ai-service/.env.example](C:\Users\admin\trawberry\ai-service\.env.example)

## Prerequisites
- Docker Desktop hoặc Docker Engine có `docker compose`
- Port trống: `3000`, `3001`, `5432`, `6379`, `8010`, `9000`, `9001`

## Quick Start
1. Tùy chọn override biến compose:

```powershell
Copy-Item infra/.env.example infra/.env
```

2. Chạy toàn bộ stack:

```powershell
docker compose --env-file infra/.env -f infra/docker-compose.yml up --build
```

Nếu không cần override:

```powershell
docker compose -f infra/docker-compose.yml up --build
```

3. Truy cập:
- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:3001/api/health`
- Swagger: `http://localhost:3001/api/docs`
- AI service health: `http://localhost:8010/health`
- MinIO Console: `http://localhost:9001`

## Runtime Notes
- `backend-nest` chạy `prisma generate` và `prisma db push` khi container start để bootstrap schema trên PostgreSQL mới.
- `backend-nest` hiện lưu product upload vào local volume `backend-uploads` qua `FILE_STORAGE_DRIVER=local`.
- `ai-service` dùng MinIO theo giao thức S3-compatible. Service `minio-init` sẽ tạo bucket và mở public bucket để URL ảnh truy cập được từ browser.
- `frontend-next` build với `NEXT_PUBLIC_API_URL=http://localhost:3001`, để browser ngoài container gọi đúng NestJS.
- Redis được dùng cho BullMQ queue giữa `backend-nest` và AI worker flow.

## Health Checks
- `frontend-next`: `GET /login`
- `backend-nest`: `GET /api/health`
- `ai-service`: `GET /health`
- `postgres`: `pg_isready`
- `redis`: `redis-cli ping`
- `minio`: `GET /minio/health/live`

## Common Commands
Start detached:

```powershell
docker compose -f infra/docker-compose.yml up --build -d
```

Stop:

```powershell
docker compose -f infra/docker-compose.yml down
```

Stop and remove volumes:

```powershell
docker compose -f infra/docker-compose.yml down -v
```

View logs:

```powershell
docker compose -f infra/docker-compose.yml logs -f backend-nest frontend-next ai-service
```

## Known Limitations
- Compose stack này không thay thế hệ thống legacy; nó chỉ dựng kiến trúc mới để migrate dần.
- `backend-nest` hiện chưa ghi product images trực tiếp lên MinIO; phần đó vẫn dùng local uploads. MinIO hiện chủ yếu phục vụ `ai-service` và future S3 migration path.
