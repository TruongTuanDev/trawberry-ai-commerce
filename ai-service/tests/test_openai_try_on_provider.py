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


def assert_named_upload(upload, *, expected_content_type: str, allowed_extensions: tuple[str, ...]) -> None:
    assert isinstance(upload, tuple)
    assert len(upload) == 3
    filename, fileobj, content_type = upload
    assert isinstance(filename, str)
    assert filename.endswith(allowed_extensions)
    assert getattr(fileobj, "name", None) == filename
    assert content_type == expected_content_type
    assert content_type != "application/octet-stream"


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

    async def stub_download(url: str, *, label: str, unsuitable_code: str, is_demo_model: bool = False):
        assert unsuitable_code in ("INVALID_PRODUCT_IMAGE", "INVALID_REFERENCE_IMAGE", "DEMO_MODEL_IMAGE_NOT_FOUND")
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
    assert images_api.edit_calls[0]["extra_body"]["output_format"] == "png"
    assert "response_format" not in images_api.edit_calls[0]
    assert "exact garment from the product image" in images_api.edit_calls[0]["prompt"]
    assert "wide_shoulders" in images_api.edit_calls[0]["prompt"]
    uploads = images_api.edit_calls[0]["image"]
    assert isinstance(uploads, list)
    assert len(uploads) == 2
    assert_named_upload(uploads[0], expected_content_type="image/png", allowed_extensions=(".png", ".webp", ".jpg", ".jpeg"))
    assert_named_upload(uploads[1], expected_content_type="image/png", allowed_extensions=(".png", ".webp", ".jpg", ".jpeg"))


def test_openai_try_on_support_uses_png_named_uploads_for_dalle2() -> None:
    images_api = FakeImagesApi(response=SimpleNamespace(data=[SimpleNamespace(b64_json=base64.b64encode(create_png_bytes()).decode("utf-8"))]))
    settings = Settings(
        openai_api_key="test-key",
        ai_try_on_output_size="1024x1024",
    )
    settings.ai_try_on_openai_model = "dall-e-2"
    support = OpenAIImageSupport(
        settings,
        client_factory=lambda _settings, _timeout: FakeClient(images_api),
    )

    support._call_openai_edit(
        "prompt",
        [
            DownloadedImage(filename="product.png", payload=create_png_bytes(), content_type="image/png"),
            DownloadedImage(filename="person.png", payload=create_png_bytes(), content_type="image/png"),
        ],
    )

    call = images_api.edit_calls[0]
    assert_named_upload(call["image"], expected_content_type="image/png", allowed_extensions=(".png",))
    assert call["image"][0] == "person.png"
    assert_named_upload(call["mask"], expected_content_type="image/png", allowed_extensions=(".png",))
    assert call["mask"][0] == "mask.png"


def test_openai_try_on_provider_maps_bad_request_to_image_unsuitable(monkeypatch) -> None:
    request = httpx.Request("POST", "https://api.openai.com/v1/images/edits")
    response = httpx.Response(status_code=400, request=request)
    provider = OpenAITryOnProvider(
        Settings(
            openai_api_key="test-key",
        )
    )

    async def stub_download(url: str, *, label: str, unsuitable_code: str, is_demo_model: bool = False):
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

    assert error.value.code == "INVALID_REFERENCE_IMAGE"
