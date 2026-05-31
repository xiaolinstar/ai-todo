#!/usr/bin/env bash
# Run on the VPS after git pull (also invoked by GitHub Actions CD workflow).
#
# CD (recommended): set AI_TODO_DEPLOY_MANIFEST to CI deploy-manifest.json path.
#   Default: docker pull GHCR image (AI_TODO_DEPLOY_MODE=pull).
#   On pull failure: server-build fallback when AI_TODO_DEPLOY_FALLBACK_SERVER_BUILD=true.
#   Force VPS build only: AI_TODO_DEPLOY_MODE=server-build.
# Local / emergency: omit manifest → build on host.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -n "${AI_TODO_DEPLOY_MANIFEST:-}" && -f "${AI_TODO_DEPLOY_MANIFEST}" ]]; then
  exec "$SCRIPT_DIR/deploy-from-manifest.sh" "${AI_TODO_DEPLOY_MANIFEST}"
fi

API_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$API_DIR"

ENV_FILE="${ENV_FILE:-.env.production}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy from .env.production.example and fill secrets." >&2
  exit 1
fi

COMPOSE_FILES=(-f docker-compose.prod.yml)
if [[ -f deploy/Caddyfile ]]; then
  COMPOSE_FILES+=(-f docker-compose.tls.yml)
fi

docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_FILE" up -d --build

PUBLISH_PORT="$(grep -E '^AI_TODO_PUBLISH_PORT=' "$ENV_FILE" | cut -d= -f2- || true)"
PUBLISH_PORT="${PUBLISH_PORT:-8082}"
curl -sf "http://127.0.0.1:${PUBLISH_PORT}/v1/health" >/dev/null

echo "ai-todo API deploy OK (health check passed on 127.0.0.1:${PUBLISH_PORT})"
