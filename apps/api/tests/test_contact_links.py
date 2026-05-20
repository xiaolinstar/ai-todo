from fastapi.testclient import TestClient


def _create_contact(client: TestClient, *, name: str = "小明", email: str = "xiaoming@example.com") -> str:
    response = client.post(
        "/v1/contacts",
        json={
            "displayName": name,
            "methods": [{"type": "email", "value": email, "isPrimary": True}],
        },
    )
    assert response.status_code == 201
    return response.json()["data"]["contact"]["id"]


def test_reminder_create_with_contact_and_today_includes_contacts(client: TestClient) -> None:
    contact_id = _create_contact(client)

    create_response = client.post(
        "/v1/reminders",
        json={
            "title": "联系小明完成作业",
            "dueAt": "2026-05-20T18:00:00+08:00",
            "contactIds": [contact_id],
        },
    )
    assert create_response.status_code == 201
    reminder = create_response.json()["data"]["reminder"]
    assert reminder["contacts"][0]["id"] == contact_id
    assert reminder["contacts"][0]["displayName"] == "小明"
    assert reminder["contacts"][0]["primaryEmail"] == "xiaoming@example.com"

    today_response = client.get("/v1/today")
    assert today_response.status_code == 200
    today_reminder = next(
        item for item in today_response.json()["data"]["reminders"] if item["id"] == reminder["id"]
    )
    assert today_reminder["contacts"][0]["id"] == contact_id


def test_reminder_update_replaces_contacts(client: TestClient) -> None:
    first_id = _create_contact(client, name="小明", email="a@example.com")
    second_id = _create_contact(client, name="小红", email="b@example.com")

    create_response = client.post(
        "/v1/reminders",
        json={"title": "跟进作业", "contactIds": [first_id]},
    )
    reminder_id = create_response.json()["data"]["reminder"]["id"]

    update_response = client.patch(
        f"/v1/reminders/{reminder_id}",
        json={"contactIds": [second_id]},
    )
    assert update_response.status_code == 200
    contacts = update_response.json()["data"]["reminder"]["contacts"]
    assert len(contacts) == 1
    assert contacts[0]["id"] == second_id
    assert contacts[0]["displayName"] == "小红"


def test_reminder_create_with_unknown_contact_returns_404(client: TestClient) -> None:
    response = client.post(
        "/v1/reminders",
        json={"title": "无效联系人", "contactIds": ["ct_missing"]},
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "CONTACT_NOT_FOUND"


def test_calendar_event_with_contact(client: TestClient) -> None:
    contact_id = _create_contact(client, name="王总", email="wang@example.com")

    response = client.post(
        "/v1/calendar/events",
        json={
            "title": "与王总开会",
            "startAt": "2026-05-21T10:00:00+08:00",
            "contactIds": [contact_id],
        },
    )
    assert response.status_code == 201
    event = response.json()["data"]["calendarEvent"]
    assert event["contacts"][0]["id"] == contact_id
    assert event["contacts"][0]["displayName"] == "王总"
