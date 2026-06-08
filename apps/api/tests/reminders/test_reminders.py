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


def test_source_external_id_create_lookup_and_list(client: TestClient) -> None:
    payload = {
        "title": "处理邮件待办",
        "source": "email_test",
        "externalId": "mail-50020378",
        "sourceMeta": {
            "from": "ops@example.com",
            "subject": "需要确认",
        },
    }

    create_response = client.post("/v1/reminders", json=payload)

    assert create_response.status_code == 201
    created = create_response.json()["data"]
    reminder = created["reminder"]
    assert created["created"] is True
    assert reminder["source"] == "email_test"
    assert reminder["externalId"] == "mail-50020378"
    assert reminder["sourceMeta"]["subject"] == "需要确认"

    duplicate_response = client.post(
        "/v1/reminders",
        json={**payload, "title": "重复扫描的邮件待办"},
    )

    assert duplicate_response.status_code == 200
    duplicate = duplicate_response.json()["data"]
    assert duplicate["created"] is False
    assert duplicate["reminder"]["id"] == reminder["id"]
    assert duplicate["reminder"]["title"] == "处理邮件待办"

    lookup_response = client.get(
        "/v1/reminders/lookup",
        params={"source": "email_test", "externalId": "mail-50020378"},
    )

    assert lookup_response.status_code == 200
    assert lookup_response.json()["data"]["reminder"]["id"] == reminder["id"]

    client.post(
        "/v1/reminders",
        json={"title": "手动待办", "source": "manual"},
    )
    list_response = client.get("/v1/reminders", params={"source": "email_test"})

    assert list_response.status_code == 200
    items = list_response.json()["data"]["items"]
    assert [item["id"] for item in items] == [reminder["id"]]


def test_lookup_requires_valid_source_and_external_id(client: TestClient) -> None:
    response = client.get(
        "/v1/reminders/lookup",
        params={"source": "bad source", "externalId": "123"},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
