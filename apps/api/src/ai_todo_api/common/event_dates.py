from datetime import date

from ai_todo_api.common.reminder_dates import parse_due_at


def instant_local_date(iso: str, timezone: str) -> date:
    return parse_due_at(iso, timezone).date()


def event_local_date_range(
    *,
    start_at: str,
    end_at: str | None,
    timezone: str,
) -> tuple[date, date]:
    start_date = instant_local_date(start_at, timezone)
    end_date = instant_local_date(end_at, timezone) if end_at else start_date
    if end_date < start_date:
        return end_date, start_date
    return start_date, end_date


def event_visible_on_date(
    *,
    start_at: str,
    end_at: str | None,
    timezone: str,
    target_date: str,
) -> bool:
    start_date, end_date = event_local_date_range(
        start_at=start_at,
        end_at=end_at,
        timezone=timezone,
    )
    return start_date.isoformat() <= target_date <= end_date.isoformat()


def event_overlaps_date_range(
    *,
    start_at: str,
    end_at: str | None,
    timezone: str,
    from_date: str | None,
    to_date: str | None,
) -> bool:
    if from_date is None and to_date is None:
        return True

    start_value, end_value = event_local_date_range(
        start_at=start_at,
        end_at=end_at,
        timezone=timezone,
    )
    range_start = start_value.isoformat()
    range_end = end_value.isoformat()

    if from_date and range_end < from_date:
        return False
    if to_date and range_start > to_date:
        return False
    return True
