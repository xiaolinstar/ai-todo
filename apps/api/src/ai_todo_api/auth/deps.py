from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from ai_todo_api.auth.context import DEFAULT_SCOPES, AuthContext, CurrentUser
from ai_todo_api.auth.scopes import ForbiddenError, is_write_method, require_write
from ai_todo_api.auth.service import ensure_dev_user
from ai_todo_api.cli_guidance import SESSION_TOKEN_CLI_HINT
from ai_todo_api.common.json_store import loads_json
from ai_todo_api.config import settings
from ai_todo_api.db.session import get_db
from ai_todo_api.errors import ErrorCode, error_detail
from ai_todo_api.modules.api_tokens.constants import TOKEN_TYPE_SESSION
from ai_todo_api.modules.api_tokens.service import resolve_token


def get_client_source(
    x_client_source: str | None = Header(default=None, alias="X-Client-Source"),
) -> str:
    value = (x_client_source or "api").strip().lower()
    if value in {"miniapp", "cli", "agent", "api"}:
        return value
    return "api"


def get_idempotency_key(
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> str | None:
    if not idempotency_key:
        return None
    cleaned = idempotency_key.strip()
    return cleaned or None


def _parse_bearer(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    token = parts[1].strip()
    return token or None


def get_auth_context(
    request: Request,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
    client_source: str = Depends(get_client_source),
) -> AuthContext:
    bearer = _parse_bearer(authorization)

    if bearer:
        token = resolve_token(db, bearer)
        if token is None:
            raise HTTPException(
                status_code=401,
                detail=error_detail(
                    ErrorCode.AUTH_INVALID_TOKEN,
                    "Invalid or expired API token.",
                ),
            )

        from ai_todo_api.auth.service import get_user

        user = get_user(db, token.user_id)
        if user is None:
            raise HTTPException(
                status_code=401,
                detail=error_detail(
                    ErrorCode.AUTH_INVALID_TOKEN,
                    "Token user no longer exists.",
                ),
            )

        if token.token_type == TOKEN_TYPE_SESSION and client_source == "cli":
            raise HTTPException(
                status_code=401,
                detail=error_detail(
                    ErrorCode.AUTH_SCOPE_DENIED,
                    SESSION_TOKEN_CLI_HINT,
                ),
            )

        scopes = tuple(loads_json(token.scopes))
        auth = AuthContext(
            user_id=user.id,
            username=user.username,
            display_name=user.display_name,
            avatar_url=user.avatar_url,
            timezone=user.timezone,
            api_token_id=token.id,
            token_type=token.token_type,
            scopes=scopes,
            client_source=client_source,
        )
    elif settings.allow_dev_auth:
        user = ensure_dev_user(
            db,
            user_id=settings.dev_user_id,
            display_name=settings.dev_user_display_name,
            timezone=settings.timezone,
        )
        auth = AuthContext(
            user_id=user.id,
            username=user.username,
            display_name=user.display_name,
            avatar_url=user.avatar_url,
            timezone=user.timezone,
            api_token_id=None,
            token_type=None,
            scopes=DEFAULT_SCOPES,
            client_source=client_source,
        )
    else:
        raise HTTPException(
            status_code=401,
            detail=error_detail(
                ErrorCode.AUTH_INVALID_TOKEN,
                "Authorization required.",
            ),
        )

    if is_write_method(request.method):
        try:
            require_write(auth)
        except ForbiddenError as error:
            raise HTTPException(
                status_code=403,
                detail=error_detail(ErrorCode.AUTH_FORBIDDEN, str(error)),
            ) from error

    return auth


def get_auth_context_bearer_required(
    request: Request,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
    client_source: str = Depends(get_client_source),
) -> AuthContext:
    """Like get_auth_context but never falls back to dev bypass (for PAT management)."""
    bearer = _parse_bearer(authorization)
    if not bearer:
        raise HTTPException(
            status_code=401,
            detail=error_detail(
                ErrorCode.AUTH_INVALID_TOKEN,
                "Bearer token required.",
            ),
        )
    return get_auth_context(request, db, authorization, client_source)


def get_current_user(auth: AuthContext = Depends(get_auth_context)) -> CurrentUser:
    return CurrentUser.from_auth(auth)
