# API 响应体注入 requestId / traceId — Batch 0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让所有 JSON API 响应体（success + error）携带与 `X-Request-ID` header 一致的 `requestId` 和 `traceId`，闭合排障链路；**不改动**任何 `error.code` 字符串。

**Architecture:** 在现有 `observability.py` HTTP middleware 中，于 `call_next` 之后对 `application/json` 响应做 body 注入；抽取纯函数 `inject_correlation_ids` 便于单测。Header、结构化日志、响应体三者共用同一 `request_id` 值。客户端传入 `X-Request-ID` 时 echo 该值。

**Tech Stack:** FastAPI / Starlette middleware, pytest, Python 3.11

**Spec / 审计来源:** P0 只读审计（2026-06-27）；对齐 `~/AgentProjects/dev-standards/playbook/api-error-codes.md` §traceId / envelope 变体。

**Out of scope（后续批次）:** 错误码前缀迁移（Batch 1–5）、`apps/api/src/ai_todo_api/errors.py` 集中枚举、dev-standards 文档 PR。

---

## File Structure

| 文件                                        | 职责                                                        |
| ------------------------------------------- | ----------------------------------------------------------- |
| `apps/api/src/ai_todo_api/observability.py` | 生成 `request_id`、注入 JSON body、写 header、打 access log |
| `apps/api/tests/test_correlation_ids.py`    | 纯函数单测 + 401/422 集成测                                 |
| `apps/api/tests/test_health.py`             | 扩展 health 成功路径 body 断言                              |
| `docs/api-design.md`                        | 示例改为 `requestId` + `traceId`，说明命名分层              |
| `docs/ops-observability.md`                 | 补充响应体字段说明                                          |

**不修改:** `main.py` exception handler、`schemas.py` 字段定义、各 router 的 `error.code` 字面量。

---

## 命名约定（实现时必须遵守）

| 层                | 字段名         | 说明                                                   |
| ----------------- | -------------- | ------------------------------------------------------ |
| Python Pydantic   | `request_id`   | snake_case，不变                                       |
| JSON wire         | `requestId`    | CamelModel 序列化惯例                                  |
| JSON wire（新增） | `traceId`      | 与 `requestId` **同值**，对齐 dev-standards 跨项目语义 |
| HTTP header       | `X-Request-ID` | 已有，保持不变                                         |
| 结构化 log        | `requestId`    | 已有，保持不变                                         |

---

### Task 1: 纯函数 `inject_correlation_ids`

**Files:**

- Create: `apps/api/tests/test_correlation_ids.py`
- Modify: `apps/api/src/ai_todo_api/observability.py`（仅新增函数，暂不改 middleware）

- [ ] **Step 1: Write the failing unit tests**

Create `apps/api/tests/test_correlation_ids.py`:

```python
from ai_todo_api.observability import inject_correlation_ids


def test_inject_adds_request_id_and_trace_id_to_success_envelope() -> None:
    payload = {"ok": True, "data": {"status": "ok"}}
    result = inject_correlation_ids(payload, "req_abc123")
    assert result["requestId"] == "req_abc123"
    assert result["traceId"] == "req_abc123"
    assert result["data"] == {"status": "ok"}


def test_inject_adds_ids_to_error_envelope() -> None:
    payload = {
        "ok": False,
        "error": {"code": "UNAUTHORIZED", "message": "missing token"},
    }
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd apps/api && .venv/bin/python -m pytest tests/test_correlation_ids.py -v
```

Expected: FAIL — `ImportError: cannot import name 'inject_correlation_ids'`

- [ ] **Step 3: Implement minimal pure function**

Add to `apps/api/src/ai_todo_api/observability.py` (above `install_observability`):

```python
def resolve_request_id(request: Request) -> str:
    incoming = request.headers.get("x-request-id")
    if incoming:
        return incoming
    return f"req_{uuid4().hex[:16]}"


def inject_correlation_ids(payload: object, request_id: str) -> object:
    if not isinstance(payload, dict):
        return payload
    result = dict(payload)
    if not result.get("requestId") and not result.get("request_id"):
        result["requestId"] = request_id
    trace_source = result.get("traceId") or result.get("requestId") or result.get("request_id") or request_id
    if not result.get("traceId"):
        result["traceId"] = trace_source
    return result
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd apps/api && .venv/bin/python -m pytest tests/test_correlation_ids.py -v
```

Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ai_todo_api/observability.py apps/api/tests/test_correlation_ids.py
git commit -m "$(cat <<'EOF'
feat(api): add inject_correlation_ids helper for response bodies

Pure function to attach requestId and traceId to JSON envelopes without changing error codes.
EOF
)"
```

---

### Task 2: Middleware JSON body 注入

**Files:**

- Modify: `apps/api/src/ai_todo_api/observability.py`（`request_observability` middleware）
- Test: `apps/api/tests/test_correlation_ids.py`（新增集成测）

- [ ] **Step 1: Write failing integration tests**

Append to `apps/api/tests/test_correlation_ids.py`:

```python
from fastapi.testclient import TestClient


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
```

- [ ] **Step 2: Run integration tests to verify they fail**

Run:

```bash
cd apps/api && .venv/bin/python -m pytest tests/test_correlation_ids.py::test_health_json_body_includes_correlation_ids -v
```

Expected: FAIL — `KeyError: 'requestId'` or assertion on missing key

- [ ] **Step 3: Implement JSON response injection in middleware**

Add helper (same file):

```python
async def _inject_correlation_ids_into_json_response(
    response: Response,
    request_id: str,
) -> Response:
    content_type = response.headers.get("content-type", "")
    if not content_type.startswith("application/json"):
        response.headers["X-Request-ID"] = request_id
        return response

    body = b""
    async for chunk in response.body_iterator:
        body += chunk

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        headers = dict(response.headers)
        headers["X-Request-ID"] = request_id
        return Response(
            content=body,
            status_code=response.status_code,
            headers=headers,
            media_type=response.media_type,
        )

    enriched = inject_correlation_ids(payload, request_id)
    encoded = json.dumps(enriched, ensure_ascii=False, separators=(",", ":")).encode()

    headers = {
        key: value
        for key, value in response.headers.items()
        if key.lower() != "content-length"
    }
    headers["X-Request-ID"] = request_id

    return Response(
        content=encoded,
        status_code=response.status_code,
        headers=headers,
        media_type="application/json",
    )
```

Replace `request_observability` body with:

```python
    @app.middleware("http")
    async def request_observability(
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        request_id = resolve_request_id(request)
        request.state.request_id = request_id
        start = time.perf_counter()
        status_code = 500
        response: Response | None = None
        try:
            response = await call_next(request)
            status_code = response.status_code
            response = await _inject_correlation_ids_into_json_response(response, request_id)
            return response
        finally:
            duration = time.perf_counter() - start
            route_path = _route_path(request)
            if settings.metrics_enabled and route_path != settings.metrics_path:
                metrics_registry.observe_request(
                    method=request.method,
                    path=route_path,
                    status_code=status_code,
                    duration=duration,
                )
            if settings.structured_logs_enabled:
                logger.info(
                    "http_request",
                    extra={
                        "extra_fields": {
                            "requestId": request_id,
                            "method": request.method,
                            "path": route_path,
                            "status": status_code,
                            "durationMs": round(duration * 1000, 2),
                            "client": request.headers.get("user-agent", ""),
                        }
                    },
                )
```

Remove the old `finally` block lines that set `response.headers["X-Request-ID"]` (header now set inside `_inject_correlation_ids_into_json_response`).

- [ ] **Step 4: Run all correlation id tests**

Run:

```bash
cd apps/api && .venv/bin/python -m pytest tests/test_correlation_ids.py -v
```

Expected: 8 passed

- [ ] **Step 5: Run full API test suite**

Run:

```bash
pnpm test:api
```

Expected: all tests pass (87+ tests)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/ai_todo_api/observability.py apps/api/tests/test_correlation_ids.py
git commit -m "$(cat <<'EOF'
feat(api): inject requestId and traceId into JSON response bodies

Middleware enriches all JSON envelopes; header and body share the same correlation id.
EOF
)"
```

---

### Task 3: 更新既有 health 测试

**Files:**

- Modify: `apps/api/tests/test_health.py`

- [ ] **Step 1: Extend existing header test**

Replace `test_response_includes_request_id` with:

```python
def test_response_includes_request_id(client: TestClient) -> None:
    response = client.get("/v1/health", headers={"X-Request-ID": "req_test_123"})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "req_test_123"
    body = response.json()
    assert body["requestId"] == "req_test_123"
    assert body["traceId"] == "req_test_123"
```

- [ ] **Step 2: Run health tests**

Run:

```bash
cd apps/api && .venv/bin/python -m pytest tests/test_health.py -v
```

Expected: all passed

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/test_health.py
git commit -m "$(cat <<'EOF'
test(api): assert requestId and traceId in health response body
EOF
)"
```

---

### Task 4: 文档对齐

**Files:**

- Modify: `docs/api-design.md`
- Modify: `docs/ops-observability.md`

- [ ] **Step 1: Update api-design.md unified response examples**

In `docs/api-design.md` §统一响应，将 success / error 示例改为：

```json
{
  "ok": true,
  "data": {},
  "requestId": "req_123",
  "traceId": "req_123"
}
```

```json
{
  "ok": false,
  "error": {
    "code": "CONTACT_AMBIGUOUS",
    "message": "Multiple contacts matched this name.",
    "details": {}
  },
  "requestId": "req_123",
  "traceId": "req_123"
}
```

在 §统一响应 下追加一段（≤5 行）：

```markdown
**关联 ID 命名：** Python 模型字段为 `request_id`；JSON wire 为 camelCase 的 `requestId` 与 `traceId`（同值）；HTTP header 为 `X-Request-ID`。与 `~/AgentProjects/dev-standards/playbook/api-error-codes.md` §traceId 对齐。
```

- [ ] **Step 2: Update ops-observability.md**

在 §结构化日志 段落后追加：

```markdown
JSON API 响应体（`/v1/*`）同样携带 `requestId` 与 `traceId`（与 `X-Request-ID` 同值），便于客户端报错时直接提供排障 ID。
```

- [ ] **Step 3: Commit**

```bash
git add docs/api-design.md docs/ops-observability.md
git commit -m "$(cat <<'EOF'
docs(api): document requestId and traceId in JSON response bodies
EOF
)"
```

---

### Task 5: 验收清单

- [ ] `pnpm test:api` exit 0
- [ ] 手动 smoke：`curl -s -H 'X-Request-ID: req_manual_1' http://127.0.0.1:3100/v1/health | jq '.requestId,.traceId'`
- [ ] 确认 `/metrics`、HTML `/` 响应**不被**注入 JSON 字段（content-type 非 JSON）
- [ ] 确认未改动任何 `error.code` 字符串（`git diff main -- apps/api/src | rg 'code='` 无新增字面量变更）

---

## Self-Review

| Spec 要求                 | 对应 Task                                 |
| ------------------------- | ----------------------------------------- |
| success body 有 requestId | Task 2 integration test health            |
| error body 有 requestId   | Task 2 integration test 401 + 422         |
| traceId 同值              | Task 1 unit tests + all integration tests |
| header 与 body 一致       | All integration tests                     |
| 不改 error.code           | Out of scope + Task 5 checklist           |
| 客户端 X-Request-ID echo  | Task 2 `req_health_body_1` 等             |
| 文档命名分层              | Task 4                                    |

无 TBD / 占位符。类型名 `requestId` / `traceId` 全文一致。

---

## 执行方式

Plan 已保存至 `docs/plans/2026-06-27-api-request-id-body-batch0.md`。

**两种执行选项：**

1. **Subagent-Driven（推荐）** — 每个 Task 派生子 agent，Task 间人工/Agent 复核
2. **Inline Execution** — 本会话按 Task 1→5 顺序直接改代码

你想用哪种方式开始实施？
