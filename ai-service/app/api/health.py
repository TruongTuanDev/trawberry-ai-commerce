from fastapi import APIRouter

from app.config import get_settings
from app.schemas.ai_images import HealthResponse


router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        ai_image_provider=settings.ai_image_provider,
        storage_driver=settings.storage_driver,
        openai_configured=bool(settings.openai_api_key),
        try_on_ready=False,
    )
