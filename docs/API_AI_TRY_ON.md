# API AI Try-On

## Phase 2 additions

- admin settings now include safe OpenAI runtime fields when `providerMode=openai`:
  - `providerConfigured`
  - `aiServiceReachable`
  - `providerSafeErrorCode`
- internal `openai` generation now returns real stored image metadata when the provider is configured
- task polling can surface:
  - `AI_PROVIDER_NOT_CONFIGURED`
  - `AI_TRY_ON_IMAGE_UNSUITABLE`
  - `AI_PROVIDER_ERROR`
  - `AI_TIMEOUT`

## Admin

### `GET /api/admin/ai-settings`

Returns:

```json
{
  "id": "default",
  "enabled": false,
  "providerMode": "mock",
  "guestDailyLimit": 3,
  "customerDailyLimit": 5,
  "requireConsent": true,
  "supportedCategories": [],
  "providerConfigured": null,
  "aiServiceReachable": null,
  "providerSafeErrorCode": null,
  "productAvailabilitySync": null,
  "createdAt": "2026-05-27T00:00:00.000Z",
  "updatedAt": "2026-05-27T00:00:00.000Z"
}
```

### `PATCH /api/admin/ai-settings`

Request:

```json
{
  "enabled": true,
  "providerMode": "demo",
  "guestDailyLimit": 3,
  "customerDailyLimit": 5,
  "requireConsent": true,
  "supportedCategories": ["1010", "1040"]
}
```

Response:

```json
{
  "id": "default",
  "enabled": true,
  "providerMode": "demo",
  "guestDailyLimit": 3,
  "customerDailyLimit": 5,
  "requireConsent": true,
  "supportedCategories": ["1010", "1040"],
  "providerConfigured": null,
  "aiServiceReachable": null,
  "providerSafeErrorCode": null,
  "productAvailabilitySync": {
    "enabledProducts": 42,
    "disabledProducts": 18,
    "mode": "RESTRICTED"
  },
  "createdAt": "2026-05-27T00:00:00.000Z",
  "updatedAt": "2026-05-28T00:00:00.000Z"
}
```

Behavior:

- `supportedCategories` is expected to contain `Category.id` values serialized as strings.
- Saving admin AI settings now also synchronizes `products.ai_try_on_enabled`.
- If `supportedCategories` is non-empty:
  - products whose `categoryId` is in the selected ids are enabled
  - products with other `categoryId` values, or `null`, are disabled
- If `supportedCategories` is empty:
  - all eligible public-ready products with images are enabled
  - ineligible products are disabled

## Public

### `GET /api/public/ai-try-on/config`

Returns public runtime config and built-in models.

Built-in models now return 10 real demo entries, for example:

```json
{
  "enabled": true,
  "providerMode": "mock",
  "guestDailyLimit": 3,
  "customerDailyLimit": 5,
  "requireConsent": true,
  "supportedCategories": [],
  "builtInModels": [
    {
      "modelId": "model-1",
      "gender": "female",
      "bodyType": "petite",
      "heightCm": 155,
      "weightKg": 45,
      "imageUrl": "/ai-try-on/models/model1.png",
      "labelRu": "Женщина, миниатюрная, 155 см",
      "labelEn": "Female, petite, 155 cm"
    }
  ]
}
```

Notes:

- `imageUrl` points to frontend public assets.
- `modelId` is the stable identifier that must be sent back in task creation.
- Current built-in ids are `model-1` through `model-10`.

### `POST /api/public/ai-try-on/uploads`

Multipart upload for a customer reference image.

Request:

- field `file`
- optional guest header `x-guest-session-id`

Response:

```json
{
  "url": "http://localhost:3001/uploads/ai-try-on/guest/guest-123/photo.png",
  "storageKey": "ai-try-on/guest/guest-123/photo.png",
  "mimeType": "image/png",
  "size": 12345
}
```

### `POST /api/public/products/:productId/try-on/tasks`

Request:

```json
{
  "selectedSize": "M",
  "selectedRussianSize": "RU 46",
  "heightCm": 172,
  "weightKg": 70,
  "gender": "female",
  "bodyType": "regular",
  "bodyTraits": ["wide_shoulders"],
  "customerImageUrl": "http://localhost:3001/uploads/ai-try-on/guest/guest-123/photo.png",
  "customerImageStorageKey": "ai-try-on/guest/guest-123/photo.png",
  "selectedModelId": "model-3",
  "consentAccepted": true
}
```

`selectedModelId` must match one of the ids returned by `GET /api/public/ai-try-on/config`, such as `model-3` or `model-7`.

Response:

```json
{
  "id": "task-uuid",
  "customerId": null,
  "guestSessionId": "guest-123",
  "shopId": "shop-uuid",
  "productId": "product-uuid",
  "selectedSize": "M",
  "selectedRussianSize": "RU 46",
  "providerMode": "mock",
  "status": "PENDING",
  "errorCode": null,
  "errorMessage": null,
  "resultImage": null,
  "sizeRecommendation": {
    "recommendedSize": "M",
    "recommendedRussianSize": "RU 46",
    "note": "AI suggestion is for reference only.",
    "noteRu": "AI-рекомендация носит справочный характер.",
    "noteEn": "AI suggestion is for reference only.",
    "confidence": "medium"
  },
  "createdAt": "2026-05-27T00:00:00.000Z",
  "updatedAt": "2026-05-27T00:00:00.000Z",
  "completedAt": null
}
```

### `GET /api/public/ai-try-on/tasks/:taskId`

Poll until:

- `PENDING`
- `PROCESSING`
- `COMPLETED`
- `FAILED`

Completed example:

```json
{
  "id": "task-uuid",
  "status": "COMPLETED",
  "providerMode": "demo",
  "resultImage": {
    "url": "http://localhost:8000/generated/ai-try-on/demo/task-uuid/1.svg",
    "storageKey": "ai-try-on/demo/task-uuid/1.svg",
    "mimeType": "image/svg+xml",
    "width": 1024,
    "height": 1536
  },
  "sizeRecommendation": {
    "recommendedSize": "M",
    "recommendedRussianSize": "RU 46",
    "note": "This recommendation is for reference only.",
    "noteRu": "Рекомендация носит справочный характер.",
    "noteEn": "This recommendation is for reference only.",
    "confidence": "medium"
  }
}
```

## Validation Codes

- `AI_TRY_ON_DISABLED`
- `AI_TRY_ON_SIZE_REQUIRED`
- `AI_TRY_ON_CONSENT_REQUIRED`
- `AI_TRY_ON_REFERENCE_REQUIRED`
- `AI_TRY_ON_PRODUCT_UNSUPPORTED`
- `AI_TRY_ON_PRODUCT_IMAGE_REQUIRED`
- `AI_TRY_ON_LIMIT_EXCEEDED`
- `AI_TRY_ON_INVALID_BODY_PROFILE`
- `AI_PROVIDER_NOT_CONFIGURED`
- `AI_TRY_ON_IMAGE_UNSUITABLE`
- `AI_PROVIDER_ERROR`
- `AI_TIMEOUT`

## Internal ai-service

### `POST /internal/ai-try-on/generate`

Request:

```json
{
  "taskId": "task-uuid",
  "providerMode": "openai",
  "product": {
    "id": "product-uuid",
    "name": "Virtual Try-On Jacket",
    "imageUrl": "http://backend-nest:3001/uploads/products/.../image.png",
    "category": "jackets",
    "selectedSize": "M",
    "selectedRussianSize": "RU 46"
  },
  "person": {
    "customerImageUrl": null,
    "selectedModelImageUrl": "http://frontend-next:3000/demo/try-on-model-female-regular.png",
    "selectedModelId": "female_regular_165",
    "heightCm": 172,
    "weightKg": 70,
    "gender": "female",
    "bodyType": "regular",
    "bodyTraits": ["wide_shoulders"]
  },
  "prompt": "Create a stable virtual try-on preview...",
  "locale": "ru"
}
```

Response:

```json
{
  "images": [
    {
      "url": "http://localhost:8000/generated/ai-try-on/openai/task-uuid/1.png",
      "storageKey": "ai-try-on/openai/task-uuid/1.png",
      "mimeType": "image/png",
      "width": 1024,
      "height": 1536
    }
  ],
  "provider": "openai",
  "metadata": {
    "promptVersion": "try_on_v1",
    "providerMode": "openai"
  }
}
```
