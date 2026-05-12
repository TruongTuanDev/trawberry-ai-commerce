import base64

from openai import AsyncOpenAI

from app.core.config import Settings

from .base import ImageProvider, ProviderGenerateRequest, ProviderImageAsset


class OpenAIImageProvider(ImageProvider):
    provider_name = "openai"

    def __init__(self, settings: Settings):
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY is required when AI_PROVIDER=openai.")
        self.settings = settings
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def generate(self, request: ProviderGenerateRequest) -> list[ProviderImageAsset]:
        if request.mode == "try_on":
            raise NotImplementedError(
                "Try-on flow should use a provider-specific image-conditioned path. "
                "This bootstrap service keeps the interface ready but only implements text-to-image for OpenAI."
            )

        response = await self.client.images.generate(
            model=self.settings.openai_image_model,
            prompt=request.prompt,
            n=request.quantity,
            size=self.settings.openai_image_size,
            quality=self.settings.openai_image_quality,
            background=self.settings.openai_image_background,
        )

        assets: list[ProviderImageAsset] = []
        for index, item in enumerate(response.data):
            if not item.b64_json:
                continue
            assets.append(
                ProviderImageAsset(
                    filename=f"{request.task_id}-openai-{index + 1}.png",
                    content_type="image/png",
                    content=base64.b64decode(item.b64_json),
                    metadata={
                        "provider": self.provider_name,
                        "revised_prompt": getattr(item, "revised_prompt", None),
                    },
                )
            )

        if not assets:
            raise RuntimeError("OpenAI provider returned no image content.")

        return assets
