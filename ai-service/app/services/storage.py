from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote

import boto3

from app.core.config import Settings


@dataclass(slots=True)
class StoredAsset:
    public_url: str
    storage_provider: str


class StorageClient:
    async def upload_bytes(self, object_key: str, content: bytes, content_type: str) -> StoredAsset:
        raise NotImplementedError


class LocalStorageClient(StorageClient):
    def __init__(self, settings: Settings):
        self.root = Path(settings.storage_local_root)
        self.public_base_url = settings.storage_public_base_url.rstrip("/")

    async def upload_bytes(self, object_key: str, content: bytes, content_type: str) -> StoredAsset:
        target = self.root / object_key
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        return StoredAsset(
            public_url=f"{self.public_base_url}/{quote(object_key)}",
            storage_provider="local",
        )


class S3StorageClient(StorageClient):
    def __init__(self, settings: Settings):
        self.bucket = settings.s3_bucket
        self.public_base_url = (settings.s3_public_base_url or "").rstrip("/")
        self.client = boto3.client(
            "s3",
            region_name=settings.s3_region,
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
        )

    async def upload_bytes(self, object_key: str, content: bytes, content_type: str) -> StoredAsset:
        self.client.put_object(
            Bucket=self.bucket,
            Key=object_key,
            Body=content,
            ContentType=content_type,
        )
        base = self.public_base_url or f"{self.client.meta.endpoint_url.rstrip('/')}/{self.bucket}"
        return StoredAsset(
            public_url=f"{base}/{quote(object_key)}",
            storage_provider="s3",
        )


def build_storage_client(settings: Settings) -> StorageClient:
    if settings.storage_provider == "s3":
        return S3StorageClient(settings)
    return LocalStorageClient(settings)
