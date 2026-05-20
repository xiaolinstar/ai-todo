from fastapi.testclient import TestClient


def test_create_search_and_show_contact(client: TestClient) -> None:
    create_response = client.post(
        "/v1/contacts",
        json={
            "displayName": "王总",
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
    assert contact["displayName"] == "王总"
    assert contact["primaryEmail"] == "Wang@example.com"
    assert contact["aliases"] == ["客户王总"]

    search_response = client.get("/v1/contacts?q=客户王总")

    assert search_response.status_code == 200
    items = search_response.json()["data"]["items"]
    assert any(item["id"] == contact["id"] for item in items)

    detail_response = client.get(f"/v1/contacts/{contact['id']}")

    assert detail_response.status_code == 200
    detail = detail_response.json()["data"]["contact"]
    assert detail["id"] == contact["id"]
    assert detail["methods"][0]["type"] == "email"
