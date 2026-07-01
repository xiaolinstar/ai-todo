from uuid import uuid4

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ai_todo_api.common.time import now_utc
from ai_todo_api.db.models import ReminderTagModel, TagModel
from ai_todo_api.modules.tags.normalize import clean_tag_display_name, normalize_tag_name
from ai_todo_api.modules.tags.schemas import TagSummary


class TagRepository:
    def __init__(self, session: Session, user_id: str) -> None:
        self._session = session
        self._user_id = user_id

    def list_tags(self, *, query: str | None = None, limit: int = 50) -> list[TagModel]:
        statement = (
            select(TagModel)
            .where(TagModel.user_id == self._user_id)
            .order_by(TagModel.name.asc())
            .limit(limit)
        )
        if query:
            pattern = f"%{query.strip()}%"
            statement = statement.where(TagModel.name.ilike(pattern))
        return list(self._session.scalars(statement))

    def get_by_normalized_name(self, normalized_name: str) -> TagModel | None:
        return self._session.scalar(
            select(TagModel).where(
                TagModel.user_id == self._user_id,
                TagModel.normalized_name == normalized_name,
            )
        )

    def get_or_create(self, display_name: str) -> TagModel:
        name = clean_tag_display_name(display_name)
        normalized = normalize_tag_name(name)
        existing = self.get_by_normalized_name(normalized)
        if existing is not None:
            return existing

        now = now_utc()
        tag = TagModel(
            id=f"tag_{uuid4().hex[:12]}",
            user_id=self._user_id,
            name=name,
            normalized_name=normalized,
            created_at=now,
        )
        self._session.add(tag)
        self._session.flush()
        return tag

    def replace_reminder_tags(self, reminder_id: str, tag_names: list[str]) -> list[TagSummary]:
        self._session.execute(
            delete(ReminderTagModel).where(ReminderTagModel.reminder_id == reminder_id)
        )

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
            self._session.add(
                ReminderTagModel(
                    id=f"rtg_{uuid4().hex[:12]}",
                    reminder_id=reminder_id,
                    tag_id=tag.id,
                    created_at=now,
                )
            )
            tags.append(TagSummary(id=tag.id, name=tag.name))

        self._session.flush()
        return tags

    def tags_for_reminders(self, reminder_ids: list[str]) -> dict[str, list[TagSummary]]:
        if not reminder_ids:
            return {}

        rows = self._session.execute(
            select(ReminderTagModel.reminder_id, TagModel.id, TagModel.name)
            .join(TagModel, TagModel.id == ReminderTagModel.tag_id)
            .where(
                ReminderTagModel.reminder_id.in_(reminder_ids),
                TagModel.user_id == self._user_id,
            )
            .order_by(TagModel.name.asc())
        ).all()

        result: dict[str, list[TagSummary]] = {reminder_id: [] for reminder_id in reminder_ids}
        for reminder_id, tag_id, tag_name in rows:
            result[reminder_id].append(TagSummary(id=tag_id, name=tag_name))
        return result

    def count_tags(self, *, query: str | None = None) -> int:
        statement = select(func.count()).select_from(TagModel).where(TagModel.user_id == self._user_id)
        if query:
            pattern = f"%{query.strip()}%"
            statement = statement.where(TagModel.name.ilike(pattern))
        return int(self._session.scalar(statement) or 0)
