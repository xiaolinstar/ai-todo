from datetime import datetime, timedelta
from uuid import uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from ai_todo_api.auth.context import AuthContext
from ai_todo_api.common.json_store import dumps_json, loads_json
from ai_todo_api.common.security import generate_api_token, hash_api_token
from ai_todo_api.common.time import now_utc
from ai_todo_api.config import settings
from ai_todo_api.db.models import ApiTokenModel
from ai_todo_api.modules.api_tokens.constants import (
    CLIENT_KIND_CLI,
    CLIENT_KIND_MINIAPP,
    TOKEN_TYPE_PAT,
    TOKEN_TYPE_SESSION,
)
from ai_todo_api.modules.api_tokens.schemas import (
    ApiTokenSummary,
    CreateApiTokenInput,
    CreateApiTokenResult,
)


class ApiTokenNotFoundError(Exception):
    pass


def create_session_token_for_user(
    session: Session,
    *,
    user_id: str,
    name: str,
    scopes: list[str],
    timezone: str,
    client_kind: str = CLIENT_KIND_MINIAPP,
    commit: bool = True,
) -> CreateApiTokenResult:
    revoke_user_sessions(session, user_id=user_id, commit=False)
    expires_at = now_utc() + timedelta(days=settings.session_token_ttl_days)
    return _create_token(
        session,
        user_id=user_id,
        name=name,
        token_type=TOKEN_TYPE_SESSION,
        client_kind=client_kind,
        scopes=scopes,
        timezone=timezone,
        expires_at=expires_at,
        commit=commit,
    )


def create_pat_for_user(
    session: Session,
    *,
    user_id: str,
    name: str,
    scopes: list[str],
    timezone: str,
    client_kind: str,
    expires_at: str | None = None,
    commit: bool = True,
) -> CreateApiTokenResult:
    return _create_token(
        session,
        user_id=user_id,
        name=name,
        token_type=TOKEN_TYPE_PAT,
        client_kind=client_kind,
        scopes=scopes,
        timezone=timezone,
        expires_at=_parse_optional_datetime(expires_at, timezone),
        commit=commit,
    )


def create_token_for_user(
    session: Session,
    *,
    user_id: str,
    name: str,
    scopes: list[str],
    timezone: str,
    expires_at: str | None = None,
    commit: bool = True,
) -> CreateApiTokenResult:
    """Backward-compatible alias: creates a PAT (used by admin scripts)."""
    return create_pat_for_user(
        session,
        user_id=user_id,
        name=name,
        scopes=scopes,
        timezone=timezone,
        client_kind=CLIENT_KIND_MINIAPP,
        expires_at=expires_at,
        commit=commit,
    )


def revoke_user_sessions(session: Session, *, user_id: str, commit: bool = True) -> int:
    now = now_utc()
    rows = session.scalars(
        select(ApiTokenModel).where(
            ApiTokenModel.user_id == user_id,
            ApiTokenModel.token_type == TOKEN_TYPE_SESSION,
            ApiTokenModel.revoked_at.is_(None),
        )
    ).all()
    for row in rows:
        row.revoked_at = now
    if commit:
        session.commit()
    else:
        session.flush()
    return len(rows)


class ApiTokenService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def create(
        self,
        auth: AuthContext,
        input_data: CreateApiTokenInput,
        *,
        client_kind: str,
    ) -> CreateApiTokenResult:
        name = input_data.name.strip()
        if not name:
            raise ValueError("Token name is required.")

        return create_pat_for_user(
            self._session,
            user_id=auth.user_id,
            name=name,
            scopes=input_data.scopes,
            timezone=auth.timezone,
            client_kind=client_kind,
            expires_at=input_data.expires_at,
        )

    def list_pats(self, user_id: str) -> list[ApiTokenSummary]:
        rows = self._session.scalars(
            select(ApiTokenModel)
            .where(
                ApiTokenModel.user_id == user_id,
                ApiTokenModel.token_type == TOKEN_TYPE_PAT,
                ApiTokenModel.revoked_at.is_(None),
            )
            .order_by(ApiTokenModel.created_at.desc())
        )
        return [_to_summary(row) for row in rows]

    def revoke_pat(self, user_id: str, token_id: str) -> str:
        token = self._session.scalar(
            select(ApiTokenModel).where(
                ApiTokenModel.id == token_id,
                ApiTokenModel.user_id == user_id,
                ApiTokenModel.token_type == TOKEN_TYPE_PAT,
                ApiTokenModel.revoked_at.is_(None),
            )
        )
        if token is None:
            raise ApiTokenNotFoundError(token_id)

        token.revoked_at = now_utc()
        self._session.commit()
        return token.id

    def revoke_all_pats(self, user_id: str) -> int:
        now = now_utc()
        rows = self._session.scalars(
            select(ApiTokenModel).where(
                ApiTokenModel.user_id == user_id,
                ApiTokenModel.token_type == TOKEN_TYPE_PAT,
                ApiTokenModel.revoked_at.is_(None),
            )
        ).all()
        for row in rows:
            row.revoked_at = now
        self._session.commit()
        return len(rows)


def resolve_token(session: Session, bearer: str) -> ApiTokenModel | None:
    token_hash = hash_api_token(bearer)
    token = session.scalar(
        select(ApiTokenModel).where(
            ApiTokenModel.token_hash == token_hash,
            ApiTokenModel.revoked_at.is_(None),
        )
    )
    if token is None:
        return None

    now = now_utc()
    expires_at = token.expires_at
    if expires_at is not None:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=ZoneInfo("UTC"))
        if expires_at < now:
            return None

    token.last_used_at = now
    session.commit()
    return token


def _create_token(
    session: Session,
    *,
    user_id: str,
    name: str,
    token_type: str,
    client_kind: str,
    scopes: list[str],
    timezone: str,
    expires_at: datetime | None,
    commit: bool,
) -> CreateApiTokenResult:
    plain = generate_api_token()
    now = now_utc()
    token = ApiTokenModel(
        id=f"token_{uuid4().hex[:12]}",
        user_id=user_id,
        name=name,
        token_type=token_type,
        client_kind=client_kind,
        token_hash=hash_api_token(plain),
        scopes=dumps_json(_normalize_scopes(scopes)),
        expires_at=expires_at,
        created_at=now,
    )
    session.add(token)
    if commit:
        session.commit()
        session.refresh(token)
    else:
        session.flush()

    return CreateApiTokenResult(
        id=token.id,
        token=plain,
        name=token.name,
        token_type=token_type,
        scopes=loads_json(token.scopes),
        expires_at=_format_datetime(token.expires_at),
    )


def _to_summary(token: ApiTokenModel) -> ApiTokenSummary:
    return ApiTokenSummary(
        id=token.id,
        name=token.name,
        scopes=loads_json(token.scopes),
        expires_at=_format_datetime(token.expires_at),
        last_used_at=_format_datetime(token.last_used_at),
        revoked_at=_format_datetime(token.revoked_at),
        created_at=token.created_at.isoformat(),
    )


def _normalize_scopes(scopes: list[str]) -> list[str]:
    cleaned = [scope.strip() for scope in scopes if scope.strip()]
    return cleaned or ["read", "write"]


def _parse_optional_datetime(value: str | None, timezone: str) -> datetime | None:
    if not value:
        return None
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=ZoneInfo(timezone))
    return parsed


def _format_datetime(value: datetime | None) -> str | None:
    return value.isoformat() if value else None
