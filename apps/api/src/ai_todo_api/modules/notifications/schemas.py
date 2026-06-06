from typing import Literal

from ai_todo_api.schemas import CamelModel


NotificationTargetType = Literal["reminder", "calendar_event"]
SubscriptionResult = Literal["accept", "reject", "ban", "filter"]


class NotificationSettings(CamelModel):
    wechat_enabled: bool
    default_reminder_enabled: bool
    quiet_start: str | None = None
    quiet_end: str | None = None
    wechat_reminder_template_id: str | None = None


class UpdateNotificationSettingsInput(CamelModel):
    wechat_enabled: bool | None = None
    default_reminder_enabled: bool | None = None
    quiet_start: str | None = None
    quiet_end: str | None = None


class NotificationSettingsResult(CamelModel):
    settings: NotificationSettings


class WechatSubscriptionResultInput(CamelModel):
    template_key: str
    template_id: str
    result: SubscriptionResult
    target_type: NotificationTargetType | None = None
    target_id: str | None = None


class WechatSubscriptionResult(CamelModel):
    accepted: bool
    delivery_id: str | None = None
    status: str | None = None
    quota_remaining: int = 0


class NotificationDeliverySummary(CamelModel):
    id: str
    target_type: str
    target_id: str
    target_title: str
    template_key: str
    scheduled_at: str
    status: str
    attempt_count: int
    error_code: str | None = None
    error_message: str | None = None
    sent_at: str | None = None


class NotificationStatusResult(CamelModel):
    items: list[NotificationDeliverySummary]
