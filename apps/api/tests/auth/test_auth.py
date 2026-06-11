from fastapi.testclient import TestClient


def test_me_returns_dev_user(client: TestClient) -> None:
    response = client.get("/v1/me")

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    user = body["data"]["user"]
    assert user["id"] == "user_dev"
    assert user["displayName"] == "开发用户"
    assert user["avatarUrl"] is None
    assert user["timezone"] == "Asia/Shanghai"


def test_update_profile(client: TestClient) -> None:
    response = client.patch(
        "/v1/me/profile",
        json={"displayName": "小林", "avatarUrl": "wxfile://avatar"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    user = body["data"]["user"]
    assert user["id"] == "user_dev"
    assert user["displayName"] == "小林"
    assert user["avatarUrl"] == "wxfile://avatar"

    me_response = client.get("/v1/me")
    me_user = me_response.json()["data"]["user"]
    assert me_user["displayName"] == "小林"
    assert me_user["avatarUrl"] == "wxfile://avatar"

    noop = client.patch(
        "/v1/me/profile",
        json={"displayName": "小林", "avatarUrl": ""},
    )
    assert noop.status_code == 200
    assert noop.json()["data"]["user"]["avatarUrl"] == "wxfile://avatar"

    cleared = client.patch(
        "/v1/me/profile",
        json={"displayName": "开发用户", "clearAvatar": True},
    )
    assert cleared.status_code == 200
    assert cleared.json()["data"]["user"]["avatarUrl"] is None
