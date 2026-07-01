from fastapi.testclient import TestClient


def test_create_reminder_with_tags_reuses_tag(client: TestClient) -> None:
    first = client.post(
        "/v1/reminders",
        json={"title": "客户报价", "tagNames": ["客户", "报价"]},
    )
    assert first.status_code == 201
    first_body = first.json()["data"]["reminder"]
    assert [tag["name"] for tag in first_body["tags"]] == ["客户", "报价"]

    second = client.post(
        "/v1/reminders",
        json={"title": "跟进报价", "tagNames": ["报价"]},
    )
    assert second.status_code == 201
    second_tags = second.json()["data"]["reminder"]["tags"]
    assert len(second_tags) == 1
    assert second_tags[0]["name"] == "报价"
    assert second_tags[0]["id"] == first_body["tags"][1]["id"]


def test_update_reminder_replaces_tags(client: TestClient) -> None:
    create_response = client.post(
        "/v1/reminders",
        json={"title": "测试标签", "tagNames": ["A", "B"]},
    )
    reminder_id = create_response.json()["data"]["reminder"]["id"]

    update_response = client.patch(
        f"/v1/reminders/{reminder_id}",
        json={"tagNames": ["B", "C"]},
    )
    assert update_response.status_code == 200
    tags = update_response.json()["data"]["reminder"]["tags"]
    assert [tag["name"] for tag in tags] == ["B", "C"]


def test_list_reminders_search_by_q_and_tag(client: TestClient) -> None:
    suffix = "srch7x9k"
    client.post(
        "/v1/reminders",
        json={"title": f"Alpha task {suffix}", "notes": "背景", "tagNames": [f"work-{suffix}"]},
    )
    client.post(
        "/v1/reminders",
        json={
            "title": f"Beta task {suffix}",
            "notes": f"包含报价关键字 {suffix}",
            "tagNames": [f"personal-{suffix}"],
        },
    )

    by_title = client.get("/v1/reminders", params={"q": f"Alpha task {suffix}"})
    assert by_title.status_code == 200
    assert len(by_title.json()["data"]["items"]) == 1
    assert by_title.json()["data"]["items"][0]["title"] == f"Alpha task {suffix}"

    by_notes = client.get("/v1/reminders", params={"q": f"报价关键字 {suffix}"})
    assert by_notes.status_code == 200
    assert len(by_notes.json()["data"]["items"]) == 1

    by_tag = client.get("/v1/reminders", params={"tag": f"work-{suffix}"})
    assert by_tag.status_code == 200
    assert len(by_tag.json()["data"]["items"]) == 1
    assert by_tag.json()["data"]["items"][0]["title"] == f"Alpha task {suffix}"


def test_add_track_entry(client: TestClient) -> None:
    create_response = client.post("/v1/reminders", json={"title": "跟踪测试"})
    reminder_id = create_response.json()["data"]["reminder"]["id"]

    add_response = client.post(
        f"/v1/reminders/{reminder_id}/track-entries",
        json={"text": "已联系客户"},
    )
    assert add_response.status_code == 200
    reminder = add_response.json()["data"]["reminder"]
    assert len(reminder["trackEntries"]) == 1
    entry = reminder["trackEntries"][0]
    assert entry["text"] == "已联系客户"
    assert len(entry["dateLabel"]) == 5
    assert entry["dateLabel"][2] == "-"


def test_add_track_entry_rejects_empty_and_long_text(client: TestClient) -> None:
    create_response = client.post("/v1/reminders", json={"title": "跟踪校验"})
    reminder_id = create_response.json()["data"]["reminder"]["id"]

    empty_response = client.post(
        f"/v1/reminders/{reminder_id}/track-entries",
        json={"text": "   "},
    )
    assert empty_response.status_code == 400

    long_response = client.post(
        f"/v1/reminders/{reminder_id}/track-entries",
        json={"text": "x" * 31},
    )
    assert long_response.status_code == 400


def test_list_tags(client: TestClient) -> None:
    client.post("/v1/reminders", json={"title": "标签词表", "tagNames": ["客户"]})

    response = client.get("/v1/tags", params={"q": "客"})
    assert response.status_code == 200
    items = response.json()["data"]["items"]
    assert any(item["name"] == "客户" for item in items)
