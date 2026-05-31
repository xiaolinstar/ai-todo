from fastapi.testclient import TestClient

from ai_todo_api.common.time import now_utc
from ai_todo_api.db.models import ReminderModel, UserModel
from tests.conftest import TestingSessionLocal


def test_reminders_are_scoped_to_dev_user(client: TestClient) -> None:
    create_response = client.post("/v1/reminders", json={"title": "我的提醒"})
    assert create_response.status_code == 201
    reminder_id = create_response.json()["data"]["reminder"]["id"]

    with TestingSessionLocal() as session:
        other_user = UserModel(
            id="user_other",
            display_name="其他用户",
            timezone="Asia/Shanghai",
            created_at=now_utc(),
            updated_at=now_utc(),
        )
        session.add(other_user)
        session.add(
            ReminderModel(
                id="rem_other",
                user_id=other_user.id,
                title="别人的提醒",
                status="pending",
                created_at=now_utc(),
                updated_at=now_utc(),
            )
        )
        session.commit()

    today_response = client.get("/v1/today")
    assert today_response.status_code == 200
    reminders = today_response.json()["data"]["reminders"]
    ids = {item["id"] for item in reminders}
    assert reminder_id in ids
    assert "rem_other" not in ids

    complete_response = client.post("/v1/reminders/rem_other/complete")
    assert complete_response.status_code == 404
