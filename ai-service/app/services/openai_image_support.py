from __future__ import annotations

import asyncio
import base64
import io
import logging
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

logger = logging.getLogger(__name__)


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


def build_image_edit_upload(
    *,
    filename: str,
    payload: bytes,
    content_type: str,
) -> tuple[str, io.BytesIO, str]:
    normalized_content_type = content_type.strip().lower()
    extension = ALLOWED_INPUT_CONTENT_TYPES.get(normalized_content_type)
    if extension is None:
        raise ProviderError(
            f"Unsupported OpenAI image edit content type: {content_type or 'unknown'}.",
            status_code=400,
            retryable=False,
            code="AI_PROVIDER_ERROR",
        )

    stem = Path(filename).stem or "image"
    normalized_filename = f"{stem}{extension}"
    stream = io.BytesIO(payload)
    stream.name = normalized_filename
    return (normalized_filename, stream, normalized_content_type)


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

    def make_square_png(self, payload: bytes, target_size: int = 1024) -> bytes:
        try:
            with Image.open(io.BytesIO(payload)) as img:
                img = img.convert("RGBA")
                w, h = img.size

                aspect_ratio = w / h
                if w > h:
                    new_w = target_size
                    new_h = int(target_size / aspect_ratio)
                else:
                    new_h = target_size
                    new_w = int(target_size * aspect_ratio)

                img_resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

                square_img = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))

                offset_x = (target_size - new_w) // 2
                offset_y = (target_size - new_h) // 2
                square_img.paste(img_resized, (offset_x, offset_y))

                out = io.BytesIO()
                square_img.save(out, format="PNG")
                return out.getvalue()
        except Exception as error:
            raise ProviderError(
                "Failed to square the reference image.",
                status_code=400,
                retryable=False,
                code="INVALID_REFERENCE_IMAGE",
            ) from error

    def generate_transparent_mask(self, payload: bytes) -> bytes:
        try:
            with Image.open(io.BytesIO(payload)) as img:
                mask = Image.new("RGBA", img.size, (0, 0, 0, 0))
                out = io.BytesIO()
                mask.save(out, format="PNG")
                return out.getvalue()
        except Exception as error:
            raise ProviderError(
                "Failed to generate transparent mask.",
                status_code=500,
                retryable=False,
                code="AI_PROVIDER_ERROR",
            ) from error

    def _extract_error_fields(
        self,
        error: Exception,
    ) -> tuple[str | None, str | None, str | None]:
        body = getattr(error, "body", None)
        if isinstance(body, dict):
            inner = body.get("error")
            if isinstance(inner, dict):
                def as_string(value: object) -> str | None:
                    if isinstance(value, str) and value.strip():
                        return value
                    return None
                return (
                    as_string(inner.get("type")),
                    as_string(inner.get("code")),
                    as_string(inner.get("message")),
                )

        import re
        message = str(error).strip()
        type_match = re.search(r"'type': '([^']+)'", message)
        code_match = re.search(r"'code': '([^']+)'", message)
        message_match = re.search(r"'message': \"([^\"]+)\"", message)
        if not message_match:
            message_match = re.search(r"'message': '([^']+)'", message)
        return (
            type_match.group(1) if type_match else None,
            code_match.group(1) if code_match else None,
            message_match.group(1) if message_match else None,
        )

    async def download_input_image(
        self,
        url: str,
        *,
        label: str,
        unsuitable_code: str,
        is_demo_model: bool = False,
    ) -> DownloadedImage:
        # Determine the appropriate error code dynamically based on label and is_demo_model
        if label == "product":
            error_code = "INVALID_PRODUCT_IMAGE"
            user_msg = "The product image is invalid or could not be loaded."
        elif is_demo_model:
            error_code = "DEMO_MODEL_IMAGE_NOT_FOUND"
            user_msg = "Demo model image is currently unavailable."
        else:
            error_code = "INVALID_REFERENCE_IMAGE"
            user_msg = "The uploaded photo is invalid or could not be loaded."

        status_code = 404 if error_code == "DEMO_MODEL_IMAGE_NOT_FOUND" else 400
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
                            user_msg,
                            status_code=status_code,
                            retryable=False,
                            code=error_code,
                        )

                    content_length = response.headers.get("content-length")
                    if content_length and int(content_length) > max_bytes:
                        raise ProviderError(
                            f"The {label} image exceeds the supported upload size.",
                            status_code=status_code,
                            retryable=False,
                            code=error_code,
                        )

                    chunks: list[bytes] = []
                    total = 0
                    async for chunk in response.aiter_bytes():
                        total += len(chunk)
                        if total > max_bytes:
                            raise ProviderError(
                                f"The {label} image exceeds the supported upload size.",
                                status_code=status_code,
                                retryable=False,
                                code=error_code,
                            )
                        chunks.append(chunk)

                    raw_payload = b"".join(chunks)
                    if not raw_payload:
                        raise ProviderError(
                            f"The {label} image is empty.",
                            status_code=status_code,
                            retryable=False,
                            code=error_code,
                        )

                    try:
                        with Image.open(io.BytesIO(raw_payload)) as image:
                            image.verify()
                    except (UnidentifiedImageError, OSError) as error:
                        raise ProviderError(
                            user_msg,
                            status_code=status_code,
                            retryable=False,
                            code=error_code,
                        ) from error

                    if self._is_dalle2_model and content_type != "image/png":
                        raw_payload = self.convert_to_png(raw_payload, label, error_code)
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
                    code="AI_TIMEOUT" if not is_demo_model else "DEMO_MODEL_IMAGE_NOT_FOUND",
                ) from error
            except httpx.HTTPStatusError as error:
                raise ProviderError(
                    user_msg,
                    status_code=status_code,
                    retryable=False,
                    code=error_code,
                ) from error
            except httpx.HTTPError as error:
                raise ProviderError(
                    f"Failed to download the {label} image.",
                    status_code=503,
                    retryable=True,
                    code="AI_PROVIDER_ERROR" if not is_demo_model else "DEMO_MODEL_IMAGE_NOT_FOUND",
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
        if self._is_dalle2_model:
            person_image = images[1]

            target_size = 1024
            if self.settings.ai_try_on_output_size in ("256x256", "512x512", "1024x1024"):
                target_size = int(self.settings.ai_try_on_output_size.split("x")[0])

            squared_payload = self.make_square_png(person_image.payload, target_size)
            mask_payload = self.generate_transparent_mask(squared_payload)

            params: dict[str, Any] = {
                "model": self.settings.ai_try_on_openai_model,
                "image": build_image_edit_upload(
                    filename="person.png",
                    payload=squared_payload,
                    content_type="image/png",
                ),
                "mask": build_image_edit_upload(
                    filename="mask.png",
                    payload=mask_payload,
                    content_type="image/png",
                ),
                "prompt": self.normalize_prompt(prompt),
                "n": 1,
                "size": f"{target_size}x{target_size}",
                "timeout": self.settings.ai_try_on_provider_timeout_seconds,
            }
        else:
            files = [
                build_image_edit_upload(
                    filename=image.filename,
                    payload=image.payload,
                    content_type=image.content_type,
                )
                for image in images
            ]

            params = {
                "model": self.settings.ai_try_on_openai_model,
                "image": files if len(files) > 1 else files[0],
                "prompt": self.normalize_prompt(prompt),
                "n": 1,
                "size": self.settings.ai_try_on_output_size,
                "timeout": self.settings.ai_try_on_provider_timeout_seconds,
            }

            params["quality"] = self.settings.openai_image_quality
            params["extra_body"] = {
                "output_format": self.settings.openai_image_output_format,
                # Keep the person's face and the garment's texture/print faithful
                # to the input images instead of regenerating them from scratch.
                "input_fidelity": self.settings.openai_image_input_fidelity,
            }

        return client.images.edit(**params)

    async def parse_response(self, response, *, provider_name: str):
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
            image_url = getattr(image, "url", None)
            has_b64_json = bool(image_b64)
            has_url = bool(image_url)

            if image_b64:
                try:
                    image_bytes = base64.b64decode(image_b64)
                except ValueError as error:
                    raise ProviderError(
                        "OpenAI returned malformed try-on image data.",
                        status_code=502,
                        retryable=False,
                        code="AI_PROVIDER_ERROR",
                    ) from error
            elif image_url:
                try:
                    async with httpx.AsyncClient() as client:
                        resp = await client.get(image_url, timeout=30.0)
                        resp.raise_for_status()
                        image_bytes = resp.content
                except Exception as error:
                    logger.error("Failed to download generated image from OpenAI URL: %s", image_url, exc_info=True)
                    raise ProviderError(
                        "Failed to retrieve generated image from URL.",
                        status_code=502,
                        retryable=False,
                        code="RESULT_IMAGE_UPLOAD_FAILED",
                    ) from error
            else:
                raise ProviderError(
                    "OpenAI returned no valid image payload (missing b64_json and url).",
                    status_code=502,
                    retryable=False,
                    code="RESULT_IMAGE_MISSING",
                )

            logger.info(
                "OpenAI image parsing: has_b64_json=%s, has_url=%s, generated_image_byte_length=%d, output_mime=%s",
                has_b64_json,
                has_url,
                len(image_bytes),
                mime_type,
            )

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
