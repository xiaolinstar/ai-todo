from ai_todo_api.observability import inject_correlation_ids
from fastapi.testclient import TestClient


def test_inject_adds_request_id_and_trace_id_to_success_envelope() -> None:
    payload = {"ok": True, "data": {"status": "ok"}}
    result = inject_correlation_ids(payload, "req_abc123")
    assert result["requestId"] == "req_abc123"
    assert result["traceId"] == "req_abc123"
    assert result["data"] == {"status": "ok"}


def test_inject_adds_ids_to_error_envelope() -> None:
    payload = {"ok": False, "error": {"code": "UNAUTHORIZED", "message": "missing token"}}
    result = inject_correlation_ids(payload, "req_err456")
    assert result["requestId"] == "req_err456"
    assert result["traceId"] == "req_err456"
    assert result["error"]["code"] == "UNAUTHORIZED"


def test_inject_does_not_overwrite_existing_ids() -> None:
    payload = {"ok": True, "data": {}, "requestId": "req_keep", "traceId": "trace_keep"}
    result = inject_correlation_ids(payload, "req_new")
    assert result["requestId"] == "req_keep"
    assert result["traceId"] == "trace_keep"


def test_inject_fills_missing_trace_id_when_request_id_present() -> None:
    payload = {"ok": True, "data": {}, "requestId": "req_only"}
    result = inject_correlation_ids(payload, "req_fallback")
    assert result["requestId"] == "req_only"
    assert result["traceId"] == "req_only"


def test_inject_no_op_for_non_dict() -> None:
    assert inject_correlation_ids([], "req_x") == []  # type: ignore[arg-type]


def test_health_json_body_includes_correlation_ids(client: TestClient) -> None:
    response = client.get("/v1/health", headers={"X-Request-ID": "req_health_body_1"})
    assert response.status_code == 200
    body = response.json()
    assert response.headers["X-Request-ID"] == "req_health_body_1"
    assert body["requestId"] == "req_health_body_1"
    assert body["traceId"] == "req_health_body_1"


def test_unauthorized_error_body_includes_correlation_ids(client: TestClient) -> None:
    response = client.post(
        "/v1/api-tokens",
        json={"name": "no-auth", "scopes": ["read"]},
        headers={"X-Request-ID": "req_unauth_body_1"},
    )
    assert response.status_code == 401
    body = response.json()
    assert body["ok"] is False
    assert body["error"]["code"] == "UNAUTHORIZED"
    assert response.headers["X-Request-ID"] == "req_unauth_body_1"
    assert body["requestId"] == "req_unauth_body_1"
    assert body["traceId"] == "req_unauth_body_1"


def test_validation_error_body_includes_correlation_ids(client: TestClient) -> None:
    response = client.post("/v1/auth/wechat/login", json={}, headers={"X-Request-ID": "req_val_body_1"})
    assert response.status_code == 422
    body = response.json()
    assert body["ok"] is False
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert body["requestId"] == "req_val_body_1"
    assert body["traceId"] == "req_val_body_1"
