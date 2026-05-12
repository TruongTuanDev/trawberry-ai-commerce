from __future__ import annotations

from pathlib import Path

from app.models.schemas import AiImageGenerateRequest, AiImageGenerateResponse, StoredImageResult
from app.providers.base import ImageProvider, ProviderGenerateRequest
from app.services.callback_client import CallbackClient
from app.services.prompt_builder import EcommercePromptBuilder
from app.services.storage import StorageClient


class ImageGenerationService:
    def __init__(
        self,
        provider: ImageProvider,
        storage_client: StorageClient,
        prompt_builder: EcommercePromptBuilder,
        callback_client: CallbackClient,
    ):
        self.provider = provider
        self.storage_client = storage_client
        self.prompt_builder = prompt_builder
        self.callback_client = callback_client

    async def generate(self, payload: AiImageGenerateRequest) -> AiImageGenerateResponse:
        prompt = self.prompt_builder.build(payload)
        assets = await self.provider.generate(
            ProviderGenerateRequest(
                task_id=payload.task_id,
                prompt=prompt,
                negative_prompt=payload.negative_prompt,
                input_image_urls=[str(url) for url in payload.source_image_urls],
                mode=payload.mode,
                quantity=payload.quantity,
            )
        )

        stored_results: list[StoredImageResult] = []
        for index, asset in enumerate(assets):
            object_key = "/".join(
                [
                    "ai-images",
                    payload.shop_id,
                    payload.product_id,
                    payload.task_id,
                    f"{index + 1}-{Path(asset.filename).name}",
                ]
            )
            stored_asset = await self.storage_client.upload_bytes(
                object_key=object_key,
                content=asset.content,
                content_type=asset.content_type,
            )
            stored_results.append(
                StoredImageResult(
                    image_url=stored_asset.public_url,
                    storage_provider=stored_asset.storage_provider,
                    mime_type=asset.content_type,
                    width=asset.width,
                    height=asset.height,
                    provider_metadata=asset.metadata,
                )
            )

        response = AiImageGenerateResponse(
            task_id=payload.task_id,
            status="completed",
            provider=self.provider.provider_name,
            provider_task_id=f"{self.provider.provider_name}-{payload.task_id}",
            prompt=prompt,
            images=stored_results,
        )

        if not payload.callback_url:
            return response

        try:
            callback_response = await self.callback_client.send(str(payload.callback_url), response)
            return response.model_copy(
                update={
                    "status": "callback_sent",
                    "callback_status": callback_response.status_code,
                }
            )
        except Exception as error:
            return response.model_copy(
                update={
                    "status": "callback_failed",
                    "callback_error": str(error),
                }
            )
