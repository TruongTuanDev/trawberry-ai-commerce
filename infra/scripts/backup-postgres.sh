#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/docker-compose.prod.yml"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/infra/.env.production}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups/postgres}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT_FILE="$BACKUP_DIR/postgres-$TIMESTAMP.dump"

echo "Creating backup at $OUTPUT_FILE"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-privileges' \
  > "$OUTPUT_FILE"

echo "Backup completed: $OUTPUT_FILE"
