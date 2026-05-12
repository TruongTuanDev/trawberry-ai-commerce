from abc import ABC, abstractmethod
from dataclasses import dataclass


class ProviderError(Exception):
    def __init__(
        self,
        message: str,
        *,
        status_code: int = 502,
        retryable: bool = False,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.retryable = retryable


@dataclass(slots=True)
class ProviderImageResult:
    source_url: str | None = None
    image_bytes: bytes | None = None
    mime_type: str | None = None
    width: int | None = None
    height: int | None = None
    provider: str | None = None


@dataclass(slots=True)
class ProviderGenerateRequest:
    task_id: str
    shop_id: str
    product_id: str
    quantity: int
    task_type: str
    style_preset: str | None
    prompt: str
    front_image_url: str | None
    back_image_url: str | None
    model_image_url: str | None


class ImageProvider(ABC):
    provider_name: str

    @abstractmethod
    async def generate(self, request: ProviderGenerateRequest) -> list[ProviderImageResult]:
        raise NotImplementedError
