"""Guardrails for Alembic migrations that must remain rollback-compatible.

The existing MVP migration history predates this checker and is treated as the
baseline. New migrations after BASELINE_REVISION are expected to follow
expand/deploy/backfill/contract discipline unless explicitly reviewed.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


BASELINE_REVISION = "20260527_0012"
ALLOW_MARKER = "ai-todo-migration: allow-destructive"
VERSIONS_DIR = Path(__file__).resolve().parents[1] / "alembic" / "versions"

DANGEROUS_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("drop_table", re.compile(r"\b(?:op|batch_op)\.drop_table\s*\(")),
    ("drop_column", re.compile(r"\b(?:op|batch_op)\.drop_column\s*\(")),
    ("drop_constraint", re.compile(r"\b(?:op|batch_op)\.drop_constraint\s*\(")),
    ("rename_table", re.compile(r"\b(?:op|batch_op)\.rename_table\s*\(")),
    ("rename_column", re.compile(r"\b(?:op|batch_op)\.alter_column\s*\([^)]*new_column_name\s*=")),
    ("nullable_false", re.compile(r"\b(?:op|batch_op)\.alter_column\s*\([^)]*nullable\s*=\s*False")),
    ("type_change", re.compile(r"\b(?:op|batch_op)\.alter_column\s*\([^)]*type_\s*=")),
    ("raw_drop_sql", re.compile(r"['\"]\s*DROP\s+", re.IGNORECASE)),
    ("raw_alter_sql", re.compile(r"['\"]\s*ALTER\s+", re.IGNORECASE)),
    ("raw_truncate_sql", re.compile(r"['\"]\s*TRUNCATE\s+", re.IGNORECASE)),
)


def revision_prefix(path: Path) -> str:
    return path.name.split("_", 2)[0] + "_" + path.name.split("_", 2)[1]


def should_check(path: Path) -> bool:
    if path.name.startswith("__"):
        return False
    if path.suffix != ".py":
        return False
    return revision_prefix(path) > BASELINE_REVISION


def find_violations(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    if ALLOW_MARKER in text:
        return []

    violations: list[str] = []
    for line_no, line in enumerate(text.splitlines(), start=1):
        for name, pattern in DANGEROUS_PATTERNS:
            if pattern.search(line):
                violations.append(f"{path}:{line_no}: {name}: {line.strip()}")
    return violations


def main() -> int:
    if not VERSIONS_DIR.is_dir():
        print(f"Missing Alembic versions directory: {VERSIONS_DIR}", file=sys.stderr)
        return 1

    violations: list[str] = []
    checked = 0
    for path in sorted(VERSIONS_DIR.glob("*.py")):
        if not should_check(path):
            continue
        checked += 1
        violations.extend(find_violations(path))

    if violations:
        print("Unsafe Alembic migration operations detected:", file=sys.stderr)
        print("", file=sys.stderr)
        for violation in violations:
            print(f"  {violation}", file=sys.stderr)
        print("", file=sys.stderr)
        print(
            "Use expand/deploy/backfill/contract migrations. If this migration is intentionally "
            f"destructive and has a rollback plan, add '{ALLOW_MARKER}' with a comment explaining why.",
            file=sys.stderr,
        )
        return 1

    print(f"Alembic migration guardrails passed ({checked} post-baseline migration(s) checked).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
