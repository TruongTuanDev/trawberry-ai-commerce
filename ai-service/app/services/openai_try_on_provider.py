from __future__ import annotations

import openai
import re
from urllib.parse import urlparse

from app.config import Settings
from app.services.image_provider import ProviderError
from app.services.openai_image_support import OpenAIImageSupport
from app.services.try_on_provider import (
    TryOnProvider,
    TryOnProviderImageResult,
    TryOnProviderRequest,
)


class OpenAITryOnProvider(TryOnProvider):
    provider_name = "openai"

    def __init__(self, settings: Settings):
        self.settings = settings
        self.support = OpenAIImageSupport(settings)

    async def generate(
        self, request: TryOnProviderRequest
    ) -> list[TryOnProviderImageResult]:
        if not self.settings.openai_api_key:
            raise ProviderError(
                "AI provider is not configured.",
                status_code=400,
                retryable=False,
                code="AI_PROVIDER_NOT_CONFIGURED",
            )

        person_image_url = request.customer_image_url or request.selected_model_image_url
        diagnostics = self._build_request_diagnostics(request)
        if not person_image_url:
            raise ProviderError(
                "A reference image is required for AI try-on.",
                status_code=400,
                retryable=False,
                code="AI_TRY_ON_REFERENCE_REQUIRED",
                diagnostics=diagnostics,
            )

        product_image = await self.support.download_input_image(
            request.product_image_url,
            label="product",
            unsuitable_code="INVALID_PRODUCT_IMAGE",
        )
        reference_code = (
            "INVALID_REFERENCE_IMAGE"
            if request.customer_image_url
            else "AI_TRY_ON_MODEL_IMAGE_UNAVAILABLE"
        )
        person_image = await self.support.download_input_image(
            person_image_url,
            label="person",
            unsuitable_code=reference_code,
        )

        try:
            response = await self.support.edit_images(
                prompt=self.build_prompt(request),
                images=[product_image, person_image],
            )
        except ProviderError as error:
            if not error.diagnostics:
                error.diagnostics = diagnostics
            raise
        except openai.AuthenticationError as error:
            raise ProviderError(
                self._message_for_code("OPENAI_AUTH_FAILED"),
                status_code=502,
                retryable=False,
                code="OPENAI_AUTH_FAILED",
                diagnostics=self._with_openai_error_details(diagnostics, error),
            ) from error
        except openai.PermissionDeniedError as error:
            raise ProviderError(
                self._message_for_code("OPENAI_AUTH_FAILED"),
                status_code=403,
                retryable=False,
                code="OPENAI_AUTH_FAILED",
                diagnostics=self._with_openai_error_details(diagnostics, error),
            ) from error
        except openai.APITimeoutError as error:
            raise ProviderError(
                "AI generation timed out. Please try again.",
                status_code=504,
                retryable=True,
                code="AI_TIMEOUT",
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
        except openai.BadRequestError as error:
            code = self._classify_bad_request_error(error)
            raise ProviderError(
                self._message_for_code(code),
                status_code=400 if code in {"INVALID_REFERENCE_IMAGE", "INVALID_PRODUCT_IMAGE"} else 422,
                retryable=False,
                code=code,
                diagnostics=self._with_openai_error_details(diagnostics, error),
            ) from error
        except openai.APIConnectionError as error:
            raise ProviderError(
                self._message_for_code("OPENAI_PROVIDER_ERROR"),
                status_code=503,
                retryable=True,
                code="OPENAI_PROVIDER_ERROR",
                diagnostics=self._with_openai_error_details(diagnostics, error),
            ) from error
        except openai.OpenAIError as error:
            raise ProviderError(
                self._message_for_code("OPENAI_PROVIDER_ERROR"),
                status_code=502,
                retryable=False,
                code="OPENAI_PROVIDER_ERROR",
                diagnostics=self._with_openai_error_details(diagnostics, error),
            ) from error

        images = self.support.parse_response(
            response,
            provider_name=self.provider_name,
        )
        return [
            TryOnProviderImageResult(
                image_bytes=image["image_bytes"],
                mime_type=image["mime_type"],
                width=image["width"],
                height=image["height"],
                provider=image["provider"],
            )
            for image in images
        ]

    def _build_request_diagnostics(
        self,
        request: TryOnProviderRequest,
    ) -> dict[str, str | int | bool | None]:
        product_host = urlparse(request.product_image_url).netloc or None
        reference_url = request.customer_image_url or request.selected_model_image_url
        reference_host = urlparse(reference_url).netloc if reference_url else None
        return {
            "referenceSource": "uploaded_photo" if request.customer_image_url else "demo_model",
            "selectedModelId": request.selected_model_id,
            "safeProductImageHost": product_host,
            "safeReferenceImageHost": reference_host,
        }

    def _safe_message(self, error: Exception) -> str:
        message = str(error).strip()
        if not message:
            return error.__class__.__name__
        return message.replace(self.settings.openai_api_key or "", "[redacted]")

    def _with_openai_error_details(
        self,
        diagnostics: dict[str, str | int | bool | None],
        error: Exception,
    ) -> dict[str, str | int | bool | None]:
        merged = dict(diagnostics)
        status_code = getattr(error, "status_code", None)
        error_type, error_code, body_message = self._extract_error_fields(error)
        message = body_message or self._safe_message(error)
        merged["safeOpenAiStatus"] = status_code
        merged["safeOpenAiErrorType"] = error_type
        merged["safeOpenAiErrorCode"] = error_code
        merged["safeOpenAiMessageSnippet"] = message[:240]
        return merged

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
        if "quota" in message or "billing" in message:
            return "OPENAI_QUOTA_EXCEEDED"
        return "OPENAI_RATE_LIMITED"

    def _classify_bad_request_error(self, error: openai.BadRequestError) -> str:
        error_type, error_code, body_message = self._extract_error_fields(error)
        message = " ".join(
            part
            for part in [
                error_type or "",
                error_code or "",
                body_message or "",
                self._safe_message(error),
            ]
            if part
        ).lower()
        if "unauthorized" in message or "authentication" in message:
            return "OPENAI_AUTH_FAILED"
        if "quota" in message or "billing" in message:
            return "OPENAI_QUOTA_EXCEEDED"
        if "rate limit" in message:
            return "OPENAI_RATE_LIMITED"
        if any(
            token in message
            for token in [
                "reference image",
                "person image",
                "customer image",
                "full-body",
                "full body",
                "front-facing",
                "front facing",
                "pose",
                "face",
            ]
        ):
            return "INVALID_REFERENCE_IMAGE"
        if any(
            token in message
            for token in [
                "product image",
                "garment image",
                "garment",
                "apparel",
                "clothing item",
            ]
        ):
            return "INVALID_PRODUCT_IMAGE"
        return "OPENAI_BAD_REQUEST"

    def _message_for_code(self, code: str) -> str:
        messages = {
            "AI_TRY_ON_MODEL_IMAGE_UNAVAILABLE": "The demo model image could not be loaded. Please try another model.",
            "INVALID_REFERENCE_IMAGE": "The reference image is not suitable for try-on. Use a clear full-body front-facing photo.",
            "INVALID_PRODUCT_IMAGE": "OpenAI rejected the image request. Please try another photo or model.",
            "OPENAI_BAD_REQUEST": "OpenAI rejected the image request. Please try another photo or model.",
            "OPENAI_AUTH_FAILED": "AI service is temporarily unavailable. Please try again later.",
            "OPENAI_QUOTA_EXCEEDED": "OpenAI quota is exceeded or billing is not active.",
            "OPENAI_RATE_LIMITED": "AI service is temporarily unavailable. Please try again later.",
            "OPENAI_PROVIDER_ERROR": "AI service is temporarily unavailable. Please try again later.",
        }
        return messages.get(code, "AI service is temporarily unavailable. Please try again later.")

    def build_prompt(self, request: TryOnProviderRequest) -> str:
        traits = ", ".join(request.body_traits) if request.body_traits else "none"
        size_text = request.selected_size or "not specified"
        russian_size_text = request.selected_russian_size or "not specified"
        return (
            "Create a realistic virtual try-on ecommerce image. "
            "Dress the person in the exact garment from the product image. "
            "Preserve the person's identity, pose, body proportions, face, hands, and background when possible. "
            "Preserve the garment color, fabric texture, stitching, pockets, buttons, pattern, silhouette, and proportions. "
            "Do not redesign the garment. "
            "Use realistic fabric drape and fit for the provided body profile. "
            f"The selected size is {size_text}, Russian size {russian_size_text}. "
            f"Body profile: height {request.height_cm or 'unknown'} cm, weight {request.weight_kg or 'unknown'} kg, "
            f"gender {request.gender or 'unknown'}, body type {request.body_type or 'unknown'}, traits {traits}. "
            "Do not generate nudity or sexualized content. "
            "Output should be photorealistic, marketplace-ready, and focused on the garment. "
            f"Product category: {request.category or 'fashion'}. "
            f"Additional instructions: {self.support.normalize_prompt(request.prompt)}"
        )
