from sqlalchemy import select
from sqlalchemy.orm import Session

from ai_todo_api.db.models import CalendarEventModel
from ai_todo_api.modules.calendar.schemas import CalendarEventSummary


class CalendarEventRepository:
    def __init__(self, session: Session, user_id: str) -> None:
        self._session = session
        self._user_id = user_id

    def add(self, event: CalendarEventModel) -> CalendarEventModel:
        self._session.add(event)
        self._session.commit()
        self._session.refresh(event)
        return event

    def get(self, event_id: str) -> CalendarEventModel | None:
        statement = select(CalendarEventModel).where(
            CalendarEventModel.id == event_id,
            CalendarEventModel.user_id == self._user_id,
            CalendarEventModel.deleted_at.is_(None),
        )
        return self._session.scalar(statement)

    def list_active(self, *, limit: int = 100) -> list[CalendarEventModel]:
        statement = (
            select(CalendarEventModel)
            .where(
                CalendarEventModel.user_id == self._user_id,
                CalendarEventModel.deleted_at.is_(None),
            )
            .order_by(CalendarEventModel.start_at)
            .limit(limit)
        )
        return list(self._session.scalars(statement))

    def save(self, event: CalendarEventModel) -> CalendarEventModel:
        self._session.add(event)
        self._session.commit()
        self._session.refresh(event)
        return event


def event_to_summary(event: CalendarEventModel) -> CalendarEventSummary:
    return CalendarEventSummary(
        id=event.id,
        title=event.title,
        start_at=event.start_at,
        end_at=event.end_at,
        timezone=event.timezone,
        location=event.location,
        description=event.description,
        contacts=[],
    )
