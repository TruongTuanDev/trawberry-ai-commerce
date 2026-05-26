from app.config import Settings
from app.services.image_provider import ProviderError
from app.services.try_on_provider import (
    TryOnProvider,
    TryOnProviderImageResult,
    TryOnProviderRequest,
)
from app.services.try_on_svg import build_try_on_svg


class OpenAITryOnProvider(TryOnProvider):
    provider_name = "openai"

    def __init__(self, settings: Settings):
        self.settings = settings

    async def generate(
        self, request: TryOnProviderRequest
    ) -> list[TryOnProviderImageResult]:
        if not self.settings.openai_api_key:
            raise ProviderError(
                "OpenAI provider is not configured for AI try-on.",
                status_code=400,
                retryable=False,
                code="AI_PROVIDER_NOT_CONFIGURED",
            )

        payload = build_try_on_svg(
            title="OpenAI Try-On Ready",
            subtitle=f"{request.product_name} | {self.settings.ai_try_on_openai_model}",
            badge=f"{request.selected_size or 'size'} / {request.locale.upper()}",
            accent="#9fb7ff",
            footer="Phase 1 placeholder wired to the OpenAI-ready provider path",
        )
        return [
            TryOnProviderImageResult(
                image_bytes=payload,
                mime_type="image/svg+xml",
                width=1024,
                height=1536,
                provider=self.provider_name,
            )
        ]
