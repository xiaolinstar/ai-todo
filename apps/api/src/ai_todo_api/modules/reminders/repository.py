from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from ai_todo_api.db.models import ReminderModel
from ai_todo_api.modules.reminders.schemas import ReminderSummary


class ReminderRepository:
    def __init__(self, session: Session, user_id: str) -> None:
        self._session = session
        self._user_id = user_id

    def add(self, reminder: ReminderModel) -> ReminderModel:
        self._session.add(reminder)
        self._session.commit()
        self._session.refresh(reminder)
        return reminder

    def get(self, reminder_id: str, *, include_deleted: bool = False) -> ReminderModel | None:
        statement = select(ReminderModel).where(
            ReminderModel.id == reminder_id,
            ReminderModel.user_id == self._user_id,
        )
        if not include_deleted:
            statement = statement.where(ReminderModel.deleted_at.is_(None))
        return self._session.scalar(statement)

    def list_active(self, *, limit: int = 100) -> list[ReminderModel]:
        statement = (
            select(ReminderModel)
            .where(
                ReminderModel.user_id == self._user_id,
                ReminderModel.deleted_at.is_(None),
            )
            .order_by(ReminderModel.created_at.desc())
            .limit(limit)
        )
        return list(self._session.scalars(statement))

    def save(self, reminder: ReminderModel) -> ReminderModel:
        self._session.add(reminder)
        self._session.commit()
        self._session.refresh(reminder)
        return reminder


def reminder_to_summary(reminder: ReminderModel) -> ReminderSummary:
    return ReminderSummary(
        id=reminder.id,
        title=reminder.title,
        status=reminder.status,  # type: ignore[arg-type]
        notes=reminder.notes,
        due_at=reminder.due_at,
        remind_at=reminder.remind_at,
        completed_at=_format_datetime(reminder.completed_at),
        contacts=[],
    )


def _format_datetime(value: datetime | None) -> str | None:
    return value.isoformat() if value else None
