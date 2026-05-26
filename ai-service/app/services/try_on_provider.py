from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(slots=True)
class TryOnProviderImageResult:
    image_bytes: bytes
    mime_type: str
    width: int
    height: int
    provider: str


@dataclass(slots=True)
class TryOnProviderRequest:
    task_id: str
    provider_mode: str
    product_name: str
    product_image_url: str
    category: str | None
    selected_size: str | None
    selected_russian_size: str | None
    prompt: str
    locale: str
    customer_image_url: str | None
    selected_model_image_url: str | None
    selected_model_id: str | None
    height_cm: int | None
    weight_kg: int | None
    gender: str | None
    body_type: str | None
    body_traits: list[str]


class TryOnProvider(ABC):
    provider_name: str

    @abstractmethod
    async def generate(self, request: TryOnProviderRequest) -> list[TryOnProviderImageResult]:
        raise NotImplementedError
