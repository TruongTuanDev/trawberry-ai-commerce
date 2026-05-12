from typing import Literal

from pydantic import BaseModel, Field, HttpUrl


class HealthResponse(BaseModel):
    ok: bool = True
    service: str


class AiImageGenerateRequest(BaseModel):
    task_id: str = Field(..., description="Task id from NestJS")
    shop_id: str
    product_id: str
    product_title: str
    brand: str | None = None
    category_name: str | None = None
    source_image_urls: list[HttpUrl] = Field(default_factory=list)
    mode: Literal["generate", "try_on"] = "generate"
    quantity: int = Field(default=1, ge=1, le=4)
    user_prompt: str | None = None
    negative_prompt: str | None = None
    prompt_options: dict[str, str | int | float | bool | None] = Field(default_factory=dict)
    callback_url: HttpUrl | None = None
    metadata: dict[str, str | int | float | bool | None] = Field(default_factory=dict)


class StoredImageResult(BaseModel):
    image_url: str
    thumbnail_url: str | None = None
    storage_provider: str
    mime_type: str
    width: int | None = None
    height: int | None = None
    provider_metadata: dict[str, str | int | float | bool | None] = Field(default_factory=dict)


class AiImageGenerateResponse(BaseModel):
    task_id: str
    status: Literal["completed", "callback_sent", "callback_failed"]
    provider: str
    provider_task_id: str | None = None
    prompt: str
    images: list[StoredImageResult]
    callback_status: int | None = None
    callback_error: str | None = None
