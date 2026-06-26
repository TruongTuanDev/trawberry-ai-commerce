from functools import lru_cache
from typing import Literal

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "strawberry-ai-service"
    environment: str = "development"
    ai_service_host: str = "0.0.0.0"
    ai_service_port: int = 8000

    ai_image_provider: Literal["mock", "openai"] = Field(
        default="mock",
        validation_alias=AliasChoices("AI_IMAGE_PROVIDER", "AI_PROVIDER"),
    )
    openai_api_key: str | None = None
    openai_image_model: str = "gpt-image-1"
    ai_try_on_openai_model: str = Field(
        default="gpt-image-1",
        validation_alias=AliasChoices(
            "AI_TRY_ON_OPENAI_MODEL",
            "OPENAI_TRY_ON_MODEL",
        ),
    )
    ai_try_on_provider_timeout_seconds: int = Field(
        default=120,
        validation_alias=AliasChoices(
            "AI_TRY_ON_PROVIDER_TIMEOUT_SECONDS",
            "OPENAI_TRY_ON_TIMEOUT_SECONDS",
        ),
    )
    ai_try_on_output_size: Literal[
        "auto",
        "1024x1024",
        "1536x1024",
        "1024x1536",
        "256x256",
        "512x512",
    ] = Field(
        default="1024x1536",
        validation_alias=AliasChoices(
            "AI_TRY_ON_OUTPUT_SIZE",
            "OPENAI_TRY_ON_OUTPUT_SIZE",
        ),
    )
    openai_image_size: str = "1024x1536"
    openai_image_quality: str = "medium"
    openai_image_output_format: Literal["jpeg", "png", "webp"] = "jpeg"
    # gpt-image-1 only: "high" preserves the input face and garment details far
    # better than "low" (much more realistic try-on), at a higher token cost.
    openai_image_input_fidelity: Literal["low", "high"] = Field(
        default="high",
        validation_alias=AliasChoices(
            "OPENAI_IMAGE_INPUT_FIDELITY",
            "AI_TRY_ON_INPUT_FIDELITY",
        ),
    )
    openai_image_timeout_seconds: int = 120
    openai_image_max_retries: int = 1
    run_openai_smoke: bool = False
    openai_input_image_max_bytes: int = Field(
        default=15 * 1024 * 1024,
        validation_alias=AliasChoices(
            "OPENAI_INPUT_IMAGE_MAX_BYTES",
            "MAX_INPUT_IMAGE_BYTES",
        ),
    )
    max_input_image_size_mb: int = Field(
        default=15,
        validation_alias=AliasChoices(
            "MAX_INPUT_IMAGE_SIZE_MB",
            "OPENAI_INPUT_IMAGE_MAX_MB",
        ),
    )
    openai_input_image_timeout_seconds: int = Field(
        default=20,
        validation_alias=AliasChoices(
            "OPENAI_INPUT_IMAGE_TIMEOUT_SECONDS",
            "INPUT_IMAGE_DOWNLOAD_TIMEOUT_SECONDS",
        ),
    )

    storage_driver: Literal["mock", "local", "s3"] = "mock"
    storage_local_root: str = Field(
        default="generated",
        validation_alias=AliasChoices("STORAGE_LOCAL_ROOT", "AI_OUTPUT_DIR"),
    )
    storage_public_base_url: str = Field(
        default="http://localhost:8000/generated",
        validation_alias=AliasChoices("STORAGE_PUBLIC_BASE_URL", "PUBLIC_BASE_URL"),
    )

    s3_bucket: str = "strawberry-ai-assets"
    s3_region: str = "us-east-1"
    s3_endpoint_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("S3_ENDPOINT_URL", "S3_ENDPOINT"),
    )
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None
    s3_public_base_url: str | None = None

    ai_service_internal_token: str = "dev-internal-token"
    nest_callback_auth_token: str | None = None

    visual_embedding_provider: Literal["mock", "open_clip"] = "mock"
    visual_embedding_model: str = "ViT-B-32"
    visual_embedding_pretrained: str = "laion2b_s34b_b79k"
    visual_embedding_dimensions: int = 512
    visual_embedding_max_bytes: int = 8 * 1024 * 1024
    visual_embedding_download_timeout_seconds: int = 15
    visual_embedding_allowed_hosts: str = "backend-nest,minio"

    @property
    def input_image_max_bytes(self) -> int:
        default_bytes = self.max_input_image_size_mb * 1024 * 1024
        return self.openai_input_image_max_bytes or default_bytes


@lru_cache
def get_settings() -> Settings:
    return Settings()
