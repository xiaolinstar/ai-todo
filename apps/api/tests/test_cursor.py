import pytest

from ai_todo_api.common.cursor import InvalidCursorError, decode_cursor, encode_cursor


def test_cursor_round_trip() -> None:
    from datetime import datetime, timezone

    sort_at = datetime(2026, 6, 6, 12, 30, tzinfo=timezone.utc)
    token = encode_cursor(sort_at=sort_at, row_id="contact_abc123")
    decoded_at, row_id = decode_cursor(token)
    assert decoded_at == sort_at
    assert row_id == "contact_abc123"


def test_decode_cursor_rejects_invalid_token() -> None:
    with pytest.raises(InvalidCursorError):
        decode_cursor("%%%")
