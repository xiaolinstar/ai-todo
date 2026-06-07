from datetime import datetime
from zoneinfo import ZoneInfo

from ai_todo_api.common.quiet_hours import is_in_quiet_hours


def test_quiet_hours_same_day_window() -> None:
    at = datetime(2026, 6, 7, 23, 0, tzinfo=ZoneInfo("Asia/Shanghai"))
    assert is_in_quiet_hours(
        quiet_start="22:00",
        quiet_end="08:00",
        timezone="Asia/Shanghai",
        at=at,
    )


def test_quiet_hours_outside_cross_midnight_window() -> None:
    at = datetime(2026, 6, 7, 12, 0, tzinfo=ZoneInfo("Asia/Shanghai"))
    assert not is_in_quiet_hours(
        quiet_start="22:00",
        quiet_end="08:00",
        timezone="Asia/Shanghai",
        at=at,
    )


def test_quiet_hours_disabled_when_unset() -> None:
    at = datetime(2026, 6, 7, 23, 0, tzinfo=ZoneInfo("Asia/Shanghai"))
    assert not is_in_quiet_hours(
        quiet_start=None,
        quiet_end="08:00",
        timezone="Asia/Shanghai",
        at=at,
    )
