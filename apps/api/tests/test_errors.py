import re
from pathlib import Path

from ai_todo_api.errors import (
    LEGACY_ERROR_ALIASES,
    ErrorCode,
    all_legacy_codes,
    canonical_code,
    legacy_wire_code,
    matches_error_code,
    wire_code,
)

_CODE_KW_PATTERN = re.compile(r"""code\s*=\s*["']([A-Z][A-Z0-9_]*)["']""")
_CODE_JSON_PATTERN = re.compile(r"""["']code["']\s*:\s*["']([A-Z][A-Z0-9_]*)["']""")


def test_every_error_code_has_valid_prefix() -> None:
    for code in ErrorCode:
        prefix = code.value.split("_", maxsplit=1)[0]
        assert prefix in {"AUTH", "VAL", "BIZ", "SYS"}, code.value


def test_legacy_aliases_map_to_distinct_canonical_codes() -> None:
    assert len(LEGACY_ERROR_ALIASES) == len(set(LEGACY_ERROR_ALIASES.values()))


def test_legacy_wire_code_round_trip() -> None:
    for legacy, canonical in LEGACY_ERROR_ALIASES.items():
        assert legacy_wire_code(canonical) == legacy
        assert canonical_code(legacy) is canonical


def test_legacy_wire_code_returns_prefixed_value_for_new_only_codes() -> None:
    assert legacy_wire_code(ErrorCode.BIZ_CONTACT_AMBIGUOUS) == "BIZ_CONTACT_AMBIGUOUS"


def test_wire_code_returns_prefixed_canonical() -> None:
    assert wire_code(ErrorCode.AUTH_INVALID_TOKEN) == "AUTH_INVALID_TOKEN"


def test_matches_error_code_accepts_legacy_and_canonical() -> None:
    assert matches_error_code("UNAUTHORIZED", ErrorCode.AUTH_INVALID_TOKEN)
    assert matches_error_code("AUTH_INVALID_TOKEN", ErrorCode.AUTH_INVALID_TOKEN)
    assert not matches_error_code("FORBIDDEN", ErrorCode.AUTH_INVALID_TOKEN)


def test_matches_error_code_accepts_val_legacy_and_canonical() -> None:
    assert matches_error_code("VALIDATION_ERROR", ErrorCode.VAL_INVALID_INPUT)
    assert matches_error_code("VAL_INVALID_INPUT", ErrorCode.VAL_INVALID_INPUT)
    assert matches_error_code("INVALID_CURSOR", ErrorCode.VAL_INVALID_CURSOR)


def test_matches_error_code_accepts_biz_legacy_and_canonical() -> None:
    assert matches_error_code("NOT_FOUND", ErrorCode.BIZ_NOT_FOUND)
    assert matches_error_code("BIZ_CONTACT_NOT_FOUND", ErrorCode.BIZ_CONTACT_NOT_FOUND)
    assert matches_error_code("IDEMPOTENCY_CONFLICT", ErrorCode.BIZ_IDEMPOTENCY_CONFLICT)


def test_all_legacy_codes_from_p0_audit_are_registered() -> None:
    expected = {
        "UNAUTHORIZED",
        "FORBIDDEN",
        "SESSION_TOKEN_NOT_ALLOWED",
        "RATE_LIMITED",
        "VALIDATION_ERROR",
        "INVALID_CURSOR",
        "NOT_FOUND",
        "CONTACT_NOT_FOUND",
        "IDEMPOTENCY_CONFLICT",
        "REMINDER_INACTIVE",
        "REMINDER_NO_SCHEDULE",
        "CALENDAR_EVENT_INACTIVE",
        "CALENDAR_EVENT_NO_SCHEDULE",
        "WECHAT_OPENID_MISSING",
        "INVALID_TARGET",
        "DATABASE_ERROR",
        "INTERNAL_ERROR",
        "HTTP_ERROR",
        "WECHAT_NOT_CONFIGURED",
    }
    assert expected == all_legacy_codes()


def test_hardcoded_api_error_codes_in_source_are_registered() -> None:
    src_root = Path(__file__).resolve().parents[1] / "src" / "ai_todo_api"
    found: set[str] = set()

    for path in src_root.rglob("*.py"):
        if path.name == "errors.py":
            continue
        text = path.read_text(encoding="utf-8")
        for pattern in (_CODE_KW_PATTERN, _CODE_JSON_PATTERN):
            found.update(pattern.findall(text))

    registered = all_legacy_codes() | {member.value for member in ErrorCode}
    unregistered = sorted(found - registered)
    assert not unregistered, f"Unregistered error codes in source: {unregistered}"
