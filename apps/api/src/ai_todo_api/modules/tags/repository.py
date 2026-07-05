from uuid import uuid4

from datetime import datetime

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ai_todo_api.common.time import now_utc
from ai_todo_api.db.models import ReminderTagModel, TagModel
from ai_todo_api.modules.tags.normalize import clean_tag_display_name, normalize_tag_name
from ai_todo_api.modules.tags.schemas import TagSummary

TAG_COLORS = [
    "#007AFF",
    "#34C759",
    "#FF9500",
    "#FF3B30",
    "#5856D6",
    "#AF52DE",
    "#FF2D55",
    "#8E8E93",
]
MAX_TAGS_PER_USER = 50
MAX_TAGS_PER_REMINDER = 5
VALID_TAG_SORTS = frozenset({"usage", "name", "updated"})


class TagRepository:
    def __init__(self, session: Session, user_id: str) -> None:
        self._session = session
        self._user_id = user_id

    def list_tags(self, *, query: str | None = None, limit: int = 50, sort: str = "usage") -> list[TagSummary]:
        if sort not in VALID_TAG_SORTS:
            raise ValueError("sort must be one of: usage, name, updated")
        statement = (
            select(TagModel, func.count(ReminderTagModel.id).label("usage_count"))
            .outerjoin(ReminderTagModel, ReminderTagModel.tag_id == TagModel.id)
            .where(TagModel.user_id == self._user_id)
            .group_by(
                TagModel.id,
                TagModel.user_id,
                TagModel.name,
                TagModel.normalized_name,
                TagModel.color,
                TagModel.last_used_at,
                TagModel.created_at,
                TagModel.updated_at,
            )
            .limit(limit)
        )
        if query:
            pattern = f"%{query.strip()}%"
            statement = statement.where(TagModel.name.ilike(pattern))
        if sort == "name":
            statement = statement.order_by(TagModel.name.asc())
        elif sort == "updated":
            statement = statement.order_by(TagModel.updated_at.desc(), TagModel.name.asc())
        else:
            statement = statement.order_by(
                func.count(ReminderTagModel.id).desc(),
                TagModel.updated_at.desc(),
                TagModel.name.asc(),
            )
        return [
            tag_to_summary(tag, usage_count=int(usage_count or 0))
            for tag, usage_count in self._session.execute(statement).all()
        ]

    def get_by_normalized_name(self, normalized_name: str) -> TagModel | None:
        return self._session.scalar(
            select(TagModel).where(
                TagModel.user_id == self._user_id,
                TagModel.normalized_name == normalized_name,
            )
        )

    def get_or_create(self, display_name: str, *, color: str | None = None) -> TagModel:
        name = clean_tag_display_name(display_name)
        normalized = normalize_tag_name(name)
        existing = self.get_by_normalized_name(normalized)
        if existing is not None:
            return existing
        if self.count_tags() >= MAX_TAGS_PER_USER:
            raise ValueError(f"Tags are limited to {MAX_TAGS_PER_USER} per user.")

        now = now_utc()
        tag = TagModel(
            id=f"tag_{uuid4().hex[:12]}",
            user_id=self._user_id,
            name=name,
            normalized_name=normalized,
            color=validate_tag_color(color) if color else self._next_color(),
            created_at=now,
            updated_at=now,
        )
        self._session.add(tag)
        self._session.flush()
        return tag

    def create_tag(self, display_name: str, *, color: str | None = None) -> TagSummary:
        tag = self.get_or_create(display_name, color=color)
        self._session.commit()
        return tag_to_summary(tag, usage_count=self.usage_count(tag.id))

    def update_tag(
        self,
        tag_id: str,
        *,
        name: str | None = None,
        color: str | None = None,
    ) -> TagSummary | None:
        tag = self.get(tag_id)
        if tag is None:
            return None
        if name is not None:
            cleaned = clean_tag_display_name(name)
            normalized = normalize_tag_name(cleaned)
            existing = self.get_by_normalized_name(normalized)
            if existing is not None and existing.id != tag.id:
                raise ValueError("Tag name already exists.")
            tag.name = cleaned
            tag.normalized_name = normalized
        if color is not None:
            tag.color = validate_tag_color(color)
        tag.updated_at = now_utc()
        self._session.add(tag)
        self._session.commit()
        return tag_to_summary(tag, usage_count=self.usage_count(tag.id))

    def delete_tag(self, tag_id: str) -> bool:
        tag = self.get(tag_id)
        if tag is None:
            return False
        self._session.delete(tag)
        self._session.commit()
        return True

    def get(self, tag_id: str) -> TagModel | None:
        return self._session.scalar(
            select(TagModel).where(TagModel.id == tag_id, TagModel.user_id == self._user_id)
        )

    def replace_reminder_tags(self, reminder_id: str, tag_names: list[str]) -> list[TagSummary]:
        self._session.execute(
            delete(ReminderTagModel).where(ReminderTagModel.reminder_id == reminder_id)
        )

        if len({normalize_tag_name(name) for name in tag_names if name.strip()}) > MAX_TAGS_PER_REMINDER:
            raise ValueError(f"Reminders can have at most {MAX_TAGS_PER_REMINDER} tags.")

        tags: list[TagSummary] = []
        now = now_utc()
        seen_normalized: set[str] = set()
        for raw_name in tag_names:
            name = clean_tag_display_name(raw_name)
            normalized = normalize_tag_name(name)
            if normalized in seen_normalized:
                continue
            seen_normalized.add(normalized)

            tag = self.get_or_create(name)
            tag.last_used_at = now
            self._session.add(tag)
            self._session.add(
                ReminderTagModel(
                    id=f"rtg_{uuid4().hex[:12]}",
                    reminder_id=reminder_id,
                    tag_id=tag.id,
                    created_at=now,
                )
            )
            tags.append(tag_to_summary(tag))

        self._session.flush()
        return tags

    def tags_for_reminders(self, reminder_ids: list[str]) -> dict[str, list[TagSummary]]:
        if not reminder_ids:
            return {}

        rows = self._session.execute(
            select(
                ReminderTagModel.reminder_id,
                TagModel.id,
                TagModel.name,
                TagModel.color,
                TagModel.created_at,
                TagModel.updated_at,
                TagModel.last_used_at,
            )
            .join(TagModel, TagModel.id == ReminderTagModel.tag_id)
            .where(
                ReminderTagModel.reminder_id.in_(reminder_ids),
                TagModel.user_id == self._user_id,
            )
            .order_by(TagModel.name.asc())
        ).all()

        result: dict[str, list[TagSummary]] = {reminder_id: [] for reminder_id in reminder_ids}
        for reminder_id, tag_id, tag_name, tag_color, created_at, updated_at, last_used_at in rows:
            result[reminder_id].append(
                TagSummary(
                    id=tag_id,
                    name=tag_name,
                    color=tag_color,
                    created_at=_format_datetime(created_at),
                    updated_at=_format_datetime(updated_at),
                    last_used_at=_format_datetime(last_used_at),
                )
            )
        return result

    def count_tags(self, *, query: str | None = None) -> int:
        statement = select(func.count()).select_from(TagModel).where(TagModel.user_id == self._user_id)
        if query:
            pattern = f"%{query.strip()}%"
            statement = statement.where(TagModel.name.ilike(pattern))
        return int(self._session.scalar(statement) or 0)

    def usage_count(self, tag_id: str) -> int:
        return int(
            self._session.scalar(
                select(func.count()).select_from(ReminderTagModel).where(ReminderTagModel.tag_id == tag_id)
            )
            or 0
        )

    def _next_color(self) -> str:
        count = self.count_tags()
        return TAG_COLORS[count % len(TAG_COLORS)]


def validate_tag_color(color: str) -> str:
    if color not in TAG_COLORS:
        raise ValueError("Unsupported tag color.")
    return color


def tag_to_summary(tag: TagModel, *, usage_count: int = 0) -> TagSummary:
    return TagSummary(
        id=tag.id,
        name=tag.name,
        color=tag.color,
        usage_count=usage_count,
        created_at=tag.created_at.isoformat(),
        updated_at=tag.updated_at.isoformat(),
        last_used_at=_format_datetime(tag.last_used_at),
    )


def _format_datetime(value: datetime | None) -> str | None:
    return value.isoformat() if value else None
