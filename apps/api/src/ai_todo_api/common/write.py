from collections.abc import Callable

from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ai_todo_api.audit.service import CommandLogService
from ai_todo_api.auth.context import AuthContext
from ai_todo_api.common.idempotency import IdempotencyConflictError, IdempotencyStore
from ai_todo_api.schemas import ApiError, ErrorResponse


def run_write(
    session: Session,
    auth: AuthContext,
    *,
    operation: str,
    idempotency_key: str | None,
    target_type: str | None,
    input_summary: dict | None,
    handler: Callable[[], JSONResponse],
    extract_target_ids: Callable[[dict], list[str]] | None = None,
) -> JSONResponse:
    idem = IdempotencyStore(session)

    if idempotency_key:
        try:
            cached = idem.get_cached(
                user_id=auth.user_id,
                idempotency_key=idempotency_key,
                operation=operation,
            )
        except IdempotencyConflictError as error:
            body = ErrorResponse(
                error=ApiError(code="IDEMPOTENCY_CONFLICT", message=str(error)),
            )
            return JSONResponse(status_code=409, content=body.model_dump(by_alias=True))

        if cached is not None:
            return cached

    response = handler()
    content = _response_content(response)

    if idempotency_key:
        idem.save(
            user_id=auth.user_id,
            idempotency_key=idempotency_key,
            operation=operation,
            status_code=response.status_code,
            content=content,
        )

    target_ids: list[str] | None = None
    if extract_target_ids and content.get("ok"):
        target_ids = extract_target_ids(content.get("data") or {})

    CommandLogService(session).record(
        auth,
        operation=operation,
        target_type=target_type,
        target_ids=target_ids,
        input_summary=input_summary,
        result_summary=_summarize_result(content),
        idempotency_key=idempotency_key,
    )

    return response


def _response_content(response: JSONResponse) -> dict:
    body = response.body
    if isinstance(body, memoryview):
        body = body.tobytes()
    if isinstance(body, bytes):
        import json

        return json.loads(body.decode("utf-8"))
    if isinstance(body, dict):
        return body
    return {}


def _summarize_result(content: dict) -> dict:
    if not content.get("ok"):
        error = content.get("error") or {}
        return {"ok": False, "code": error.get("code"), "message": error.get("message")}

    data = content.get("data") or {}
    summary: dict = {"ok": True}
    for key in ("reminder", "calendarEvent", "contact", "id"):
        if key in data:
            value = data[key]
            if isinstance(value, dict) and "id" in value:
                summary[key] = {"id": value["id"]}
            else:
                summary[key] = value
    return summary
