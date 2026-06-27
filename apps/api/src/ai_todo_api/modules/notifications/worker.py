import logging
import time
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select

from ai_todo_api.config import settings
from ai_todo_api.errors import ErrorCode, wire_code
from ai_todo_api.db.models import CalendarEventModel, NotificationDeliveryModel, ReminderModel
from ai_todo_api.db.session import SessionLocal
from ai_todo_api.modules.notifications.service import (
    TARGET_TYPE_CALENDAR_EVENT,
    TARGET_TYPE_REMINDER,
    NotificationDispatchService,
)
from ai_todo_api.modules.notifications.wechat_client import (
    WechatSubscribeMessageError,
    send_subscribe_message,
)


logger = logging.getLogger(__name__)

# WeChat public template #15788 (待办事项到期提醒):
# 事项主题 {{thing23.DATA}} · 截止日期 {{time2.DATA}} · 备注 {{thing13.DATA}}
WECHAT_REMINDER_FIELD_TITLE = "thing23"
WECHAT_REMINDER_FIELD_DUE = "time2"
WECHAT_REMINDER_FIELD_NOTES = "thing13"


def run_forever() -> None:
    logging.basicConfig(level=logging.INFO)
    logger.info("notification worker started")
    while True:
        processed = run_once()
        if processed == 0:
            time.sleep(settings.notification_worker_poll_seconds)


def run_once() -> int:
    with SessionLocal() as session:
        dispatcher = NotificationDispatchService(session)
        deliveries = dispatcher.claim_due(limit=settings.notification_worker_batch_size)

    for delivery in deliveries:
        _process_delivery(delivery.id)
    return len(deliveries)


def _process_delivery(delivery_id: str) -> None:
    with SessionLocal() as session:
        dispatcher = NotificationDispatchService(session)
        delivery = session.get(NotificationDeliveryModel, delivery_id)
        if delivery is None:
            return

        openid = dispatcher.get_wechat_openid(delivery.user_id)
        if not openid:
            dispatcher.mark_skipped(
                delivery,
                code=wire_code(ErrorCode.BIZ_WECHAT_OPENID_MISSING),
                message="User has no WeChat identity.",
            )
            return

        if not dispatcher.consume_quota(delivery):
            dispatcher.mark_no_quota(delivery)
            return

        try:
            page, data = _build_wechat_message(session, delivery)
        except ValueError as exc:
            dispatcher.mark_skipped(
                delivery,
                code=wire_code(ErrorCode.BIZ_INVALID_TARGET),
                message=str(exc),
            )
            return

        try:
            result = send_subscribe_message(
                openid=openid,
                template_id=delivery.template_id,
                page=page,
                data=data,
            )
        except WechatSubscribeMessageError as exc:
            dispatcher.mark_failed(delivery, code=exc.code, message=exc.message)
            return

        dispatcher.mark_sent(delivery, provider_message_id=result.message_id)


def _build_wechat_message(
    session,
    delivery: NotificationDeliveryModel,
) -> tuple[str, dict[str, dict[str, str]]]:
    if delivery.target_type == TARGET_TYPE_REMINDER:
        return _build_reminder_wechat_message(session, delivery)
    if delivery.target_type == TARGET_TYPE_CALENDAR_EVENT:
        return _build_calendar_wechat_message(session, delivery)
    raise ValueError(f"Unsupported target type: {delivery.target_type}")


def _build_reminder_wechat_message(
    session,
    delivery: NotificationDeliveryModel,
) -> tuple[str, dict[str, dict[str, str]]]:
    reminder = session.scalar(
        select(ReminderModel).where(
            ReminderModel.id == delivery.target_id,
            ReminderModel.user_id == delivery.user_id,
            ReminderModel.deleted_at.is_(None),
        )
    )
    if reminder is None:
        raise ValueError(f"Reminder {delivery.target_id} was not found.")

    remind_time = reminder.remind_at or reminder.due_at or delivery.scheduled_at.isoformat()
    return (
        f"pages/reminders/reminders?reminderId={reminder.id}",
        {
            WECHAT_REMINDER_FIELD_TITLE: {"value": _truncate(reminder.title, 20)},
            WECHAT_REMINDER_FIELD_DUE: {"value": _format_wechat_time(remind_time)},
            WECHAT_REMINDER_FIELD_NOTES: {
                "value": _truncate(reminder.notes or "点击查看提醒详情", 20)
            },
        },
    )


def _build_calendar_wechat_message(
    session,
    delivery: NotificationDeliveryModel,
) -> tuple[str, dict[str, dict[str, str]]]:
    event = session.scalar(
        select(CalendarEventModel).where(
            CalendarEventModel.id == delivery.target_id,
            CalendarEventModel.user_id == delivery.user_id,
            CalendarEventModel.deleted_at.is_(None),
        )
    )
    if event is None:
        raise ValueError(f"Calendar event {delivery.target_id} was not found.")

    start_time = event.start_at or delivery.scheduled_at.isoformat()
    return (
        f"pages/calendar/calendar?eventId={event.id}",
        {
            WECHAT_REMINDER_FIELD_TITLE: {"value": _truncate(event.title, 20)},
            WECHAT_REMINDER_FIELD_DUE: {"value": _format_wechat_time(start_time)},
            WECHAT_REMINDER_FIELD_NOTES: {"value": _calendar_event_notes(event)},
        },
    )


def _calendar_event_notes(event: CalendarEventModel) -> str:
    location = (event.location or "").strip()
    if location:
        return _truncate(location, 20)
    description = (event.description or "").strip()
    if description:
        return _truncate(description, 20)
    if event.end_at and event.start_at:
        return _truncate(_format_wechat_time_range(event.start_at, event.end_at), 20)
    return "点击查看日程详情"


def _format_wechat_time_range(start_at: str, end_at: str) -> str:
    tz = ZoneInfo(settings.timezone)
    start = datetime.fromisoformat(start_at)
    end = datetime.fromisoformat(end_at)
    if start.tzinfo is None:
        start = start.replace(tzinfo=tz)
    if end.tzinfo is None:
        end = end.replace(tzinfo=tz)
    start_local = start.astimezone(tz)
    end_local = end.astimezone(tz)
    return (
        f"{start_local.hour:02d}:{start_local.minute:02d}-"
        f"{end_local.hour:02d}:{end_local.minute:02d}"
    )


def _format_wechat_time(value: str) -> str:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=ZoneInfo(settings.timezone))
    local = parsed.astimezone(ZoneInfo(settings.timezone))
    return f"{local.year}年{local.month}月{local.day}日 {local.hour:02d}:{local.minute:02d}"


def _truncate(value: str, max_length: int) -> str:
    return value[:max_length]


if __name__ == "__main__":
    run_forever()
