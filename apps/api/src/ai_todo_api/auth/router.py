from fastapi import APIRouter, Depends

from ai_todo_api.auth.deps import CurrentUser, get_current_user
from ai_todo_api.auth.schemas import MeResult, UserSummary
from ai_todo_api.schemas import ApiResponse


router = APIRouter(prefix="/v1", tags=["auth"])


@router.get("/me")
def me(user: CurrentUser = Depends(get_current_user)) -> ApiResponse[MeResult]:
    return ApiResponse(
        data=MeResult(
            user=UserSummary(
                id=user.id,
                display_name=user.display_name,
                timezone=user.timezone,
            )
        )
    )
