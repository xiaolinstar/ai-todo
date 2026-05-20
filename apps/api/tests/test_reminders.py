from fastapi.testclient import TestClient


def test_create_complete_and_today_flow(client: TestClient) -> None:
    create_response = client.post("/v1/reminders", json={"title": "测试提醒"})

    assert create_response.status_code == 201
    create_body = create_response.json()
    reminder = create_body["data"]["reminder"]
    assert reminder["title"] == "测试提醒"
    assert reminder["status"] == "pending"

    today_response = client.get("/v1/today")
    assert today_response.status_code == 200
    today_body = today_response.json()["data"]
    assert today_body["timezone"] == "Asia/Shanghai"
    assert any(item["id"] == reminder["id"] for item in today_body["reminders"])

    complete_response = client.post(f"/v1/reminders/{reminder['id']}/complete")

    assert complete_response.status_code == 200
    completed = complete_response.json()["data"]["reminder"]
    assert completed["status"] == "completed"
    assert completed["completedAt"]

    today_after_complete = client.get("/v1/today")
    assert not any(
        item["id"] == reminder["id"] for item in today_after_complete.json()["data"]["reminders"]
    )
