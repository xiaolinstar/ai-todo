#!/usr/bin/env bash
# Deploy API using CI-published deploy-manifest.json (image digest fingerprint).
set -euo pipefail

MANIFEST="${1:?Usage: deploy-from-manifest.sh /path/to/deploy-manifest.json}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$API_DIR/../.." && pwd)"
DEPLOY_DIR="$REPO_ROOT/.deploy"
CURRENT_DEPLOY_FILE="$DEPLOY_DIR/current.json"

if ! command -v node >/dev/null 2>&1; then
  echo "node is required to verify deploy-manifest fingerprint" >&2
  exit 1
fi

node "$REPO_ROOT/scripts/ci/verify-deploy-manifest.mjs" "$MANIFEST"

GIT_SHA="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).gitSha)" "$MANIFEST")"
API_IMAGE="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).artifacts.api.image)" "$MANIFEST")"
API_DIGEST="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).artifacts.api.digest)" "$MANIFEST")"
FINGERPRINT="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).fingerprint)" "$MANIFEST")"
RUN_ID="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).runId || '')" "$MANIFEST")"

echo "Deploy manifest OK"
echo "  git_sha=${GIT_SHA}"
echo "  image=${API_IMAGE}"
echo "  digest=${API_DIGEST}"

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose v2 is required on the deploy host" >&2
  exit 1
fi

PREVIOUS_GIT_SHA=""
PREVIOUS_API_IMAGE=""
PREVIOUS_API_DIGEST=""
PREVIOUS_FINGERPRINT=""
PREVIOUS_RUN_ID=""
if [[ -f "$CURRENT_DEPLOY_FILE" ]]; then
  PREVIOUS_GIT_SHA="$(node -e "const v = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); console.log(v.gitSha || '')" "$CURRENT_DEPLOY_FILE")"
  PREVIOUS_API_IMAGE="$(node -e "const v = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); console.log(v.apiImage || '')" "$CURRENT_DEPLOY_FILE")"
  PREVIOUS_API_DIGEST="$(node -e "const v = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); console.log(v.apiDigest || '')" "$CURRENT_DEPLOY_FILE")"
  PREVIOUS_FINGERPRINT="$(node -e "const v = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); console.log(v.fingerprint || '')" "$CURRENT_DEPLOY_FILE")"
  PREVIOUS_RUN_ID="$(node -e "const v = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); console.log(v.ciRunId || '')" "$CURRENT_DEPLOY_FILE")"
fi

cd "$REPO_ROOT"
git fetch origin
git reset --hard "$GIT_SHA"

cd "$API_DIR"

ENV_FILE="${ENV_FILE:-.env.production}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy from .env.production.example and fill secrets." >&2
  exit 1
fi

ALLOW_DEV_AUTH="$(grep -E '^AI_TODO_ALLOW_DEV_AUTH=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)"
ALLOW_DEV_AUTH="${ALLOW_DEV_AUTH//\"/}"
ALLOW_DEV_AUTH="${ALLOW_DEV_AUTH//\'/}"
if [[ "${ALLOW_DEV_AUTH:-false}" != "false" ]]; then
  echo "Refusing production deploy: AI_TODO_ALLOW_DEV_AUTH must be false in $ENV_FILE" >&2
  exit 1
fi

if ! grep -Eq '^AI_TODO_WECHAT_APP_ID=.+$' "$ENV_FILE"; then
  echo "Missing AI_TODO_WECHAT_APP_ID in $ENV_FILE" >&2
  exit 1
fi

if ! grep -Eq '^AI_TODO_WECHAT_APP_SECRET=.+$' "$ENV_FILE"; then
  echo "Missing AI_TODO_WECHAT_APP_SECRET in $ENV_FILE" >&2
  exit 1
fi

if [[ -n "${GHCR_DEPLOY_TOKEN:-}" ]]; then
  echo "$GHCR_DEPLOY_TOKEN" | docker login ghcr.io -u "${GHCR_DEPLOY_USER:-github}" --password-stdin
fi

COMPOSE_FILES=()
set_compose_files() {
  COMPOSE_FILES=(-f docker-compose.prod.yml)
  if [[ -f deploy/Caddyfile ]]; then
    COMPOSE_FILES+=(-f docker-compose.tls.yml)
  fi
}

set_compose_files

PUBLISH_PORT="$(grep -E '^AI_TODO_PUBLISH_PORT=' "$ENV_FILE" | cut -d= -f2- || true)"
PUBLISH_PORT="${PUBLISH_PORT:-8082}"

deploy_image() {
  local image="$1"
  export AI_TODO_API_IMAGE="$image"
  docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_FILE" pull api
  docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_FILE" up -d --no-build
}

verify_deployed_api() {
  curl -sf "http://127.0.0.1:${PUBLISH_PORT}/v1/health" >/dev/null

  local health_db_json
  health_db_json="$(curl -sf "http://127.0.0.1:${PUBLISH_PORT}/v1/health/db")"
  node -e "
const response = JSON.parse(process.argv[1]);
const data = response.data || {};
if (!response.ok || data.status !== 'ok' || data.identitiesTable !== true || data.usersHasUsername !== true) {
  console.error('health/db failed:', JSON.stringify(response));
  process.exit(1);
}
" "$health_db_json"
}

write_deploy_record() {
  local output="$1"
  local git_sha="$2"
  local api_image="$3"
  local api_digest="$4"
  local fingerprint="$5"
  local run_id="$6"
  local status="$7"
  local rolled_back_from_git_sha="${8:-}"
  local rolled_back_from_api_image="${9:-}"

  node -e "
const fs = require('fs');
const [
  output,
  gitSha,
  apiImage,
  apiDigest,
  fingerprint,
  ciRunId,
  status,
  rolledBackFromGitSha,
  rolledBackFromApiImage
] = process.argv.slice(1);
const payload = {
  gitSha,
  apiImage,
  apiDigest,
  fingerprint,
  ciRunId: ciRunId || null,
  status,
  deployedAt: new Date().toISOString()
};
if (rolledBackFromGitSha || rolledBackFromApiImage) {
  payload.rolledBackFrom = {
    gitSha: rolledBackFromGitSha || null,
    apiImage: rolledBackFromApiImage || null
  };
}
fs.writeFileSync(output, JSON.stringify(payload, null, 2) + '\n');
" "$output" "$git_sha" "$api_image" "$api_digest" "$fingerprint" "$run_id" "$status" "$rolled_back_from_git_sha" "$rolled_back_from_api_image"
}

rollback_previous_deploy() {
  if [[ -z "$PREVIOUS_GIT_SHA" || -z "$PREVIOUS_API_IMAGE" ]]; then
    echo "No previous deploy record found; automatic rollback is unavailable." >&2
    return 1
  fi

  echo "Rolling back to previous deploy:"
  echo "  git_sha=${PREVIOUS_GIT_SHA}"
  echo "  image=${PREVIOUS_API_IMAGE}"

  cd "$REPO_ROOT"
  git reset --hard "$PREVIOUS_GIT_SHA"
  cd "$API_DIR"
  set_compose_files

  deploy_image "$PREVIOUS_API_IMAGE"
  verify_deployed_api

  mkdir -p "$DEPLOY_DIR"
  write_deploy_record \
    "$CURRENT_DEPLOY_FILE" \
    "$PREVIOUS_GIT_SHA" \
    "$PREVIOUS_API_IMAGE" \
    "$PREVIOUS_API_DIGEST" \
    "$PREVIOUS_FINGERPRINT" \
    "$PREVIOUS_RUN_ID" \
    "rolled_back" \
    "$GIT_SHA" \
    "$API_IMAGE"
}

if ! deploy_image "$API_IMAGE" || ! verify_deployed_api; then
  echo "New deploy failed health checks; attempting automatic rollback." >&2
  if rollback_previous_deploy; then
    echo "Rollback OK; current deploy remains on previous version." >&2
  else
    echo "Rollback failed or unavailable; manual intervention required." >&2
  fi
  exit 1
fi

mkdir -p "$DEPLOY_DIR"
write_deploy_record \
  "$CURRENT_DEPLOY_FILE" \
  "$GIT_SHA" \
  "$API_IMAGE" \
  "$API_DIGEST" \
  "$FINGERPRINT" \
  "$RUN_ID" \
  "deployed"

echo "ai-todo API deploy OK (manifest image, health/db on 127.0.0.1:${PUBLISH_PORT})"
