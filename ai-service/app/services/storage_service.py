from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote

import boto3

from app.config import Settings


@dataclass(slots=True)
class StoredAsset:
    url: str
    storage_key: str | None
    provider: str


class StorageService:
    async def store_from_url(self, object_key: str, source_url: str) -> StoredAsset:
        raise NotImplementedError

    async def store_bytes(
        self,
        object_key: str,
        payload: bytes,
        *,
        content_type: str,
    ) -> StoredAsset:
        raise NotImplementedError


class MockStorageService(StorageService):
    async def store_from_url(self, object_key: str, source_url: str) -> StoredAsset:
        return StoredAsset(
            url=source_url,
            storage_key=object_key,
            provider="MOCK",
        )

    async def store_bytes(
        self,
        object_key: str,
        payload: bytes,
        *,
        content_type: str,
    ) -> StoredAsset:
        return StoredAsset(
            url=f"https://mock-ai.local/{quote(object_key)}",
            storage_key=object_key,
            provider="MOCK",
        )


class LocalStorageService(StorageService):
    def __init__(self, settings: Settings):
        self.root = Path(settings.storage_local_root)
        self.public_base_url = settings.storage_public_base_url.rstrip("/")

    async def store_from_url(self, object_key: str, source_url: str) -> StoredAsset:
        target = self.root / object_key
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(source_url, encoding="utf-8")
        return StoredAsset(
            url=f"{self.public_base_url}/{quote(object_key)}",
            storage_key=object_key,
            provider="LOCAL",
        )

    async def store_bytes(
        self,
        object_key: str,
        payload: bytes,
        *,
        content_type: str,
    ) -> StoredAsset:
        target = self.root / object_key
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(payload)
        return StoredAsset(
            url=f"{self.public_base_url}/{quote(object_key)}",
            storage_key=object_key,
            provider="LOCAL",
        )


class S3StorageService(StorageService):
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

    async def store_from_url(self, object_key: str, source_url: str) -> StoredAsset:
        self.client.put_object(
            Bucket=self.bucket,
            Key=object_key,
            Body=source_url.encode("utf-8"),
            ContentType="text/plain",
        )
        base = self.public_base_url or f"{self.client.meta.endpoint_url.rstrip('/')}/{self.bucket}"
        return StoredAsset(
            url=f"{base}/{quote(object_key)}",
            storage_key=object_key,
            provider="S3",
        )

    async def store_bytes(
        self,
        object_key: str,
        payload: bytes,
        *,
        content_type: str,
    ) -> StoredAsset:
        self.client.put_object(
            Bucket=self.bucket,
            Key=object_key,
            Body=payload,
            ContentType=content_type,
        )
        base = self.public_base_url or f"{self.client.meta.endpoint_url.rstrip('/')}/{self.bucket}"
        return StoredAsset(
            url=f"{base}/{quote(object_key)}",
            storage_key=object_key,
            provider="S3",
        )


def build_storage_service(settings: Settings) -> StorageService:
    if settings.storage_driver == "mock":
        return MockStorageService()
    if settings.storage_driver == "s3":
        return S3StorageService(settings)
    return LocalStorageService(settings)
