from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_try_on_service, verify_internal_token
from app.schemas.ai_try_on import TryOnGenerateRequest, TryOnGenerateResponse
from app.services.image_provider import ProviderError
from app.services.try_on_service import TryOnService


router = APIRouter(
    prefix="/internal/ai-try-on",
    tags=["internal-ai-try-on"],
    dependencies=[Depends(verify_internal_token)],
)


@router.post("/generate", response_model=TryOnGenerateResponse)
async def generate_ai_try_on(
    payload: TryOnGenerateRequest,
    service: TryOnService = Depends(get_try_on_service),
) -> TryOnGenerateResponse:
    try:
        return await service.generate(payload)
    except ProviderError as error:
        raise HTTPException(
            status_code=error.status_code,
            detail={
                "code": error.code,
                "message": str(error),
                **error.diagnostics,
            },
        ) from error
