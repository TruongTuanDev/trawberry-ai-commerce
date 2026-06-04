from app.services.try_on_provider import (
    TryOnProvider,
    TryOnProviderImageResult,
    TryOnProviderRequest,
)
from app.services.try_on_svg import build_try_on_svg


class DemoTryOnProvider(TryOnProvider):
    provider_name = "demo"

    async def generate(
        self, request: TryOnProviderRequest
    ) -> list[TryOnProviderImageResult]:
        category = (request.category or "fashion").lower()
        if "dress" in category:
            accent = "#d9a0b5"
        elif "pants" in category or "jeans" in category:
            accent = "#88a9d8"
        else:
            accent = "#9ec6a8"

        payload = build_try_on_svg(
            title="AI Try-On Demo",
            subtitle=f"{request.product_name} | {category}",
            badge=f"{request.gender or 'profile'} / {request.body_type or 'regular'}",
            accent=accent,
            footer="Category-based deterministic demo asset",
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
