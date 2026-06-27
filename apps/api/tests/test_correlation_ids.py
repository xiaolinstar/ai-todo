from ai_todo_api.observability import inject_correlation_ids


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
