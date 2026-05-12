from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass(slots=True)
class ProviderImageAsset:
    filename: str
    content_type: str
    content: bytes
    width: int | None = None
    height: int | None = None
    metadata: dict[str, str | int | float | bool | None] = field(default_factory=dict)


@dataclass(slots=True)
class ProviderGenerateRequest:
    task_id: str
    prompt: str
    negative_prompt: str | None
    input_image_urls: list[str]
    mode: str
    quantity: int


class ImageProvider(ABC):
    provider_name: str

    @abstractmethod
    async def generate(self, request: ProviderGenerateRequest) -> list[ProviderImageAsset]:
        raise NotImplementedError
