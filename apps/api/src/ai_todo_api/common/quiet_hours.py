from datetime import datetime, time
from zoneinfo import ZoneInfo


def parse_hh_mm(value: str | None) -> time | None:
    if not value:
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    hour_str, minute_str = cleaned.split(":", 1)
    return time(hour=int(hour_str), minute=int(minute_str))


def is_in_quiet_hours(
    *,
    quiet_start: str | None,
    quiet_end: str | None,
    timezone: str,
    at: datetime | None = None,
) -> bool:
    start = parse_hh_mm(quiet_start)
    end = parse_hh_mm(quiet_end)
    if start is None or end is None:
        return False

    moment = at or datetime.now(tz=ZoneInfo(timezone))
    local = moment.astimezone(ZoneInfo(timezone))
    current = local.time().replace(second=0, microsecond=0)

    if start == end:
        return True
    if start < end:
        return start <= current < end
    return current >= start or current < end
