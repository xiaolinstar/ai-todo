from uuid import uuid4

from sqlalchemy.orm import Session

from ai_todo_api.auth.context import AuthContext
from ai_todo_api.common.json_store import dumps_json
from ai_todo_api.common.time import now_utc
from ai_todo_api.db.models import CommandLogModel


class CommandLogService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def record(
        self,
        auth: AuthContext,
        *,
        operation: str,
        target_type: str | None = None,
        target_ids: list[str] | None = None,
        input_summary: dict | None = None,
        result_summary: dict | None = None,
        request_id: str | None = None,
        idempotency_key: str | None = None,
    ) -> None:
        entry = CommandLogModel(
            id=f"log_{uuid4().hex[:12]}",
            user_id=auth.user_id,
            api_token_id=auth.api_token_id,
            source=auth.client_source,
            operation=operation,
            request_id=request_id,
            idempotency_key=idempotency_key,
            target_type=target_type,
            target_ids=dumps_json(target_ids) if target_ids else None,
            input_summary=dumps_json(input_summary) if input_summary else None,
            result_summary=dumps_json(result_summary) if result_summary else None,
            created_at=now_utc(),
        )
        self._session.add(entry)
        self._session.commit()
