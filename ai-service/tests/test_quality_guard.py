from io import BytesIO

from PIL import Image
import pytest

from app.services.image_provider import ProviderError
from app.services.image_quality_guard import validate_generated_image


def create_png_bytes() -> bytes:
    image = Image.new("RGB", (32, 24), color=(255, 0, 0))
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_quality_guard_accepts_valid_image() -> None:
    payload = create_png_bytes()

    result = validate_generated_image(payload, expected_mime_type="image/png")

    assert result.mime_type == "image/png"
    assert result.width == 32
    assert result.height == 24
    assert result.file_size > 0


def test_quality_guard_rejects_empty_image() -> None:
    with pytest.raises(ProviderError) as error:
        validate_generated_image(b"", expected_mime_type="image/png")

    assert "empty" in str(error.value).lower()


def test_quality_guard_rejects_wrong_format() -> None:
    with pytest.raises(ProviderError) as error:
        validate_generated_image(b"not-an-image", expected_mime_type="image/png")

    assert "readable image" in str(error.value)
