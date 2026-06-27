from datetime import datetime

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from ai_todo_api.common.cursor import decode_cursor, encode_cursor
from ai_todo_api.common.list_page import ListPage
from ai_todo_api.db.models import ReminderModel
from ai_todo_api.modules.reminders.schemas import ReminderSummary, WechatNotifyStatus


class ReminderRepository:
    def __init__(self, session: Session, user_id: str) -> None:
        self._session = session
        self._user_id = user_id

    @property
    def session(self) -> Session:
        return self._session

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

    def find_by_source(
        self,
        *,
        source: str,
        external_id: str,
        include_deleted: bool = False,
    ) -> ReminderModel | None:
        statement = select(ReminderModel).where(
            ReminderModel.user_id == self._user_id,
            ReminderModel.source == source,
            ReminderModel.external_id == external_id,
        )
        if not include_deleted:
            statement = statement.where(ReminderModel.deleted_at.is_(None))
        return self._session.scalar(statement)

    def list_active(self, *, limit: int = 100) -> list[ReminderModel]:
        return self.list_page(limit=limit).items

    def list_page(
        self,
        *,
        status: str | None = None,
        source: str | None = None,
        limit: int = 50,
        cursor: str | None = None,
    ) -> ListPage[ReminderModel]:
        statement = select(ReminderModel).where(
            ReminderModel.user_id == self._user_id,
            ReminderModel.deleted_at.is_(None),
        )
        if status:
            statement = statement.where(ReminderModel.status == status)
        if source:
            statement = statement.where(ReminderModel.source == source)

        total_count = int(
            self._session.scalar(select(func.count()).select_from(statement.subquery())) or 0
        )

        ordered = statement.order_by(ReminderModel.created_at.desc(), ReminderModel.id.desc())
        if cursor:
            sort_at, row_id = decode_cursor(cursor)
            ordered = ordered.where(
                or_(
                    ReminderModel.created_at < sort_at,
                    and_(ReminderModel.created_at == sort_at, ReminderModel.id < row_id),
                )
            )

        rows = list(self._session.scalars(ordered.limit(limit + 1)))
        has_more = len(rows) > limit
        items = rows[:limit]
        next_cursor = None
        if has_more and items:
            last = items[-1]
            next_cursor = encode_cursor(sort_at=last.created_at, row_id=last.id)

        return ListPage(
            items=items,
            total_count=total_count,
            next_cursor=next_cursor,
            has_more=has_more,
        )

    def list_all_sorted(
        self,
        *,
        status: str | None = None,
        source: str | None = None,
        sort: str = "due_at",
        limit: int | None = None,
    ) -> list[ReminderModel]:
        statement = select(ReminderModel).where(
            ReminderModel.user_id == self._user_id,
            ReminderModel.deleted_at.is_(None),
        )
        if status:
            statement = statement.where(ReminderModel.status == status)
        if source:
            statement = statement.where(ReminderModel.source == source)

        if sort == "completed_at":
            statement = statement.order_by(
                ReminderModel.completed_at.desc().nulls_last(),
                ReminderModel.id.desc(),
            )
        elif sort == "due_at":
            statement = statement.order_by(
                ReminderModel.due_at.asc().nulls_last(),
                ReminderModel.id.asc(),
            )
        else:
            statement = statement.order_by(
                ReminderModel.created_at.desc(),
                ReminderModel.id.desc(),
            )

        if limit is not None:
            statement = statement.limit(limit)
        return list(self._session.scalars(statement))

    def count_active(self, *, status: str | None = None, source: str | None = None) -> int:
        statement = select(ReminderModel).where(
            ReminderModel.user_id == self._user_id,
            ReminderModel.deleted_at.is_(None),
        )
        if status:
            statement = statement.where(ReminderModel.status == status)
        if source:
            statement = statement.where(ReminderModel.source == source)
        return int(
            self._session.scalar(select(func.count()).select_from(statement.subquery())) or 0
        )

    def list_all_active(self) -> list[ReminderModel]:
        statement = (
            select(ReminderModel)
            .where(
                ReminderModel.user_id == self._user_id,
                ReminderModel.deleted_at.is_(None),
            )
            .order_by(ReminderModel.created_at.desc(), ReminderModel.id.desc())
        )
        return list(self._session.scalars(statement))

    def save(self, reminder: ReminderModel) -> ReminderModel:
        self._session.add(reminder)
        self._session.commit()
        self._session.refresh(reminder)
        return reminder


def reminder_to_summary(
    reminder: ReminderModel,
    *,
    contacts: list | None = None,
    wechat_notify_status: WechatNotifyStatus = "none",
) -> ReminderSummary:
    return ReminderSummary(
        id=reminder.id,
        title=reminder.title,
        status=reminder.status,  # type: ignore[arg-type]
        notes=reminder.notes,
        due_at=reminder.due_at,
        remind_at=reminder.remind_at,
        source=reminder.source,
        external_id=reminder.external_id,
        source_meta=reminder.source_meta,
        completed_at=_format_datetime(reminder.completed_at),
        wechat_notify_requested=reminder.wechat_notify_requested,
        wechat_notify_status=wechat_notify_status,
        contacts=contacts or [],
    )


def _format_datetime(value: datetime | None) -> str | None:
    return value.isoformat() if value else None
