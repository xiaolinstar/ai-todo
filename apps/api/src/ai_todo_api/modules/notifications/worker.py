import logging
import time

from sqlalchemy import select

from ai_todo_api.config import settings
from ai_todo_api.db.models import NotificationDeliveryModel, ReminderModel
from ai_todo_api.db.session import SessionLocal
from ai_todo_api.modules.notifications.service import (
    TARGET_TYPE_REMINDER,
    NotificationDispatchService,
)
from ai_todo_api.modules.notifications.wechat_client import (
    WechatSubscribeMessageError,
    send_subscribe_message,
)


logger = logging.getLogger(__name__)


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
                code="WECHAT_OPENID_MISSING",
                message="User has no WeChat identity.",
            )
            return

        if not dispatcher.consume_quota(delivery):
            dispatcher.mark_no_quota(delivery)
            return

        try:
            page, data = _build_wechat_message(session, delivery)
        except ValueError as exc:
            dispatcher.mark_skipped(delivery, code="INVALID_TARGET", message=str(exc))
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
    if delivery.target_type != TARGET_TYPE_REMINDER:
        raise ValueError(f"Unsupported target type: {delivery.target_type}")

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
            "thing1": {"value": _truncate(reminder.title, 20)},
            "time2": {"value": _truncate(remind_time.replace("T", " "), 20)},
            "thing3": {"value": _truncate(reminder.notes or "点击查看提醒详情", 20)},
        },
    )


def _truncate(value: str, max_length: int) -> str:
    return value[:max_length]


if __name__ == "__main__":
    run_forever()
