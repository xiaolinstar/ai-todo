from fastapi.testclient import TestClient


def test_create_search_and_show_contact(client: TestClient) -> None:
    create_response = client.post(
        "/v1/contacts",
        json={
            "displayName": "邢小林",
            "company": "示例科技",
            "methods": [
                {
                    "type": "email",
                    "label": "work",
                    "value": "Wang@example.com",
                    "isPrimary": True,
                }
            ],
            "aliases": ["客户王总"],
        },
    )

    assert create_response.status_code == 201
    contact = create_response.json()["data"]["contact"]
    assert contact["displayName"] == "邢小林"
    assert contact["handle"] == "xingxiaolin"
    assert contact["handleSource"] == "generated"
    assert contact["primaryEmail"] == "Wang@example.com"
    assert contact["aliases"] == ["客户王总"]

    search_response = client.get("/v1/contacts?q=客户王总")

    assert search_response.status_code == 200
    items = search_response.json()["data"]["items"]
    assert items[0]["handle"]
    assert any(item["id"] == contact["id"] for item in items)

    detail_response = client.get(f"/v1/contacts/{contact['handle']}")

    assert detail_response.status_code == 200
    detail = detail_response.json()["data"]["contact"]
    assert detail["id"] == contact["id"]
    assert detail["methods"][0]["type"] == "email"


def test_generated_contact_handles_are_unique_per_user(client: TestClient) -> None:
    first_response = client.post("/v1/contacts", json={"displayName": "Handle Seed Unique"})
    second_response = client.post("/v1/contacts", json={"displayName": "Handle Seed Unique"})

    assert first_response.status_code == 201
    assert second_response.status_code == 201
    assert first_response.json()["data"]["contact"]["handle"] == "handleseedunique"
    assert second_response.json()["data"]["contact"]["handle"] == "handleseedunique01"


def test_update_contact(client: TestClient) -> None:
    create_response = client.post(
        "/v1/contacts",
        json={"displayName": "张三", "methods": [{"type": "email", "value": "a@example.com"}]},
    )
    contact_id = create_response.json()["data"]["contact"]["id"]

    update_response = client.patch(
        f"/v1/contacts/{contact_id}",
        json={
            "displayName": "张三（客户）",
            "handle": "customer-zhang",
            "methods": [{"type": "email", "value": "zhang@example.com", "isPrimary": True}],
        },
    )

    assert update_response.status_code == 200
    updated = update_response.json()["data"]["contact"]
    assert updated["displayName"] == "张三（客户）"
    assert updated["handle"] == "customerzhang"
    assert updated["handleSource"] == "manual"
    assert updated["primaryEmail"] == "zhang@example.com"


def test_manual_contact_handle_must_be_unique(client: TestClient) -> None:
    first_response = client.post(
        "/v1/contacts",
        json={"displayName": "联系人 A", "handle": "vip"},
    )
    second_response = client.post(
        "/v1/contacts",
        json={"displayName": "联系人 B", "handle": "vip"},
    )

    assert first_response.status_code == 201
    assert second_response.status_code == 400
    assert second_response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_delete_contact_removes_it_from_list_and_show(client: TestClient) -> None:
    create_response = client.post(
        "/v1/contacts",
        json={"displayName": "可删除联系人", "handle": "delete-me"},
    )
    assert create_response.status_code == 201
    contact = create_response.json()["data"]["contact"]

    delete_response = client.delete(f"/v1/contacts/{contact['id']}")
    assert delete_response.status_code == 200
    assert delete_response.json()["data"]["deleted"] is True


def test_contact_search_matches_normalized_handle(client: TestClient) -> None:
    create_response = client.post(
        "/v1/contacts",
        json={"displayName": "Codex CLI Test", "handle": "codex-cli-test"},
    )
    assert create_response.status_code == 201
    contact = create_response.json()["data"]["contact"]
    assert contact["handle"] == "codexclitest"

    search_response = client.get("/v1/contacts", params={"q": "codex-cli"})
    assert search_response.status_code == 200
    items = search_response.json()["data"]["items"]
    assert any(item["id"] == contact["id"] for item in items)


def test_contact_list_returns_all_contacts_without_limit(client: TestClient) -> None:
    for index in range(25):
        response = client.post(
            "/v1/contacts",
            json={"displayName": f"联系人 {index:02d}"},
        )
        assert response.status_code == 201

    list_response = client.get("/v1/contacts")
    assert list_response.status_code == 200
    body = list_response.json()["data"]
    assert body["totalCount"] >= 25
    assert len(body["items"]) == body["totalCount"]
    assert body["hasMore"] is False
    assert body["nextCursor"] is None


def test_contact_list_supports_cursor_pagination(client: TestClient) -> None:
    for index in range(5):
        response = client.post(
            "/v1/contacts",
            json={"displayName": f"分页联系人 {index}"},
        )
        assert response.status_code == 201

    first_page = client.get("/v1/contacts", params={"limit": 2})
    assert first_page.status_code == 200
    first_body = first_page.json()["data"]
    assert len(first_body["items"]) == 2
    assert first_body["totalCount"] >= 5
    assert first_body["hasMore"] is True
    assert first_body["nextCursor"]

    second_page = client.get(
        "/v1/contacts",
        params={"limit": 2, "cursor": first_body["nextCursor"]},
    )
    assert second_page.status_code == 200
    second_body = second_page.json()["data"]
    assert len(second_body["items"]) == 2
    first_ids = {item["id"] for item in first_body["items"]}
    second_ids = {item["id"] for item in second_body["items"]}
    assert first_ids.isdisjoint(second_ids)


def test_contact_list_rejects_invalid_cursor(client: TestClient) -> None:
    response = client.get("/v1/contacts", params={"limit": 10, "cursor": "not-a-cursor"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_CURSOR"
