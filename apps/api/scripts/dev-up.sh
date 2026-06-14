#!/usr/bin/env sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${AI_TODO_ENV_FILE:-.env.local}"
if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE — copy from .env.local.example and configure WeChat secrets." >&2
  exit 1
fi

COMPOSE_ENV_FILES_VALUE="$ENV_FILE"
if [ -f .env ] && [ "$ENV_FILE" != ".env" ]; then
  COMPOSE_ENV_FILES_VALUE=".env,$ENV_FILE"
fi

COMPOSE_ENV_FILES="$COMPOSE_ENV_FILES_VALUE" exec docker compose --profile notifications up -d --build "$@"
