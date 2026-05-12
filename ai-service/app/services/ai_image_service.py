from app.schemas.ai_images import AiImageGenerateRequest, AiImageGenerateResponse, GeneratedImage
from app.services.callback_client import CallbackClient
from app.services.image_provider import ImageProvider, ProviderGenerateRequest, ProviderImageResult
from app.services.prompt_builder import EcommercePromptBuilder
from app.services.storage_service import StorageService


MIME_EXTENSION_MAP = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


class AiImageService:
    def __init__(
        self,
        provider: ImageProvider,
        storage_service: StorageService,
        prompt_builder: EcommercePromptBuilder,
        callback_client: CallbackClient,
    ):
        self.provider = provider
        self.storage_service = storage_service
        self.prompt_builder = prompt_builder
        self.callback_client = callback_client

    async def generate(self, payload: AiImageGenerateRequest) -> AiImageGenerateResponse:
        prompt = self.prompt_builder.build(payload)
        generated_assets = await self.provider.generate(
            ProviderGenerateRequest(
                task_id=payload.task_id,
                shop_id=payload.shop_id,
                product_id=payload.product_id,
                quantity=payload.quantity,
                task_type=payload.task_type,
                style_preset=payload.style_preset,
                prompt=prompt,
                front_image_url=str(payload.input_images.front_image_url) if payload.input_images.front_image_url else None,
                back_image_url=str(payload.input_images.back_image_url) if payload.input_images.back_image_url else None,
                model_image_url=str(payload.input_images.model_image_url) if payload.input_images.model_image_url else None,
            )
        )

        images: list[GeneratedImage] = []
        for index, asset in enumerate(generated_assets):
            object_key = self._build_object_key(payload, asset, index)
            stored = await self._store_asset(object_key, asset)
            images.append(
                GeneratedImage(
                    url=stored.url,
                    storage_key=stored.storage_key,
                    provider=asset.provider or self.provider.provider_name,
                    width=asset.width,
                    height=asset.height,
                )
            )

        response = AiImageGenerateResponse(
            task_id=payload.task_id,
            status="COMPLETED",
            images=images,
        )

        if payload.callback_url:
            await self.callback_client.send(str(payload.callback_url), response.model_dump(by_alias=True))

        return response

    def _build_object_key(
        self,
        payload: AiImageGenerateRequest,
        asset: ProviderImageResult,
        index: int,
    ) -> str:
        extension = MIME_EXTENSION_MAP.get(asset.mime_type or "", "txt" if asset.source_url else "bin")
        return "/".join(
            [
                "ai-images",
                payload.shop_id,
                payload.product_id,
                payload.task_id,
                f"{index + 1}.{extension}",
            ]
        )

    async def _store_asset(
        self,
        object_key: str,
        asset: ProviderImageResult,
    ):
        if asset.image_bytes is not None:
            return await self.storage_service.store_bytes(
                object_key,
                asset.image_bytes,
                content_type=asset.mime_type or "application/octet-stream",
            )

        if asset.source_url is None:
            raise ValueError("Provider image result must include either image_bytes or source_url.")

        return await self.storage_service.store_from_url(object_key, asset.source_url)
