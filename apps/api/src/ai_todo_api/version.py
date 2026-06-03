"""Component version for ai-todo-api (single source: apps/api/pyproject.toml)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import tomllib

_PYPROJECT = Path(__file__).resolve().parents[2] / "pyproject.toml"


@lru_cache(maxsize=1)
def get_api_version() -> str:
    with _PYPROJECT.open("rb") as handle:
        return tomllib.load(handle)["project"]["version"]
