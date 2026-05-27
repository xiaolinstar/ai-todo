from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ai_todo_api.auth.context import CurrentUser, DEFAULT_SCOPES
from ai_todo_api.auth.deps import get_current_user
from ai_todo_api.auth.schemas import (
    DevIssuePatInput,
    DevIssuePatResult,
    MeResult,
    UserSummary,
    WechatLoginInput,
    WechatLoginResult,
)
from ai_todo_api.auth.rate_limit import enforce_wechat_login_rate_limit
from ai_todo_api.auth.service import ensure_dev_user
from ai_todo_api.auth.wechat_service import login_with_wechat_code
from ai_todo_api.config import settings
from ai_todo_api.db.session import get_db
from ai_todo_api.modules.api_tokens.constants import CLIENT_KIND_CLI
from ai_todo_api.modules.api_tokens.service import create_pat_for_user
from ai_todo_api.schemas import ApiResponse


router = APIRouter(prefix="/v1", tags=["auth"])


@router.post("/auth/wechat/login", status_code=200)
def wechat_login(
    body: WechatLoginInput,
    db: Session = Depends(get_db),
    _: None = Depends(enforce_wechat_login_rate_limit),
) -> ApiResponse[WechatLoginResult]:
    return ApiResponse(data=login_with_wechat_code(db, body.code))


@router.get("/me")
def me(user: CurrentUser = Depends(get_current_user)) -> ApiResponse[MeResult]:
    return ApiResponse(
        data=MeResult(
            user=UserSummary(
                id=user.id,
                username=user.username,
                display_name=user.display_name,
                timezone=user.timezone,
            )
        )
    )


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
