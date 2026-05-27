from __future__ import annotations

import asyncio
import base64
import io
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

import httpx
import openai
from openai import OpenAI
from PIL import Image, UnidentifiedImageError

from app.config import Settings
from app.services.image_provider import ProviderError
from app.services.image_quality_guard import validate_generated_image


ALLOWED_INPUT_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

OUTPUT_FORMAT_MIME_MAP = {
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
}

DIMENSION_MAP = {
    "1024x1024": (1024, 1024),
    "1024x1536": (1024, 1536),
    "1536x1024": (1536, 1024),
    "256x256": (256, 256),
    "512x512": (512, 512),
    "1792x1024": (1792, 1024),
    "1024x1792": (1024, 1792),
    "auto": (None, None),
}


@dataclass(slots=True)
class DownloadedImage:
    filename: str
    payload: bytes
    content_type: str


class OpenAIImageSupport:
    def __init__(
        self,
        settings: Settings,
        *,
        client_factory: Callable[[Settings, int], OpenAI] | None = None,
    ) -> None:
        self.settings = settings
        self._client_factory = client_factory or self._build_client

    @property
    def _is_dalle2_model(self) -> bool:
        return self.settings.ai_try_on_openai_model == "dall-e-2"

    async def download_input_image(
        self,
        url: str,
        *,
        label: str,
        unsuitable_code: str,
    ) -> DownloadedImage:
        timeout = httpx.Timeout(self.settings.openai_input_image_timeout_seconds)
        max_bytes = self.settings.input_image_max_bytes

        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            try:
                async with client.stream("GET", url) as response:
                    response.raise_for_status()
                    content_type = (
                        (response.headers.get("content-type") or "")
                        .split(";")[0]
                        .strip()
                        .lower()
                    )
                    if content_type not in ALLOWED_INPUT_CONTENT_TYPES:
                        raise ProviderError(
                            f"The {label} image is not suitable for AI try-on.",
                            status_code=400,
                            retryable=False,
                            code=unsuitable_code,
                        )

                    content_length = response.headers.get("content-length")
                    if content_length and int(content_length) > max_bytes:
                        raise ProviderError(
                            f"The {label} image exceeds the supported upload size.",
                            status_code=400,
                            retryable=False,
                            code=unsuitable_code,
                        )

                    chunks: list[bytes] = []
                    total = 0
                    async for chunk in response.aiter_bytes():
                        total += len(chunk)
                        if total > max_bytes:
                            raise ProviderError(
                                f"The {label} image exceeds the supported upload size.",
                                status_code=400,
                                retryable=False,
                                code=unsuitable_code,
                            )
                        chunks.append(chunk)

                    raw_payload = b"".join(chunks)
                    if not raw_payload:
                        raise ProviderError(
                            f"The {label} image is empty.",
                            status_code=400,
                            retryable=False,
                            code=unsuitable_code,
                        )

                    try:
                        with Image.open(io.BytesIO(raw_payload)) as image:
                            image.verify()
                    except (UnidentifiedImageError, OSError) as error:
                        raise ProviderError(
                            f"The {label} image is not suitable for AI try-on.",
                            status_code=400,
                            retryable=False,
                            code=unsuitable_code,
                        ) from error

                    if self._is_dalle2_model and content_type != "image/png":
                        raw_payload = self.convert_to_png(raw_payload, label, unsuitable_code)
                        content_type = "image/png"

                    extension = ALLOWED_INPUT_CONTENT_TYPES[content_type]
                    return DownloadedImage(
                        filename=f"{label}{extension}",
                        payload=raw_payload,
                        content_type=content_type,
                    )
            except ProviderError:
                raise
            except httpx.TimeoutException as error:
                raise ProviderError(
                    f"Timed out while downloading the {label} image.",
                    status_code=504,
                    retryable=True,
                    code="AI_TIMEOUT",
                ) from error
            except httpx.HTTPStatusError as error:
                raise ProviderError(
                    f"Failed to download the {label} image: HTTP {error.response.status_code}.",
                    status_code=400,
                    retryable=False,
                    code=unsuitable_code,
                ) from error
            except httpx.HTTPError as error:
                raise ProviderError(
                    f"Failed to download the {label} image.",
                    status_code=503,
                    retryable=True,
                    code="AI_PROVIDER_ERROR",
                ) from error

    def convert_to_png(
        self,
        payload: bytes,
        label: str,
        unsuitable_code: str,
    ) -> bytes:
        try:
            with Image.open(io.BytesIO(payload)) as image:
                image = image.convert("RGBA")
                out = io.BytesIO()
                image.save(out, format="PNG")
                return out.getvalue()
        except UnidentifiedImageError as error:
            raise ProviderError(
                f"The {label} image is not suitable for AI try-on.",
                status_code=400,
                retryable=False,
                code=unsuitable_code,
            ) from error

    async def edit_images(
        self,
        *,
        prompt: str,
        images: list[DownloadedImage],
    ):
        return await asyncio.to_thread(self._call_openai_edit, prompt, images)

    def _call_openai_edit(self, prompt: str, images: list[DownloadedImage]):
        client = self._client_factory(
            self.settings,
            self.settings.ai_try_on_provider_timeout_seconds,
        )
        with tempfile.TemporaryDirectory(prefix="strawberry-openai-try-on-") as tmp_dir:
            files = []
            handles = []
            try:
                for index, image in enumerate(images):
                    path = Path(tmp_dir) / f"{index + 1}-{image.filename}"
                    path.write_bytes(image.payload)
                    handle = path.open("rb")
                    handles.append(handle)
                    files.append(handle)

                params: dict[str, Any] = {
                    "model": self.settings.ai_try_on_openai_model,
                    "image": files if len(files) > 1 else files[0],
                    "prompt": self.normalize_prompt(prompt),
                    "n": 1,
                    "size": self.settings.ai_try_on_output_size,
                    "timeout": self.settings.ai_try_on_provider_timeout_seconds,
                    "response_format": "b64_json",
                }

                if not self._is_dalle2_model:
                    params["quality"] = self.settings.openai_image_quality
                    params["extra_body"] = {
                        "output_format": self.settings.openai_image_output_format,
                    }

                return client.images.edit(**params)
            finally:
                for handle in handles:
                    handle.close()

    def parse_response(self, response, *, provider_name: str):
        data = getattr(response, "data", None)
        if not data:
            raise ProviderError(
                "OpenAI returned no try-on image data.",
                status_code=502,
                retryable=False,
                code="AI_PROVIDER_ERROR",
            )

        width, height = DIMENSION_MAP.get(
            self.settings.ai_try_on_output_size,
            (None, None),
        )
        mime_type = OUTPUT_FORMAT_MIME_MAP[self.settings.openai_image_output_format]
        results = []
        for image in data:
            image_b64 = getattr(image, "b64_json", None)
            if not image_b64:
                raise ProviderError(
                    "OpenAI returned an invalid try-on image payload.",
                    status_code=502,
                    retryable=False,
                    code="AI_PROVIDER_ERROR",
                )

            try:
                image_bytes = base64.b64decode(image_b64)
            except ValueError as error:
                raise ProviderError(
                    "OpenAI returned malformed try-on image data.",
                    status_code=502,
                    retryable=False,
                    code="AI_PROVIDER_ERROR",
                ) from error

            quality = validate_generated_image(
                image_bytes,
                expected_mime_type=mime_type,
            )
            results.append(
                {
                    "image_bytes": image_bytes,
                    "mime_type": quality.mime_type,
                    "width": quality.width if quality.width else width,
                    "height": quality.height if quality.height else height,
                    "provider": provider_name,
                }
            )

        return results

    def normalize_prompt(self, prompt: str) -> str:
        return " ".join(prompt.split()).strip()

    def build_client(self) -> OpenAI:
        return self._client_factory(
            self.settings,
            self.settings.ai_try_on_provider_timeout_seconds,
        )

    def _build_client(self, settings: Settings, timeout_seconds: int) -> OpenAI:
        return OpenAI(
            api_key=settings.openai_api_key,
            timeout=timeout_seconds,
            max_retries=settings.openai_image_max_retries,
        )
