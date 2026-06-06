import base64
import json
from datetime import datetime


class InvalidCursorError(ValueError):
    pass


def encode_cursor(*, sort_at: datetime, row_id: str) -> str:
    payload = {"t": sort_at.isoformat(), "id": row_id}
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def decode_cursor(cursor: str) -> tuple[datetime, str]:
    if not cursor.strip():
        raise InvalidCursorError("Cursor must not be empty.")

    padding = "=" * (-len(cursor) % 4)
    try:
        raw = base64.urlsafe_b64decode(f"{cursor}{padding}".encode("ascii"))
        payload = json.loads(raw.decode("utf-8"))
        sort_at = datetime.fromisoformat(payload["t"])
        row_id = payload["id"]
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise InvalidCursorError("Cursor is invalid or malformed.") from error

    if not isinstance(row_id, str) or not row_id:
        raise InvalidCursorError("Cursor is invalid or malformed.")

    return sort_at, row_id
