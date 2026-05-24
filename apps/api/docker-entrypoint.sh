#!/bin/sh
set -e

if [ -z "${AI_TODO_DATABASE_URL:-}" ]; then
  export AI_TODO_DATABASE_URL="$(python /app/scripts/build_database_url.py)"
fi

python /app/scripts/wait_for_db.py
alembic upgrade head
exec "$@"
