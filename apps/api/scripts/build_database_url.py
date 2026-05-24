"""Build AI_TODO_DATABASE_URL with URL-encoded credentials (Docker entrypoint)."""

from __future__ import annotations

import os
import sys
from urllib.parse import quote_plus


def main() -> None:
    existing = os.environ.get("AI_TODO_DATABASE_URL", "").strip()
    if existing:
        print(existing)
        return

    user = os.environ.get("POSTGRES_USER", "ai_todo")
    password = os.environ.get("POSTGRES_PASSWORD", "")
    host = os.environ.get("POSTGRES_HOST", "postgres")
    port = os.environ.get("POSTGRES_PORT", "5432")
    database = os.environ.get("POSTGRES_DB", "ai_todo")

    if not password:
        print("POSTGRES_PASSWORD is not set", file=sys.stderr)
        sys.exit(1)

    url = (
        f"postgresql+psycopg://{quote_plus(user)}:{quote_plus(password)}"
        f"@{host}:{port}/{quote_plus(database)}"
    )
    print(url)


if __name__ == "__main__":
    main()
