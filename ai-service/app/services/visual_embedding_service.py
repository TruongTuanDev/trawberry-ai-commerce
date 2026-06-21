import base64
import hashlib
import ipaddress
import math
import socket
from io import BytesIO
from urllib.parse import urlparse

import httpx
from PIL import Image, UnidentifiedImageError

from app.core.config import Settings
from app.schemas.visual_embeddings import VisualEmbeddingRequest, VisualEmbeddingResponse


class VisualEmbeddingError(ValueError):
    pass


class VisualEmbeddingService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._model = None
        self._preprocess = None

    def warmup(self) -> None:
        if self.settings.visual_embedding_provider != "open_clip":
            return
        self._load_open_clip_model()

    async def embed(self, payload: VisualEmbeddingRequest) -> VisualEmbeddingResponse:
        image_bytes = await self._resolve_image_bytes(payload)
        image = self._decode_image(image_bytes)
        fingerprint = hashlib.sha256(image_bytes).hexdigest()

        if self.settings.visual_embedding_provider == "open_clip":
            embedding = self._embed_open_clip(image)
            provider = "open_clip"
            model = self.settings.visual_embedding_model
        else:
            embedding = self._embed_mock(image_bytes)
            provider = "mock"
            model = "deterministic_mock_v1"

        return VisualEmbeddingResponse(
            embedding=embedding,
            dimensions=len(embedding),
            model=model,
            provider=provider,
            fingerprint=fingerprint,
        )

    async def _resolve_image_bytes(self, payload: VisualEmbeddingRequest) -> bytes:
        if payload.image_base64:
            try:
                value = base64.b64decode(payload.image_base64, validate=True)
            except ValueError as exc:
                raise VisualEmbeddingError("image_base64 is invalid.") from exc
            self._validate_size(value)
            return value

        if not payload.image_url:
            raise VisualEmbeddingError("An image source is required.")
        return await self._download_image(str(payload.image_url))

    async def _download_image(self, url: str) -> bytes:
        self._validate_remote_url(url)
        timeout = httpx.Timeout(self.settings.visual_embedding_download_timeout_seconds)
        try:
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
                async with client.stream("GET", url) as response:
                    response.raise_for_status()
                    content_type = response.headers.get("content-type", "").split(";", 1)[0]
                    if content_type not in {"image/jpeg", "image/png", "image/webp"}:
                        raise VisualEmbeddingError("Remote URL is not a supported image.")
                    chunks: list[bytes] = []
                    size = 0
                    async for chunk in response.aiter_bytes():
                        size += len(chunk)
                        if size > self.settings.visual_embedding_max_bytes:
                            raise VisualEmbeddingError("Remote image exceeds the size limit.")
                        chunks.append(chunk)
                    value = b"".join(chunks)
                    self._validate_size(value)
                    return value
        except VisualEmbeddingError:
            raise
        except (httpx.HTTPError, TimeoutError) as exc:
            raise VisualEmbeddingError("Remote image could not be downloaded.") from exc

    def _validate_remote_url(self, url: str) -> None:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            raise VisualEmbeddingError("Only HTTP(S) image URLs are supported.")

        hostname = parsed.hostname.lower()
        allowed_hosts = {
            value.strip().lower()
            for value in self.settings.visual_embedding_allowed_hosts.split(",")
            if value.strip()
        }
        if hostname in allowed_hosts:
            return
        if parsed.scheme != "https":
            raise VisualEmbeddingError("Public image URLs must use HTTPS.")

        try:
            addresses = socket.getaddrinfo(hostname, parsed.port or 443, type=socket.SOCK_STREAM)
        except socket.gaierror as exc:
            raise VisualEmbeddingError("Image host could not be resolved.") from exc

        for address in addresses:
            ip = ipaddress.ip_address(address[4][0])
            if not ip.is_global:
                raise VisualEmbeddingError("Private or reserved image hosts are not allowed.")

    def _validate_size(self, value: bytes) -> None:
        if not value:
            raise VisualEmbeddingError("Image is empty.")
        if len(value) > self.settings.visual_embedding_max_bytes:
            raise VisualEmbeddingError("Image exceeds the size limit.")

    def _decode_image(self, value: bytes) -> Image.Image:
        try:
            image = Image.open(BytesIO(value))
            image.load()
            if image.format not in {"JPEG", "PNG", "WEBP"}:
                raise VisualEmbeddingError("Image format is not supported.")
            return image.convert("RGB")
        except (UnidentifiedImageError, OSError) as exc:
            raise VisualEmbeddingError("Image bytes could not be decoded.") from exc

    def _embed_mock(self, value: bytes) -> list[float]:
        dimensions = self.settings.visual_embedding_dimensions
        seed = hashlib.sha512(value).digest()
        vector = [((seed[index % len(seed)] / 255.0) * 2.0) - 1.0 for index in range(dimensions)]
        return self._normalize(vector)

    def _embed_open_clip(self, image: Image.Image) -> list[float]:
        try:
            import torch
        except ImportError as exc:
            raise VisualEmbeddingError(
                "open_clip provider dependencies are unavailable."
            ) from exc

        self._load_open_clip_model()

        tensor = self._preprocess(image).unsqueeze(0)
        with torch.no_grad():
            vector = self._model.encode_image(tensor)
            vector = vector / vector.norm(dim=-1, keepdim=True)
        values = vector[0].cpu().tolist()
        if len(values) != self.settings.visual_embedding_dimensions:
            raise VisualEmbeddingError("Embedding dimensions do not match configuration.")
        return [float(value) for value in values]

    def _load_open_clip_model(self) -> None:
        if self._model is not None and self._preprocess is not None:
            return
        try:
            import open_clip
        except ImportError as exc:
            raise VisualEmbeddingError("open_clip provider dependencies are unavailable.") from exc

        model, _, preprocess = open_clip.create_model_and_transforms(
            self.settings.visual_embedding_model,
            pretrained=self.settings.visual_embedding_pretrained,
            device="cpu",
        )
        model.eval()
        self._model = model
        self._preprocess = preprocess

    def _normalize(self, values: list[float]) -> list[float]:
        norm = math.sqrt(sum(value * value for value in values))
        if norm == 0:
            raise VisualEmbeddingError("Embedding vector has zero norm.")
        return [round(value / norm, 8) for value in values]
