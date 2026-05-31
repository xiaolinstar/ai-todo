#!/bin/sh
set -e

if [ -z "${AI_TODO_DATABASE_URL:-}" ]; then
  export AI_TODO_DATABASE_URL="$(python /app/scripts/build_database_url.py)"
fi

python /app/scripts/wait_for_db.py
if [ "${AI_TODO_SKIP_MIGRATIONS:-false}" != "true" ]; then
  alembic upgrade head
fi
exec "$@"
