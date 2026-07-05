from datetime import datetime

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from ai_todo_api.common.cursor import decode_cursor, encode_cursor
from ai_todo_api.common.list_page import ListPage
from ai_todo_api.db.models import (
    ReminderModel,
    ReminderTagModel,
    ReminderTrackEntryModel,
    TagModel,
)
from ai_todo_api.modules.reminders.schemas import ReminderSummary, ReminderTrackEntry, TagSummary, WechatNotifyStatus
from ai_todo_api.modules.tags.normalize import normalize_tag_name


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
        query: str | None = None,
        tags: list[str] | None = None,
        limit: int = 50,
        cursor: str | None = None,
        sort: str = "created_at",
    ) -> ListPage[ReminderModel]:
        statement = select(ReminderModel).where(
            ReminderModel.user_id == self._user_id,
            ReminderModel.deleted_at.is_(None),
        )
        if status:
            statement = statement.where(ReminderModel.status == status)
        if source:
            statement = statement.where(ReminderModel.source == source)

        statement = _apply_search_filters(statement, query=query, tags=tags, user_id=self._user_id)

        reminder_ids = _distinct_reminder_ids(statement).subquery()
        total_count = int(self._session.scalar(select(func.count()).select_from(reminder_ids)) or 0)

        sort_column = _sort_column(sort)
        ordered = (
            select(ReminderModel)
            .where(ReminderModel.id.in_(select(reminder_ids.c.id)))
            .order_by(sort_column.desc(), ReminderModel.id.desc())
        )
        if cursor:
            sort_at, row_id = decode_cursor(cursor)
            ordered = ordered.where(
                or_(
                    sort_column < sort_at,
                    and_(sort_column == sort_at, ReminderModel.id < row_id),
                )
            )

        rows = list(self._session.scalars(ordered.limit(limit + 1)))
        has_more = len(rows) > limit
        items = rows[:limit]
        next_cursor = None
        if has_more and items:
            last = items[-1]
            next_cursor = encode_cursor(sort_at=_sort_value(last, sort), row_id=last.id)

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
        query: str | None = None,
        tags: list[str] | None = None,
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

        statement = _apply_search_filters(statement, query=query, tags=tags, user_id=self._user_id)
        reminder_ids = _distinct_reminder_ids(statement).subquery()
        statement = select(ReminderModel).where(ReminderModel.id.in_(select(reminder_ids.c.id)))

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
        elif sort == "updated_at":
            statement = statement.order_by(
                ReminderModel.updated_at.desc(),
                ReminderModel.id.desc(),
            )
        else:
            statement = statement.order_by(
                ReminderModel.created_at.desc(),
                ReminderModel.id.desc(),
            )

        if limit is not None:
            statement = statement.limit(limit)
        return list(self._session.scalars(statement))

    def count_active(
        self,
        *,
        status: str | None = None,
        source: str | None = None,
        query: str | None = None,
        tags: list[str] | None = None,
    ) -> int:
        statement = select(ReminderModel).where(
            ReminderModel.user_id == self._user_id,
            ReminderModel.deleted_at.is_(None),
        )
        if status:
            statement = statement.where(ReminderModel.status == status)
        if source:
            statement = statement.where(ReminderModel.source == source)
        statement = _apply_search_filters(statement, query=query, tags=tags, user_id=self._user_id)
        reminder_ids = _distinct_reminder_ids(statement).subquery()
        return int(self._session.scalar(select(func.count()).select_from(reminder_ids)) or 0)

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


def _apply_search_filters(statement, *, query: str | None, tags: list[str] | None, user_id: str):
    cleaned_query = query.strip() if query else None

    normalized_tags = _normalized_tag_filters(tags)
    if normalized_tags:
        matching_reminder_ids = (
            select(ReminderTagModel.reminder_id)
            .join(TagModel, TagModel.id == ReminderTagModel.tag_id)
            .where(
                TagModel.user_id == user_id,
                TagModel.normalized_name.in_(normalized_tags),
            )
            .group_by(ReminderTagModel.reminder_id)
            .having(func.count(func.distinct(TagModel.normalized_name)) == len(normalized_tags))
            .subquery()
        )
        statement = statement.where(ReminderModel.id.in_(select(matching_reminder_ids.c.reminder_id)))

    if cleaned_query:
        pattern = f"%{cleaned_query}%"
        statement = (
            statement.outerjoin(ReminderTagModel, ReminderTagModel.reminder_id == ReminderModel.id)
            .outerjoin(TagModel, TagModel.id == ReminderTagModel.tag_id)
        )
        statement = statement.outerjoin(
            ReminderTrackEntryModel,
            ReminderTrackEntryModel.reminder_id == ReminderModel.id,
        ).where(
            or_(
                ReminderModel.title.ilike(pattern),
                ReminderModel.notes.ilike(pattern),
                TagModel.name.ilike(pattern),
                ReminderTrackEntryModel.text.ilike(pattern),
            )
        )
    return statement


def _normalized_tag_filters(tags: list[str] | None) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for tag in tags or []:
        cleaned = tag.strip()
        if not cleaned:
            continue
        normalized = normalize_tag_name(cleaned)
        if normalized in seen:
            continue
        seen.add(normalized)
        result.append(normalized)
    return result


def _distinct_reminder_ids(statement):
    return statement.with_only_columns(ReminderModel.id).order_by(None).distinct()


def _sort_column(sort: str):
    if sort == "updated_at":
        return ReminderModel.updated_at
    if sort == "completed_at":
        return ReminderModel.completed_at
    if sort == "due_at":
        return ReminderModel.due_at
    return ReminderModel.created_at


def _sort_value(reminder: ReminderModel, sort: str) -> datetime:
    if sort == "updated_at":
        return reminder.updated_at
    if sort == "completed_at":
        return reminder.completed_at or reminder.updated_at
    if sort == "due_at":
        if reminder.due_at:
            return datetime.fromisoformat(reminder.due_at)
        return reminder.created_at
    return reminder.created_at


def reminder_to_summary(
    reminder: ReminderModel,
    *,
    contacts: list | None = None,
    tags: list[TagSummary] | None = None,
    track_entries: list[ReminderTrackEntry] | None = None,
    wechat_notify_status: WechatNotifyStatus = "none",
) -> ReminderSummary:
    return ReminderSummary(
        id=reminder.id,
        title=reminder.title,
        status=reminder.status,  # type: ignore[arg-type]
        notes=reminder.notes,
        tags=tags or [],
        track_entries=track_entries or [],
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
