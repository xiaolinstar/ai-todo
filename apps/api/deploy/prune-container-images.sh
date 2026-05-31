#!/usr/bin/env bash
# Prune old ai-todo API images on the VPS; keep recent digests for rollback.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$API_DIR/../.." && pwd)"
RETENTION_FILE="${AI_TODO_IMAGE_RETENTION_FILE:-$REPO_ROOT/.deploy/image-retention.json}"
KEEP_COUNT="${AI_TODO_IMAGE_RETENTION:-3}"

if ! command -v docker >/dev/null 2>&1 || [[ ! -f "$RETENTION_FILE" ]]; then
  exit 0
fi

mapfile -t KEEP_HEX < <(
  python3 - "$RETENTION_FILE" "$KEEP_COUNT" <<'PY'
import json
import sys
from pathlib import Path

data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
keep = max(int(sys.argv[2]), 1)
for digest in (data.get("digests") or [])[:keep]:
    print(digest.removeprefix("sha256:"))
PY
)

if ((${#KEEP_HEX[@]} == 0)); then
  exit 0
fi

echo "Pruning API images (keep ${#KEEP_HEX[@]} digest(s))..." >&2

is_kept() {
  local hex="$1"
  local k
  for k in "${KEEP_HEX[@]}"; do
    [[ "$hex" == "$k" ]] && return 0
  done
  return 1
}

mapfile -t RUNNING < <(docker ps -q 2>/dev/null || true)
is_running() {
  local id="$1"
  local r
  for r in "${RUNNING[@]}"; do
    [[ "$r" == "$id" ]] && return 0
  done
  return 1
}

docker image prune -f >/dev/null 2>&1 || true

mapfile -t IMAGE_IDS < <(
  {
    docker image ls --format '{{.ID}}' --filter reference='ghcr.io/xiaolinstar/ai-todo-api' 2>/dev/null || true
    docker image ls --format '{{.ID}}' --filter reference='ghcr.nju.edu.cn/xiaolinstar/ai-todo-api' 2>/dev/null || true
    docker image ls --format '{{.ID}} {{.Repository}}' 2>/dev/null | awk '/ai-todo-api/ {print $1}' || true
  } | sort -u
)

for image_id in "${IMAGE_IDS[@]}"; do
  [[ -z "$image_id" ]] && continue
  is_running "$image_id" && continue

  repo_digests="$(docker image inspect "$image_id" --format '{{range .RepoDigests}}{{println .}}{{end}}' 2>/dev/null || true)"
  if [[ -z "$repo_digests" ]]; then
    continue
  fi

  keep_image=0
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    hex="${line#*@sha256:}"
    if is_kept "$hex"; then
      keep_image=1
      break
    fi
  done <<<"$repo_digests"

  if (( keep_image == 0 )); then
    echo "Removing unused API image ${image_id}" >&2
    docker rmi "$image_id" >/dev/null 2>&1 || true
  fi
done

echo "Image prune done." >&2
