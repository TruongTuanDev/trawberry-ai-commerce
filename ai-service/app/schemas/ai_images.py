from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


def to_camel(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


class ApiModel(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
    )


class HealthResponse(ApiModel):
    status: Literal["OK"] = "OK"
    ok: bool = True
    service: str = "strawberry-ai-service"
    ai_image_provider: Literal["mock", "openai"] = "mock"
    storage_driver: Literal["mock", "local", "s3"] = "mock"
    openai_configured: bool = False
    try_on_ready: bool = False


class InputImages(ApiModel):
    front_image_url: HttpUrl | None = None
    back_image_url: HttpUrl | None = None
    model_image_url: HttpUrl | None = None


class AiImageGenerateRequest(ApiModel):
    task_id: str = Field(..., min_length=1)
    shop_id: str = Field(..., min_length=1)
    product_id: str = Field(..., min_length=1)
    quantity: int = Field(default=1, ge=1, le=10)
    task_type: Literal[
        "PRODUCT_MODEL_IMAGE",
        "TRY_ON",
        "BACKGROUND_REPLACE",
        "DETAIL_SHOT",
    ] = "PRODUCT_MODEL_IMAGE"
    style_preset: Literal[
        "MAIN_COVER",
        "STUDIO",
        "LIFESTYLE",
        "WALKING",
        "BACK_VIEW",
        "DETAIL",
        "TRY_ON",
    ] | None = None
    prompt: str = Field(..., min_length=10, max_length=4000)
    input_images: InputImages = Field(default_factory=InputImages)
    callback_url: HttpUrl | None = None


class GeneratedImage(ApiModel):
    url: str
    storage_key: str | None = None
    provider: str
    width: int | None = None
    height: int | None = None


class AiImageGenerateResponse(ApiModel):
    task_id: str
    status: Literal["COMPLETED"] = "COMPLETED"
    images: list[GeneratedImage]
