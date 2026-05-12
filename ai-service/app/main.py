from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.health import router as health_router
from app.api.internal_ai_images import router as internal_ai_images_router
from app.config import get_settings
from app.utils.logging import configure_logging


configure_logging()
settings = get_settings()
app = FastAPI(title="Strawberry AI Service", version="0.2.0")
app.include_router(health_router)
app.include_router(internal_ai_images_router)

Path(settings.storage_local_root).mkdir(parents=True, exist_ok=True)
app.mount("/generated", StaticFiles(directory=settings.storage_local_root), name="generated")
