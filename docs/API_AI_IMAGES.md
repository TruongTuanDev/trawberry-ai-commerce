# API AI Images

Task-based AI image generation module for the new NestJS backend.

## Scope
Phase này chỉ triển khai orchestration trong `backend-nest`:
- kiểm tra quyền shop
- kiểm tra product và input images
- kiểm tra credit
- tạo task
- enqueue queue job
- mock worker xử lý task
- lưu generated images
- attach generated image vào `product_images`

Không gọi OpenAI thật trong phase này.

## Database Models

### `ai_generation_tasks`
Current task model stores:
- `shop_id`
- `product_id`
- `requested_by`
- `status`
- `mode`
- `task_type`
- `quantity`
- `prompt`
- `style_preset`
- `source_image_id`
- `input_front_image_id`
- `input_back_image_id`
- `input_model_image_id`
- `credit_cost`
- `attempt_count`
- `queue_job_id`
- `provider_task_id`
- `error_message`
- `credit_refunded_at`
- `completed_at`
- timestamps

### `ai_generated_images`
Current generated image model stores:
- `task_id`
- `shop_id`
- `product_id`
- `image_url`
- `storage_key`
- `thumbnail_url`
- `provider`
- `storage_provider`
- `mime_type`
- `width`
- `height`
- `is_selected`
- `attached_image_id`
- timestamps

### `seller_ai_credits`
Current credit model stores:
- `shop_id`
- `total_credits`
- `used_credits`
- `remaining_credits`

Backward-compatible fields kept:
- `balance`
- `reserved`
- `last_granted_at`

### `ai_usage_logs`
Current usage log model stores:
- `shop_id`
- `user_id`
- `task_id`
- `provider`
- `action`
- `credit_cost`
- `status`
- `error_message`
- `credit_delta`
- `balance_after`
- `metadata`
- `created_at`

## Default Dev Credit Policy

If a shop has no `seller_ai_credits` record yet:
- `GET /api/shops/:shopId/ai-credits` auto-creates one
- default credits for local/dev: `50`

This behavior is for bootstrap convenience in the new stack and should be revisited for production policy.

## Status Lifecycle
- `PENDING`
- `PROCESSING`
- `COMPLETED`
- `FAILED`
- `CANCELLED`

## Task Types
- `PRODUCT_MODEL_IMAGE`
- `TRY_ON`
- `BACKGROUND_REPLACE`
- `DETAIL_SHOT`

## Endpoints

### `POST /api/shops/:shopId/products/:productId/ai-images/tasks`
Creates a new AI image task.

Request example:
```json
{
  "taskType": "PRODUCT_MODEL_IMAGE",
  "quantity": 2,
  "prompt": "Create a clean studio AI product model image for marketplace listing.",
  "stylePreset": "studio-editorial",
  "inputFrontImageId": "uuid",
  "inputBackImageId": "uuid"
}
```

Behavior:
- requires `JwtAuthGuard + ShopAccessGuard`
- verifies the product belongs to the shop
- verifies input images belong to the same product
- validates `quantity` in range `1..10`
- creates default dev credits if shop has none yet
- rejects when `remainingCredits < quantity`
- deducts credits immediately
- stores a `PENDING` task
- enqueues a BullMQ job or triggers mock worker when queue is disabled

Backward-compatible request support:
- `sourceImageId` is accepted as alias for `inputFrontImageId`
- `mode` is still accepted for current frontend compatibility

### `GET /api/shops/:shopId/ai-images/tasks`
Lists AI tasks for one shop.

Optional query params:
- `status`
- `productId`
- `search`

### `GET /api/shops/:shopId/ai-images/tasks/:taskId`
Returns one task with generated images.

### `POST /api/shops/:shopId/ai-images/tasks/:taskId/retry`
Retries one task.

Current rule:
- only `FAILED` tasks can be retried
- retry deducts credits again
- task is reset to `PENDING`

### `POST /api/shops/:shopId/products/:productId/ai-images/:generatedImageId/attach`
Attaches one generated AI image back into the normal product gallery by creating a new `product_images` record.

Behavior:
- created product image uses `imageType=AI_GENERATED`
- generated image is marked `isSelected=true`
- generated image must belong to the same `shopId` and `productId`

### `POST /api/shops/:shopId/products/:productId/images/:generatedImageId/attach`
Backward-compatible alias route kept for the current frontend integration.

### `GET /api/shops/:shopId/ai-credits`
Returns AI credit summary for one shop.

Response example:
```json
{
  "id": "uuid",
  "shopId": "uuid",
  "totalCredits": 50,
  "usedCredits": 2,
  "remainingCredits": 48,
  "createdAt": "2026-05-11T00:00:00.000Z",
  "updatedAt": "2026-05-11T00:00:00.000Z"
}
```

## Queue and Worker
- Queue name: `ai-images`
- Job name: `generate-product-image`
- Default provider: `mock-provider`

Worker behavior in this phase:
- `PENDING -> PROCESSING`
- mock provider generates placeholder/copy-based image URLs
- writes `ai_generated_images`
- updates task to `COMPLETED`
- on error:
  - task becomes `FAILED`
  - `error_message` is stored
  - credit is refunded once

## Credit Logic
- cost per generated image: `1 credit`
- task with `quantity=2` deducts `2 credits`
- attach does not spend extra credit

## Tests
- `backend-nest/test/ai-images.e2e-spec.ts`
- `backend-nest/test/ai-images.worker.spec.ts`

Covered scenarios:
- create AI task successfully
- auto-create credits for a shop without credit record
- fail when credits are insufficient
- fail when input image belongs to another product
- forbid cross-shop access
- retry a failed task
- attach generated image into `product_images`
- worker completes tasks with mock provider
- worker refunds credit on failure

## Runtime Smoke

```bash
cd backend-nest
npm run smoke:ai-images
```

Smoke verifies:
- seller register
- local seller approval bootstrap
- login
- create shop
- create product
- upload `FRONT` image
- initialize credits
- create task with `quantity=2`
- mock worker completes task
- poll task until `COMPLETED`
- attach one generated image
- verify product image has `imageType=AI_GENERATED`
- verify credits drop by `2`
- verify cross-shop access returns `403`
