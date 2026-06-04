#!/bin/sh
set -eu

MINIO_ALIAS="${MINIO_ALIAS:-local}"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://minio:9000}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-change-me-minio-password}"
DEFAULT_BUCKET="${MINIO_BUCKET:-strawberry-ai-assets}"
APP_BUCKET="${S3_BUCKET:-$DEFAULT_BUCKET}"
AI_TRY_ON_BUCKET="${AI_TRY_ON_BUCKET:-ai-try-on}"

mc alias set "$MINIO_ALIAS" "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"

ensure_bucket() {
  bucket_name="$1"
  if [ -z "$bucket_name" ]; then
    return
  fi

  mc mb --ignore-existing "$MINIO_ALIAS/$bucket_name"
}

set_policy() {
  policy_name="$1"
  bucket_name="$2"
  if [ -z "$bucket_name" ]; then
    return
  fi

  mc anonymous set "$policy_name" "$MINIO_ALIAS/$bucket_name"
}

ensure_bucket "$DEFAULT_BUCKET"
set_policy public "$DEFAULT_BUCKET"

if [ "$APP_BUCKET" != "$DEFAULT_BUCKET" ]; then
  ensure_bucket "$APP_BUCKET"
  set_policy public "$APP_BUCKET"
fi

if [ "$AI_TRY_ON_BUCKET" != "$DEFAULT_BUCKET" ] && [ "$AI_TRY_ON_BUCKET" != "$APP_BUCKET" ]; then
  ensure_bucket "$AI_TRY_ON_BUCKET"
  set_policy download "$AI_TRY_ON_BUCKET"
fi
