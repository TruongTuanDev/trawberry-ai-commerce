# ai-service

FastAPI service for internal marketplace AI image generation orchestration.

## Current state
- internal API only
- `MockImageProvider` remains the default safe provider
- `OpenAIImageProvider` is now implemented and enabled only when `AI_IMAGE_PROVIDER=openai`
- internal token protection
- mock, local, or S3-compatible storage
- current default verified marketplace runtime is `AI_IMAGE_PROVIDER=mock` with `backend-nest` calling this service

## Stack
- Python
- FastAPI
- Pydantic
- Uvicorn
- httpx
- boto3
- OpenAI Python SDK
- Docker

## Endpoints
- `GET /health`
- `POST /internal/ai-images/generate`

Health response now includes safe runtime metadata for upstream diagnostics:
- `aiImageProvider`
- `storageDriver`
- `openaiConfigured`
- `openaiSmokeEnabled`
- `safeErrorCode`
- `tryOnReady`

## Internal auth
All internal generation calls require:
- header: `X-Internal-Token`
- env: `AI_SERVICE_INTERNAL_TOKEN`

If the token is missing or invalid, the service returns `401`.

## Provider selection

### `AI_IMAGE_PROVIDER=mock`
- default local/dev mode
- never calls OpenAI
- reuses the input URL as mock output metadata

### `AI_IMAGE_PROVIDER=openai`
- requires `OPENAI_API_KEY`
- uses the OpenAI Images API
- chooses:
  - `images.edit` when reference images exist
  - `images.generate` when no reference image exists
- GPT image edit requests intentionally avoid unsupported parameter combinations that caused prior `400` failures

## Important env
- `ENVIRONMENT=development|test|production`
- `AI_IMAGE_PROVIDER=mock|openai`
- `OPENAI_API_KEY=`
- `OPENAI_IMAGE_MODEL=gpt-image-1`
- `OPENAI_IMAGE_SIZE=1024x1536`
- `OPENAI_IMAGE_QUALITY=medium`
- `OPENAI_IMAGE_OUTPUT_FORMAT=jpeg`
- `OPENAI_IMAGE_TIMEOUT_SECONDS=120`
- `OPENAI_IMAGE_MAX_RETRIES=1`
- `OPENAI_INPUT_IMAGE_MAX_BYTES=15728640`
- `OPENAI_INPUT_IMAGE_TIMEOUT_SECONDS=20`
- `STORAGE_DRIVER=mock|local|s3`
- `STORAGE_LOCAL_ROOT=generated`
- `STORAGE_PUBLIC_BASE_URL=http://localhost:8000/generated`

## Request contract

```json
{
  "taskId": "task-123",
  "shopId": "shop-1",
  "productId": "prod-1",
  "quantity": 2,
  "taskType": "PRODUCT_MODEL_IMAGE",
  "stylePreset": "STUDIO",
  "prompt": "Create a clean studio AI product model image for marketplace listing.",
  "inputImages": {
    "frontImageUrl": "https://cdn.example.com/front.jpg",
    "backImageUrl": "https://cdn.example.com/back.jpg",
    "modelImageUrl": "https://cdn.example.com/model.jpg"
  }
}
```

## Response contract

```json
{
  "taskId": "task-123",
  "status": "COMPLETED",
  "images": [
    {
      "url": "http://localhost:8000/generated/ai-images/shop-1/prod-1/task-123/1.jpg",
      "storageKey": "ai-images/shop-1/prod-1/task-123/1.jpg",
      "provider": "OPENAI",
      "width": 1024,
      "height": 1536
    }
  ]
}
```

## Storage behavior

### `STORAGE_DRIVER=mock`
- good for local metadata-only mock flow
- not recommended for real OpenAI outputs because assets are not persisted as real binary files

### `STORAGE_DRIVER=local`
- writes generated image bytes under `generated/`
- serves them under `/generated/*`

### `STORAGE_DRIVER=s3`
- uploads generated image bytes to S3/MinIO-compatible object storage

## Local run

### 1. Create venv and install
```bash
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Configure env
```bash
Copy-Item .env.example .env
```

Profiles:
- development: `.env.example`
- test: `.env.test.example`
- production: inject real values from the deploy platform; do not reuse local examples unchanged

### 3. Start with mock provider
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Recommended local defaults:
- `AI_IMAGE_PROVIDER=mock`
- `STORAGE_DRIVER=mock`

If you want persisted local files instead of metadata-only mock storage:
- set `STORAGE_DRIVER=local`
- keep `AI_IMAGE_PROVIDER=mock` unless you intentionally test OpenAI with a real key

### 4. Start with OpenAI provider
Set:
- `AI_IMAGE_PROVIDER=openai`
- `OPENAI_API_KEY=...`
- `STORAGE_DRIVER=local` or `STORAGE_DRIVER=s3`

Then start:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Tests
```bash
python -m compileall app
python -m pytest -q
```

Test isolation rules:
- `pytest` forces `ENVIRONMENT=test`
- `pytest` forces `AI_IMAGE_PROVIDER=mock`
- `pytest` forces `STORAGE_DRIVER=mock`
- `pytest` clears S3/OpenAI runtime env so tests never require MinIO, S3, or OpenAI

## Optional OpenAI smoke
This never runs by default.

```bash
$env:RUN_OPENAI_SMOKE='true'
$env:AI_IMAGE_PROVIDER='openai'
$env:OPENAI_API_KEY='...'
python scripts/smoke_openai_provider.py
```

If `RUN_OPENAI_SMOKE` is false, the script prints `SKIP` and exits successfully.

If `RUN_OPENAI_SMOKE` is true but required env is missing, the script fails clearly.

If OpenAI billing, quota, auth, or storage fails, the script fails clearly with safe error output.

## Host And Docker Reachability

- `ai-service` receives image URLs from `backend-nest`
- when both services run in Docker, those URLs must be reachable from inside the `ai-service` container
- the backend now rewrites local product image URLs to `BACKEND_INTERNAL_BASE_URL` before sending them here
- host-side smoke scripts should use `http://127.0.0.1:8000`, not `http://ai-service:8000`

## Docker
```bash
docker build -t strawberry-ai-service .
docker run --rm -p 8000:8000 --env-file .env strawberry-ai-service
```

## Visual Product Embeddings

- `POST /internal/visual-search/embeddings` accepts exactly one image URL or base64 image and requires `X-Internal-Token`.
- Tests and development default to deterministic `mock` vectors.
- Production uses `VISUAL_EMBEDDING_PROVIDER=open_clip` with `ViT-B-32` and 512 normalized dimensions.
- Public URL downloads require HTTPS and reject private/reserved addresses. Explicit Compose-only hosts such as `backend-nest` and `minio` are allowlisted.
- Model weights are downloaded on first real use and cached in the Compose `ai-model-cache` volume.

## Notes
- `frontend-next` still talks only to `backend-nest`.
- `backend-nest` controls credits, task status, and retries.
- OpenAI errors are surfaced as clear HTTP failures so `backend-nest` can mark the task `FAILED` and refund credit using the existing flow.
- Current real-runtime blocker after contract repair is account-side `OPENAI_BILLING_HARD_LIMIT`, not the old request-contract `400` and not Docker image-download failure.
