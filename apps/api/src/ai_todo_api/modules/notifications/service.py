from datetime import datetime, timedelta
from uuid import uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ai_todo_api.auth.wechat_service import WECHAT_PROVIDER
from ai_todo_api.common.time import now_utc
from ai_todo_api.config import settings
from ai_todo_api.db.models import (
    CalendarEventModel,
    IdentityModel,
    NotificationDeliveryModel,
    NotificationPreferenceModel,
    NotificationSubscriptionModel,
    ReminderModel,
)
from ai_todo_api.modules.notifications.schemas import (
    NotificationDeliverySummary,
    NotificationSettings,
    UpdateNotificationSettingsInput,
)


CHANNEL_WECHAT_SUBSCRIBE = "wechat_subscribe"
TEMPLATE_KEY_REMINDER_DUE = "reminder_due"
TEMPLATE_KEY_CALENDAR_START = "calendar_event_start"
TARGET_TYPE_REMINDER = "reminder"
TARGET_TYPE_CALENDAR_EVENT = "calendar_event"
STATUS_PENDING = "pending"
STATUS_SENDING = "sending"
STATUS_SENT = "sent"
STATUS_FAILED = "failed"
STATUS_NO_QUOTA = "no_quota"
STATUS_SKIPPED = "skipped"


class NotificationValidationError(Exception):
    pass


class NotificationTargetNotFoundError(Exception):
    pass


class NotificationDeliveryService:
    def __init__(self, session: Session, user_id: str) -> None:
        self._session = session
        self._user_id = user_id

    def get_settings(self) -> NotificationSettings:
        preference = self._get_or_create_preference()
        return NotificationSettings(
            wechat_enabled=preference.wechat_enabled,
            default_reminder_enabled=preference.default_reminder_enabled,
            quiet_start=preference.quiet_start,
            quiet_end=preference.quiet_end,
            wechat_reminder_template_id=settings.wechat_reminder_template_id,
        )

    def update_settings(self, input_data: UpdateNotificationSettingsInput) -> NotificationSettings:
        preference = self._get_or_create_preference()
        updates = input_data.model_dump(exclude_unset=True)
        now = now_utc()

        if "wechat_enabled" in updates:
            preference.wechat_enabled = bool(updates["wechat_enabled"])
        if "default_reminder_enabled" in updates:
            preference.default_reminder_enabled = bool(updates["default_reminder_enabled"])
        if "quiet_start" in updates:
            preference.quiet_start = _clean_optional(updates["quiet_start"])
        if "quiet_end" in updates:
            preference.quiet_end = _clean_optional(updates["quiet_end"])

        preference.updated_at = now
        self._session.flush()
        return self.get_settings()

    def record_wechat_subscription_result(
        self,
        *,
        template_key: str,
        template_id: str,
        result: str,
        target_type: str | None,
        target_id: str | None,
    ) -> tuple[bool, NotificationDeliveryModel | None, int]:
        template_key = template_key.strip()
        template_id = template_id.strip()
        if not template_key or not template_id:
            raise NotificationValidationError("Template key and template id are required.")

        if result != "accept":
            subscription = self._upsert_subscription(
                template_key=template_key,
                template_id=template_id,
                result=result,
                increment_quota=False,
            )
            self._session.commit()
            return False, None, subscription.quota_remaining

        delivery = None
        if target_type or target_id:
            if not target_type or not target_id:
                raise NotificationValidationError("Target type and target id must be provided together.")
            delivery = self.ensure_delivery_for_target(
                target_type=target_type,
                target_id=target_id,
                template_key=template_key,
                template_id=template_id,
            )

        subscription = self._upsert_subscription(
            template_key=template_key,
            template_id=template_id,
            result=result,
            increment_quota=True,
        )
        self._session.commit()

        return True, delivery, subscription.quota_remaining

    def ensure_delivery_for_target(
        self,
        *,
        target_type: str,
        target_id: str,
        template_key: str,
        template_id: str,
    ) -> NotificationDeliveryModel:
        if target_type == TARGET_TYPE_REMINDER:
            if template_key != TEMPLATE_KEY_REMINDER_DUE:
                raise NotificationValidationError("Unsupported notification template.")
            reminder = self._session.scalar(
                select(ReminderModel).where(
                    ReminderModel.id == target_id,
                    ReminderModel.user_id == self._user_id,
                    ReminderModel.deleted_at.is_(None),
                )
            )
            if reminder is None:
                raise NotificationTargetNotFoundError(target_id)
            scheduled_at = _parse_schedule(reminder.remind_at or reminder.due_at)
            if scheduled_at is None:
                raise NotificationValidationError("Reminder does not have a due or reminder time.")
        elif target_type == TARGET_TYPE_CALENDAR_EVENT:
            if template_key != TEMPLATE_KEY_CALENDAR_START:
                raise NotificationValidationError("Unsupported notification template.")
            event = self._session.scalar(
                select(CalendarEventModel).where(
                    CalendarEventModel.id == target_id,
                    CalendarEventModel.user_id == self._user_id,
                    CalendarEventModel.deleted_at.is_(None),
                )
            )
            if event is None:
                raise NotificationTargetNotFoundError(target_id)
            scheduled_at = _parse_schedule(event.start_at)
            if scheduled_at is None:
                raise NotificationValidationError("Calendar event does not have a start time.")
        else:
            raise NotificationValidationError("Only reminder and calendar event notifications are supported.")

        return self._upsert_delivery(
            target_type=target_type,
            target_id=target_id,
            template_key=template_key,
            template_id=template_id,
            scheduled_at=scheduled_at,
        )

    def _upsert_delivery(
        self,
        *,
        target_type: str,
        target_id: str,
        template_key: str,
        template_id: str,
        scheduled_at: datetime,
    ) -> NotificationDeliveryModel:
        now = now_utc()
        delivery = self._session.scalar(
            select(NotificationDeliveryModel).where(
                NotificationDeliveryModel.user_id == self._user_id,
                NotificationDeliveryModel.channel == CHANNEL_WECHAT_SUBSCRIBE,
                NotificationDeliveryModel.target_type == target_type,
                NotificationDeliveryModel.target_id == target_id,
                NotificationDeliveryModel.template_key == template_key,
            )
        )

        if delivery is None:
            delivery = NotificationDeliveryModel(
                id=f"ndel_{uuid4().hex[:12]}",
                user_id=self._user_id,
                channel=CHANNEL_WECHAT_SUBSCRIBE,
                target_type=target_type,
                target_id=target_id,
                template_key=template_key,
                template_id=template_id,
                scheduled_at=scheduled_at,
                status=STATUS_PENDING,
                attempt_count=0,
                created_at=now,
                updated_at=now,
            )
            self._session.add(delivery)
            try:
                self._session.flush()
            except IntegrityError:
                self._session.rollback()
                raise
            return delivery

        delivery.template_id = template_id
        delivery.scheduled_at = scheduled_at
        if delivery.status in {STATUS_FAILED, STATUS_NO_QUOTA, STATUS_SKIPPED}:
            delivery.status = STATUS_PENDING
            delivery.error_code = None
            delivery.error_message = None
            delivery.next_attempt_at = None
        delivery.updated_at = now
        self._session.flush()
        return delivery

    def sync_reminder_target(self, reminder: ReminderModel) -> None:
        deliveries = self._session.scalars(
            select(NotificationDeliveryModel).where(
                NotificationDeliveryModel.user_id == self._user_id,
                NotificationDeliveryModel.target_type == TARGET_TYPE_REMINDER,
                NotificationDeliveryModel.target_id == reminder.id,
            )
        ).all()
        if not deliveries:
            return

        now = now_utc()
        if reminder.deleted_at is not None or reminder.status == "completed":
            for delivery in deliveries:
                if delivery.status in {STATUS_PENDING, STATUS_SENDING, STATUS_FAILED, STATUS_NO_QUOTA}:
                    self._mark_delivery_skipped(
                        delivery,
                        code="REMINDER_INACTIVE",
                        message="Reminder was completed or deleted.",
                        now=now,
                    )
            self._session.commit()
            return

        scheduled_at = _parse_schedule(reminder.remind_at or reminder.due_at)
        for delivery in deliveries:
            if scheduled_at is None:
                if delivery.status in {STATUS_PENDING, STATUS_SENDING, STATUS_FAILED, STATUS_NO_QUOTA}:
                    self._mark_delivery_skipped(
                        delivery,
                        code="REMINDER_NO_SCHEDULE",
                        message="Reminder no longer has a due or reminder time.",
                        now=now,
                    )
                continue

            delivery.scheduled_at = scheduled_at
            if delivery.status in {STATUS_FAILED, STATUS_NO_QUOTA, STATUS_SKIPPED}:
                delivery.status = STATUS_PENDING
                delivery.error_code = None
                delivery.error_message = None
                delivery.next_attempt_at = None
            delivery.updated_at = now
        self._session.commit()

    def sync_calendar_event_target(self, event: CalendarEventModel) -> None:
        deliveries = self._session.scalars(
            select(NotificationDeliveryModel).where(
                NotificationDeliveryModel.user_id == self._user_id,
                NotificationDeliveryModel.target_type == TARGET_TYPE_CALENDAR_EVENT,
                NotificationDeliveryModel.target_id == event.id,
            )
        ).all()
        if not deliveries:
            return

        now = now_utc()
        if event.deleted_at is not None:
            for delivery in deliveries:
                if delivery.status in {STATUS_PENDING, STATUS_SENDING, STATUS_FAILED, STATUS_NO_QUOTA}:
                    self._mark_delivery_skipped(
                        delivery,
                        code="CALENDAR_EVENT_INACTIVE",
                        message="Calendar event was deleted.",
                        now=now,
                    )
            self._session.commit()
            return

        scheduled_at = _parse_schedule(event.start_at)
        for delivery in deliveries:
            if scheduled_at is None:
                if delivery.status in {STATUS_PENDING, STATUS_SENDING, STATUS_FAILED, STATUS_NO_QUOTA}:
                    self._mark_delivery_skipped(
                        delivery,
                        code="CALENDAR_EVENT_NO_SCHEDULE",
                        message="Calendar event no longer has a start time.",
                        now=now,
                    )
                continue

            delivery.scheduled_at = scheduled_at
            if delivery.status in {STATUS_FAILED, STATUS_NO_QUOTA, STATUS_SKIPPED}:
                delivery.status = STATUS_PENDING
                delivery.error_code = None
                delivery.error_message = None
                delivery.next_attempt_at = None
            delivery.updated_at = now
        self._session.commit()

    def list_deliveries(
        self,
        *,
        target_type: str | None = None,
        target_id: str | None = None,
        limit: int = 50,
    ) -> list[NotificationDeliverySummary]:
        filters = [NotificationDeliveryModel.user_id == self._user_id]
        if target_type:
            filters.append(NotificationDeliveryModel.target_type == target_type)
        if target_id:
            filters.append(NotificationDeliveryModel.target_id == target_id)

        items = self._session.scalars(
            select(NotificationDeliveryModel)
            .where(*filters)
            .order_by(NotificationDeliveryModel.scheduled_at.desc())
            .limit(limit)
        ).all()
        return [delivery_to_summary(item) for item in items]

    def _get_or_create_preference(self) -> NotificationPreferenceModel:
        preference = self._session.get(NotificationPreferenceModel, self._user_id)
        if preference is not None:
            return preference

        now = now_utc()
        preference = NotificationPreferenceModel(
            user_id=self._user_id,
            wechat_enabled=True,
            default_reminder_enabled=True,
            created_at=now,
            updated_at=now,
        )
        self._session.add(preference)
        self._session.flush()
        return preference

    def _mark_delivery_skipped(
        self,
        delivery: NotificationDeliveryModel,
        *,
        code: str,
        message: str,
        now: datetime,
    ) -> None:
        delivery.status = STATUS_SKIPPED
        delivery.error_code = code
        delivery.error_message = message
        delivery.updated_at = now

    def _upsert_subscription(
        self,
        *,
        template_key: str,
        template_id: str,
        result: str,
        increment_quota: bool,
    ) -> NotificationSubscriptionModel:
        now = now_utc()
        subscription = self._session.scalar(
            select(NotificationSubscriptionModel).where(
                NotificationSubscriptionModel.user_id == self._user_id,
                NotificationSubscriptionModel.provider == WECHAT_PROVIDER,
                NotificationSubscriptionModel.template_key == template_key,
                NotificationSubscriptionModel.template_id == template_id,
            )
        )
        if subscription is None:
            subscription = NotificationSubscriptionModel(
                id=f"nsub_{uuid4().hex[:12]}",
                user_id=self._user_id,
                provider=WECHAT_PROVIDER,
                template_key=template_key,
                template_id=template_id,
                quota_remaining=0,
                created_at=now,
                updated_at=now,
            )
            self._session.add(subscription)

        if increment_quota:
            subscription.quota_remaining += 1
        subscription.last_request_result = result
        subscription.updated_at = now
        self._session.flush()
        return subscription


class NotificationDispatchService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def claim_due(self, *, limit: int) -> list[NotificationDeliveryModel]:
        now = now_utc()
        due = self._session.scalars(
            select(NotificationDeliveryModel)
            .where(
                NotificationDeliveryModel.status == STATUS_PENDING,
                NotificationDeliveryModel.scheduled_at <= now,
                or_(
                    NotificationDeliveryModel.next_attempt_at.is_(None),
                    NotificationDeliveryModel.next_attempt_at <= now,
                ),
            )
            .order_by(NotificationDeliveryModel.scheduled_at.asc())
            .limit(limit)
            .with_for_update(skip_locked=True)
        ).all()
        for delivery in due:
            delivery.status = STATUS_SENDING
            delivery.updated_at = now
        self._session.commit()
        return list(due)

    def mark_sent(self, delivery: NotificationDeliveryModel, *, provider_message_id: str | None = None) -> None:
        now = now_utc()
        delivery.status = STATUS_SENT
        delivery.provider_message_id = provider_message_id
        delivery.sent_at = now
        delivery.updated_at = now
        self._session.commit()

    def mark_no_quota(self, delivery: NotificationDeliveryModel) -> None:
        now = now_utc()
        delivery.status = STATUS_NO_QUOTA
        delivery.error_code = STATUS_NO_QUOTA
        delivery.error_message = "No accepted WeChat subscription quota is available."
        delivery.updated_at = now
        self._session.commit()

    def mark_failed(self, delivery: NotificationDeliveryModel, *, code: str, message: str) -> None:
        now = now_utc()
        delivery.attempt_count += 1
        delivery.error_code = code
        delivery.error_message = message[:1000]
        if delivery.attempt_count >= settings.notification_max_attempts:
            delivery.status = STATUS_FAILED
            delivery.next_attempt_at = None
        else:
            delivery.status = STATUS_PENDING
            delivery.next_attempt_at = now + timedelta(minutes=2 * delivery.attempt_count)
        delivery.updated_at = now
        self._session.commit()

    def mark_skipped(self, delivery: NotificationDeliveryModel, *, code: str, message: str) -> None:
        now = now_utc()
        delivery.status = STATUS_SKIPPED
        delivery.error_code = code
        delivery.error_message = message
        delivery.updated_at = now
        self._session.commit()

    def consume_quota(self, delivery: NotificationDeliveryModel) -> bool:
        subscription = self._session.scalar(
            select(NotificationSubscriptionModel).where(
                NotificationSubscriptionModel.user_id == delivery.user_id,
                NotificationSubscriptionModel.provider == WECHAT_PROVIDER,
                NotificationSubscriptionModel.template_key == delivery.template_key,
                NotificationSubscriptionModel.template_id == delivery.template_id,
                NotificationSubscriptionModel.quota_remaining > 0,
            )
        )
        if subscription is None:
            return False
        subscription.quota_remaining -= 1
        subscription.updated_at = now_utc()
        self._session.commit()
        return True

    def get_wechat_openid(self, user_id: str) -> str | None:
        identity = self._session.scalar(
            select(IdentityModel).where(
                IdentityModel.user_id == user_id,
                IdentityModel.provider == WECHAT_PROVIDER,
            )
        )
        return identity.provider_subject if identity else None


def delivery_to_summary(delivery: NotificationDeliveryModel) -> NotificationDeliverySummary:
    return NotificationDeliverySummary(
        id=delivery.id,
        target_type=delivery.target_type,
        target_id=delivery.target_id,
        template_key=delivery.template_key,
        scheduled_at=delivery.scheduled_at.isoformat(),
        status=delivery.status,
        attempt_count=delivery.attempt_count,
        error_code=delivery.error_code,
        error_message=delivery.error_message,
        sent_at=delivery.sent_at.isoformat() if delivery.sent_at else None,
    )


def _clean_optional(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _parse_schedule(value: str | None) -> datetime | None:
    if not value:
        return None
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=ZoneInfo(settings.timezone))
    return parsed.astimezone(ZoneInfo("UTC"))
