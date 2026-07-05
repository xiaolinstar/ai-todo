from fastapi.testclient import TestClient


def test_create_reminder_with_tags_reuses_tag(client: TestClient) -> None:
    first = client.post(
        "/v1/reminders",
        json={"title": "客户报价", "tagNames": ["客户", "报价"]},
    )
    assert first.status_code == 201
    first_body = first.json()["data"]["reminder"]
    assert [tag["name"] for tag in first_body["tags"]] == ["客户", "报价"]
    assert first_body["tags"][0]["color"].startswith("#")

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
    client.post(
        "/v1/reminders",
        json={
            "title": f"Both tags {suffix}",
            "tagNames": [f"work-{suffix}", f"personal-{suffix}"],
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
    assert {item["title"] for item in by_tag.json()["data"]["items"]} == {
        f"Alpha task {suffix}",
        f"Both tags {suffix}",
    }

    by_tags = client.get(
        "/v1/reminders",
        params=[("tag", f"work-{suffix}"), ("tag", f"personal-{suffix}")],
    )
    assert by_tags.status_code == 200
    assert [item["title"] for item in by_tags.json()["data"]["items"]] == [f"Both tags {suffix}"]


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


def test_list_tags(client: TestClient, demo_suffix: str) -> None:
    tag_name = f"客户-{demo_suffix}"
    client.post("/v1/reminders", json={"title": "标签词表", "tagNames": [tag_name]})

    response = client.get("/v1/tags", params={"q": tag_name})
    assert response.status_code == 200
    items = response.json()["data"]["items"]
    customer = next(item for item in items if item["name"] == tag_name)
    assert customer["usageCount"] == 1
    assert customer["color"].startswith("#")
    assert customer["createdAt"]
    assert customer["updatedAt"]
    assert customer["lastUsedAt"]


def test_list_tags_sorting(client: TestClient, demo_suffix: str) -> None:
    popular = f"popular-{demo_suffix}"
    rare = f"rare-{demo_suffix}"
    client.post("/v1/reminders", json={"title": "常用 1", "tagNames": [popular]})
    client.post("/v1/reminders", json={"title": "常用 2", "tagNames": [popular]})
    client.post("/v1/reminders", json={"title": "低频", "tagNames": [rare]})

    by_usage = client.get("/v1/tags", params={"q": demo_suffix, "sort": "usage"})
    assert by_usage.status_code == 200
    names = [item["name"] for item in by_usage.json()["data"]["items"]]
    assert names.index(popular) < names.index(rare)

    by_name = client.get("/v1/tags", params={"q": demo_suffix, "sort": "name"})
    assert by_name.status_code == 200
    assert [item["name"] for item in by_name.json()["data"]["items"]] == sorted(names)


def test_manage_tag_name_color_and_delete(client: TestClient) -> None:
    create_response = client.post("/v1/tags", json={"name": "重要", "color": "#FF9500"})
    assert create_response.status_code == 201
    tag = create_response.json()["data"]["tag"]
    assert tag["name"] == "重要"
    assert tag["color"] == "#FF9500"
    assert tag["usageCount"] == 0

    update_response = client.patch(
        f"/v1/tags/{tag['id']}",
        json={"name": "高优先级", "color": "#FF3B30"},
    )
    assert update_response.status_code == 200
    updated = update_response.json()["data"]["tag"]
    assert updated["name"] == "高优先级"
    assert updated["color"] == "#FF3B30"

    delete_response = client.delete(f"/v1/tags/{tag['id']}")
    assert delete_response.status_code == 200
    assert delete_response.json()["data"]["deleted"] is True


def test_tag_limits(client: TestClient) -> None:
    response = client.post(
        "/v1/reminders",
        json={"title": "标签过多", "tagNames": ["a", "b", "c", "d", "e", "f"]},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VAL_INVALID_INPUT"


def test_user_tag_limit(client: TestClient) -> None:
    existing = client.get("/v1/tags", params={"limit": 200})
    assert existing.status_code == 200
    for tag in existing.json()["data"]["items"]:
        delete_response = client.delete(f"/v1/tags/{tag['id']}")
        assert delete_response.status_code == 200

    for index in range(50):
        response = client.post("/v1/tags", json={"name": f"标签-{index}"})
        assert response.status_code == 201

    overflow = client.post("/v1/tags", json={"name": "第五十一个"})
    assert overflow.status_code == 400
    assert overflow.json()["error"]["code"] == "VAL_INVALID_INPUT"


def test_rejects_unsupported_tag_color(client: TestClient) -> None:
    response = client.post("/v1/tags", json={"name": "奇怪颜色", "color": "#123456"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VAL_INVALID_INPUT"
