from fastapi.testclient import TestClient

from ai_todo_api.common.time import now_utc, today_in_timezone
from ai_todo_api.config import settings
from ai_todo_api.db.models import CalendarEventModel, UserModel
from tests.conftest import TestingSessionLocal


def test_calendar_events_are_scoped_to_dev_user(client: TestClient) -> None:
    today = today_in_timezone(settings.timezone)
    create_response = client.post(
        "/v1/calendar/events",
        json={
            "title": "我的会议",
            "startAt": f"{today}T10:00:00+08:00",
        },
    )
    assert create_response.status_code == 201
    event_id = create_response.json()["data"]["calendarEvent"]["id"]

    with TestingSessionLocal() as session:
        other_user = UserModel(
            id="user_other_cal",
            display_name="其他用户",
            timezone="Asia/Shanghai",
            created_at=now_utc(),
            updated_at=now_utc(),
        )
        session.add(other_user)
        session.add(
            CalendarEventModel(
                id="evt_other",
                user_id=other_user.id,
                title="别人的会议",
                start_at=f"{today}T11:00:00+08:00",
                timezone="Asia/Shanghai",
                source="api",
                created_at=now_utc(),
                updated_at=now_utc(),
            )
        )
        session.commit()

    today_response = client.get("/v1/calendar/today")
    ids = {item["id"] for item in today_response.json()["data"]["items"]}
    assert event_id in ids
    assert "evt_other" not in ids

    detail_response = client.get("/v1/calendar/events/evt_other")
    assert detail_response.status_code == 404
