#!/usr/bin/env sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${AI_TODO_ENV_FILE:-.env.local}"
if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE — copy from .env.local.example and configure WeChat secrets." >&2
  exit 1
fi

exec docker compose --env-file "$ENV_FILE" --profile notifications up -d --build "$@"
