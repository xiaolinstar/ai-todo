#!/usr/bin/env python3
"""Sync Postgres role password to match .env.production (run on the VPS host)."""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Apply POSTGRES_PASSWORD from .env.production to the running Postgres volume."
    )
    parser.add_argument(
        "--env-file",
        default=".env.production",
        help="Env file path (default: .env.production)",
    )
    parser.add_argument(
        "--compose-file",
        default="docker-compose.prod.yml",
        help="Compose file (default: docker-compose.prod.yml)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print SQL only, do not execute",
    )
    args = parser.parse_args()

    api_dir = Path(__file__).resolve().parents[1]
    env_path = (api_dir / args.env_file).resolve()
    if not env_path.is_file():
        print(f"Missing env file: {env_path}", file=sys.stderr)
        sys.exit(1)

    env = load_env_file(env_path)
    user = env.get("POSTGRES_USER", "ai_todo")
    password = env.get("POSTGRES_PASSWORD", "")
    database = env.get("POSTGRES_DB", "ai_todo")

    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", user):
        print(f"Unsafe POSTGRES_USER for SQL: {user!r}", file=sys.stderr)
        sys.exit(1)
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", database):
        print(f"Unsafe POSTGRES_DB for psql -d: {database!r}", file=sys.stderr)
        sys.exit(1)

    if not password:
        print("POSTGRES_PASSWORD is empty in env file", file=sys.stderr)
        sys.exit(1)

    sql = f"ALTER USER {user} WITH PASSWORD {sql_literal(password)};"
    print(f"Target user: {user}")
    print(f"Env file: {env_path}")

    if args.dry_run:
        print(f"SQL: {sql}")
        return

    compose = ["docker", "compose", "-f", args.compose_file, "--env-file", str(env_path)]

    def run_psql(as_user: str) -> subprocess.CompletedProcess[str]:
        cmd = [
            *compose,
            "exec",
            "-T",
            "postgres",
            "psql",
            "-U",
            as_user,
            "-d",
            database,
            "-v",
            "ON_ERROR_STOP=1",
            "-c",
            sql,
        ]
        return subprocess.run(cmd, cwd=api_dir, text=True, capture_output=True)

    result = run_psql(user)
    if result.returncode != 0 and user != "postgres":
        print(f"Retry as postgres superuser ({user} failed)", file=sys.stderr)
        result = run_psql("postgres")

    if result.returncode != 0:
        print(result.stderr or result.stdout, file=sys.stderr)
        sys.exit(result.returncode)

    if result.stdout.strip():
        print(result.stdout.strip())

    restart = subprocess.run(
        [*compose, "restart", "api"],
        cwd=api_dir,
        text=True,
        capture_output=True,
    )
    if restart.returncode != 0:
        print(restart.stderr or restart.stdout, file=sys.stderr)
        sys.exit(restart.returncode)

    print("Password synced. API container restarted.")
    print("Verify: curl http://127.0.0.1:8082/v1/health")


if __name__ == "__main__":
    main()
