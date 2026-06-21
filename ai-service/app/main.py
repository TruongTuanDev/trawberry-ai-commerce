from pathlib import Path
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.health import router as health_router
from app.api.internal_ai_images import router as internal_ai_images_router
from app.api.internal_ai_try_on import router as internal_ai_try_on_router
from app.api.internal_visual_embeddings import router as internal_visual_embeddings_router
from app.config import get_settings
from app.dependencies import get_visual_embedding_service
from app.utils.logging import configure_logging


configure_logging()
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await asyncio.to_thread(get_visual_embedding_service().warmup)
    yield


app = FastAPI(title="Strawberry AI Service", version="0.2.0", lifespan=lifespan)
app.include_router(health_router)
app.include_router(internal_ai_images_router)
app.include_router(internal_ai_try_on_router)
app.include_router(internal_visual_embeddings_router)

Path(settings.storage_local_root).mkdir(parents=True, exist_ok=True)
app.mount("/generated", StaticFiles(directory=settings.storage_local_root), name="generated")
