#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/docker-compose.prod.yml"
ENV_FILE="${1:-${ENV_FILE:-$ROOT_DIR/infra/.env.production}}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

PUBLIC_SITE_URL="${PUBLIC_SITE_URL:-http://127.0.0.1:${NGINX_HTTP_PORT:-80}}"
BACKEND_PUBLIC_URL="${BACKEND_PUBLIC_URL:-http://127.0.0.1:${NGINX_HTTP_PORT:-80}}"

check_url() {
  local url="$1"
  echo "Checking $url"
  curl --fail --silent --show-error --location --max-time 20 --head "$url" >/dev/null
}

check_url "$PUBLIC_SITE_URL/"
check_url "$PUBLIC_SITE_URL/products"
check_url "$PUBLIC_SITE_URL/admin/ai-settings"
check_url "$PUBLIC_SITE_URL/admin/homepage-slides"
check_url "$BACKEND_PUBLIC_URL/api/health"

echo "Checking internal ai-service health"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T ai-service \
  python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"

echo "Smoke checks passed"
