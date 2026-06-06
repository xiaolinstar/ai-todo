"""Lightweight health probe for the notification worker container."""

from __future__ import annotations

import os
import subprocess
import sys

from sqlalchemy import create_engine, text


def _resolve_database_url() -> str:
    existing = os.environ.get("AI_TODO_DATABASE_URL", "").strip()
    if existing:
        return existing

    result = subprocess.run(
        [sys.executable, "/app/scripts/build_database_url.py"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        print(result.stderr.strip() or "Failed to build database URL", file=sys.stderr)
        sys.exit(1)
    return result.stdout.strip()


def main() -> None:
    database_url = _resolve_database_url()
    engine = create_engine(database_url, pool_pre_ping=True)
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))


if __name__ == "__main__":
    main()
