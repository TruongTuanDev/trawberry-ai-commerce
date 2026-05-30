from __future__ import annotations
import logging
import re

import openai

from app.config import Settings
from app.services.image_provider import ProviderError
from app.services.openai_image_support import OpenAIImageSupport
from app.services.try_on_provider import (
    TryOnProvider,
    TryOnProviderImageResult,
    TryOnProviderRequest,
)

logger = logging.getLogger(__name__)


class OpenAITryOnProvider(TryOnProvider):
    provider_name = "openai"

    def __init__(self, settings: Settings):
        self.settings = settings
        self.support = OpenAIImageSupport(settings)

    def _safe_message(self, error: Exception) -> str:
        message = str(error).strip()
        if not message:
            return error.__class__.__name__
        return message.replace(self.settings.openai_api_key or "", "[redacted]")

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
        if not person_image_url:
            raise ProviderError(
                "The uploaded image is not suitable for try-on.",
                status_code=400,
                retryable=False,
                code="INVALID_REFERENCE_IMAGE",
            )

        is_demo_model = not request.customer_image_url and bool(request.selected_model_image_url)

        product_image = await self.support.download_input_image(
            request.product_image_url,
            label="product",
            unsuitable_code="INVALID_PRODUCT_IMAGE",
        )
        person_image = await self.support.download_input_image(
            person_image_url,
            label="person",
            unsuitable_code="DEMO_MODEL_IMAGE_NOT_FOUND" if is_demo_model else "INVALID_REFERENCE_IMAGE",
            is_demo_model=is_demo_model,
        )

        try:
            response = await self.support.edit_images(
                prompt=self.build_prompt(request),
                images=[product_image, person_image],
            )
        except ProviderError:
            raise
        except openai.AuthenticationError as error:
            safe_msg = self._safe_message(error)
            logger.error(f"OpenAI Auth Error during try-on: {safe_msg}", exc_info=True)
            raise ProviderError(
                "AI service is currently unavailable (authentication failed).",
                status_code=401,
                retryable=False,
                code="OPENAI_AUTH_FAILED",
            ) from error
        except openai.PermissionDeniedError as error:
            safe_msg = self._safe_message(error)
            logger.error(f"OpenAI Permission Error during try-on: {safe_msg}", exc_info=True)
            raise ProviderError(
                "AI service is currently unavailable (authentication failed).",
                status_code=401,
                retryable=False,
                code="OPENAI_AUTH_FAILED",
            ) from error
        except openai.APITimeoutError as error:
            safe_msg = self._safe_message(error)
            logger.error(f"OpenAI Timeout Error during try-on: {safe_msg}", exc_info=True)
            raise ProviderError(
                "AI generation timed out. Please try again.",
                status_code=504,
                retryable=True,
                code="OPENAI_PROVIDER_ERROR",
            ) from error
        except openai.RateLimitError as error:
            safe_msg = self._safe_message(error).lower()
            logger.error(f"OpenAI Rate Limit Error during try-on: {safe_msg}", exc_info=True)
            if "quota" in safe_msg or "billing" in safe_msg:
                raise ProviderError(
                    "AI service quota has been exceeded. Please contact the administrator.",
                    status_code=429,
                    retryable=False,
                    code="OPENAI_QUOTA_EXCEEDED",
                ) from error
            raise ProviderError(
                "AI service rate limit reached. Please wait a moment.",
                status_code=429,
                retryable=True,
                code="OPENAI_RATE_LIMITED",
            ) from error
        except openai.BadRequestError as error:
            error_type, error_code, body_message = self.support._extract_error_fields(error)
            status_code = getattr(error, "status_code", 400)

            sanitized_message = self._safe_message(error)
            if body_message:
                sanitized_message = self._safe_message(Exception(body_message))

            logger.error(
                "OpenAI Bad Request during try-on: status_code=%s, error.type=%s, error.code=%s, error.message=%s",
                status_code, error_type, error_code, sanitized_message
            )
            raise ProviderError(
                "AI try-on rejected the image edit request.",
                status_code=400,
                retryable=False,
                code="OPENAI_BAD_REQUEST",
            ) from error
        except openai.OpenAIError as error:
            safe_msg = self._safe_message(error)
            logger.error(f"OpenAI General Error during try-on: {safe_msg}", exc_info=True)
            raise ProviderError(
                "AI try-on generation failed. Please try again later.",
                status_code=502,
                retryable=False,
                code="OPENAI_PROVIDER_ERROR",
            ) from error

        images = await self.support.parse_response(
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
