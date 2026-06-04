from typing import Literal

from pydantic import Field, HttpUrl

from app.schemas.ai_images import ApiModel


class TryOnProduct(ApiModel):
    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    image_url: HttpUrl
    category: str | None = None
    selected_size: str | None = None
    selected_russian_size: str | None = None


class TryOnPerson(ApiModel):
    customer_image_url: HttpUrl | None = None
    selected_model_image_url: HttpUrl | None = None
    selected_model_id: str | None = None
    height_cm: int | None = None
    weight_kg: int | None = None
    gender: Literal["male", "female", "other"] | None = None
    body_type: Literal["slim", "regular", "large"] | None = None
    body_traits: list[str] = Field(default_factory=list)


class TryOnGenerateRequest(ApiModel):
    task_id: str = Field(..., min_length=1)
    provider_mode: Literal["mock", "demo", "openai"] = "mock"
    product: TryOnProduct
    person: TryOnPerson
    prompt: str = Field(..., min_length=10, max_length=4000)
    locale: Literal["ru", "en"] = "ru"


class TryOnGeneratedImage(ApiModel):
    url: str | None = None
    storage_key: str | None = None
    image_base64: str | None = None
    mime_type: str
    width: int | None = None
    height: int | None = None


class TryOnGenerateResponse(ApiModel):
    images: list[TryOnGeneratedImage]
    provider: str
    metadata: dict[str, str | int | float | bool | None] = Field(default_factory=dict)
