import json
from typing import Any


def dumps_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def loads_json(value: str) -> Any:
    return json.loads(value)
