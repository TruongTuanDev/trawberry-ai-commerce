from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

from PIL import Image, UnidentifiedImageError

from app.services.image_provider import ProviderError


ALLOWED_OUTPUT_MIME_TYPES = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WEBP",
}

PIL_FORMAT_TO_MIME = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
}


@dataclass(slots=True)
class QualityGuardResult:
    mime_type: str
    width: int
    height: int
    file_size: int


def validate_generated_image(
    payload: bytes,
    *,
    expected_mime_type: str,
) -> QualityGuardResult:
    if not payload:
        raise ProviderError(
            "Generated image is empty.",
            status_code=502,
            retryable=False,
        )

    if expected_mime_type not in ALLOWED_OUTPUT_MIME_TYPES:
        raise ProviderError(
            f"Unsupported generated image MIME type: {expected_mime_type}.",
            status_code=502,
            retryable=False,
        )

    try:
        with Image.open(BytesIO(payload)) as image:
            image.load()
            width, height = image.size
            detected_mime_type = PIL_FORMAT_TO_MIME.get((image.format or "").upper())
    except UnidentifiedImageError as error:
        raise ProviderError(
            "Generated image failed quality validation because the binary is not a readable image.",
            status_code=502,
            retryable=False,
        ) from error
    except OSError as error:
        raise ProviderError(
            "Generated image failed quality validation during image parsing.",
            status_code=502,
            retryable=False,
        ) from error

    if not detected_mime_type or detected_mime_type not in ALLOWED_OUTPUT_MIME_TYPES:
        raise ProviderError(
            "Generated image has an unsupported decoded format.",
            status_code=502,
            retryable=False,
        )

    if detected_mime_type != expected_mime_type:
        raise ProviderError(
            "Generated image MIME type does not match the configured output format.",
            status_code=502,
            retryable=False,
        )

    if width <= 0 or height <= 0:
        raise ProviderError(
            "Generated image has invalid dimensions.",
            status_code=502,
            retryable=False,
        )

    return QualityGuardResult(
        mime_type=detected_mime_type,
        width=width,
        height=height,
        file_size=len(payload),
    )
