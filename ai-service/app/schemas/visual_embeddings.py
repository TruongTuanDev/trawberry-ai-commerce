from pydantic import BaseModel, Field, HttpUrl, model_validator


class VisualEmbeddingRequest(BaseModel):
    image_base64: str | None = None
    image_url: HttpUrl | None = None

    @model_validator(mode="after")
    def require_exactly_one_source(self) -> "VisualEmbeddingRequest":
        if bool(self.image_base64) == bool(self.image_url):
            raise ValueError("Provide exactly one of image_base64 or image_url.")
        return self


class VisualEmbeddingResponse(BaseModel):
    embedding: list[float]
    dimensions: int = Field(ge=1)
    model: str
    provider: str
    fingerprint: str
