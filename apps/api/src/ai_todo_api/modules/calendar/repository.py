from datetime import datetime

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from ai_todo_api.common.cursor import decode_cursor, encode_cursor
from ai_todo_api.common.list_page import ListPage
from ai_todo_api.db.models import CalendarEventModel
from ai_todo_api.modules.calendar.schemas import CalendarEventSummary
from ai_todo_api.modules.contacts.schemas import ContactSummary


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
        return self.list_page(limit=limit).items

    def list_page(
        self,
        *,
        limit: int = 50,
        cursor: str | None = None,
    ) -> ListPage[CalendarEventModel]:
        statement = select(CalendarEventModel).where(
            CalendarEventModel.user_id == self._user_id,
            CalendarEventModel.deleted_at.is_(None),
        )
        total_count = int(
            self._session.scalar(select(func.count()).select_from(statement.subquery())) or 0
        )

        ordered = statement.order_by(CalendarEventModel.start_at.asc(), CalendarEventModel.id.asc())
        if cursor:
            sort_at, row_id = decode_cursor(cursor)
            sort_key = sort_at.isoformat()
            ordered = ordered.where(
                or_(
                    CalendarEventModel.start_at > sort_key,
                    and_(CalendarEventModel.start_at == sort_key, CalendarEventModel.id > row_id),
                )
            )

        rows = list(self._session.scalars(ordered.limit(limit + 1)))
        has_more = len(rows) > limit
        items = rows[:limit]
        next_cursor = None
        if has_more and items:
            last = items[-1]
            sort_at = datetime.fromisoformat(last.start_at)
            next_cursor = encode_cursor(sort_at=sort_at, row_id=last.id)

        return ListPage(
            items=items,
            total_count=total_count,
            next_cursor=next_cursor,
            has_more=has_more,
        )

    def list_all_active(self) -> list[CalendarEventModel]:
        statement = (
            select(CalendarEventModel)
            .where(
                CalendarEventModel.user_id == self._user_id,
                CalendarEventModel.deleted_at.is_(None),
            )
            .order_by(CalendarEventModel.start_at.asc(), CalendarEventModel.id.asc())
        )
        return list(self._session.scalars(statement))

    def save(self, event: CalendarEventModel) -> CalendarEventModel:
        self._session.add(event)
        self._session.commit()
        self._session.refresh(event)
        return event


def event_to_summary(
    event: CalendarEventModel,
    *,
    contacts: list[ContactSummary] | None = None,
) -> CalendarEventSummary:
    return CalendarEventSummary(
        id=event.id,
        title=event.title,
        start_at=event.start_at,
        end_at=event.end_at,
        timezone=event.timezone,
        location=event.location,
        description=event.description,
        contacts=contacts or [],
    )
