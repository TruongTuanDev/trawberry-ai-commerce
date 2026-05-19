from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_ai_image_service, verify_internal_token
from app.schemas.ai_images import AiImageGenerateRequest, AiImageGenerateResponse
from app.services.ai_image_service import AiImageService
from app.services.image_provider import ProviderError


router = APIRouter(
    prefix="/internal/ai-images",
    tags=["internal-ai-images"],
    dependencies=[Depends(verify_internal_token)],
)


@router.post("/generate", response_model=AiImageGenerateResponse)
async def generate_ai_images(
    payload: AiImageGenerateRequest,
    service: AiImageService = Depends(get_ai_image_service),
) -> AiImageGenerateResponse:
    try:
        return await service.generate(payload)
    except ProviderError as error:
        raise HTTPException(
            status_code=error.status_code,
            detail={
                "code": error.code,
                "message": str(error),
            },
        ) from error
