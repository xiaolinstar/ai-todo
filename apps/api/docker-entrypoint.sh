#!/bin/sh
set -e

python /app/scripts/wait_for_db.py
alembic upgrade head
exec "$@"
