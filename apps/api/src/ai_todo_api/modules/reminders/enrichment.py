from sqlalchemy.orm import Session

from ai_todo_api.db.models import ReminderModel
from ai_todo_api.modules.contacts.schemas import ContactSummary
from ai_todo_api.modules.notifications.service import TARGET_TYPE_REMINDER, TEMPLATE_KEY_REMINDER_DUE
from ai_todo_api.modules.reminders.repository import reminder_to_summary
from ai_todo_api.modules.reminders.schemas import ReminderSummary, WechatNotifyStatus
from ai_todo_api.modules.reminders.track_repository import TrackEntryRepository
from ai_todo_api.modules.tags.repository import TagRepository


def reminders_to_enriched_summaries(
    session: Session,
    user_id: str,
    reminders: list[ReminderModel],
    contact_map: dict[str, list[ContactSummary]],
) -> list[ReminderSummary]:
    if not reminders:
        return []

    from ai_todo_api.modules.notifications.notify_fields import load_wechat_notify_status_map

    reminder_ids = [reminder.id for reminder in reminders]
    status_map = load_wechat_notify_status_map(
        session,
        user_id,
        target_type=TARGET_TYPE_REMINDER,
        template_key=TEMPLATE_KEY_REMINDER_DUE,
        target_ids=reminder_ids,
    )
    tag_map = TagRepository(session, user_id).tags_for_reminders(reminder_ids)
    track_map = TrackEntryRepository(session, user_id).entries_for_reminders(reminder_ids)

    return [
        reminder_to_summary(
            reminder,
            contacts=contact_map.get(reminder.id, []),
            tags=tag_map.get(reminder.id, []),
            track_entries=track_map.get(reminder.id, []),
            wechat_notify_status=status_map.get(reminder.id, "none"),
        )
        for reminder in reminders
    ]


def reminder_to_enriched_summary(
    session: Session,
    user_id: str,
    reminder: ReminderModel,
    *,
    contacts: list[ContactSummary] | None = None,
    wechat_notify_status: WechatNotifyStatus = "none",
) -> ReminderSummary:
    tag_map = TagRepository(session, user_id).tags_for_reminders([reminder.id])
    track_map = TrackEntryRepository(session, user_id).entries_for_reminders([reminder.id])
    return reminder_to_summary(
        reminder,
        contacts=contacts or [],
        tags=tag_map.get(reminder.id, []),
        track_entries=track_map.get(reminder.id, []),
        wechat_notify_status=wechat_notify_status,
    )
