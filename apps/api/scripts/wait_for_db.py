"""Block until PostgreSQL accepts connections (used by Docker entrypoint)."""

from __future__ import annotations

import os
import sys
import time

from sqlalchemy import create_engine, text

MAX_ATTEMPTS = 30
SLEEP_SECONDS = 2


def main() -> None:
    database_url = os.environ.get("AI_TODO_DATABASE_URL")
    if not database_url:
        print("AI_TODO_DATABASE_URL is not set", file=sys.stderr)
        sys.exit(1)

    engine = create_engine(database_url)
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            print("Database is ready")
            return
        except Exception as error:  # noqa: BLE001 - retry on any connection error
            if attempt >= MAX_ATTEMPTS:
                print(f"Database not ready after {MAX_ATTEMPTS} attempts: {error}", file=sys.stderr)
                message = str(error).lower()
                if "password authentication failed" in message:
                    print(
                        "\nHint: POSTGRES_PASSWORD in .env.production does not match the "
                        "password stored in the Postgres data volume.\n"
                        "  • To rotate: edit .env.production, then run "
                        "python3 scripts/rotate_postgres_password.py\n"
                        "  • Fresh dev reset only: docker compose ... down -v\n"
                        "See docs/deploy.md § 数据库密码",
                        file=sys.stderr,
                    )
                sys.exit(1)
            print(f"Waiting for database ({attempt}/{MAX_ATTEMPTS})…")
            time.sleep(SLEEP_SECONDS)


if __name__ == "__main__":
    main()
