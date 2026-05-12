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
    openai_image_size: str = "1024x1536"
    openai_image_quality: str = "medium"
    openai_image_output_format: Literal["jpeg", "png", "webp"] = "jpeg"
    openai_image_timeout_seconds: int = 120
    openai_image_max_retries: int = 1
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
        default="http://localhost:8010/generated",
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

    @property
    def input_image_max_bytes(self) -> int:
        default_bytes = self.max_input_image_size_mb * 1024 * 1024
        return self.openai_input_image_max_bytes or default_bytes


@lru_cache
def get_settings() -> Settings:
    return Settings()
