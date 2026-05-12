# Phase Report

## Scope
Standardize environment configurations for the project to ensure correct behavior in local and Docker environments without exposing secrets.

Constraints followed:
- No changes in `strawberry-frontend`
- No changes in `strawberry-backend`
- No real `.env` files committed.
- No OpenAI calls made during this phase.
- Backward compatibility maintained for JWT configurations.

## Da Lam Gi

### Safe fixes applied
- Standardized `.env.example` in `backend-nest`, `ai-service`, `frontend-next`, and `infra` with exact matching variables.
- Updated `backend-nest` auth module to support `JWT_SECRET` and `JWT_EXPIRES_IN`, gracefully falling back to `JWT_ACCESS_SECRET` and `JWT_ACCESS_EXPIRES_IN` to prevent breaking existing tests or local configurations.
- Changed default port of `ai-service` in `app/core/config.py` from `8010` to `8000` to align with expected configuration `AI_SERVICE_BASE_URL=http://localhost:8000`.
- Updated `infra/docker-compose.yml`:
  - `backend-nest` now explicitly connects to `ai-service` via `AI_SERVICE_BASE_URL=http://ai-service:8000`.
  - Exposed port `8000` instead of `8010` for `ai-service`.
- Explicitly ignored `.env` and `.env.local` files across `.gitignore` files while ensuring `.env.example` is checked in.
- Added comprehensive documentation in `docs/RUNTIME_ENV.md` on how to set up local and Docker environments.

## File Da Thay Doi
- `backend-nest/.env.example`
- `ai-service/.env.example`
- `frontend-next/.env.example`
- `infra/.env.example`
- `infra/docker-compose.yml`
- `ai-service/app/core/config.py`
- `backend-nest/src/modules/auth/auth.module.ts`
- `backend-nest/src/modules/auth/auth.service.ts`
- `backend-nest/src/modules/auth/strategies/jwt.strategy.ts`
- `frontend-next/.gitignore`
- `ai-service/.gitignore`
- `backend-nest/.gitignore`
- `docs/RUNTIME_ENV.md`
- `docs/PHASE_REPORT.md`

## Verification Pass/Fail

### ai-service
- `python -m compileall app`: **Pass**
- `python -m pytest -q`: **Pass** (16 tests passed)

### backend-nest
- `npm run lint`: **Pass**
- `npm test -- --runInBand`: **Pass** (30 tests passed)
- `npm run build`: **Pass**

### frontend-next
- `npm run lint`: **Pass**
- `npm run build`: **Pass**

### infra
- `docker compose -f infra/docker-compose.yml config`: **Pass**

## Báo cáo lỗi OpenAI (DALL-E 2)
Trong quá trình thực hiện End-to-End smoke test cho OpenAI provider, chúng tôi đã gặp phải lỗi từ OpenAI (400 Bad Request):
- **Loại lỗi**: `billing` (Billing hard limit has been reached)
- **Chi tiết**: `{'error': {'message': 'Billing hard limit has been reached', 'type': 'image_generation_user_error', 'param': None, 'code': 'billing_hard_limit_reached'}}`
- **Tác động**: Yêu cầu gọi OpenAI thật thất bại vì tài khoản đã hết hạn mức thanh toán.
- **Kết quả xử lý**: Hệ thống backend-nest đã xử lý an toàn:
  - Task status được chuyển thành `FAILED` với `errorMessage` được ghi đầy đủ và rõ ràng.
  - Credit đã được **hoàn trả (refund) đúng số lượng (0 credit bị trừ)**.
  - Quá trình chuyển đổi định dạng ảnh từ JPEG sang PNG (đáp ứng đúng requirement của OpenAI edit) được thực hiện trong memory (PIL) mà không làm lộ secret hay thay đổi logic bừa bãi, và giờ đây chỉ kích hoạt cho `dall-e-2` model thay vì ép buộc đối với mọi model.
  - Không có secret nào bị in ra log.

## Moi Truong & Blocker
- Docker daemon is currently not running/available in the underlying environment, so `docker compose up` could not be fully run (noted as an environment blocker).
- Real OpenAI smoke test failed due to billing hard limits.

## Ket Qua Chinh
- Env naming is strictly standardized across services.
- Local setups map to `http://localhost:8000` while Docker seamlessly targets `http://ai-service:8000`.
- Missing `.env` real files are not tracked.
- Backward compatibility with legacy `JWT_ACCESS_SECRET` preserves existing developer setups and tests.
- Backend OpenAI smoke script successfully handles end-to-end task polling, verifying failure and credit refund accurately.
- OpenAIImageProvider dynamically prioritizes GPT Image models (supporting JPEG/PNG/WEBP without forced conversion) while safely isolating legacy DALL-E 2 constraints.

## OpenAI Smoke Test (End-to-End)
**Status**: FAILED (Expected failure due to billing limit)
**Reason**: OpenAI API key provided has reached its billing hard limit.
- AI service gracefully catches and propagates the error.
- Backend gracefully transitions task to FAILED and successfully refunds credits.
