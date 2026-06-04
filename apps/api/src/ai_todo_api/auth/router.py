from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ai_todo_api.auth.context import CurrentUser, DEFAULT_SCOPES
from ai_todo_api.auth.deps import get_current_user
from ai_todo_api.auth.schemas import (
    DevIssuePatInput,
    DevIssuePatResult,
    MeResult,
    UpdateProfileInput,
    UpdateProfileResult,
    UserSummary,
    WechatLoginInput,
    WechatLoginResult,
)
from ai_todo_api.auth.rate_limit import enforce_wechat_login_rate_limit
from ai_todo_api.auth.service import ensure_dev_user, update_user_profile
from ai_todo_api.auth.wechat_service import login_with_wechat_code
from ai_todo_api.config import settings
from ai_todo_api.db.session import get_db
from ai_todo_api.modules.api_tokens.constants import CLIENT_KIND_CLI
from ai_todo_api.modules.api_tokens.service import create_pat_for_user
from ai_todo_api.schemas import ApiResponse


router = APIRouter(prefix="/v1", tags=["auth"])


def _user_summary(user: CurrentUser | object) -> UserSummary:
    return UserSummary(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        timezone=user.timezone,
    )


@router.post("/auth/wechat/login", status_code=200)
def wechat_login(
    body: WechatLoginInput,
    db: Session = Depends(get_db),
    _: None = Depends(enforce_wechat_login_rate_limit),
) -> ApiResponse[WechatLoginResult]:
    return ApiResponse(data=login_with_wechat_code(db, body.code))


@router.get("/me")
def me(user: CurrentUser = Depends(get_current_user)) -> ApiResponse[MeResult]:
    return ApiResponse(data=MeResult(user=_user_summary(user)))


@router.patch("/me/profile")
def update_profile(
    body: UpdateProfileInput,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ApiResponse[UpdateProfileResult]:
    try:
        updated = update_user_profile(
            db,
            user_id=user.id,
            display_name=body.display_name,
            avatar_url=body.avatar_url,
            timezone=body.timezone,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "ok": False,
                "error": {"code": "VALIDATION_ERROR", "message": str(exc)},
            },
        ) from exc

    return ApiResponse(data=UpdateProfileResult(user=_user_summary(updated)))


@router.post("/auth/dev/issue-pat", status_code=201)
def dev_issue_pat(
    body: DevIssuePatInput,
    db: Session = Depends(get_db),
) -> ApiResponse[DevIssuePatResult]:
    if not settings.allow_dev_auth:
        raise HTTPException(
            status_code=404,
            detail={
                "ok": False,
                "error": {
                    "code": "NOT_FOUND",
                    "message": "Dev PAT issuance is disabled.",
                },
            },
        )

    user = ensure_dev_user(
        db,
        user_id=settings.dev_user_id,
        display_name=settings.dev_user_display_name,
        timezone=settings.timezone,
    )
    name = body.name.strip() or "CLI Local"
    result = create_pat_for_user(
        db,
        user_id=user.id,
        name=name,
        scopes=list(DEFAULT_SCOPES),
        timezone=user.timezone,
        client_kind=CLIENT_KIND_CLI,
    )
    return ApiResponse(
        data=DevIssuePatResult(
            id=result.id,
            token=result.token,
            name=result.name,
            token_type=result.token_type,
            scopes=result.scopes,
        )
    )
