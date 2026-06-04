from fastapi.testclient import TestClient


def test_update_profile_timezone(client: TestClient) -> None:
    response = client.patch(
        "/v1/me/profile",
        json={"timezone": "America/New_York"},
    )

    assert response.status_code == 200
    user = response.json()["data"]["user"]
    assert user["timezone"] == "America/New_York"

    today = client.get("/v1/today")
    assert today.json()["data"]["timezone"] == "America/New_York"

    client.patch("/v1/me/profile", json={"timezone": "Asia/Shanghai"})
