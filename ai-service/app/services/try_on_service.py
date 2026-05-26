from app.schemas.ai_try_on import (
    TryOnGenerateRequest,
    TryOnGenerateResponse,
    TryOnGeneratedImage,
)
from app.services.image_provider import ProviderError
from app.services.storage_service import StorageService
from app.services.try_on_provider import (
    TryOnProvider,
    TryOnProviderRequest,
)


MIME_EXTENSION_MAP = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/svg+xml": "svg",
}


class TryOnService:
    def __init__(
        self,
        *,
        storage_service: StorageService,
        providers: dict[str, TryOnProvider],
    ):
        self.storage_service = storage_service
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
        for index, asset in enumerate(assets):
            object_key = self._build_object_key(payload, asset.mime_type, index)
            stored = await self.storage_service.store_bytes(
                object_key,
                asset.image_bytes,
                content_type=asset.mime_type,
            )
            images.append(
                TryOnGeneratedImage(
                    url=stored.url,
                    storage_key=stored.storage_key,
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

    def _build_object_key(self, payload: TryOnGenerateRequest, mime_type: str, index: int) -> str:
        extension = MIME_EXTENSION_MAP.get(mime_type, "bin")
        return "/".join(
            [
                "ai-try-on",
                payload.provider_mode,
                payload.task_id,
                f"{index + 1}.{extension}",
            ]
        )
