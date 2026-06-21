from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_visual_embedding_service, verify_internal_token
from app.schemas.visual_embeddings import VisualEmbeddingRequest, VisualEmbeddingResponse
from app.services.visual_embedding_service import VisualEmbeddingError, VisualEmbeddingService


router = APIRouter(
    prefix="/internal/visual-search",
    tags=["internal-visual-search"],
    dependencies=[Depends(verify_internal_token)],
)


@router.post("/embeddings", response_model=VisualEmbeddingResponse)
async def create_embedding(
    payload: VisualEmbeddingRequest,
    service: VisualEmbeddingService = Depends(get_visual_embedding_service),
) -> VisualEmbeddingResponse:
    try:
        return await service.embed(payload)
    except VisualEmbeddingError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
