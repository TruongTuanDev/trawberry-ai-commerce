import base64
from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image

from app.config import get_settings
from app.dependencies import get_visual_embedding_service
from app.main import app
from app.services.visual_embedding_service import VisualEmbeddingService


client = TestClient(app)


def build_png_bytes() -> bytes:
    output = BytesIO()
    Image.new("RGB", (8, 8), color=(220, 30, 90)).save(output, format="PNG")
    return output.getvalue()


PNG_BYTES = build_png_bytes()


def setup_function() -> None:
    get_settings.cache_clear()
    get_visual_embedding_service.cache_clear()


def test_embedding_requires_internal_token() -> None:
    response = client.post(
        "/internal/visual-search/embeddings",
        json={"image_base64": base64.b64encode(PNG_BYTES).decode("ascii")},
    )
    assert response.status_code == 401


def test_mock_embedding_is_normalized_and_deterministic() -> None:
    token = get_settings().ai_service_internal_token
    payload = {"image_base64": base64.b64encode(PNG_BYTES).decode("ascii")}

    first = client.post(
        "/internal/visual-search/embeddings",
        headers={"X-Internal-Token": token},
        json=payload,
    )
    second = client.post(
        "/internal/visual-search/embeddings",
        headers={"X-Internal-Token": token},
        json=payload,
    )

    assert first.status_code == 200
    assert second.status_code == 200
    body = first.json()
    assert body == second.json()
    assert body["provider"] == "mock"
    assert body["dimensions"] == 512
    assert len(body["embedding"]) == 512
    norm = sum(value * value for value in body["embedding"]) ** 0.5
    assert abs(norm - 1.0) < 0.00001


def test_embedding_rejects_invalid_image_bytes() -> None:
    token = get_settings().ai_service_internal_token
    response = client.post(
        "/internal/visual-search/embeddings",
        headers={"X-Internal-Token": token},
        json={"image_base64": base64.b64encode(b"not-an-image").decode("ascii")},
    )
    assert response.status_code == 422


def test_mock_provider_warmup_does_not_load_a_model() -> None:
    service = VisualEmbeddingService(get_settings())

    service.warmup()

    assert service._model is None
    assert service._preprocess is None
