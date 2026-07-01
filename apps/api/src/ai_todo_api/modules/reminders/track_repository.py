from datetime import datetime
from uuid import uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from ai_todo_api.common.time import now_utc
from ai_todo_api.db.models import ReminderTrackEntryModel
from ai_todo_api.modules.reminders.schemas import ReminderTrackEntry


class TrackEntryRepository:
    def __init__(self, session: Session, user_id: str) -> None:
        self._session = session
        self._user_id = user_id

    def add(self, *, reminder_id: str, text: str, timezone: str) -> ReminderTrackEntryModel:
        cleaned = text.strip()
        if not cleaned:
            raise ValueError("Track entry text is required.")
        if len(cleaned) > 30:
            raise ValueError("Track entry text must be 30 characters or fewer.")

        now = now_utc()
        entry = ReminderTrackEntryModel(
            id=f"rtk_{uuid4().hex[:12]}",
            reminder_id=reminder_id,
            user_id=self._user_id,
            date_label=_date_label(now, timezone),
            text=cleaned,
            created_at=now,
        )
        self._session.add(entry)
        self._session.flush()
        return entry

    def entries_for_reminders(self, reminder_ids: list[str]) -> dict[str, list[ReminderTrackEntry]]:
        if not reminder_ids:
            return {}

        rows = list(
            self._session.scalars(
                select(ReminderTrackEntryModel)
                .where(
                    ReminderTrackEntryModel.reminder_id.in_(reminder_ids),
                    ReminderTrackEntryModel.user_id == self._user_id,
                )
                .order_by(
                    ReminderTrackEntryModel.created_at.desc(),
                    ReminderTrackEntryModel.id.desc(),
                )
            )
        )

        result: dict[str, list[ReminderTrackEntry]] = {reminder_id: [] for reminder_id in reminder_ids}
        for row in rows:
            result[row.reminder_id].append(track_entry_to_schema(row))
        return result


def track_entry_to_schema(entry: ReminderTrackEntryModel) -> ReminderTrackEntry:
    return ReminderTrackEntry(
        id=entry.id,
        date_label=entry.date_label,
        text=entry.text,
        created_at=entry.created_at.isoformat(),
    )


def _date_label(now: datetime, timezone: str) -> str:
    local = now.astimezone(ZoneInfo(timezone))
    return local.strftime("%m-%d")
