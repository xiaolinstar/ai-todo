from fastapi.testclient import TestClient


def test_health_includes_deploy_metadata(client: TestClient) -> None:
    response = client.get("/v1/health")

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["data"]["service"] == "ai-todo-api"
    assert body["data"]["status"] == "ok"
    assert body["data"]["apiVersion"] == "0.1.3"
    assert "releaseTag" in body["data"]
    assert "gitSha" in body["data"]
