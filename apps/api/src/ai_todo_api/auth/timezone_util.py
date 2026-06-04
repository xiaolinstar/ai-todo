from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def validate_timezone(value: str) -> str:
    timezone = value.strip()
    if not timezone:
        raise ValueError("Timezone is required.")
    try:
        ZoneInfo(timezone)
    except ZoneInfoNotFoundError as exc:
        raise ValueError("Invalid IANA timezone.") from exc
    return timezone
