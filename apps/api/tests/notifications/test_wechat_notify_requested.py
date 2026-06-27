from datetime import timedelta

from ai_todo_api.common.time import now_utc


def test_miniapp_create_sets_wechat_notify_requested(client):
    start_at = (now_utc() + timedelta(hours=2)).isoformat()
    response = client.post(
        "/v1/calendar/events",
        json={"title": "小程序日程", "startAt": start_at},
        headers={"X-Client-Source": "miniapp"},
    )
    assert response.status_code == 201
    event = response.json()["data"]["calendarEvent"]
    assert event["wechatNotifyRequested"] is True
    assert event["wechatNotifyStatus"] == "none"


def test_cli_create_does_not_set_wechat_notify_requested(client):
    start_at = (now_utc() + timedelta(hours=2)).isoformat()
    response = client.post(
        "/v1/calendar/events",
        json={"title": "CLI 日程", "startAt": start_at},
        headers={"X-Client-Source": "cli"},
    )
    assert response.status_code == 201
    event = response.json()["data"]["calendarEvent"]
    assert event["wechatNotifyRequested"] is False
    assert event["wechatNotifyStatus"] == "none"


def test_create_calendar_event_explicit_notify_choice_overrides_client_default(client):
    start_at = (now_utc() + timedelta(hours=2)).isoformat()
    miniapp_response = client.post(
        "/v1/calendar/events",
        json={"title": "显式关闭日程提醒", "startAt": start_at, "wechatNotifyRequested": False},
        headers={"X-Client-Source": "miniapp"},
    )
    assert miniapp_response.status_code == 201
    assert miniapp_response.json()["data"]["calendarEvent"]["wechatNotifyRequested"] is False

    cli_response = client.post(
        "/v1/calendar/events",
        json={"title": "显式开启日程提醒", "startAt": start_at, "wechatNotifyRequested": True},
        headers={"X-Client-Source": "cli"},
    )
    assert cli_response.status_code == 201
    assert cli_response.json()["data"]["calendarEvent"]["wechatNotifyRequested"] is True


def test_miniapp_create_reminder_sets_wechat_notify_requested(client):
    due_at = (now_utc() + timedelta(hours=2)).isoformat()
    response = client.post(
        "/v1/reminders",
        json={"title": "小程序提醒", "dueAt": due_at},
        headers={"X-Client-Source": "miniapp"},
    )
    assert response.status_code == 201
    reminder = response.json()["data"]["reminder"]
    assert reminder["wechatNotifyRequested"] is True
    assert reminder["wechatNotifyStatus"] == "none"


def test_cli_create_reminder_does_not_set_wechat_notify_requested(client):
    due_at = (now_utc() + timedelta(hours=2)).isoformat()
    response = client.post(
        "/v1/reminders",
        json={"title": "CLI 提醒", "dueAt": due_at},
        headers={"X-Client-Source": "cli"},
    )
    assert response.status_code == 201
    reminder = response.json()["data"]["reminder"]
    assert reminder["wechatNotifyRequested"] is False
    assert reminder["wechatNotifyStatus"] == "none"


def test_create_reminder_explicit_notify_choice_overrides_client_default(client):
    due_at = (now_utc() + timedelta(hours=2)).isoformat()
    miniapp_response = client.post(
        "/v1/reminders",
        json={"title": "显式关闭提醒", "dueAt": due_at, "wechatNotifyRequested": False},
        headers={"X-Client-Source": "miniapp"},
    )
    assert miniapp_response.status_code == 201
    assert miniapp_response.json()["data"]["reminder"]["wechatNotifyRequested"] is False

    cli_response = client.post(
        "/v1/reminders",
        json={"title": "显式开启提醒", "dueAt": due_at, "wechatNotifyRequested": True},
        headers={"X-Client-Source": "cli"},
    )
    assert cli_response.status_code == 201
    assert cli_response.json()["data"]["reminder"]["wechatNotifyRequested"] is True


def test_calendar_summary_reflects_pending_delivery_after_subscription(client):
    start_at = (now_utc() + timedelta(hours=2)).isoformat()
    create_response = client.post(
        "/v1/calendar/events",
        json={"title": "订阅日程", "startAt": start_at},
        headers={"X-Client-Source": "miniapp"},
    )
    event_id = create_response.json()["data"]["calendarEvent"]["id"]

    client.post(
        "/v1/notifications/wechat/subscription-result",
        json={
            "templateKey": "calendar_event_start",
            "templateId": "tmpl_calendar",
            "result": "accept",
            "targetType": "calendar_event",
            "targetId": event_id,
        },
    )

    detail = client.get(f"/v1/calendar/events/{event_id}")
    event = detail.json()["data"]["calendarEvent"]
    assert event["wechatNotifyStatus"] == "pending"


def test_patch_wechat_notify_requested_on_calendar_event(client):
    start_at = (now_utc() + timedelta(hours=2)).isoformat()
    create_response = client.post(
        "/v1/calendar/events",
        json={"title": "可开启提醒", "startAt": start_at},
        headers={"X-Client-Source": "cli"},
    )
    event_id = create_response.json()["data"]["calendarEvent"]["id"]

    patch_response = client.patch(
        f"/v1/calendar/events/{event_id}",
        json={"wechatNotifyRequested": True},
        headers={"X-Client-Source": "miniapp"},
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["data"]["calendarEvent"]["wechatNotifyRequested"] is True
