from fastapi import APIRouter

from app.config import get_settings
from app.schemas.ai_images import HealthResponse


router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    settings = get_settings()
    safe_error_code: str | None = None
    openai_configured = (
        settings.ai_image_provider == "openai" and bool(settings.openai_api_key)
    )

    if settings.ai_image_provider == "openai" and not settings.openai_api_key:
        safe_error_code = "OPENAI_UNAUTHORIZED"
    elif settings.storage_driver == "s3" and (
        not settings.s3_bucket
        or not settings.s3_endpoint_url
        or not settings.s3_access_key_id
        or not settings.s3_secret_access_key
    ):
        safe_error_code = "STORAGE_WRITE_FAILED"

    return HealthResponse(
        ai_image_provider=settings.ai_image_provider,
        storage_driver=settings.storage_driver,
        openai_configured=openai_configured,
        openai_smoke_enabled=settings.run_openai_smoke,
        safe_error_code=safe_error_code,
        try_on_ready=False,
    )
