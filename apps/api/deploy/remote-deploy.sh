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

COMMON_ENV_FILE="${COMMON_ENV_FILE:-.env}"
COMPOSE_ENV_FILES_VALUE="$ENV_FILE"
if [[ -f "$COMMON_ENV_FILE" && "$COMMON_ENV_FILE" != "$ENV_FILE" ]]; then
  COMPOSE_ENV_FILES_VALUE="${COMMON_ENV_FILE},${ENV_FILE}"
fi

env_value() {
  local name="$1"
  local value=""
  if [[ -f "$COMMON_ENV_FILE" ]]; then
    value="$(grep -E "^${name}=" "$COMMON_ENV_FILE" | tail -n1 | cut -d= -f2- || true)"
  fi
  local override=""
  if grep -Eq "^${name}=" "$ENV_FILE"; then
    override="$(grep -E "^${name}=" "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)"
    value="$override"
  fi
  echo "$value"
}

if [[ -z "${AI_TODO_COMPOSE_PROJECT_NAME:-}" && -z "$(env_value AI_TODO_COMPOSE_PROJECT_NAME)" ]]; then
  case "$ENV_FILE" in
    *.staging)
      export AI_TODO_COMPOSE_PROJECT_NAME=ai-todo-staging
      ;;
  esac
fi

COMPOSE_FILES=(-f docker-compose.prod.yml)
if [[ -f deploy/Caddyfile ]]; then
  COMPOSE_FILES+=(-f docker-compose.tls.yml)
fi

COMPOSE_ENV_FILES="$COMPOSE_ENV_FILES_VALUE" docker compose "${COMPOSE_FILES[@]}" up -d --build

PUBLISH_PORT="$(env_value AI_TODO_PUBLISH_PORT)"
PUBLISH_PORT="${PUBLISH_PORT:-8082}"
curl -sf "http://127.0.0.1:${PUBLISH_PORT}/v1/health" >/dev/null

echo "ai-todo API deploy OK (health check passed on 127.0.0.1:${PUBLISH_PORT})"
