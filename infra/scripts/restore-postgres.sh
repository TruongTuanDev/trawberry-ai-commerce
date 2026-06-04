#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/docker-compose.prod.yml"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/infra/.env.production}"
DUMP_PATH="${1:-}"

if [[ -z "$DUMP_PATH" ]]; then
  echo "Usage: $0 /absolute/or/relative/path/to/backup.dump"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE"
  exit 1
fi

if [[ ! -f "$DUMP_PATH" ]]; then
  echo "Dump file not found: $DUMP_PATH"
  exit 1
fi

echo "This will restore $DUMP_PATH into the live production database."
echo "Run during a maintenance window."
read -r -p "Type RESTORE to continue: " CONFIRMATION

if [[ "$CONFIRMATION" != "RESTORE" ]]; then
  echo "Restore cancelled."
  exit 1
fi

cat "$DUMP_PATH" | docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges'

echo "Restore completed from $DUMP_PATH"
