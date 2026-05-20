from datetime import datetime
from zoneinfo import ZoneInfo


def now_utc() -> datetime:
    return datetime.now(tz=ZoneInfo("UTC"))


def today_in_timezone(timezone: str) -> str:
    return datetime.now(tz=ZoneInfo(timezone)).date().isoformat()
