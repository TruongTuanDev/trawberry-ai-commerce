#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/docker-compose.prod.yml"
ENV_FILE="${1:-${ENV_FILE:-$ROOT_DIR/infra/.env.production}}"
SITE_URL="${SITE_URL:-}"
API_URL="${API_URL:-}"
AI_SERVICE_CONTAINER_NAME="${AI_SERVICE_CONTAINER_NAME:-strawberry-ai-service}"
CHECK_ADMIN_ROUTES="${CHECK_ADMIN_ROUTES:-true}"
CHECK_AI_SERVICE_HEALTH="${CHECK_AI_SERVICE_HEALTH:-true}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

PUBLIC_SITE_URL="${SITE_URL:-${PUBLIC_SITE_URL:-http://127.0.0.1:${NGINX_HTTP_PORT:-80}}}"
BACKEND_PUBLIC_URL="${API_URL:-${BACKEND_PUBLIC_URL:-http://127.0.0.1:${NGINX_HTTP_PORT:-80}}}"

check_get() {
  local url="$1"
  echo "GET $url"
  curl --fail --silent --show-error --location --max-time 20 "$url" >/dev/null
}

check_head() {
  local url="$1"
  echo "HEAD $url"
  curl --fail --silent --show-error --location --max-time 20 --head "$url" >/dev/null
}

check_get "$PUBLIC_SITE_URL/"
check_get "$PUBLIC_SITE_URL/products"
check_get "$BACKEND_PUBLIC_URL/api/health"

if [[ "$CHECK_ADMIN_ROUTES" == "true" ]]; then
  check_head "$PUBLIC_SITE_URL/admin/ai-settings"
  check_head "$PUBLIC_SITE_URL/admin/homepage-slides"
fi

if [[ "$CHECK_AI_SERVICE_HEALTH" == "true" ]]; then
  echo "Checking internal ai-service health"
  docker exec "$AI_SERVICE_CONTAINER_NAME" \
    python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"
fi

echo "Smoke checks passed"
