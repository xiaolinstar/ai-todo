from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from ai_todo_api.db.models import (
    CalendarEventModel,
    NotificationDeliveryModel,
    NotificationPreferenceModel,
    ReminderModel,
)
from ai_todo_api.modules.calendar.repository import event_to_summary
from ai_todo_api.modules.calendar.schemas import CalendarEventSummary
from ai_todo_api.modules.contacts.schemas import ContactSummary
from ai_todo_api.modules.reminders.enrichment import reminders_to_enriched_summaries
from ai_todo_api.modules.reminders.schemas import ReminderSummary
from ai_todo_api.modules.notifications.service import (
    TARGET_TYPE_CALENDAR_EVENT,
    TARGET_TYPE_REMINDER,
    TEMPLATE_KEY_CALENDAR_START,
    TEMPLATE_KEY_REMINDER_DUE,
)


WechatNotifyStatus = Literal["none", "pending", "sending", "sent", "failed", "no_quota", "skipped"]


def user_default_wechat_notify_enabled(session: Session, user_id: str) -> bool:
    preference = session.get(NotificationPreferenceModel, user_id)
    if preference is None:
        return True
    return bool(preference.wechat_enabled and preference.default_reminder_enabled)


def resolve_wechat_notify_requested(
    *,
    client_source: str,
    session: Session,
    user_id: str,
    requested: bool | None = None,
) -> bool:
    if requested is not None:
        return bool(requested)
    if client_source != "miniapp":
        return False
    return user_default_wechat_notify_enabled(session, user_id)


def load_wechat_notify_status_map(
    session: Session,
    user_id: str,
    *,
    target_type: str,
    template_key: str,
    target_ids: list[str],
) -> dict[str, WechatNotifyStatus]:
    if not target_ids:
        return {}

    deliveries = session.scalars(
        select(NotificationDeliveryModel)
        .where(
            NotificationDeliveryModel.user_id == user_id,
            NotificationDeliveryModel.target_type == target_type,
            NotificationDeliveryModel.template_key == template_key,
            NotificationDeliveryModel.target_id.in_(target_ids),
        )
        .order_by(NotificationDeliveryModel.updated_at.desc())
    ).all()

    status_map: dict[str, WechatNotifyStatus] = {}
    for delivery in deliveries:
        if delivery.target_id in status_map:
            continue
        status_map[delivery.target_id] = delivery.status  # type: ignore[assignment]

    return status_map


def events_to_summaries(
    session: Session,
    user_id: str,
    events: list[CalendarEventModel],
    contact_map: dict[str, list[ContactSummary]],
) -> list[CalendarEventSummary]:
    status_map = load_wechat_notify_status_map(
        session,
        user_id,
        target_type=TARGET_TYPE_CALENDAR_EVENT,
        template_key=TEMPLATE_KEY_CALENDAR_START,
        target_ids=[event.id for event in events],
    )
    return [
        event_to_summary(
            event,
            contacts=contact_map.get(event.id, []),
            wechat_notify_status=status_map.get(event.id, "none"),
        )
        for event in events
    ]


def reminders_to_summaries(
    session: Session,
    user_id: str,
    reminders: list[ReminderModel],
    contact_map: dict[str, list[ContactSummary]],
) -> list[ReminderSummary]:
    return reminders_to_enriched_summaries(
        session,
        user_id,
        reminders,
        contact_map,
    )
