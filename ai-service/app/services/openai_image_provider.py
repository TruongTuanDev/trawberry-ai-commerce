from __future__ import annotations

import asyncio
import base64
import logging
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import httpx
import openai
from openai import OpenAI
from PIL import Image, UnidentifiedImageError
import io

from app.config import Settings
from app.services.image_provider import (
    ImageProvider,
    ProviderError,
    ProviderGenerateRequest,
    ProviderImageResult,
)
from app.services.image_quality_guard import validate_generated_image


LOGGER = logging.getLogger(__name__)

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


class OpenAIImageProvider(ImageProvider):
    provider_name = "OPENAI"

    def __init__(
        self,
        settings: Settings,
        *,
        client_factory: Callable[[Settings], OpenAI] | None = None,
    ):
        self.settings = settings
        self._client_factory = client_factory or self._build_client

    @property
    def _is_dalle2_model(self) -> bool:
        return self.settings.openai_image_model == "dall-e-2"

    @property
    def _is_gpt_image_model(self) -> bool:
        model = self.settings.openai_image_model
        return model.startswith("gpt-image-") or model.startswith("chatgpt-image-")

    async def generate(self, request: ProviderGenerateRequest) -> list[ProviderImageResult]:
        if not self.settings.openai_api_key:
            raise ProviderError(
                "OpenAI provider is enabled but OPENAI_API_KEY is missing.",
                status_code=500,
                retryable=False,
            )

        downloaded_images = await self._download_reference_images(request)

        try:
            response = await asyncio.to_thread(
                self._call_openai,
                request,
                downloaded_images,
            )
        except ProviderError:
            raise
        except openai.AuthenticationError as error:
            raise ProviderError(
                f"OpenAI authentication failed: {self._safe_message(error)}",
                status_code=502,
                retryable=False,
            ) from error
        except openai.RateLimitError as error:
            raise ProviderError(
                f"OpenAI rate limit hit: {self._safe_message(error)}",
                status_code=503,
                retryable=True,
            ) from error
        except openai.APITimeoutError as error:
            raise ProviderError(
                f"OpenAI request timed out: {self._safe_message(error)}",
                status_code=504,
                retryable=True,
            ) from error
        except openai.BadRequestError as error:
            raise ProviderError(
                f"OpenAI rejected the request: {self._safe_message(error)}",
                status_code=422,
                retryable=False,
            ) from error
        except openai.PermissionDeniedError as error:
            raise ProviderError(
                f"OpenAI permission denied: {self._safe_message(error)}",
                status_code=403,
                retryable=False,
            ) from error
        except openai.APIConnectionError as error:
            raise ProviderError(
                f"OpenAI connection failed: {self._safe_message(error)}",
                status_code=503,
                retryable=True,
            ) from error
        except openai.APIStatusError as error:
            retryable = error.status_code >= 500
            raise ProviderError(
                f"OpenAI API error: {self._safe_message(error)}",
                status_code=error.status_code,
                retryable=retryable,
            ) from error
        except openai.OpenAIError as error:
            raise ProviderError(
                f"OpenAI image generation failed: {self._safe_message(error)}",
                status_code=502,
                retryable=False,
            ) from error

        return self._parse_response(response)

    async def _download_reference_images(
        self,
        request: ProviderGenerateRequest,
    ) -> list[DownloadedImage]:
        references = [
            ("front", request.front_image_url),
            ("back", request.back_image_url),
            ("model", request.model_image_url),
        ]

        images: list[DownloadedImage] = []
        for label, url in references:
            if not url:
                continue
            images.append(await self._download_input_image(url, label))
        return images

    async def _download_input_image(self, url: str, label: str) -> DownloadedImage:
        timeout = httpx.Timeout(self.settings.openai_input_image_timeout_seconds)
        max_bytes = self.settings.input_image_max_bytes

        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            try:
                async with client.stream("GET", url) as response:
                    response.raise_for_status()
                    content_type = (response.headers.get("content-type") or "").split(";")[0].strip().lower()
                    if content_type not in ALLOWED_INPUT_CONTENT_TYPES:
                        raise ProviderError(
                            f"Unsupported input image content type for {label} image: {content_type or 'unknown'}.",
                            status_code=400,
                            retryable=False,
                        )

                    content_length = response.headers.get("content-length")
                    if content_length and int(content_length) > max_bytes:
                        raise ProviderError(
                            f"Input {label} image is too large to download safely.",
                            status_code=400,
                            retryable=False,
                        )

                    chunks: list[bytes] = []
                    total = 0
                    async for chunk in response.aiter_bytes():
                        total += len(chunk)
                        if total > max_bytes:
                            raise ProviderError(
                                f"Input {label} image exceeds the configured download limit.",
                                status_code=400,
                                retryable=False,
                            )
                        chunks.append(chunk)

                    raw_payload = b"".join(chunks)
                    if self._is_dalle2_model and content_type != "image/png":
                        try:
                            with Image.open(io.BytesIO(raw_payload)) as img:
                                img = img.convert("RGBA")
                                out = io.BytesIO()
                                img.save(out, format="PNG")
                                raw_payload = out.getvalue()
                            content_type = "image/png"
                        except UnidentifiedImageError as error:
                            raise ProviderError(
                                f"Failed to decode the {label} image: invalid image data.",
                                status_code=400,
                                retryable=False,
                            ) from error

                    ext = ".png" if content_type == "image/png" else (".jpg" if content_type == "image/jpeg" else ".webp")
                    return DownloadedImage(
                        filename=f"{label}{ext}",
                        payload=raw_payload,
                        content_type=content_type,
                    )
            except ProviderError:
                raise
            except httpx.TimeoutException as error:
                raise ProviderError(
                    f"Timed out while downloading the {label} input image.",
                    status_code=504,
                    retryable=True,
                ) from error
            except httpx.HTTPStatusError as error:
                raise ProviderError(
                    f"Failed to download the {label} input image: HTTP {error.response.status_code}.",
                    status_code=400,
                    retryable=False,
                ) from error
            except httpx.HTTPError as error:
                raise ProviderError(
                    f"Failed to download the {label} input image.",
                    status_code=503,
                    retryable=True,
                ) from error

    def _call_openai(
        self,
        request: ProviderGenerateRequest,
        downloaded_images: list[DownloadedImage],
    ):
        client = self._client_factory(self.settings)
        if downloaded_images:
            return self._call_openai_edit(client, request, downloaded_images)
        
        params = {
            "model": self.settings.openai_image_model,
            "prompt": request.prompt,
            "n": request.quantity,
            "size": self.settings.openai_image_size,
            "response_format": "b64_json",
            "timeout": self.settings.openai_image_timeout_seconds,
        }
        
        if not self._is_dalle2_model:
            params["quality"] = self.settings.openai_image_quality
            params["extra_body"] = {"output_format": self.settings.openai_image_output_format}
            
        return client.images.generate(**params)

    def _call_openai_edit(
        self,
        client: OpenAI,
        request: ProviderGenerateRequest,
        downloaded_images: list[DownloadedImage],
    ):
        with tempfile.TemporaryDirectory(prefix="strawberry-openai-") as tmp_dir:
            files = []
            file_handles = []
            try:
                for index, image in enumerate(downloaded_images):
                    path = Path(tmp_dir) / f"{index + 1}-{image.filename}"
                    path.write_bytes(image.payload)
                    handle = path.open("rb")
                    file_handles.append(handle)
                    files.append(handle)

                params = {
                    "model": self.settings.openai_image_model,
                    "image": files[0],
                    "prompt": request.prompt,
                    "n": request.quantity,
                    "size": self.settings.openai_image_size,
                    "response_format": "b64_json",
                    "timeout": self.settings.openai_image_timeout_seconds,
                }
                
                if not self._is_dalle2_model:
                    params["extra_body"] = {
                        "quality": self.settings.openai_image_quality,
                        "output_format": self.settings.openai_image_output_format,
                    }

                return client.images.edit(**params)
            finally:
                for handle in file_handles:
                    handle.close()

    def _parse_response(self, response) -> list[ProviderImageResult]:
        data = getattr(response, "data", None)
        if not data:
            raise ProviderError(
                "OpenAI returned no image data.",
                status_code=502,
                retryable=False,
            )

        width, height = DIMENSION_MAP.get(
            self.settings.openai_image_size,
            (None, None),
        )
        mime_type = OUTPUT_FORMAT_MIME_MAP[self.settings.openai_image_output_format]
        results: list[ProviderImageResult] = []
        for image in data:
            image_b64 = getattr(image, "b64_json", None)
            if not image_b64:
                raise ProviderError(
                    "OpenAI returned an image response without b64_json output.",
                    status_code=502,
                    retryable=False,
                )

            try:
                image_bytes = base64.b64decode(image_b64)
            except ValueError as error:
                raise ProviderError(
                    "OpenAI returned malformed base64 image output.",
                    status_code=502,
                    retryable=False,
                ) from error

            quality = validate_generated_image(
                image_bytes,
                expected_mime_type=mime_type,
            )

            results.append(
                ProviderImageResult(
                    image_bytes=image_bytes,
                    mime_type=quality.mime_type,
                    width=quality.width if quality.width else width,
                    height=quality.height if quality.height else height,
                    provider=self.provider_name,
                )
            )

        return results

    def _build_client(self, settings: Settings) -> OpenAI:
        return OpenAI(
            api_key=settings.openai_api_key,
            timeout=settings.openai_image_timeout_seconds,
            max_retries=settings.openai_image_max_retries,
        )

    def _safe_message(self, error: Exception) -> str:
        message = str(error).strip()
        if not message:
            return error.__class__.__name__
        return message.replace(self.settings.openai_api_key or "", "[redacted]")
