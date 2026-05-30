#!/usr/bin/env bash
# Deploy API using CI-published deploy-manifest.json (image digest fingerprint).
set -euo pipefail

MANIFEST="${1:?Usage: deploy-from-manifest.sh /path/to/deploy-manifest.json}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$API_DIR/../.." && pwd)"
DEPLOY_DIR="$REPO_ROOT/.deploy"
CURRENT_DEPLOY_FILE="$DEPLOY_DIR/current.json"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to verify deploy-manifest fingerprint" >&2
  exit 1
fi

python3 "$REPO_ROOT/scripts/ci/verify_deploy_manifest.py" "$MANIFEST"

GIT_SHA="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['gitSha'])" "$MANIFEST")"
API_IMAGE="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['artifacts']['api']['image'])" "$MANIFEST")"
API_DIGEST="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['artifacts']['api']['digest'])" "$MANIFEST")"
FINGERPRINT="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['fingerprint'])" "$MANIFEST")"
RUN_ID="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('runId') or '')" "$MANIFEST")"

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
  PREVIOUS_GIT_SHA="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('gitSha') or '')" "$CURRENT_DEPLOY_FILE")"
  PREVIOUS_API_IMAGE="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('apiImage') or '')" "$CURRENT_DEPLOY_FILE")"
  PREVIOUS_API_DIGEST="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('apiDigest') or '')" "$CURRENT_DEPLOY_FILE")"
  PREVIOUS_FINGERPRINT="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('fingerprint') or '')" "$CURRENT_DEPLOY_FILE")"
  PREVIOUS_RUN_ID="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('ciRunId') or '')" "$CURRENT_DEPLOY_FILE")"
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

pull_image_with_retry() {
  local image="$1"
  local max_attempts="${AI_TODO_PULL_RETRIES:-5}"
  local attempt=1
  local wait_seconds=5

  while (( attempt <= max_attempts )); do
    if docker pull "$image"; then
      return 0
    fi
    if (( attempt == max_attempts )); then
      break
    fi
    echo "docker pull attempt ${attempt}/${max_attempts} failed; retrying in ${wait_seconds}s..." >&2
    sleep "$wait_seconds"
    attempt=$((attempt + 1))
    wait_seconds=$((wait_seconds * 2))
  done

  echo "Failed to pull API image after ${max_attempts} attempts: $image" >&2
  return 1
}

deploy_image() {
  local image="$1"
  export AI_TODO_API_IMAGE="$image"
  if ! pull_image_with_retry "$image"; then
    return 1
  fi
  if ! docker image inspect "$image" >/dev/null 2>&1; then
    echo "Image not present locally after pull: $image" >&2
    return 1
  fi
  docker compose "${COMPOSE_FILES[@]}" --env-file "$ENV_FILE" up -d --no-build --pull never
}

verify_deployed_api() {
  curl -sf "http://127.0.0.1:${PUBLISH_PORT}/v1/health" >/dev/null

  local health_db_json
  health_db_json="$(curl -sf "http://127.0.0.1:${PUBLISH_PORT}/v1/health/db")"
  python3 - "$health_db_json" <<'PY'
import json
import sys

response = json.loads(sys.argv[1])
data = response.get("data") or {}
if not (
    response.get("ok")
    and data.get("status") == "ok"
    and data.get("identitiesTable") is True
    and data.get("usersHasUsername") is True
):
    print(f"health/db failed: {json.dumps(response, ensure_ascii=False)}", file=sys.stderr)
    raise SystemExit(1)
PY
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

  python3 - "$output" "$git_sha" "$api_image" "$api_digest" "$fingerprint" "$run_id" "$status" "$rolled_back_from_git_sha" "$rolled_back_from_api_image" <<'PY'
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

(
    output,
    git_sha,
    api_image,
    api_digest,
    fingerprint,
    ci_run_id,
    status,
    rolled_back_from_git_sha,
    rolled_back_from_api_image,
) = sys.argv[1:]

payload = {
    "gitSha": git_sha,
    "apiImage": api_image,
    "apiDigest": api_digest,
    "fingerprint": fingerprint,
    "ciRunId": ci_run_id or None,
    "status": status,
    "deployedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
}
if rolled_back_from_git_sha or rolled_back_from_api_image:
    payload["rolledBackFrom"] = {
        "gitSha": rolled_back_from_git_sha or None,
        "apiImage": rolled_back_from_api_image or None,
    }

Path(output).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
PY
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
