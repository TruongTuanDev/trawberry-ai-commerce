from __future__ import annotations

import json
import os
from pathlib import Path
import sys

SERVICE_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = SERVICE_ROOT.parent
if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))

from fastapi.testclient import TestClient

from app.config import get_settings
from app.dependencies import get_ai_image_service, get_provider
from app.main import app


from dotenv import load_dotenv


def _bool_env(name: str) -> bool:
    return os.getenv(name, "").strip().lower() == "true"


def main() -> int:
    load_dotenv(REPO_ROOT / "infra" / ".env")
    load_dotenv(SERVICE_ROOT / ".env")
    run_smoke = _bool_env("RUN_OPENAI_SMOKE")
    api_key = os.getenv("OPENAI_API_KEY", "")
    provider = os.getenv("AI_IMAGE_PROVIDER", "mock").strip().lower()
    storage_driver = os.getenv("STORAGE_DRIVER", "mock").strip().lower()
    internal_token = os.getenv("AI_SERVICE_INTERNAL_TOKEN", "")
    front_image_url = os.getenv(
        "OPENAI_SMOKE_FRONT_IMAGE_URL",
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
    )

    if not run_smoke:
        print("SKIP: RUN_OPENAI_SMOKE is not true.")
        return 0

    if not api_key:
        print("FAIL: RUN_OPENAI_SMOKE=true but OPENAI_API_KEY is missing.")
        return 1
    if provider != "openai":
        print("FAIL: RUN_OPENAI_SMOKE=true requires AI_IMAGE_PROVIDER=openai.")
        return 1
    if not internal_token:
        print("FAIL: RUN_OPENAI_SMOKE=true requires AI_SERVICE_INTERNAL_TOKEN.")
        return 1
    if storage_driver not in {"mock", "local", "s3"}:
        print(f"FAIL: Unsupported STORAGE_DRIVER '{storage_driver}'.")
        return 1

    get_settings.cache_clear()
    get_provider.cache_clear()
    get_ai_image_service.cache_clear()

    settings = get_settings()
    model = settings.openai_image_model
    print(
        json.dumps(
            {
                "status": "RUNNING",
                "provider": settings.ai_image_provider,
                "storageDriver": settings.storage_driver,
                "model": model,
            }
        )
    )

    client = TestClient(app)
    token = settings.ai_service_internal_token
    response = client.post(
        "/internal/ai-images/generate",
        headers={"X-Internal-Token": token},
        json={
            "taskId": "openai-smoke-task",
            "shopId": "smoke-shop",
            "productId": "smoke-product",
            "quantity": 1,
            "taskType": "PRODUCT_MODEL_IMAGE",
            "stylePreset": "STUDIO",
            "prompt": "Create a clean marketplace studio image while keeping the original product unchanged.",
            "inputImages": {
                "frontImageUrl": front_image_url
            },
        },
    )

    body = response.json()
    print(json.dumps({"statusCode": response.status_code, "body": body}, ensure_ascii=False))

    if response.status_code != 200:
        return 1

    images = body.get("images", [])
    if (
        not body.get("taskId")
        or body.get("status") != "COMPLETED"
        or len(images) != 1
        or not images[0].get("url")
        or not images[0].get("storageKey")
        or images[0].get("provider") != "OPENAI"
    ):
        print("FAIL: OpenAI smoke response did not match the expected contract.")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
