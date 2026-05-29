import asyncio
import base64
from io import BytesIO
from types import SimpleNamespace

import httpx
import openai
from PIL import Image
import pytest

from app.config import Settings
from app.services.image_provider import ProviderError
from app.services.openai_image_support import DownloadedImage, OpenAIImageSupport
from app.services.openai_try_on_provider import OpenAITryOnProvider
from app.services.try_on_provider import TryOnProviderRequest


class FakeImagesApi:
    def __init__(self, response=None, error: Exception | None = None):
        self.response = response
        self.error = error
        self.edit_calls: list[dict] = []

    def edit(self, **kwargs):
        self.edit_calls.append(kwargs)
        if self.error:
            raise self.error
        return self.response


class FakeClient:
    def __init__(self, images_api: FakeImagesApi):
        self.images = images_api


def create_png_bytes() -> bytes:
    image = Image.new("RGB", (64, 96), color=(55, 110, 155))
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def build_request() -> TryOnProviderRequest:
    return TryOnProviderRequest(
        task_id="task-try-on-1",
        provider_mode="openai",
        product_name="Marketplace jacket",
        product_image_url="https://cdn.example.com/product.png",
        category="jackets",
        selected_size="M",
        selected_russian_size="RU 46",
        prompt="Create a realistic marketplace try-on preview for this jacket.",
        locale="ru",
        customer_image_url="https://cdn.example.com/customer.png",
        selected_model_image_url=None,
        selected_model_id=None,
        height_cm=172,
        weight_kg=70,
        gender="female",
        body_type="regular",
        body_traits=["wide_shoulders"],
    )


def test_openai_try_on_provider_requires_api_key() -> None:
    provider = OpenAITryOnProvider(
        Settings(
            openai_api_key="",
        )
    )

    with pytest.raises(ProviderError) as error:
        asyncio.run(provider.generate(build_request()))

    assert error.value.code == "AI_PROVIDER_NOT_CONFIGURED"


def test_openai_try_on_provider_calls_image_edit(monkeypatch) -> None:
    image_bytes = create_png_bytes()
    response = SimpleNamespace(
        data=[SimpleNamespace(b64_json=base64.b64encode(image_bytes).decode("utf-8"))]
    )
    images_api = FakeImagesApi(response=response)
    provider = OpenAITryOnProvider(
        Settings(
            openai_api_key="test-key",
            ai_try_on_openai_model="gpt-image-1",
            ai_try_on_output_size="1024x1536",
            openai_image_output_format="png",
        )
    )
    provider.support = OpenAIImageSupport(
        provider.settings,
        client_factory=lambda _settings, _timeout: FakeClient(images_api),
    )

    async def stub_download(url: str, *, label: str, unsuitable_code: str):
        expected_code = (
            "INVALID_PRODUCT_IMAGE"
            if label == "product"
            else "INVALID_REFERENCE_IMAGE"
        )
        assert unsuitable_code == expected_code
        return DownloadedImage(
            filename=f"{label}.png",
            payload=create_png_bytes(),
            content_type="image/png",
        )

    monkeypatch.setattr(provider.support, "download_input_image", stub_download)

    results = asyncio.run(provider.generate(build_request()))

    assert len(results) == 1
    assert results[0].mime_type == "image/png"
    assert results[0].provider == "openai"
    assert len(images_api.edit_calls) == 1
    assert images_api.edit_calls[0]["model"] == "gpt-image-1"
    assert images_api.edit_calls[0]["size"] == "1024x1536"
    assert "exact garment from the product image" in images_api.edit_calls[0]["prompt"]
    assert "wide_shoulders" in images_api.edit_calls[0]["prompt"]


def test_openai_try_on_provider_maps_bad_request_to_image_unsuitable(monkeypatch) -> None:
    request = httpx.Request("POST", "https://api.openai.com/v1/images/edits")
    response = httpx.Response(status_code=400, request=request)
    provider = OpenAITryOnProvider(
        Settings(
            openai_api_key="test-key",
        )
    )

    async def stub_download(url: str, *, label: str, unsuitable_code: str):
        return DownloadedImage(
            filename=f"{label}.png",
            payload=create_png_bytes(),
            content_type="image/png",
        )

    monkeypatch.setattr(provider.support, "download_input_image", stub_download)
    async def stub_edit_images(**kwargs):
        raise openai.BadRequestError(
            message="image safety policy violation",
            response=response,
            body=None,
        )

    monkeypatch.setattr(provider.support, "edit_images", stub_edit_images)

    with pytest.raises(ProviderError) as error:
        asyncio.run(provider.generate(build_request()))

    assert error.value.code == "OPENAI_BAD_REQUEST"


def test_openai_try_on_provider_maps_reference_bad_request(monkeypatch) -> None:
    request = httpx.Request("POST", "https://api.openai.com/v1/images/edits")
    response = httpx.Response(status_code=400, request=request)
    provider = OpenAITryOnProvider(
        Settings(
            openai_api_key="test-key",
        )
    )

    async def stub_download(url: str, *, label: str, unsuitable_code: str):
        return DownloadedImage(
            filename=f"{label}.png",
            payload=create_png_bytes(),
            content_type="image/png",
        )

    monkeypatch.setattr(provider.support, "download_input_image", stub_download)

    async def stub_edit_images(**kwargs):
        raise openai.BadRequestError(
            message="reference image must be a clear full-body front-facing photo",
            response=response,
            body={
                "error": {
                    "type": "invalid_request_error",
                    "code": "invalid_image",
                    "message": "reference image must be a clear full-body front-facing photo",
                }
            },
        )

    monkeypatch.setattr(provider.support, "edit_images", stub_edit_images)

    with pytest.raises(ProviderError) as error:
        asyncio.run(provider.generate(build_request()))

    assert error.value.code == "INVALID_REFERENCE_IMAGE"


def test_openai_try_on_provider_uses_structured_model_download_error(monkeypatch) -> None:
    provider = OpenAITryOnProvider(
        Settings(
            openai_api_key="test-key",
        )
    )
    request = build_request()
    request.customer_image_url = None
    request.selected_model_image_url = "https://skidkaberry.com/ai-try-on/models/model2.png"
    request.selected_model_id = "model-2"

    async def stub_download(url: str, *, label: str, unsuitable_code: str):
        if label == "product":
            return DownloadedImage(
                filename="product.png",
                payload=create_png_bytes(),
                content_type="image/png",
            )
        raise ProviderError(
            "The demo model image could not be loaded. Please try another model.",
            status_code=400,
            retryable=False,
            code=unsuitable_code,
        )

    monkeypatch.setattr(provider.support, "download_input_image", stub_download)

    with pytest.raises(ProviderError) as error:
        asyncio.run(provider.generate(request))

    assert error.value.code == "AI_TRY_ON_MODEL_IMAGE_UNAVAILABLE"


def test_openai_input_validation_rejects_non_raster_images(monkeypatch) -> None:
    support = OpenAIImageSupport(
        Settings(
            openai_api_key="test-key",
        )
    )

    class FakeResponse:
        headers = {
            "content-type": "image/svg+xml",
            "content-length": "32",
        }

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        def raise_for_status(self):
            return None

        async def aiter_bytes(self):
            yield b"<svg></svg>"

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        def stream(self, method: str, url: str):
            return FakeResponse()

    monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)

    with pytest.raises(ProviderError) as error:
        asyncio.run(
            support.download_input_image(
                "https://cdn.example.com/model.svg",
                label="person",
                unsuitable_code="AI_TRY_ON_IMAGE_UNSUITABLE",
            )
        )

    assert error.value.code == "AI_TRY_ON_IMAGE_UNSUITABLE"
