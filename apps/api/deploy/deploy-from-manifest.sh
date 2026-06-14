#!/usr/bin/env bash
# Deploy API using CI-published deploy-manifest.json (image digest fingerprint).
# Rollback after CD post-deploy verify: deploy-from-manifest.sh --rollback-to-previous
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$API_DIR/../.." && pwd)"
DEPLOY_DIR="$REPO_ROOT/.deploy"
CURRENT_DEPLOY_FILE="$DEPLOY_DIR/current.json"
PREVIOUS_SUCCESS_FILE="$DEPLOY_DIR/previous-success.json"

ROLLBACK_ONLY=0
if [[ "${1:-}" == "--rollback-to-previous" ]]; then
  ROLLBACK_ONLY=1
  shift
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to verify deploy-manifest fingerprint" >&2
  exit 1
fi

GIT_SHA=""
API_IMAGE=""
API_DIGEST=""
FINGERPRINT=""
RUN_ID=""

if [[ "$ROLLBACK_ONLY" -eq 0 ]]; then
  MANIFEST="${1:?Usage: deploy-from-manifest.sh /path/to/deploy-manifest.json}"
  python3 "$REPO_ROOT/scripts/ci/verify_deploy_manifest.py" "$MANIFEST"

  GIT_SHA="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['gitSha'])" "$MANIFEST")"
  API_IMAGE="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['artifacts']['api']['image'])" "$MANIFEST")"
  API_DIGEST="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['artifacts']['api']['digest'])" "$MANIFEST")"
  FINGERPRINT="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['fingerprint'])" "$MANIFEST")"
  RUN_ID="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('runId') or '')" "$MANIFEST")"
  export AI_TODO_GIT_SHA="${AI_TODO_GIT_SHA:-$GIT_SHA}"
  export AI_TODO_RELEASE_TAG="${AI_TODO_RELEASE_TAG:-${RELEASE_TAG:-}}"

  echo "Deploy manifest OK"
  echo "  git_sha=${GIT_SHA}"
  echo "  release_tag=${AI_TODO_RELEASE_TAG:-}"
  echo "  image=${API_IMAGE}"
  echo "  digest=${API_DIGEST}"
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose v2 is required on the deploy host" >&2
  exit 1
fi

PREVIOUS_GIT_SHA=""
PREVIOUS_API_IMAGE=""
PREVIOUS_API_DIGEST=""
PREVIOUS_FINGERPRINT=""
PREVIOUS_RUN_ID=""
PREVIOUS_DEPLOY_MODE="pull"
if [[ "$ROLLBACK_ONLY" -eq 0 && -f "$CURRENT_DEPLOY_FILE" ]]; then
  PREVIOUS_GIT_SHA="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('gitSha') or '')" "$CURRENT_DEPLOY_FILE")"
  PREVIOUS_API_IMAGE="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('apiImage') or '')" "$CURRENT_DEPLOY_FILE")"
  PREVIOUS_API_DIGEST="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('apiDigest') or '')" "$CURRENT_DEPLOY_FILE")"
  PREVIOUS_FINGERPRINT="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('fingerprint') or '')" "$CURRENT_DEPLOY_FILE")"
  PREVIOUS_RUN_ID="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('ciRunId') or '')" "$CURRENT_DEPLOY_FILE")"
  PREVIOUS_DEPLOY_MODE="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('deployMode') or 'pull')" "$CURRENT_DEPLOY_FILE")"
fi

if [[ "$ROLLBACK_ONLY" -eq 0 ]]; then
  cd "$REPO_ROOT"
  git fetch origin
  git reset --hard "$GIT_SHA"
fi

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

ALLOW_DEV_AUTH="$(env_value AI_TODO_ALLOW_DEV_AUTH)"
ALLOW_DEV_AUTH="${ALLOW_DEV_AUTH//\"/}"
ALLOW_DEV_AUTH="${ALLOW_DEV_AUTH//\'/}"
if [[ "${ALLOW_DEV_AUTH:-false}" != "false" ]]; then
  echo "Refusing production deploy: AI_TODO_ALLOW_DEV_AUTH must be false in $ENV_FILE" >&2
  exit 1
fi

if [[ -z "$(env_value AI_TODO_WECHAT_APP_ID)" ]]; then
  echo "Missing AI_TODO_WECHAT_APP_ID in $ENV_FILE" >&2
  exit 1
fi

if [[ -z "$(env_value AI_TODO_WECHAT_APP_SECRET)" ]]; then
  echo "Missing AI_TODO_WECHAT_APP_SECRET in $ENV_FILE" >&2
  exit 1
fi

if [[ -n "${GHCR_DEPLOY_TOKEN:-}" ]]; then
  GHCR_LOGIN_USER="${GHCR_DEPLOY_USER:-github}"
  echo "$GHCR_DEPLOY_TOKEN" | docker login ghcr.io -u "$GHCR_LOGIN_USER" --password-stdin
fi

PULL_REGISTRY_MIRROR="$(env_value AI_TODO_PULL_REGISTRY_MIRROR | tr -d ' "'\''"')"
# Public GHCR 默认走 NJU 镜像；CD 可 export 覆盖。设为 "none" 可禁用镜像站。
if [[ -n "${AI_TODO_PULL_REGISTRY_MIRROR:-}" ]]; then
  if [[ "${AI_TODO_PULL_REGISTRY_MIRROR}" == "none" ]]; then
    PULL_REGISTRY_MIRROR=""
  else
    PULL_REGISTRY_MIRROR="${AI_TODO_PULL_REGISTRY_MIRROR}"
  fi
else
  PULL_REGISTRY_MIRROR="${PULL_REGISTRY_MIRROR:-ghcr.nju.edu.cn}"
fi
CANONICAL_REGISTRY_HOST="${AI_TODO_CANONICAL_REGISTRY_HOST:-ghcr.io}"

if [[ -n "${GHCR_DEPLOY_TOKEN:-}" && -n "$PULL_REGISTRY_MIRROR" ]]; then
  echo "$GHCR_DEPLOY_TOKEN" | docker login "$PULL_REGISTRY_MIRROR" -u "${GHCR_LOGIN_USER:-github}" --password-stdin \
    || echo "Warning: docker login $PULL_REGISTRY_MIRROR failed; mirror pull may still work for cached public layers." >&2
fi

if [[ -n "$PULL_REGISTRY_MIRROR" ]]; then
  echo "Pull registry mirror enabled: $PULL_REGISTRY_MIRROR (canonical remains $CANONICAL_REGISTRY_HOST; digest-pinned)"
fi

COMPOSE_FILES=()
set_compose_files() {
  COMPOSE_FILES=(-f docker-compose.prod.yml)
  if [[ -f deploy/Caddyfile ]]; then
    COMPOSE_FILES+=(-f docker-compose.tls.yml)
  fi
}

set_compose_files

compose_notification_profile_args() {
  if [[ -n "$(env_value AI_TODO_WECHAT_REMINDER_TEMPLATE_ID)" ]]; then
    echo "Notification worker profile enabled (template ID configured)." >&2
    printf '%s\n' --profile notifications
  fi
}

compose_up() {
  # shellcheck disable=SC2207
  local profile_args=($(compose_notification_profile_args))
  COMPOSE_ENV_FILES="$COMPOSE_ENV_FILES_VALUE" docker compose "${COMPOSE_FILES[@]}" "${profile_args[@]}" "$@"
}

PUBLISH_PORT="$(env_value AI_TODO_PUBLISH_PORT)"
PUBLISH_PORT="${PUBLISH_PORT:-8082}"

rewrite_pull_ref() {
  local canonical="$1"
  local mirror="$2"
  if [[ -z "$mirror" || "$canonical" != "${CANONICAL_REGISTRY_HOST}/"* ]]; then
    echo "$canonical"
    return 0
  fi
  echo "${mirror}/${canonical#${CANONICAL_REGISTRY_HOST}/}"
}

pull_with_retries() {
  local image="$1"
  local max_attempts="${AI_TODO_PULL_RETRIES:-2}"
  local per_pull_timeout="${AI_TODO_PULL_TIMEOUT_SECONDS:-180}"
  local attempt=1
  local wait_seconds=3

  while (( attempt <= max_attempts )); do
    if command -v timeout >/dev/null 2>&1; then
      if timeout "$per_pull_timeout" docker pull "$image"; then
        return 0
      fi
    elif docker pull "$image"; then
      return 0
    fi
    if (( attempt == max_attempts )); then
      break
    fi
    echo "docker pull attempt ${attempt}/${max_attempts} failed for ${image} (timeout=${per_pull_timeout}s); retrying in ${wait_seconds}s..." >&2
    sleep "$wait_seconds"
    attempt=$((attempt + 1))
  done

  echo "Failed to pull after ${max_attempts} attempts: $image" >&2
  return 1
}

# Image ref passed to docker compose after pull (may be mirror host; same digest as manifest).
RESOLVED_API_IMAGE=""

resolve_pulled_image_ref() {
  local canonical="$1"
  local pulled_ref="$2"

  if ! docker image inspect "$pulled_ref" >/dev/null 2>&1; then
    echo "Pulled ref not found locally: $pulled_ref" >&2
    return 1
  fi

  if [[ "$pulled_ref" == "$canonical" ]]; then
    RESOLVED_API_IMAGE="$canonical"
    return 0
  fi

  local image_id
  image_id="$(docker image inspect "$pulled_ref" --format '{{.Id}}')"
  # docker tag src@sha256:x dst@sha256:x → "refusing to create a tag with a digest reference"
  if docker tag "$image_id" "$canonical" 2>/dev/null; then
    RESOLVED_API_IMAGE="$canonical"
    echo "Retagged to canonical ref: $canonical" >&2
    return 0
  fi

  RESOLVED_API_IMAGE="$pulled_ref"
  echo "Using pulled ref for compose (same digest, mirror host): $pulled_ref" >&2
  return 0
}

verify_local_image_digest() {
  local canonical="$1"
  local expected_digest="$2"
  local digest_hex="${expected_digest#sha256:}"

  if ! docker image inspect "$canonical" >/dev/null 2>&1; then
    echo "Image not present locally: $canonical" >&2
    return 1
  fi

  local repo_digests
  repo_digests="$(docker image inspect "$canonical" --format '{{range .RepoDigests}}{{println .}}{{end}}')"

  if [[ -z "$repo_digests" ]]; then
    # NJU 等镜像站拉取后 retag 到 ghcr.io@sha256:… 时，RepoDigests 可能为空；digest-pinned 即视为有效
    if [[ "$canonical" == *"@sha256:${digest_hex}" ]]; then
      echo "RepoDigests empty; trusting digest-pinned ref ${canonical}" >&2
      return 0
    fi
    echo "No RepoDigests for $canonical" >&2
    return 1
  fi

  if grep -Fq "sha256:${digest_hex}" <<<"$repo_digests"; then
    return 0
  fi

  echo "Digest mismatch for $canonical (expected sha256:${digest_hex})" >&2
  echo "RepoDigests:" >&2
  echo "$repo_digests" >&2
  return 1
}

api_image_already_present() {
  local canonical="$1"
  local expected_digest="$2"
  local mirror="$PULL_REGISTRY_MIRROR"
  local mirror_ref=""

  if docker image inspect "$canonical" >/dev/null 2>&1 \
    && verify_local_image_digest "$canonical" "$expected_digest"; then
    RESOLVED_API_IMAGE="$canonical"
    return 0
  fi

  if [[ -n "$mirror" ]]; then
    mirror_ref="$(rewrite_pull_ref "$canonical" "$mirror")"
    if [[ "$mirror_ref" != "$canonical" ]] \
      && docker image inspect "$mirror_ref" >/dev/null 2>&1 \
      && verify_local_image_digest "$mirror_ref" "$expected_digest"; then
      RESOLVED_API_IMAGE="$mirror_ref"
      return 0
    fi
  fi

  return 1
}

pull_api_image() {
  local canonical="$1"
  local expected_digest="$2"
  local mirror="$PULL_REGISTRY_MIRROR"
  local mirror_ref=""

  RESOLVED_API_IMAGE="$canonical"

  if api_image_already_present "$canonical" "$expected_digest"; then
    echo "API image already present with expected digest; skipping pull (${RESOLVED_API_IMAGE})." >&2
    return 0
  fi

  if [[ -n "$mirror" ]]; then
    mirror_ref="$(rewrite_pull_ref "$canonical" "$mirror")"
    if [[ "$mirror_ref" != "$canonical" ]]; then
      echo "Trying pull via mirror $mirror ..." >&2
      if pull_with_retries "$mirror_ref"; then
        if verify_local_image_digest "$mirror_ref" "$expected_digest" \
          && resolve_pulled_image_ref "$canonical" "$mirror_ref"; then
          echo "Pull OK via mirror $mirror" >&2
          return 0
        fi
        echo "Mirror pull finished but digest verify failed for ${mirror_ref}." >&2
      fi
      if [[ "${AI_TODO_PULL_SKIP_CANONICAL_FALLBACK:-true}" == "true" ]]; then
        echo "Mirror path failed; skipping canonical $CANONICAL_REGISTRY_HOST (fast-fail to server-build)." >&2
        return 1
      fi
      echo "Mirror path failed; falling back to $CANONICAL_REGISTRY_HOST." >&2
    fi
  fi

  echo "Trying pull via canonical registry $CANONICAL_REGISTRY_HOST ..." >&2
  if ! pull_with_retries "$canonical"; then
    return 1
  fi
  if verify_local_image_digest "$canonical" "$expected_digest"; then
    RESOLVED_API_IMAGE="$canonical"
    return 0
  fi
  return 1
}

deploy_image() {
  local image="$1"
  local digest="$2"
  if ! pull_api_image "$image" "$digest"; then
    return 1
  fi
  export AI_TODO_API_IMAGE="${RESOLVED_API_IMAGE:-$image}"
  echo "compose image=${AI_TODO_API_IMAGE}" >&2
  compose_up up -d --no-build --pull never
}

deploy_server_build() {
  echo "Deploying via server-build (docker compose build on VPS)..." >&2
  unset AI_TODO_API_IMAGE
  export APT_MIRROR="${APT_MIRROR:-mirrors.tencent.com}"
  compose_up up -d --build
}

# pull | server-build (auto fallback uses pull then server-build)
DEPLOY_MODE="${AI_TODO_DEPLOY_MODE:-pull}"
DEPLOY_FALLBACK_BUILD="${AI_TODO_DEPLOY_FALLBACK_SERVER_BUILD:-true}"
DEPLOY_MODE_RECORD="$DEPLOY_MODE"

assert_health_db_json() {
  local health_db_json="$1"
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

wait_for_deployed_api() {
  local max_wait="${AI_TODO_HEALTH_WAIT_SECONDS:-120}"
  local interval="${AI_TODO_HEALTH_POLL_SECONDS:-2}"
  local elapsed=0
  local health_db_json=""

  echo "Waiting for API health (up to ${max_wait}s)..." >&2
  while (( elapsed < max_wait )); do
    if curl -sf "http://127.0.0.1:${PUBLISH_PORT}/v1/health" >/dev/null 2>&1; then
      if health_db_json="$(curl -sf "http://127.0.0.1:${PUBLISH_PORT}/v1/health/db" 2>/dev/null)" \
        && [[ -n "$health_db_json" ]]; then
        if assert_health_db_json "$health_db_json"; then
          return 0
        fi
      fi
    fi
    sleep "$interval"
    elapsed=$((elapsed + interval))
  done

  echo "API not healthy within ${max_wait}s (127.0.0.1:${PUBLISH_PORT})" >&2
  return 1
}

verify_deployed_api() {
  wait_for_deployed_api
}

deploy_new_version() {
  if [[ "$DEPLOY_MODE" == "server-build" ]]; then
    deploy_server_build
    return $?
  fi

  if deploy_image "$API_IMAGE" "$API_DIGEST"; then
    return 0
  fi

  if [[ "${DEPLOY_FALLBACK_BUILD}" == "true" ]]; then
    echo "docker pull deploy failed; falling back to server-build." >&2
    DEPLOY_MODE_RECORD="server-build-fallback"
    deploy_server_build
    return $?
  fi

  return 1
}

deploy_previous_version() {
  local mode="${1:-pull}"
  if [[ "$mode" == "server-build" || "$mode" == "server-build-fallback" ]]; then
    deploy_server_build
    return $?
  fi
  deploy_image "$PREVIOUS_API_IMAGE" "$PREVIOUS_API_DIGEST"
}

record_image_retention() {
  local digest="$1"
  local retention_file="${AI_TODO_IMAGE_RETENTION_FILE:-$DEPLOY_DIR/image-retention.json}"
  local keep_count="${AI_TODO_IMAGE_RETENTION:-3}"
  mkdir -p "$DEPLOY_DIR"
  python3 - "$retention_file" "$digest" "$keep_count" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
digest = sys.argv[2]
keep = max(int(sys.argv[3]), 1)
data = {"digests": []}
if path.exists():
    data = json.loads(path.read_text(encoding="utf-8"))
digests = [d for d in data.get("digests", []) if d != digest]
digests.insert(0, digest)
data["digests"] = digests[:keep]
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
PY
}

prune_old_api_images() {
  if [[ -x "$SCRIPT_DIR/prune-container-images.sh" ]]; then
    bash "$SCRIPT_DIR/prune-container-images.sh" || echo "Warning: image prune failed (non-fatal)." >&2
  fi
}

write_deploy_record() {
  local output="$1"
  local git_sha="$2"
  local api_image="$3"
  local api_digest="$4"
  local fingerprint="$5"
  local run_id="$6"
  local status="$7"
  local deploy_mode="${8:-pull}"
  local rolled_back_from_git_sha="${9:-}"
  local rolled_back_from_api_image="${10:-}"

  python3 - "$output" "$git_sha" "$api_image" "$api_digest" "$fingerprint" "$run_id" "$status" "$deploy_mode" "$rolled_back_from_git_sha" "$rolled_back_from_api_image" <<'PY'
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

(
    output,
    git_sha,
    api_image,
    api_digest,
    fingerprint,
    ci_run_id,
    status,
    deploy_mode,
    rolled_back_from_git_sha,
    rolled_back_from_api_image,
) = sys.argv[1:]

payload = {
    "gitSha": git_sha,
    "apiImage": api_image,
    "apiDigest": api_digest,
    "fingerprint": fingerprint,
    "ciRunId": ci_run_id or None,
    "deployMode": deploy_mode or "pull",
    "status": status,
    "deployedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
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
  local rolled_back_from_git_sha="${1:-$GIT_SHA}"
  local rolled_back_from_api_image="${2:-$API_IMAGE}"

  if [[ -z "$PREVIOUS_GIT_SHA" ]]; then
    echo "No previous deploy record found; automatic rollback is unavailable." >&2
    return 1
  fi
  if [[ "$PREVIOUS_DEPLOY_MODE" == "pull" && -z "$PREVIOUS_API_IMAGE" ]]; then
    echo "No previous API image recorded; automatic rollback is unavailable." >&2
    return 1
  fi

  echo "Rolling back to previous deploy:"
  echo "  git_sha=${PREVIOUS_GIT_SHA}"
  echo "  deploy_mode=${PREVIOUS_DEPLOY_MODE}"
  echo "  image=${PREVIOUS_API_IMAGE}"

  cd "$REPO_ROOT"
  git reset --hard "$PREVIOUS_GIT_SHA"
  cd "$API_DIR"
  set_compose_files

  if ! deploy_previous_version "$PREVIOUS_DEPLOY_MODE" || ! verify_deployed_api; then
    return 1
  fi

  mkdir -p "$DEPLOY_DIR"
  write_deploy_record \
    "$CURRENT_DEPLOY_FILE" \
    "$PREVIOUS_GIT_SHA" \
    "$PREVIOUS_API_IMAGE" \
    "$PREVIOUS_API_DIGEST" \
    "$PREVIOUS_FINGERPRINT" \
    "$PREVIOUS_RUN_ID" \
    "rolled_back" \
    "$PREVIOUS_DEPLOY_MODE" \
    "$rolled_back_from_git_sha" \
    "$rolled_back_from_api_image"
}

write_previous_success_snapshot() {
  if [[ -z "$PREVIOUS_GIT_SHA" ]]; then
    rm -f "$PREVIOUS_SUCCESS_FILE"
    echo "No prior deploy snapshot (first deploy); skipped previous-success.json" >&2
    return 0
  fi

  mkdir -p "$DEPLOY_DIR"
  python3 - "$PREVIOUS_SUCCESS_FILE" "$PREVIOUS_GIT_SHA" "$PREVIOUS_API_IMAGE" "$PREVIOUS_API_DIGEST" "$PREVIOUS_FINGERPRINT" "$PREVIOUS_RUN_ID" "$PREVIOUS_DEPLOY_MODE" <<'PY'
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

output, git_sha, api_image, api_digest, fingerprint, run_id, deploy_mode = sys.argv[1:9]
payload = {
    "gitSha": git_sha,
    "apiImage": api_image,
    "apiDigest": api_digest,
    "fingerprint": fingerprint,
    "ciRunId": run_id or None,
    "deployMode": deploy_mode or "pull",
    "recordedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
}
Path(output).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
PY
  echo "Wrote previous deploy snapshot: $PREVIOUS_SUCCESS_FILE" >&2
}

load_previous_success_snapshot() {
  if [[ ! -f "$PREVIOUS_SUCCESS_FILE" ]]; then
    echo "Missing $PREVIOUS_SUCCESS_FILE — cannot rollback to pre-deploy version." >&2
    return 1
  fi

  PREVIOUS_GIT_SHA="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('gitSha') or '')" "$PREVIOUS_SUCCESS_FILE")"
  PREVIOUS_API_IMAGE="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('apiImage') or '')" "$PREVIOUS_SUCCESS_FILE")"
  PREVIOUS_API_DIGEST="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('apiDigest') or '')" "$PREVIOUS_SUCCESS_FILE")"
  PREVIOUS_FINGERPRINT="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('fingerprint') or '')" "$PREVIOUS_SUCCESS_FILE")"
  PREVIOUS_RUN_ID="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('ciRunId') or '')" "$PREVIOUS_SUCCESS_FILE")"
  PREVIOUS_DEPLOY_MODE="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('deployMode') or 'pull')" "$PREVIOUS_SUCCESS_FILE")"
}

run_rollback_to_previous_success() {
  local failed_git_sha=""
  local failed_api_image=""

  if [[ -f "$CURRENT_DEPLOY_FILE" ]]; then
    failed_git_sha="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('gitSha') or '')" "$CURRENT_DEPLOY_FILE")"
    failed_api_image="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('apiImage') or '')" "$CURRENT_DEPLOY_FILE")"
  fi

  cd "$API_DIR"
  ENV_FILE="${ENV_FILE:-.env.production}"
  PUBLISH_PORT="$(grep -E '^AI_TODO_PUBLISH_PORT=' "$ENV_FILE" | cut -d= -f2- || true)"
  PUBLISH_PORT="${PUBLISH_PORT:-8082}"
  set_compose_files

  if ! load_previous_success_snapshot; then
    exit 1
  fi

  if ! rollback_previous_deploy "$failed_git_sha" "$failed_api_image"; then
    echo "CD rollback-to-previous failed." >&2
    exit 1
  fi

  echo "CD rollback-to-previous OK (health/db on 127.0.0.1:${PUBLISH_PORT})"
}

if [[ "$ROLLBACK_ONLY" -eq 1 ]]; then
  if [[ $# -gt 0 ]]; then
    echo "rollback mode accepts no manifest path (got: $*)" >&2
    exit 1
  fi
  run_rollback_to_previous_success
  exit 0
fi

echo "Deploy strategy: mode=${DEPLOY_MODE} fallback_server_build=${DEPLOY_FALLBACK_BUILD}" >&2

if ! deploy_new_version || ! verify_deployed_api; then
  echo "New deploy failed; attempting automatic rollback." >&2
  if rollback_previous_deploy "$GIT_SHA" "$API_IMAGE"; then
    echo "Rollback OK; current deploy remains on previous version." >&2
  else
    echo "Rollback failed or unavailable; manual intervention required." >&2
  fi
  exit 1
fi

mkdir -p "$DEPLOY_DIR"
write_previous_success_snapshot
write_deploy_record \
  "$CURRENT_DEPLOY_FILE" \
  "$GIT_SHA" \
  "$API_IMAGE" \
  "$API_DIGEST" \
  "$FINGERPRINT" \
  "$RUN_ID" \
  "deployed" \
  "$DEPLOY_MODE_RECORD"

record_image_retention "$API_DIGEST"
prune_old_api_images

echo "ai-todo API deploy OK (mode=${DEPLOY_MODE_RECORD}, health/db on 127.0.0.1:${PUBLISH_PORT})"
