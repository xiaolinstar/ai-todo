from fastapi.testclient import TestClient


def test_health_includes_deploy_metadata(client: TestClient) -> None:
    response = client.get("/v1/health")

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["data"]["service"] == "ai-todo-api"
    assert body["data"]["status"] == "ok"
    assert body["data"]["apiVersion"] == "0.2.2"
    assert "releaseTag" in body["data"]
    assert "gitSha" in body["data"]


def test_root_preview_includes_cli_onboarding(client: TestClient) -> None:
    response = client.get("/")

    assert response.status_code == 200
    html = response.text
    assert "npm install -g @xiaolinstar/ai-todo-cli" in html
    assert "~/.ai-todo/settings.json" in html
    assert "ai-todo whoami" in html
    assert "@ai-todo/cli" not in html
    assert "ai-todo login" not in html
