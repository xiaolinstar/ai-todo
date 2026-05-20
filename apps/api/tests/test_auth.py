from fastapi.testclient import TestClient


def test_me_returns_dev_user(client: TestClient) -> None:
    response = client.get("/v1/me")

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    user = body["data"]["user"]
    assert user["id"] == "user_dev"
    assert user["displayName"] == "开发用户"
    assert user["timezone"] == "Asia/Shanghai"
