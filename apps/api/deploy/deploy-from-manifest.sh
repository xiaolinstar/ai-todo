#!/usr/bin/env bash
# Deploy API using CI-published deploy-manifest.json (image digest fingerprint).
set -euo pipefail

MANIFEST="${1:?Usage: deploy-from-manifest.sh /path/to/deploy-manifest.json}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$API_DIR/../.." && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "node is required to verify deploy-manifest fingerprint" >&2
  exit 1
fi

node "$REPO_ROOT/scripts/ci/verify-deploy-manifest.mjs" "$MANIFEST"

GIT_SHA="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).gitSha)" "$MANIFEST")"
API_IMAGE="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).artifacts.api.image)" "$MANIFEST")"
API_DIGEST="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).artifacts.api.digest)" "$MANIFEST")"

echo "Deploy manifest OK"
echo "  git_sha=${GIT_SHA}"
echo "  image=${API_IMAGE}"
echo "  digest=${API_DIGEST}"

cd "$REPO_ROOT"
git fetch origin
git reset --hard "$GIT_SHA"

cd "$API_DIR"

ENV_FILE="${ENV_FILE:-.env.production}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy from .env.production.example and fill secrets." >&2
  exit 1
fi

if [[ -n "${GHCR_DEPLOY_TOKEN:-}" ]]; then
  echo "$GHCR_DEPLOY_TOKEN" | docker login ghcr.io -u "${GHCR_DEPLOY_USER:-github}" --password-stdin
fi

export AI_TODO_API_IMAGE="$API_IMAGE"

COMPOSE_FILES=(-f docker-compose.prod.yml)
if [[ -f deploy/Caddyfile ]]; then
  COMPOSE_FILES+=(-f docker-compose.tls.yml)
fi

docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_FILE" pull api
docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_FILE" up -d --no-build

PUBLISH_PORT="$(grep -E '^AI_TODO_PUBLISH_PORT=' "$ENV_FILE" | cut -d= -f2- || true)"
PUBLISH_PORT="${PUBLISH_PORT:-8082}"
curl -sf "http://127.0.0.1:${PUBLISH_PORT}/v1/health" >/dev/null

echo "ai-todo API deploy OK (manifest image, health on 127.0.0.1:${PUBLISH_PORT})"
