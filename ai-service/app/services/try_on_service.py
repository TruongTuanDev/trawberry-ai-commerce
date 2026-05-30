import base64

from app.schemas.ai_try_on import (
    TryOnGenerateRequest,
    TryOnGenerateResponse,
    TryOnGeneratedImage,
)
from app.services.image_provider import ProviderError
from app.services.try_on_provider import (
    TryOnProvider,
    TryOnProviderRequest,
)
class TryOnService:
    def __init__(
        self,
        *,
        providers: dict[str, TryOnProvider],
    ):
        self.providers = providers

    async def generate(self, payload: TryOnGenerateRequest) -> TryOnGenerateResponse:
        provider = self.providers.get(payload.provider_mode)
        if provider is None:
            raise ProviderError(
                f"Unsupported AI try-on provider mode: {payload.provider_mode}",
                status_code=400,
                retryable=False,
                code="AI_PROVIDER_UNSUPPORTED",
            )

        assets = await provider.generate(
            TryOnProviderRequest(
                task_id=payload.task_id,
                provider_mode=payload.provider_mode,
                product_name=payload.product.name,
                product_image_url=str(payload.product.image_url),
                category=payload.product.category,
                selected_size=payload.product.selected_size,
                selected_russian_size=payload.product.selected_russian_size,
                prompt=payload.prompt,
                locale=payload.locale,
                customer_image_url=str(payload.person.customer_image_url)
                if payload.person.customer_image_url
                else None,
                selected_model_image_url=str(payload.person.selected_model_image_url)
                if payload.person.selected_model_image_url
                else None,
                selected_model_id=payload.person.selected_model_id,
                height_cm=payload.person.height_cm,
                weight_kg=payload.person.weight_kg,
                gender=payload.person.gender,
                body_type=payload.person.body_type,
                body_traits=payload.person.body_traits,
            )
        )

        images: list[TryOnGeneratedImage] = []
        for asset in assets:
            images.append(
                TryOnGeneratedImage(
                    url=None,
                    storage_key=None,
                    image_base64=base64.b64encode(asset.image_bytes).decode("utf-8"),
                    mime_type=asset.mime_type,
                    width=asset.width,
                    height=asset.height,
                )
            )

        return TryOnGenerateResponse(
            images=images,
            provider=provider.provider_name,
            metadata={
                "promptVersion": "try_on_v1",
                "providerMode": payload.provider_mode,
            },
        )
