from app.services.image_provider import ImageProvider, ProviderGenerateRequest, ProviderImageResult


class MockImageProvider(ImageProvider):
    provider_name = "MOCK"

    async def generate(self, request: ProviderGenerateRequest) -> list[ProviderImageResult]:
        primary_url = (
            request.front_image_url
            or request.model_image_url
            or request.back_image_url
            or f"https://mock-ai.local/generated/{request.task_id}/placeholder.png"
        )

        return [
            ProviderImageResult(
                source_url=f"{primary_url}{'&' if '?' in primary_url else '?'}mockVariant={index + 1}",
                width=1024,
                height=1024,
            )
            for index in range(request.quantity)
        ]
