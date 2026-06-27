"""Central API error code registry (ADR-0005 / dev-standards api-error-codes).

Batch 2+: AUTH wire responses use prefixed :class:`ErrorCode` values.
Batch 3+: VAL wire responses use prefixed :class:`ErrorCode` values.
Batch 4+: BIZ wire responses use prefixed :class:`ErrorCode` values.
SYS family still emits legacy codes until batch 5.
"""

from enum import StrEnum


class ErrorCode(StrEnum):
    """Canonical prefixed error codes."""

    # AUTH — 401 / 403 / 429
    AUTH_INVALID_TOKEN = "AUTH_INVALID_TOKEN"
    AUTH_FORBIDDEN = "AUTH_FORBIDDEN"
    AUTH_SCOPE_DENIED = "AUTH_SCOPE_DENIED"
    AUTH_RATE_LIMITED = "AUTH_RATE_LIMITED"

    # VAL — 400 / 422
    VAL_INVALID_INPUT = "VAL_INVALID_INPUT"
    VAL_INVALID_CURSOR = "VAL_INVALID_CURSOR"
    VAL_CONTACT_METHOD_REQUIRED = "VAL_CONTACT_METHOD_REQUIRED"

    # BIZ — 400 / 404 / 409 / 422
    BIZ_NOT_FOUND = "BIZ_NOT_FOUND"
    BIZ_CONTACT_NOT_FOUND = "BIZ_CONTACT_NOT_FOUND"
    BIZ_CONTACT_AMBIGUOUS = "BIZ_CONTACT_AMBIGUOUS"
    BIZ_CONFIRMATION_REQUIRED = "BIZ_CONFIRMATION_REQUIRED"
    BIZ_IDEMPOTENCY_CONFLICT = "BIZ_IDEMPOTENCY_CONFLICT"
    BIZ_REMINDER_INACTIVE = "BIZ_REMINDER_INACTIVE"
    BIZ_REMINDER_NO_SCHEDULE = "BIZ_REMINDER_NO_SCHEDULE"
    BIZ_CALENDAR_EVENT_INACTIVE = "BIZ_CALENDAR_EVENT_INACTIVE"
    BIZ_CALENDAR_EVENT_NO_SCHEDULE = "BIZ_CALENDAR_EVENT_NO_SCHEDULE"
    BIZ_WECHAT_OPENID_MISSING = "BIZ_WECHAT_OPENID_MISSING"
    BIZ_INVALID_TARGET = "BIZ_INVALID_TARGET"

    # SYS — 500 / 502 / 503 / 504
    SYS_DB_UNAVAILABLE = "SYS_DB_UNAVAILABLE"
    SYS_INTERNAL_ERROR = "SYS_INTERNAL_ERROR"
    SYS_WECHAT_NOT_CONFIGURED = "SYS_WECHAT_NOT_CONFIGURED"
    SYS_HTTP_ERROR = "SYS_HTTP_ERROR"


# Legacy wire codes still returned to clients (Batch 2–5 will switch wire to ErrorCode.value).
LEGACY_ERROR_ALIASES: dict[str, ErrorCode] = {
    "UNAUTHORIZED": ErrorCode.AUTH_INVALID_TOKEN,
    "FORBIDDEN": ErrorCode.AUTH_FORBIDDEN,
    "SESSION_TOKEN_NOT_ALLOWED": ErrorCode.AUTH_SCOPE_DENIED,
    "RATE_LIMITED": ErrorCode.AUTH_RATE_LIMITED,
    "VALIDATION_ERROR": ErrorCode.VAL_INVALID_INPUT,
    "INVALID_CURSOR": ErrorCode.VAL_INVALID_CURSOR,
    "NOT_FOUND": ErrorCode.BIZ_NOT_FOUND,
    "CONTACT_NOT_FOUND": ErrorCode.BIZ_CONTACT_NOT_FOUND,
    "IDEMPOTENCY_CONFLICT": ErrorCode.BIZ_IDEMPOTENCY_CONFLICT,
    "REMINDER_INACTIVE": ErrorCode.BIZ_REMINDER_INACTIVE,
    "REMINDER_NO_SCHEDULE": ErrorCode.BIZ_REMINDER_NO_SCHEDULE,
    "CALENDAR_EVENT_INACTIVE": ErrorCode.BIZ_CALENDAR_EVENT_INACTIVE,
    "CALENDAR_EVENT_NO_SCHEDULE": ErrorCode.BIZ_CALENDAR_EVENT_NO_SCHEDULE,
    "WECHAT_OPENID_MISSING": ErrorCode.BIZ_WECHAT_OPENID_MISSING,
    "INVALID_TARGET": ErrorCode.BIZ_INVALID_TARGET,
    "DATABASE_ERROR": ErrorCode.SYS_DB_UNAVAILABLE,
    "INTERNAL_ERROR": ErrorCode.SYS_INTERNAL_ERROR,
    "HTTP_ERROR": ErrorCode.SYS_HTTP_ERROR,
    "WECHAT_NOT_CONFIGURED": ErrorCode.SYS_WECHAT_NOT_CONFIGURED,
}


_CANONICAL_TO_LEGACY: dict[ErrorCode, str] = {
    canonical: legacy for legacy, canonical in LEGACY_ERROR_ALIASES.items()
}


def canonical_code(legacy: str) -> ErrorCode:
    """Map a legacy wire code to its canonical :class:`ErrorCode`."""
    try:
        return LEGACY_ERROR_ALIASES[legacy]
    except KeyError as exc:
        raise KeyError(f"Unknown legacy error code: {legacy!r}") from exc


def legacy_wire_code(code: ErrorCode) -> str:
    """Return the legacy wire string for *code* (migration reference / client matching)."""
    return _CANONICAL_TO_LEGACY.get(code, code.value)


def wire_code(code: ErrorCode) -> str:
    """Return canonical prefixed code for HTTP wire responses."""
    return code.value


def matches_error_code(wire: str, code: ErrorCode) -> bool:
    """True if *wire* equals *code* or a known legacy alias for it."""
    if wire == code.value:
        return True
    return LEGACY_ERROR_ALIASES.get(wire) is code


def error_detail(code: ErrorCode, message: str) -> dict[str, object]:
    """Build envelope ``detail`` dict for :class:`HTTPException`."""
    return {
        "ok": False,
        "error": {"code": wire_code(code), "message": message},
    }


def all_legacy_codes() -> frozenset[str]:
    return frozenset(LEGACY_ERROR_ALIASES.keys())
