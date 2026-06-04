#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/docker-compose.prod.yml"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/infra/.env.production}"
SMOKE_SCRIPT="$ROOT_DIR/infra/scripts/smoke-production.sh"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE"
  echo "Create it from infra/.env.example before deploying."
  exit 1
fi

cd "$ROOT_DIR"

echo "Pulling base images"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull postgres redis minio minio-init || true

echo "Building application images"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build nginx backend-nest frontend-next ai-service

echo "Starting production stack"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

echo "Running smoke checks"
"$SMOKE_SCRIPT" "$ENV_FILE"

echo "Current container status"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
