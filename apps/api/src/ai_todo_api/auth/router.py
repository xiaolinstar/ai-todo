from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ai_todo_api.auth.context import CurrentUser
from ai_todo_api.auth.deps import get_current_user
from ai_todo_api.auth.schemas import MeResult, UserSummary, WechatLoginInput, WechatLoginResult
from ai_todo_api.auth.rate_limit import enforce_wechat_login_rate_limit
from ai_todo_api.auth.wechat_service import login_with_wechat_code
from ai_todo_api.db.session import get_db
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
