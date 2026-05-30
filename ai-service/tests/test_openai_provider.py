import asyncio
import base64
from io import BytesIO
from types import SimpleNamespace

import httpx
import openai
from PIL import Image
import pytest

from app.config import Settings, get_settings
from app.dependencies import get_provider
from app.services.image_provider import ProviderError, ProviderGenerateRequest
from app.services.openai_image_provider import OpenAIImageProvider


class FakeImagesApi:
    def __init__(self, response=None, error: Exception | None = None):
        self.response = response
        self.error = error
        self.generate_calls: list[dict] = []
        self.edit_calls: list[dict] = []

    def generate(self, **kwargs):
        self.generate_calls.append(kwargs)
        if self.error:
            raise self.error
        return self.response

    def edit(self, **kwargs):
        self.edit_calls.append(kwargs)
        if self.error:
            raise self.error
        return self.response


class FakeClient:
    def __init__(self, images_api: FakeImagesApi):
        self.images = images_api


def create_image_bytes(format_name: str) -> bytes:
    image = Image.new("RGB", (48, 32), color=(25, 50, 75))
    buffer = BytesIO()
    image.save(buffer, format=format_name)
    return buffer.getvalue()


def build_request(front_image_url: str | None = None) -> ProviderGenerateRequest:
    return ProviderGenerateRequest(
        task_id="task-1",
        shop_id="shop-1",
        product_id="prod-1",
        quantity=1,
        task_type="PRODUCT_MODEL_IMAGE",
        style_preset="STUDIO",
        prompt="Create a clean marketplace image that preserves the original product exactly.",
        front_image_url=front_image_url,
        back_image_url=None,
        model_image_url=None,
    )


def test_openai_provider_uses_generate_when_no_input_images() -> None:
    image_bytes = create_image_bytes("JPEG")
    response = SimpleNamespace(
        data=[SimpleNamespace(b64_json=base64.b64encode(image_bytes).decode("utf-8"))]
    )
    images_api = FakeImagesApi(response=response)
    provider = OpenAIImageProvider(
        Settings(
            ai_image_provider="openai",
            openai_api_key="test-key",
            openai_image_model="gpt-image-1",
            openai_image_output_format="jpeg",
        ),
        client_factory=lambda _settings: FakeClient(images_api),
    )

    results = asyncio.run(provider.generate(build_request()))

    assert len(results) == 1
    assert results[0].image_bytes == image_bytes
    assert results[0].provider == "OPENAI"
    assert images_api.generate_calls[0]["model"] == "gpt-image-1"
    assert images_api.generate_calls[0]["quality"] == "medium"
    assert images_api.generate_calls[0]["output_format"] == "jpeg"
    assert "response_format" not in images_api.generate_calls[0]
    assert images_api.edit_calls == []


def test_openai_provider_uses_edit_when_input_images_are_present(monkeypatch) -> None:
    image_bytes = create_image_bytes("PNG")
    response = SimpleNamespace(
        data=[SimpleNamespace(b64_json=base64.b64encode(image_bytes).decode("utf-8"))]
    )
    images_api = FakeImagesApi(response=response)
    provider = OpenAIImageProvider(
        Settings(
            ai_image_provider="openai",
            openai_api_key="test-key",
            openai_image_model="gpt-image-1",
            openai_image_output_format="png",
        ),
        client_factory=lambda _settings: FakeClient(images_api),
    )

    async def stub_download(_url: str, label: str):
        return SimpleNamespace(
            filename=f"{label}.png",
            payload=b"reference-image",
            content_type="image/png",
        )

    monkeypatch.setattr(provider, "_download_input_image", stub_download)

    results = asyncio.run(
        provider.generate(build_request(front_image_url="https://cdn.example.com/front.png"))
    )

    assert len(results) == 1
    assert results[0].mime_type == "image/png"
    assert images_api.generate_calls == []
    assert len(images_api.edit_calls) == 1
    assert images_api.edit_calls[0]["extra_body"]["output_format"] == "png"
    assert images_api.edit_calls[0]["quality"] == "medium"
    assert "response_format" not in images_api.edit_calls[0]


def test_provider_selection_respects_env(monkeypatch) -> None:
    monkeypatch.setenv("AI_IMAGE_PROVIDER", "mock")
    get_settings.cache_clear()
    get_provider.cache_clear()
    assert get_provider().provider_name == "MOCK"

    monkeypatch.setenv("AI_IMAGE_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    get_settings.cache_clear()
    get_provider.cache_clear()
    assert get_provider().provider_name == "OPENAI"


def test_openai_provider_maps_malformed_response() -> None:
    response = SimpleNamespace(data=[SimpleNamespace(b64_json=None)])
    images_api = FakeImagesApi(response=response)
    provider = OpenAIImageProvider(
        Settings(
            ai_image_provider="openai",
            openai_api_key="test-key",
        ),
        client_factory=lambda _settings: FakeClient(images_api),
    )

    with pytest.raises(ProviderError) as error:
        asyncio.run(provider.generate(build_request()))

    assert "b64_json" in str(error.value)


def test_safe_message_redacts_api_key() -> None:
    provider = OpenAIImageProvider(
        Settings(
            ai_image_provider="openai",
            openai_api_key="super-secret-key",
        ),
    )

    sanitized = provider._safe_message(RuntimeError("token=super-secret-key rejected"))

    assert "super-secret-key" not in sanitized
    assert "[redacted]" in sanitized


def test_openai_provider_maps_rate_limit_error() -> None:
    request = httpx.Request("POST", "https://api.openai.com/v1/images/generations")
    response = httpx.Response(status_code=429, request=request)
    images_api = FakeImagesApi(
        error=openai.RateLimitError(
            "rate limited",
            response=response,
            body=None,
        )
    )
    provider = OpenAIImageProvider(
        Settings(
            ai_image_provider="openai",
            openai_api_key="test-key",
        ),
        client_factory=lambda _settings: FakeClient(images_api),
    )

    with pytest.raises(ProviderError) as error:
        asyncio.run(provider.generate(build_request()))

    assert error.value.status_code == 503
    assert error.value.retryable is True
    assert error.value.code == "OPENAI_RATE_LIMIT"


def test_openai_provider_maps_bad_request_with_safe_diagnostics() -> None:
    request = httpx.Request("POST", "https://api.openai.com/v1/images/edits")
    response = httpx.Response(status_code=400, request=request)
    images_api = FakeImagesApi(
        error=openai.BadRequestError(
            message="unsupported parameter",
            response=response,
            body={
                "error": {
                    "type": "invalid_request_error",
                    "code": "invalid_parameter",
                    "message": "Unknown parameter: response_format",
                }
            },
        )
    )
    provider = OpenAIImageProvider(
        Settings(
            ai_image_provider="openai",
            openai_api_key="test-key",
        ),
        client_factory=lambda _settings: FakeClient(images_api),
    )

    with pytest.raises(ProviderError) as error:
        asyncio.run(provider.generate(build_request()))

    assert error.value.code == "OPENAI_BAD_REQUEST"
    assert error.value.diagnostics["safeOpenAiStatus"] == 400
    assert error.value.diagnostics["safeOpenAiErrorType"] == "invalid_request_error"
    assert error.value.diagnostics["safeOpenAiErrorCode"] == "invalid_parameter"
    assert "response_format" in error.value.diagnostics["safeOpenAiMessageSnippet"]


def test_openai_provider_maps_missing_key_to_safe_code() -> None:
    provider = OpenAIImageProvider(
        Settings(
            ai_image_provider="openai",
            openai_api_key="",
        ),
    )

    with pytest.raises(ProviderError) as error:
        asyncio.run(provider.generate(build_request()))

    assert error.value.code == "OPENAI_UNAUTHORIZED"


def test_openai_provider_uses_gpt_image_models_properly(monkeypatch) -> None:
    image_bytes = create_image_bytes("JPEG")
    response = SimpleNamespace(
        data=[SimpleNamespace(b64_json=base64.b64encode(image_bytes).decode("utf-8"))]
    )
    images_api = FakeImagesApi(response=response)
    
    async def stub_download(_url: str, label: str):
        return SimpleNamespace(
            filename=f"{label}.jpg",
            payload=b"reference-image",
            content_type="image/jpeg",
        )

    provider_1 = OpenAIImageProvider(
        Settings(ai_image_provider="openai", openai_api_key="test", openai_image_model="gpt-image-1", openai_image_output_format="jpeg"),
        client_factory=lambda _settings: FakeClient(images_api),
    )
    monkeypatch.setattr(provider_1, "_download_input_image", stub_download)
    asyncio.run(provider_1.generate(build_request(front_image_url="https://cdn.example.com/front.jpg")))
    
    assert images_api.edit_calls[-1]["model"] == "gpt-image-1"
    assert images_api.edit_calls[-1]["quality"] == "medium"
    assert images_api.edit_calls[-1]["extra_body"]["output_format"] == "jpeg"
    assert "response_format" not in images_api.edit_calls[-1]
    
    provider_15 = OpenAIImageProvider(
        Settings(ai_image_provider="openai", openai_api_key="test", openai_image_model="gpt-image-1.5", openai_image_output_format="jpeg"),
        client_factory=lambda _settings: FakeClient(images_api),
    )
    monkeypatch.setattr(provider_15, "_download_input_image", stub_download)
    asyncio.run(provider_15.generate(build_request(front_image_url="https://cdn.example.com/front.jpg")))
    
    assert images_api.edit_calls[-1]["model"] == "gpt-image-1.5"
    assert images_api.edit_calls[-1]["image"]
    assert "response_format" not in images_api.edit_calls[-1]


def test_openai_provider_uses_dalle2_properly(monkeypatch) -> None:
    image_bytes = create_image_bytes("PNG")
    response = SimpleNamespace(
        data=[SimpleNamespace(b64_json=base64.b64encode(image_bytes).decode("utf-8"))]
    )
    images_api = FakeImagesApi(response=response)
    
    async def stub_download(_url: str, label: str):
        return SimpleNamespace(
            filename=f"{label}.png",
            payload=create_image_bytes("PNG"),
            content_type="image/png",
        )

    provider = OpenAIImageProvider(
        Settings(ai_image_provider="openai", openai_api_key="test", openai_image_model="dall-e-2", openai_image_output_format="png"),
        client_factory=lambda _settings: FakeClient(images_api),
    )
    monkeypatch.setattr(provider, "_download_input_image", stub_download)
    asyncio.run(provider.generate(build_request(front_image_url="https://cdn.example.com/front.png")))
    
    assert images_api.edit_calls[-1]["model"] == "dall-e-2"
    assert "response_format" not in images_api.edit_calls[-1]
    assert "quality" not in images_api.edit_calls[-1]
