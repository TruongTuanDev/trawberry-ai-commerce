from __future__ import annotations

import json
import os
import sys

from fastapi.testclient import TestClient

from app.config import get_settings
from app.dependencies import get_ai_image_service, get_provider
from app.main import app


from dotenv import load_dotenv

def main() -> int:
    load_dotenv()
    run_smoke = os.getenv("RUN_OPENAI_SMOKE", "").lower() == "true"
    api_key = os.getenv("OPENAI_API_KEY", "")
    front_image_url = os.getenv(
        "OPENAI_SMOKE_FRONT_IMAGE_URL",
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
    )

    if not run_smoke:
        print("SKIP: RUN_OPENAI_SMOKE is not true.")
        return 0

    if not api_key:
        print("SKIP: OPENAI_API_KEY is not configured.")
        return 0

    get_settings.cache_clear()
    get_provider.cache_clear()
    get_ai_image_service.cache_clear()

    settings = get_settings()
    model = settings.openai_image_model
    print(f"Running OpenAI smoke test using model: {model}")

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
    print(json.dumps({"status_code": response.status_code, "body": body}, ensure_ascii=False))

    if response.status_code == 422:
        detail = body.get("detail", "")
        if "Billing hard limit has been reached" in detail or "quota" in detail.lower():
            print("Account/Billing Quota Issue: The OpenAI account has reached its billing hard limit or quota.")
            return 0
        return 1

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
