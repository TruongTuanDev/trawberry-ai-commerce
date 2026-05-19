# OpenAI Image Provider

## Scope
`OpenAIImageProvider` is the real provider implementation inside `ai-service`.

It is only active when:
- `AI_IMAGE_PROVIDER=openai`

Default local/dev remains:
- `AI_IMAGE_PROVIDER=mock`

Current default verified seller runtime remains:
- `AI_WORKER_MODE=ai-service`
- `AI_IMAGE_PROVIDER=mock`
- `OPENAI real` is opt-in only and not part of default pass

## Opt-In Only Runtime Verification

Real OpenAI verification is never part of default tests.

Required env:
- `RUN_OPENAI_SMOKE=true`
- `AI_WORKER_MODE=ai-service`
- `AI_IMAGE_PROVIDER=openai`
- `OPENAI_API_KEY=...`
- `AI_SERVICE_INTERNAL_TOKEN=...`
- valid `STORAGE_DRIVER`

If `RUN_OPENAI_SMOKE=false`:
- smoke scripts print `SKIPPED`
- exit `0`

If `RUN_OPENAI_SMOKE=true` but required env is missing:
- smoke fails
- exit is non-zero

## API Choice
The implementation uses the OpenAI Images API.

Selection logic:
- with input references:
  - use `images.edit`
- without input references:
  - use `images.generate`

This follows the official OpenAI docs:
- image generation guide: https://platform.openai.com/docs/guides/image-generation/image-generation
- Images API reference: https://platform.openai.com/docs/api-reference/images?lang=python

## Model Handling (GPT Image vs DALL-E 2)
The provider dynamically handles model differences:
- **GPT Image models** (e.g. `gpt-image-1`, `gpt-image-1.5`): This is the default. Inputs can be standard JPEG, PNG, or WEBP. All image processing uses the standard parameters provided by the config.
- **Legacy DALL-E 2** (`dall-e-2`): If used, this triggers a fallback compatibility mode. It forces inputs to be converted to PNG internally using Pillow (with alpha channels) and strips out incompatible API parameters like `quality` to ensure DALL-E 2 endpoints do not throw 400 parameter errors.

## Inputs
The provider accepts:
- `frontImageUrl`
- `backImageUrl`
- `modelImageUrl`

Downloaded references are validated for:
- HTTP success
- allowed image content type:
  - `image/jpeg`
  - `image/png`
  - `image/webp`
- maximum download size
- request timeout
- non-empty decodable image payload

When `backend-nest` runs inside Docker, image URLs sent to `ai-service` should use an internal base such as `http://backend-nest:3001`, not `localhost`.

## Outputs
The provider returns:
- image bytes decoded from `b64_json`
- `provider=OPENAI`
- `width`
- `height`
- `mime_type`

Storage is handled later by `StorageService`.

## Quality Guard
Before the provider result is returned to `backend-nest`, the generated binary is checked for:
- non-empty file size
- readable image binary
- allowed MIME:
  - `image/jpeg`
  - `image/png`
  - `image/webp`
- readable `width`
- readable `height`

If any check fails, `ai-service` returns a provider error and `backend-nest` can mark the task `FAILED` and refund credit.

## Error Mapping
- missing `OPENAI_API_KEY`:
  - safe code: `OPENAI_UNAUTHORIZED`
- rate limit:
  - safe code: `OPENAI_RATE_LIMIT`
- billing hard limit:
  - safe code: `OPENAI_BILLING_HARD_LIMIT`
- quota exhausted:
  - safe code: `OPENAI_QUOTA_EXCEEDED`
- timeout:
  - safe code: `OPENAI_RATE_LIMIT`
- malformed response:
  - safe code: `AI_SERVICE_INVALID_RESPONSE`
- bad request / policy-style rejection:
  - safe code: `OPENAI_BAD_REQUEST`
- storage write failure:
  - safe code: `STORAGE_WRITE_FAILED`

No API key is logged or returned.

Additional safe diagnostics now returned on provider failures:
- `safeOpenAiStatus`
- `safeOpenAiErrorType`
- `safeOpenAiErrorCode`
- `safeOpenAiMessageSnippet`
- `requestMode`
- `hasReferenceImages`
- `imageCount`
- `model`

## Seller UI Status
- `/seller/ai-images` can surface:
  - `OpenAI real mode`
  - `OpenAI real blocked`
  - `AI service mock mode`
  - `AI service offline`
- Default tests remain mock-safe and do not call OpenAI.

## Storage Notes
Recommended when using OpenAI for real output:
- `STORAGE_DRIVER=local`
- or `STORAGE_DRIVER=s3`

`STORAGE_DRIVER=mock` is metadata-only and not ideal for real output persistence.

## Tests
Covered by unit tests with mocked OpenAI client:
- provider selection
- `generate` path
- `edit` path
- quality guard valid image
- quality guard empty/invalid image
- malformed response handling
- rate limit mapping
- secret redaction helper
- smoke script skip path

No default test calls OpenAI directly.

## Optional Smoke
Run only when explicitly enabled:
- `RUN_OPENAI_SMOKE=true`
- `OPENAI_API_KEY=...`
- `AI_IMAGE_PROVIDER=openai`

Command:
```bash
python scripts/smoke_openai_provider.py
```

If the flag is false, the script prints `SKIP` and exits successfully.

If the flag is true but the key, provider mode, or internal token is missing:
- the script fails
- no key is printed

If it runs successfully, it verifies:
- `taskId`
- `status=COMPLETED`
- `images.length=1`
- `url`
- `storageKey`
- `provider=OPENAI`

## 2026-05-19 Real Runtime Debug Result

- request contract issue was fixed for `gpt-image-1`
- internal Docker image URL reachability was fixed by rewriting backend asset URLs to `BACKEND_INTERNAL_BASE_URL`
- current real runtime blocker is now account-side:
  - `OPENAI_BILLING_HARD_LIMIT`
  - `safeOpenAiErrorType=billing_limit_user_error`
  - `safeOpenAiErrorCode=billing_hard_limit_reached`
- this means the provider is now reached successfully and the previous `OPENAI_BAD_REQUEST` contract failure is no longer the active blocker
