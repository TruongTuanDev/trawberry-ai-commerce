from __future__ import annotations

import asyncio
import base64
import logging
import re
import tempfile
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from typing import Any, Callable

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
                "OpenAI authentication failed.",
                status_code=500,
                retryable=False,
                code="OPENAI_UNAUTHORIZED",
                diagnostics=self._build_request_diagnostics(
                    request,
                    downloaded_images=[],
                ),
            )

        downloaded_images = await self._download_reference_images(request)
        diagnostics = self._build_request_diagnostics(request, downloaded_images)

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
                "OpenAI authentication failed.",
                status_code=502,
                retryable=False,
                code="OPENAI_UNAUTHORIZED",
                diagnostics=self._with_openai_error_details(diagnostics, error),
            ) from error
        except openai.RateLimitError as error:
            code = self._classify_rate_limit_error(error)
            raise ProviderError(
                self._message_for_code(code),
                status_code=503,
                retryable=True,
                code=code,
                diagnostics=self._with_openai_error_details(diagnostics, error),
            ) from error
        except openai.APITimeoutError as error:
            raise ProviderError(
                "OpenAI rate limit or timeout blocked the request.",
                status_code=504,
                retryable=True,
                code="OPENAI_RATE_LIMIT",
                diagnostics=self._with_openai_error_details(diagnostics, error),
            ) from error
        except openai.BadRequestError as error:
            code = self._classify_bad_request_error(error)
            raise ProviderError(
                self._message_for_code(code),
                status_code=422,
                retryable=False,
                code=code,
                diagnostics=self._with_openai_error_details(diagnostics, error),
            ) from error
        except openai.PermissionDeniedError as error:
            raise ProviderError(
                "OpenAI authentication failed.",
                status_code=403,
                retryable=False,
                code="OPENAI_UNAUTHORIZED",
                diagnostics=self._with_openai_error_details(diagnostics, error),
            ) from error
        except openai.APIConnectionError as error:
            raise ProviderError(
                "OpenAI connection failed.",
                status_code=503,
                retryable=True,
                code="AI_SERVICE_UNREACHABLE",
                diagnostics=self._with_openai_error_details(diagnostics, error),
            ) from error
        except openai.APIStatusError as error:
            retryable = error.status_code >= 500
            code = self._classify_status_error(error)
            raise ProviderError(
                self._message_for_code(code),
                status_code=error.status_code,
                retryable=retryable,
                code=code,
                diagnostics=self._with_openai_error_details(diagnostics, error),
            ) from error
        except openai.OpenAIError as error:
            raise ProviderError(
                "OpenAI image generation failed.",
                status_code=502,
                retryable=False,
                code="OPENAI_BAD_REQUEST",
                diagnostics=self._with_openai_error_details(diagnostics, error),
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
                    if not raw_payload:
                        raise ProviderError(
                            f"Input {label} image was empty.",
                            status_code=400,
                            retryable=False,
                        )

                    try:
                        with Image.open(io.BytesIO(raw_payload)) as img:
                            img.verify()
                    except (UnidentifiedImageError, OSError) as error:
                        raise ProviderError(
                            f"Failed to decode the {label} image: invalid image data.",
                            status_code=400,
                            retryable=False,
                        ) from error

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

        params: dict[str, Any] = {
            "model": self.settings.openai_image_model,
            "prompt": self._normalize_prompt(request.prompt),
            "n": request.quantity,
        }

        self._apply_generate_params(params)
        return client.images.generate(**params)


    def _make_square_png(self, payload: bytes, target_size: int = 1024) -> bytes:
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

    def _call_openai_edit(
        self,
        client: OpenAI,
        request: ProviderGenerateRequest,
        downloaded_images: list[DownloadedImage],
    ):
        with tempfile.TemporaryDirectory(prefix="strawberry-openai-") as tmp_dir:
            file_handles = []
            try:
                if self._is_dalle2_model:
                    target_size = 1024
                    if self.settings.openai_image_size in ("256x256", "512x512", "1024x1024"):
                        target_size = int(self.settings.openai_image_size.split("x")[0])

                    img1 = downloaded_images[0]
                    sq1 = self._make_square_png(img1.payload, target_size)
                    p1 = Path(tmp_dir) / "image.png"
                    p1.write_bytes(sq1)
                    h1 = p1.open("rb")
                    file_handles.append(h1)

                    params: dict[str, Any] = {
                        "model": self.settings.openai_image_model,
                        "image": h1,
                        "prompt": self._normalize_prompt(request.prompt),
                        "n": request.quantity,
                    }

                    if len(downloaded_images) > 1:
                        img2 = downloaded_images[1]
                        sq2 = self._make_square_png(img2.payload, target_size)
                        p2 = Path(tmp_dir) / "mask.png"
                        p2.write_bytes(sq2)
                        h2 = p2.open("rb")
                        file_handles.append(h2)
                        params["mask"] = h2
                else:
                    files = []
                    for index, image in enumerate(downloaded_images):
                        path = Path(tmp_dir) / f"{index + 1}-{image.filename}"
                        path.write_bytes(image.payload)
                        handle = path.open("rb")
                        file_handles.append(handle)
                        files.append(handle)

                    params: dict[str, Any] = {
                        "model": self.settings.openai_image_model,
                        "image": files if len(files) > 1 else files[0],
                        "prompt": self._normalize_prompt(request.prompt),
                        "n": request.quantity,
                    }

                self._apply_edit_params(params)
                return client.images.edit(**params)
            finally:
                for handle in file_handles:
                    handle.close()

    def _apply_generate_params(self, params: dict[str, Any]) -> None:
        params["size"] = self.settings.openai_image_size
        params["timeout"] = self.settings.openai_image_timeout_seconds
        if self._is_dalle2_model:
            params["response_format"] = "b64_json"
            return

        params["quality"] = self.settings.openai_image_quality
        params["output_format"] = self.settings.openai_image_output_format

    def _apply_edit_params(self, params: dict[str, Any]) -> None:
        params["size"] = self.settings.openai_image_size
        params["timeout"] = self.settings.openai_image_timeout_seconds
        if self._is_dalle2_model:
            params["response_format"] = "b64_json"
            return

        params["quality"] = self.settings.openai_image_quality
        params["extra_body"] = {
            "output_format": self.settings.openai_image_output_format,
        }

    def _parse_response(self, response) -> list[ProviderImageResult]:
        data = getattr(response, "data", None)
        if not data:
                raise ProviderError(
                    "OpenAI returned no image data.",
                    status_code=502,
                    retryable=False,
                    code="AI_SERVICE_INVALID_RESPONSE",
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
                    code="AI_SERVICE_INVALID_RESPONSE",
                )

            try:
                image_bytes = base64.b64decode(image_b64)
            except ValueError as error:
                raise ProviderError(
                    "OpenAI returned malformed base64 image output.",
                    status_code=502,
                    retryable=False,
                    code="AI_SERVICE_INVALID_RESPONSE",
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

    def _normalize_prompt(self, prompt: str) -> str:
        return " ".join(prompt.split()).strip()

    def _build_request_diagnostics(
        self,
        request: ProviderGenerateRequest,
        downloaded_images: list[DownloadedImage],
    ) -> dict[str, Any]:
        return {
            "requestMode": "edit" if downloaded_images else "generate",
            "hasReferenceImages": bool(downloaded_images),
            "imageCount": len(downloaded_images),
            "model": self.settings.openai_image_model,
            "safeInputImages": [
                {
                    "name": image.filename,
                    "contentType": image.content_type,
                    "bytes": len(image.payload),
                    "sha256Prefix": sha256(image.payload).hexdigest()[:12],
                }
                for image in downloaded_images
            ],
            "safePromptLength": len(self._normalize_prompt(request.prompt)),
        }

    def _with_openai_error_details(
        self,
        diagnostics: dict[str, Any],
        error: Exception,
    ) -> dict[str, Any]:
        merged = dict(diagnostics)
        status_code = getattr(error, "status_code", None)
        error_type, error_code, body_message = self._extract_error_fields(error)
        message = self._safe_message(error)
        if body_message:
            message = self._safe_message(Exception(body_message))

        merged["safeOpenAiStatus"] = status_code
        merged["safeOpenAiErrorType"] = error_type
        merged["safeOpenAiErrorCode"] = error_code
        merged["safeOpenAiMessageSnippet"] = message[:240]
        return merged

    def _classify_bad_request_error(self, error: openai.BadRequestError) -> str:
        _error_type, error_code, body_message = self._extract_error_fields(error)
        message = " ".join(
            part
            for part in [
                error_code or "",
                body_message or "",
                self._safe_message(error),
            ]
            if part
        ).lower()
        if "billing hard limit" in message or "billing_hard_limit" in message:
            return "OPENAI_BILLING_HARD_LIMIT"
        if "quota" in message:
            return "OPENAI_QUOTA_EXCEEDED"
        if "rate limit" in message:
            return "OPENAI_RATE_LIMIT"
        if "unauthorized" in message or "authentication" in message:
            return "OPENAI_UNAUTHORIZED"
        return "OPENAI_BAD_REQUEST"

    def _extract_error_fields(
        self,
        error: Exception,
    ) -> tuple[str | None, str | None, str | None]:
        body = getattr(error, "body", None)
        if isinstance(body, dict):
            inner = body.get("error")
            if isinstance(inner, dict):
                return (
                    self._as_string(inner.get("type")),
                    self._as_string(inner.get("code")),
                    self._as_string(inner.get("message")),
                )

        safe_message = self._safe_message(error)
        type_match = re.search(r"'type': '([^']+)'", safe_message)
        code_match = re.search(r"'code': '([^']+)'", safe_message)
        message_match = re.search(r"'message': \"([^\"]+)\"", safe_message)
        if not message_match:
            message_match = re.search(r"'message': '([^']+)'", safe_message)
        return (
          type_match.group(1) if type_match else None,
          code_match.group(1) if code_match else None,
          message_match.group(1) if message_match else None,
        )

    def _as_string(self, value: object) -> str | None:
        if isinstance(value, str) and value.strip():
            return value
        return None

    def _classify_rate_limit_error(self, error: openai.RateLimitError) -> str:
        message = self._safe_message(error).lower()
        if "billing hard limit" in message:
            return "OPENAI_BILLING_HARD_LIMIT"
        if "quota" in message:
            return "OPENAI_QUOTA_EXCEEDED"
        return "OPENAI_RATE_LIMIT"

    def _classify_status_error(self, error: openai.APIStatusError) -> str:
        message = self._safe_message(error).lower()
        if error.status_code == 429:
            if "billing hard limit" in message:
                return "OPENAI_BILLING_HARD_LIMIT"
            if "quota" in message:
                return "OPENAI_QUOTA_EXCEEDED"
            return "OPENAI_RATE_LIMIT"
        if error.status_code in (401, 403):
            return "OPENAI_UNAUTHORIZED"
        if error.status_code == 400:
            return "OPENAI_BAD_REQUEST"
        return "AI_SERVICE_INVALID_RESPONSE"

    def _message_for_code(self, code: str) -> str:
        messages = {
            "OPENAI_UNAUTHORIZED": "OpenAI authentication failed.",
            "OPENAI_BILLING_HARD_LIMIT": "OpenAI billing hard limit blocked the request.",
            "OPENAI_RATE_LIMIT": "OpenAI rate limit blocked the request.",
            "OPENAI_QUOTA_EXCEEDED": "OpenAI quota exceeded.",
            "OPENAI_BAD_REQUEST": "OpenAI rejected the image request.",
            "AI_SERVICE_UNREACHABLE": "OpenAI connection failed.",
            "AI_SERVICE_INVALID_RESPONSE": "OpenAI returned an invalid response.",
        }
        return messages.get(code, "OpenAI image generation failed.")
