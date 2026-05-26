from app.services.try_on_provider import (
    TryOnProvider,
    TryOnProviderImageResult,
    TryOnProviderRequest,
)
from app.services.try_on_svg import build_try_on_svg


class MockTryOnProvider(TryOnProvider):
    provider_name = "mock"

    async def generate(
        self, request: TryOnProviderRequest
    ) -> list[TryOnProviderImageResult]:
        reference = "uploaded photo" if request.customer_image_url else (
            request.selected_model_id or "built-in model"
        )
        payload = build_try_on_svg(
            title="AI Try-On Mock",
            subtitle=f"{request.product_name} | {reference}",
            badge=f"Size {request.selected_size or 'N/A'}",
            accent="#f2b36f",
            footer="Deterministic local demo result",
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
