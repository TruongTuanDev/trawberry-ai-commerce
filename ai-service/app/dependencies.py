from functools import lru_cache

from fastapi import Header, HTTPException, status

from app.config import Settings, get_settings
from app.services.ai_image_service import AiImageService
from app.services.callback_client import CallbackClient
from app.services.image_provider import ImageProvider
from app.services.mock_image_provider import MockImageProvider
from app.services.openai_image_provider import OpenAIImageProvider
from app.services.prompt_builder import EcommercePromptBuilder
from app.services.storage_service import build_storage_service
from app.services.demo_try_on_provider import DemoTryOnProvider
from app.services.mock_try_on_provider import MockTryOnProvider
from app.services.openai_try_on_provider import OpenAITryOnProvider
from app.services.try_on_provider import TryOnProvider
from app.services.try_on_service import TryOnService


@lru_cache
def get_provider() -> ImageProvider:
    settings = get_settings()
    if settings.ai_image_provider.lower() == "openai":
        return OpenAIImageProvider(settings)
    return MockImageProvider()


@lru_cache
def get_ai_image_service() -> AiImageService:
    settings: Settings = get_settings()
    return AiImageService(
        provider=get_provider(),
        storage_service=build_storage_service(settings),
        prompt_builder=EcommercePromptBuilder(),
        callback_client=CallbackClient(settings),
    )


@lru_cache
def get_try_on_providers() -> dict[str, TryOnProvider]:
    settings = get_settings()
    return {
        "mock": MockTryOnProvider(),
        "demo": DemoTryOnProvider(),
        "openai": OpenAITryOnProvider(settings),
    }


@lru_cache
def get_try_on_service() -> TryOnService:
    return TryOnService(
        providers=get_try_on_providers(),
    )


async def verify_internal_token(
    x_internal_token: str | None = Header(default=None),
) -> None:
    settings = get_settings()
    if not x_internal_token or x_internal_token != settings.ai_service_internal_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal token.",
        )
