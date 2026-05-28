import logging
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from ai_todo_api.auth.context import DEFAULT_SCOPES
from ai_todo_api.auth.schemas import UserSummary, WechatLoginResult
from ai_todo_api.auth.wechat_client import WechatAuthError, WechatSession, exchange_wechat_code
from ai_todo_api.common.time import now_utc
from ai_todo_api.config import settings
from ai_todo_api.db.models import IdentityModel, UserModel
from ai_todo_api.auth.service import ensure_dev_user
from ai_todo_api.modules.api_tokens.constants import (
    DEV_SESSION_TOKEN_NAME,
    SESSION_TOKEN_NAME,
)
from ai_todo_api.modules.api_tokens.service import create_session_token_for_user


WECHAT_PROVIDER = "wechat"
DEFAULT_WECHAT_DISPLAY_NAME = "微信用户"
logger = logging.getLogger(__name__)


def login_with_wechat_code(session: Session, code: str) -> WechatLoginResult:
    if not settings.wechat_app_id or not settings.wechat_app_secret:
        if settings.allow_dev_auth:
            return _login_with_dev_user(session)
        raise HTTPException(
            status_code=503,
            detail={
                "ok": False,
                "error": {
                    "code": "WECHAT_NOT_CONFIGURED",
                    "message": "WeChat login is not configured on the server.",
                },
            },
        )

    code = code.strip()
    if not code:
        raise HTTPException(
            status_code=422,
            detail={
                "ok": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "WeChat login code is required.",
                },
            },
        )

    try:
        wechat_session = exchange_wechat_code(
            code=code,
            app_id=settings.wechat_app_id,
            app_secret=settings.wechat_app_secret,
        )
    except WechatAuthError as exc:
        status_code = 401 if exc.code == "INVALID_WECHAT_CODE" else 502
        raise HTTPException(
            status_code=status_code,
            detail={
                "ok": False,
                "error": {"code": exc.code, "message": exc.message},
            },
        ) from exc

    try:
        return _complete_wechat_login(session, wechat_session)
    except IntegrityError:
        session.rollback()
        try:
            return _complete_wechat_login(session, wechat_session)
        except IntegrityError as retry_exc:
            session.rollback()
            raise _integrity_http_error(retry_exc) from retry_exc
    except SQLAlchemyError as exc:
        session.rollback()
        logger.exception("wechat login database error")
        raise _database_http_error(exc) from exc


def _login_with_dev_user(session: Session) -> WechatLoginResult:
    """Local dev: issue a miniapp token for the configured dev user without WeChat API."""
    user = ensure_dev_user(
        session,
        user_id=settings.dev_user_id,
        display_name=settings.dev_user_display_name,
        timezone=settings.timezone,
    )
    token = create_session_token_for_user(
        session,
        user_id=user.id,
        name=DEV_SESSION_TOKEN_NAME,
        scopes=list(DEFAULT_SCOPES),
        timezone=user.timezone,
    )
    return WechatLoginResult(
        access_token=token.token,
        token_type=token.token_type,
        user=UserSummary(
            id=user.id,
            username=user.username,
            display_name=user.display_name,
            timezone=user.timezone,
        ),
    )


def _complete_wechat_login(session: Session, wechat_session: WechatSession) -> WechatLoginResult:
    user = _get_or_create_user(session, wechat_session, commit=False)
    token = create_session_token_for_user(
        session,
        user_id=user.id,
        name=SESSION_TOKEN_NAME,
        scopes=list(DEFAULT_SCOPES),
        timezone=user.timezone,
        commit=False,
    )
    session.commit()

    return WechatLoginResult(
        access_token=token.token,
        token_type=token.token_type,
        user=UserSummary(
            id=user.id,
            username=user.username,
            display_name=user.display_name,
            timezone=user.timezone,
        ),
    )


def _get_or_create_user(
    session: Session,
    wechat_session: WechatSession,
    *,
    commit: bool,
) -> UserModel:
    now = now_utc()
    identity = session.scalar(
        select(IdentityModel).where(
            IdentityModel.provider == WECHAT_PROVIDER,
            IdentityModel.provider_subject == wechat_session.openid,
        )
    )

    if identity is not None:
        user = session.get(UserModel, identity.user_id)
        if user is None:
            logger.warning(
                "Removing orphan identity %s for openid %s",
                identity.id,
                wechat_session.openid,
            )
            session.delete(identity)
            session.flush()
            identity = None

    if identity is not None:
        identity.last_used_at = now
        if wechat_session.union_id and not identity.union_id:
            identity.union_id = wechat_session.union_id
        if commit:
            session.commit()
        else:
            session.flush()

        user = session.get(UserModel, identity.user_id)
        if user is None:
            raise HTTPException(
                status_code=500,
                detail={
                    "ok": False,
                    "error": {
                        "code": "INTERNAL_ERROR",
                        "message": "Linked user record is missing.",
                    },
                },
            )
        return user

    user = UserModel(
        id=f"user_{uuid4().hex[:12]}",
        display_name=DEFAULT_WECHAT_DISPLAY_NAME,
        timezone=settings.timezone,
        created_at=now,
        updated_at=now,
    )
    session.add(user)
    session.flush()

    identity = IdentityModel(
        id=f"id_{uuid4().hex[:12]}",
        user_id=user.id,
        provider=WECHAT_PROVIDER,
        provider_subject=wechat_session.openid,
        union_id=wechat_session.union_id,
        created_at=now,
        last_used_at=now,
    )
    session.add(identity)
    if commit:
        session.commit()
        session.refresh(user)
    else:
        session.flush()
    return user


def _integrity_http_error(exc: IntegrityError) -> HTTPException:
    detail = str(getattr(exc, "orig", exc)).lower()
    if "foreign key" in detail and "identities_user_id_fkey" in detail:
        message = "WeChat user bootstrap failed. Retry login after API restart."
    else:
        message = "Failed to create WeChat user. Please retry."
    return HTTPException(
        status_code=500,
        detail={
            "ok": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": message,
            },
        },
    )


def _database_http_error(exc: SQLAlchemyError) -> HTTPException:
    message = "Database error during WeChat login."
    detail = str(exc).lower()
    if "username" in detail or "identities" in detail or "does not exist" in detail:
        message = "Database schema is out of date. Run alembic upgrade head on the API host."
    return HTTPException(
        status_code=500,
        detail={
            "ok": False,
            "error": {"code": "DATABASE_ERROR", "message": message},
        },
    )
