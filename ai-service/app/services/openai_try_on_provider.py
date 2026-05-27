from __future__ import annotations

import openai

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
        if not person_image_url:
            raise ProviderError(
                "The uploaded image is not suitable for try-on.",
                status_code=400,
                retryable=False,
                code="AI_TRY_ON_IMAGE_UNSUITABLE",
            )

        product_image = await self.support.download_input_image(
            request.product_image_url,
            label="product",
            unsuitable_code="AI_TRY_ON_IMAGE_UNSUITABLE",
        )
        person_image = await self.support.download_input_image(
            person_image_url,
            label="person",
            unsuitable_code="AI_TRY_ON_IMAGE_UNSUITABLE",
        )

        try:
            response = await self.support.edit_images(
                prompt=self.build_prompt(request),
                images=[product_image, person_image],
            )
        except ProviderError:
            raise
        except openai.AuthenticationError as error:
            raise ProviderError(
                "AI provider is not configured.",
                status_code=400,
                retryable=False,
                code="AI_PROVIDER_NOT_CONFIGURED",
            ) from error
        except openai.PermissionDeniedError as error:
            raise ProviderError(
                "AI provider is not configured.",
                status_code=400,
                retryable=False,
                code="AI_PROVIDER_NOT_CONFIGURED",
            ) from error
        except openai.APITimeoutError as error:
            raise ProviderError(
                "AI generation timed out. Please try again.",
                status_code=504,
                retryable=True,
                code="AI_TIMEOUT",
            ) from error
        except openai.RateLimitError as error:
            raise ProviderError(
                "AI generation failed. Please try again.",
                status_code=503,
                retryable=True,
                code="AI_PROVIDER_ERROR",
            ) from error
        except openai.BadRequestError as error:
            message = str(error).lower()
            code = (
                "AI_TRY_ON_IMAGE_UNSUITABLE"
                if "image" in message or "safety" in message
                else "AI_PROVIDER_ERROR"
            )
            user_message = (
                "The uploaded image is not suitable for try-on."
                if code == "AI_TRY_ON_IMAGE_UNSUITABLE"
                else "AI generation failed. Please try again."
            )
            raise ProviderError(
                user_message,
                status_code=400 if code == "AI_TRY_ON_IMAGE_UNSUITABLE" else 502,
                retryable=False,
                code=code,
            ) from error
        except openai.OpenAIError as error:
            raise ProviderError(
                "AI generation failed. Please try again.",
                status_code=502,
                retryable=False,
                code="AI_PROVIDER_ERROR",
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
