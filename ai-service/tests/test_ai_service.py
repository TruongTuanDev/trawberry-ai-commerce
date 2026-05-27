from fastapi.testclient import TestClient

from app.config import get_settings
from app.dependencies import (
    get_ai_image_service,
    get_provider,
    get_try_on_providers,
    get_try_on_service,
)
from app.main import app


client = TestClient(app)


def setup_function() -> None:
    get_settings.cache_clear()
    get_provider.cache_clear()
    get_ai_image_service.cache_clear()
    get_try_on_providers.cache_clear()
    get_try_on_service.cache_clear()


def test_health() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "OK"
    assert body["aiImageProvider"] == "mock"
    assert body["storageDriver"] == "mock"
    assert body["openaiConfigured"] is False
    assert body["openaiSmokeEnabled"] is False
    assert body["safeErrorCode"] == "OPENAI_UNAUTHORIZED"
    assert body["tryOnReady"] is True


def test_health_reports_openai_blocked_when_provider_is_openai_without_key(monkeypatch) -> None:
    monkeypatch.setenv("AI_IMAGE_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "")
    get_settings.cache_clear()
    get_provider.cache_clear()
    get_ai_image_service.cache_clear()

    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["aiImageProvider"] == "openai"
    assert body["openaiConfigured"] is False
    assert body["safeErrorCode"] == "OPENAI_UNAUTHORIZED"


def test_health_reports_openai_configuration_even_when_mock_provider_is_active(
    monkeypatch,
) -> None:
    monkeypatch.setenv("AI_IMAGE_PROVIDER", "mock")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key-that-should-not-mark-mock-ready")
    get_settings.cache_clear()
    get_provider.cache_clear()
    get_ai_image_service.cache_clear()

    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["aiImageProvider"] == "mock"
    assert body["openaiConfigured"] is True
    assert body["safeErrorCode"] is None


def test_generate_with_valid_token(monkeypatch) -> None:
    monkeypatch.setenv("AI_IMAGE_PROVIDER", "mock")
    token = get_settings().ai_service_internal_token

    response = client.post(
        "/internal/ai-images/generate",
        headers={"X-Internal-Token": token},
        json={
            "taskId": "task-1",
            "shopId": "shop-1",
            "productId": "prod-1",
            "quantity": 2,
            "taskType": "PRODUCT_MODEL_IMAGE",
            "stylePreset": "STUDIO",
            "prompt": "Create a clean studio AI product model image for marketplace listing.",
            "inputImages": {
                "frontImageUrl": "https://cdn.example.com/front.jpg",
            },
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "COMPLETED"
    assert len(body["images"]) == 2
    assert all(image["provider"] == "MOCK" for image in body["images"])


def test_generate_missing_token_returns_401() -> None:
    response = client.post(
        "/internal/ai-images/generate",
        json={
            "taskId": "task-1",
            "shopId": "shop-1",
            "productId": "prod-1",
            "quantity": 1,
            "taskType": "PRODUCT_MODEL_IMAGE",
            "prompt": "Create a clean studio AI product model image for marketplace listing.",
            "inputImages": {},
        },
    )

    assert response.status_code == 401


def test_generate_invalid_token_returns_401() -> None:
    response = client.post(
        "/internal/ai-images/generate",
        headers={"X-Internal-Token": "wrong-token"},
        json={
            "taskId": "task-1",
            "shopId": "shop-1",
            "productId": "prod-1",
            "quantity": 1,
            "taskType": "PRODUCT_MODEL_IMAGE",
            "prompt": "Create a clean studio AI product model image for marketplace listing.",
            "inputImages": {},
        },
    )

    assert response.status_code == 401


def test_quantity_min_max_validation() -> None:
    token = get_settings().ai_service_internal_token

    too_low = client.post(
        "/internal/ai-images/generate",
        headers={"X-Internal-Token": token},
        json={
            "taskId": "task-low",
            "shopId": "shop-1",
            "productId": "prod-1",
            "quantity": 0,
            "taskType": "PRODUCT_MODEL_IMAGE",
            "prompt": "Create a clean studio AI product model image for marketplace listing.",
            "inputImages": {},
        },
    )
    too_high = client.post(
        "/internal/ai-images/generate",
        headers={"X-Internal-Token": token},
        json={
            "taskId": "task-high",
            "shopId": "shop-1",
            "productId": "prod-1",
            "quantity": 11,
            "taskType": "PRODUCT_MODEL_IMAGE",
            "prompt": "Create a clean studio AI product model image for marketplace listing.",
            "inputImages": {},
        },
    )

    assert too_low.status_code == 422
    assert too_high.status_code == 422


def test_mock_provider_returns_requested_image_count(monkeypatch) -> None:
    monkeypatch.setenv("AI_IMAGE_PROVIDER", "mock")
    token = get_settings().ai_service_internal_token

    response = client.post(
        "/internal/ai-images/generate",
        headers={"X-Internal-Token": token},
        json={
            "taskId": "task-quantity",
            "shopId": "shop-1",
            "productId": "prod-1",
            "quantity": 4,
            "taskType": "DETAIL_SHOT",
            "stylePreset": "DETAIL",
            "prompt": "Create detail-focused marketplace images that preserve the original product exactly.",
            "inputImages": {
                "frontImageUrl": "https://cdn.example.com/front.jpg",
                "backImageUrl": "https://cdn.example.com/back.jpg",
            },
        },
    )

    assert response.status_code == 200
    assert len(response.json()["images"]) == 4


def test_generate_try_on_mock() -> None:
    token = get_settings().ai_service_internal_token

    response = client.post(
        "/internal/ai-try-on/generate",
        headers={"X-Internal-Token": token},
        json={
            "taskId": "try-on-task-1",
            "providerMode": "mock",
            "product": {
                "id": "prod-1",
                "name": "Marketplace jacket",
                "imageUrl": "https://cdn.example.com/product.jpg",
                "category": "jackets",
                "selectedSize": "M",
                "selectedRussianSize": "RU 46",
            },
            "person": {
                "selectedModelId": "female_regular_165",
                "gender": "female",
                "bodyType": "regular",
                "bodyTraits": ["wide_shoulders"],
            },
            "prompt": "Create a stable marketplace virtual try-on preview for this jacket.",
            "locale": "ru",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "mock"
    assert len(body["images"]) == 1
    assert body["images"][0]["mimeType"] == "image/svg+xml"


def test_generate_try_on_demo() -> None:
    token = get_settings().ai_service_internal_token

    response = client.post(
        "/internal/ai-try-on/generate",
        headers={"X-Internal-Token": token},
        json={
            "taskId": "try-on-task-demo",
            "providerMode": "demo",
            "product": {
                "id": "prod-1",
                "name": "Marketplace dress",
                "imageUrl": "https://cdn.example.com/product.jpg",
                "category": "dresses",
                "selectedSize": "S",
                "selectedRussianSize": "RU 44",
            },
            "person": {
                "selectedModelId": "female_slim_168",
                "gender": "female",
                "bodyType": "slim",
                "bodyTraits": ["long_legs"],
            },
            "prompt": "Create a stable marketplace virtual try-on preview for this dress.",
            "locale": "en",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "demo"
    assert len(body["images"]) == 1
    assert body["images"][0]["mimeType"] == "image/svg+xml"


def test_generate_try_on_openai_missing_key_returns_configured_error(monkeypatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "")
    get_settings.cache_clear()
    get_try_on_providers.cache_clear()
    get_try_on_service.cache_clear()
    token = get_settings().ai_service_internal_token

    response = client.post(
        "/internal/ai-try-on/generate",
        headers={"X-Internal-Token": token},
        json={
            "taskId": "try-on-task-2",
            "providerMode": "openai",
            "product": {
                "id": "prod-1",
                "name": "Marketplace jacket",
                "imageUrl": "https://cdn.example.com/product.jpg",
            },
            "person": {
                "selectedModelId": "male_regular_175",
            },
            "prompt": "Create a stable marketplace virtual try-on preview for this jacket.",
            "locale": "ru",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "AI_PROVIDER_NOT_CONFIGURED"
