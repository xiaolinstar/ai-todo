from datetime import timedelta

from ai_todo_api.common.time import now_utc
from ai_todo_api.db.models import (
    IdentityModel,
    NotificationDeliveryModel,
    NotificationSubscriptionModel,
)
from ai_todo_api.modules.notifications.service import NotificationDispatchService


def test_notification_settings_exposes_template_id(client, monkeypatch):
    monkeypatch.setattr(
        "ai_todo_api.modules.notifications.service.settings.wechat_reminder_template_id",
        "tmpl_reminder",
    )

    response = client.get("/v1/notifications/settings")

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["data"]["settings"]["wechatReminderTemplateId"] == "tmpl_reminder"


def test_wechat_subscription_accept_creates_delivery(client):
    due_at = (now_utc() + timedelta(minutes=5)).isoformat()
    create_response = client.post(
        "/v1/reminders",
        json={"title": "测试微信提醒", "dueAt": due_at},
    )
    reminder_id = create_response.json()["data"]["reminder"]["id"]

    response = client.post(
        "/v1/notifications/wechat/subscription-result",
        json={
            "templateKey": "reminder_due",
            "templateId": "tmpl_reminder",
            "result": "accept",
            "targetType": "reminder",
            "targetId": reminder_id,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["data"]["accepted"] is True
    assert body["data"]["status"] == "pending"
    assert body["data"]["quotaRemaining"] == 1

    status_response = client.get(
        f"/v1/notifications/status?target_type=reminder&target_id={reminder_id}"
    )
    items = status_response.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["templateKey"] == "reminder_due"
    assert items[0]["status"] == "pending"
    assert items[0]["targetTitle"] == "测试微信提醒"


def test_wechat_subscription_reject_does_not_create_delivery(client):
    due_at = (now_utc() + timedelta(minutes=5)).isoformat()
    create_response = client.post(
        "/v1/reminders",
        json={"title": "拒绝微信提醒", "dueAt": due_at},
    )
    reminder_id = create_response.json()["data"]["reminder"]["id"]

    response = client.post(
        "/v1/notifications/wechat/subscription-result",
        json={
            "templateKey": "reminder_due",
            "templateId": "tmpl_reminder",
            "result": "reject",
            "targetType": "reminder",
            "targetId": reminder_id,
        },
    )

    assert response.status_code == 200
    assert response.json()["data"]["accepted"] is False

    status_response = client.get(
        f"/v1/notifications/status?target_type=reminder&target_id={reminder_id}"
    )
    assert status_response.json()["data"]["items"] == []


def test_dispatch_claims_due_delivery_and_consumes_quota(client):
    due_at = (now_utc() - timedelta(minutes=1)).isoformat()
    create_response = client.post(
        "/v1/reminders",
        json={"title": "到期提醒", "dueAt": due_at},
    )
    reminder_id = create_response.json()["data"]["reminder"]["id"]
    response = client.post(
        "/v1/notifications/wechat/subscription-result",
        json={
            "templateKey": "reminder_due",
            "templateId": "tmpl_reminder",
            "result": "accept",
            "targetType": "reminder",
            "targetId": reminder_id,
        },
    )
    delivery_id = response.json()["data"]["deliveryId"]

    from ai_todo_api.main import app
    from ai_todo_api.db.session import get_db

    session_generator = app.dependency_overrides[get_db]()
    session = next(session_generator)
    try:
        session.add(
            IdentityModel(
                id="id_notification_test",
                user_id="user_dev",
                provider="wechat",
                provider_subject="openid_test",
                created_at=now_utc(),
                last_used_at=now_utc(),
            )
        )
        session.commit()
        dispatcher = NotificationDispatchService(session)

        deliveries = dispatcher.claim_due(limit=10)

        assert [delivery.id for delivery in deliveries] == [delivery_id]
        delivery = session.get(NotificationDeliveryModel, delivery_id)
        assert delivery.status == "sending"
        assert dispatcher.get_wechat_openid("user_dev") == "openid_test"
        subscription = (
            session.query(NotificationSubscriptionModel)
            .filter(NotificationSubscriptionModel.template_id == "tmpl_reminder")
            .order_by(NotificationSubscriptionModel.created_at.desc())
            .first()
        )
        assert subscription is not None
        quota_before = subscription.quota_remaining

        assert dispatcher.consume_quota(delivery) is True

        session.refresh(subscription)
        assert subscription.quota_remaining == quota_before - 1
    finally:
        session_generator.close()


def test_sync_reminder_target_updates_delivery_schedule(client):
    due_at = (now_utc() + timedelta(hours=2)).isoformat()
    create_response = client.post(
        "/v1/reminders",
        json={"title": "改期提醒", "dueAt": due_at},
    )
    reminder_id = create_response.json()["data"]["reminder"]["id"]
    client.post(
        "/v1/notifications/wechat/subscription-result",
        json={
            "templateKey": "reminder_due",
            "templateId": "tmpl_reminder",
            "result": "accept",
            "targetType": "reminder",
            "targetId": reminder_id,
        },
    )

    new_due_at = (now_utc() + timedelta(hours=4)).isoformat()
    client.patch(
        f"/v1/reminders/{reminder_id}",
        json={"dueAt": new_due_at},
    )

    status_response = client.get(
        f"/v1/notifications/status?target_type=reminder&target_id={reminder_id}"
    )
    items = status_response.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["status"] == "pending"
    assert items[0]["scheduledAt"].startswith(new_due_at[:16])


def test_sync_reminder_target_skips_delivery_when_completed(client):
    due_at = (now_utc() + timedelta(hours=2)).isoformat()
    create_response = client.post(
        "/v1/reminders",
        json={"title": "完成提醒", "dueAt": due_at},
    )
    reminder_id = create_response.json()["data"]["reminder"]["id"]
    client.post(
        "/v1/notifications/wechat/subscription-result",
        json={
            "templateKey": "reminder_due",
            "templateId": "tmpl_reminder",
            "result": "accept",
            "targetType": "reminder",
            "targetId": reminder_id,
        },
    )

    client.post(f"/v1/reminders/{reminder_id}/complete", json={})

    status_response = client.get(
        f"/v1/notifications/status?target_type=reminder&target_id={reminder_id}"
    )
    items = status_response.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["status"] == "skipped"
    assert items[0]["errorCode"] == "REMINDER_INACTIVE"


def test_wechat_subscription_accept_creates_calendar_delivery(client):
    start_at = (now_utc() + timedelta(minutes=5)).isoformat()
    create_response = client.post(
        "/v1/calendar/events",
        json={"title": "测试微信日程", "startAt": start_at},
    )
    event_id = create_response.json()["data"]["calendarEvent"]["id"]

    response = client.post(
        "/v1/notifications/wechat/subscription-result",
        json={
            "templateKey": "calendar_event_start",
            "templateId": "tmpl_reminder",
            "result": "accept",
            "targetType": "calendar_event",
            "targetId": event_id,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["data"]["accepted"] is True
    assert body["data"]["status"] == "pending"

    status_response = client.get(
        f"/v1/notifications/status?target_type=calendar_event&target_id={event_id}"
    )
    items = status_response.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["templateKey"] == "calendar_event_start"
    assert items[0]["status"] == "pending"


def test_sync_calendar_event_target_updates_delivery_schedule(client):
    start_at = (now_utc() + timedelta(hours=2)).isoformat()
    create_response = client.post(
        "/v1/calendar/events",
        json={"title": "改期日程", "startAt": start_at},
    )
    event_id = create_response.json()["data"]["calendarEvent"]["id"]
    client.post(
        "/v1/notifications/wechat/subscription-result",
        json={
            "templateKey": "calendar_event_start",
            "templateId": "tmpl_reminder",
            "result": "accept",
            "targetType": "calendar_event",
            "targetId": event_id,
        },
    )

    new_start_at = (now_utc() + timedelta(hours=4)).isoformat()
    client.patch(
        f"/v1/calendar/events/{event_id}",
        json={"startAt": new_start_at},
    )

    status_response = client.get(
        f"/v1/notifications/status?target_type=calendar_event&target_id={event_id}"
    )
    items = status_response.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["status"] == "pending"
    assert items[0]["scheduledAt"].startswith(new_start_at[:16])


def test_sync_calendar_event_target_skips_delivery_when_deleted(client):
    start_at = (now_utc() + timedelta(hours=2)).isoformat()
    create_response = client.post(
        "/v1/calendar/events",
        json={"title": "删除日程", "startAt": start_at},
    )
    event_id = create_response.json()["data"]["calendarEvent"]["id"]
    client.post(
        "/v1/notifications/wechat/subscription-result",
        json={
            "templateKey": "calendar_event_start",
            "templateId": "tmpl_reminder",
            "result": "accept",
            "targetType": "calendar_event",
            "targetId": event_id,
        },
    )

    client.delete(f"/v1/calendar/events/{event_id}")

    status_response = client.get(
        f"/v1/notifications/status?target_type=calendar_event&target_id={event_id}"
    )
    items = status_response.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["status"] == "skipped"
    assert items[0]["errorCode"] == "CALENDAR_EVENT_INACTIVE"
    assert items[0]["targetTitle"] == "删除日程"


def test_notification_status_includes_calendar_event_title(client):
    start_at = (now_utc() + timedelta(hours=1)).isoformat()
    create_response = client.post(
        "/v1/calendar/events",
        json={"title": "周会提醒", "startAt": start_at},
    )
    event_id = create_response.json()["data"]["calendarEvent"]["id"]
    client.post(
        "/v1/notifications/wechat/subscription-result",
        json={
            "templateKey": "calendar_event_start",
            "templateId": "tmpl_reminder",
            "result": "accept",
            "targetType": "calendar_event",
            "targetId": event_id,
        },
    )

    status_response = client.get(
        f"/v1/notifications/status?target_type=calendar_event&target_id={event_id}"
    )
    items = status_response.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["targetTitle"] == "周会提醒"
