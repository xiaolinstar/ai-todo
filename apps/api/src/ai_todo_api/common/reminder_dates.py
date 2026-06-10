from datetime import date, datetime
from zoneinfo import ZoneInfo


def parse_due_at(due_at: str, timezone: str) -> datetime:
    parsed = datetime.fromisoformat(due_at)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=ZoneInfo(timezone))
    return parsed.astimezone(ZoneInfo(timezone))


def due_at_local_date(due_at: str | None, timezone: str) -> date | None:
    if not due_at:
        return None
    return parse_due_at(due_at, timezone).date()


def is_reminder_visible_today(
    *,
    due_at: str | None,
    status: str,
    timezone: str,
    today: str,
) -> bool:
    if status not in {"pending", "in_progress"}:
        return False

    if not due_at:
        return True

    due_date = due_at_local_date(due_at, timezone)
    if due_date is None:
        return False

    return due_date.isoformat() <= today


def is_reminder_in_due_range(
    *,
    due_at: str | None,
    timezone: str,
    from_date: str | None,
    to_date: str | None,
) -> bool:
    if not due_at:
        return from_date is None and to_date is None

    due_date = due_at_local_date(due_at, timezone)
    if due_date is None:
        return False

    due_value = due_date.isoformat()
    if from_date and due_value < from_date:
        return False
    if to_date and due_value > to_date:
        return False
    return True
