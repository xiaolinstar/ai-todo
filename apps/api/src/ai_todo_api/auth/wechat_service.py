from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ai_todo_api.auth.context import DEFAULT_SCOPES
from ai_todo_api.auth.schemas import UserSummary, WechatLoginResult
from ai_todo_api.auth.wechat_client import WechatAuthError, WechatSession, exchange_wechat_code
from ai_todo_api.common.time import now_utc
from ai_todo_api.config import settings
from ai_todo_api.db.models import IdentityModel, UserModel
from ai_todo_api.modules.api_tokens.service import create_token_for_user


WECHAT_PROVIDER = "wechat"
DEFAULT_WECHAT_DISPLAY_NAME = "微信用户"
MINIAPP_TOKEN_NAME = "WeChat Miniapp"


def login_with_wechat_code(session: Session, code: str) -> WechatLoginResult:
    if not settings.wechat_app_id or not settings.wechat_app_secret:
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

    user = _get_or_create_user(session, wechat_session)
    token = create_token_for_user(
        session,
        user_id=user.id,
        name=MINIAPP_TOKEN_NAME,
        scopes=list(DEFAULT_SCOPES),
        timezone=user.timezone,
    )

    return WechatLoginResult(
        access_token=token.token,
        user=UserSummary(
            id=user.id,
            display_name=user.display_name,
            timezone=user.timezone,
        ),
    )


def _get_or_create_user(session: Session, wechat_session: WechatSession) -> UserModel:
    now = now_utc()
    identity = session.scalar(
        select(IdentityModel).where(
            IdentityModel.provider == WECHAT_PROVIDER,
            IdentityModel.provider_subject == wechat_session.openid,
        )
    )

    if identity is not None:
        identity.last_used_at = now
        if wechat_session.union_id and not identity.union_id:
            identity.union_id = wechat_session.union_id
        session.commit()

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
    identity = IdentityModel(
        id=f"id_{uuid4().hex[:12]}",
        user_id=user.id,
        provider=WECHAT_PROVIDER,
        provider_subject=wechat_session.openid,
        union_id=wechat_session.union_id,
        created_at=now,
        last_used_at=now,
    )
    session.add(user)
    session.add(identity)
    session.commit()
    session.refresh(user)
    return user
