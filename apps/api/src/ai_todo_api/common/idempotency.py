import json
from uuid import uuid4

from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ai_todo_api.common.time import now_utc
from ai_todo_api.db.models import IdempotencyRecordModel


class IdempotencyConflictError(Exception):
    pass


class IdempotencyStore:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_cached(
        self,
        *,
        user_id: str,
        idempotency_key: str,
        operation: str,
    ) -> JSONResponse | None:
        record = self._session.scalar(
            select(IdempotencyRecordModel).where(
                IdempotencyRecordModel.user_id == user_id,
                IdempotencyRecordModel.idempotency_key == idempotency_key,
            )
        )
        if record is None:
            return None

        if record.operation != operation:
            raise IdempotencyConflictError(
                f"Idempotency key already used for operation {record.operation}."
            )

        body = json.loads(record.response_body)
        return JSONResponse(status_code=record.status_code, content=body)

    def save(
        self,
        *,
        user_id: str,
        idempotency_key: str,
        operation: str,
        status_code: int,
        content: dict,
    ) -> None:
        record = IdempotencyRecordModel(
            id=f"idem_{uuid4().hex[:12]}",
            user_id=user_id,
            idempotency_key=idempotency_key,
            operation=operation,
            status_code=status_code,
            response_body=json.dumps(content, ensure_ascii=False, separators=(",", ":")),
            created_at=now_utc(),
        )
        self._session.add(record)
        self._session.commit()
