"""Component version for ai-todo-api (single source: apps/api/pyproject.toml)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import tomllib

_PYPROJECT = Path(__file__).resolve().parents[2] / "pyproject.toml"


@lru_cache(maxsize=1)
def get_api_version() -> str:
    for candidate in (_PYPROJECT, Path("/app/pyproject.toml")):
        if candidate.is_file():
            with candidate.open("rb") as handle:
                return tomllib.load(handle)["project"]["version"]

    try:
        from importlib.metadata import version

        return version("ai-todo-api")
    except Exception:
        return "0.0.0"
