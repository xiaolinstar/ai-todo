from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ai_todo_api.auth.deps import get_current_user
from ai_todo_api.auth.context import CurrentUser
from ai_todo_api.db.session import get_db
from ai_todo_api.modules.tags.repository import TagRepository
from ai_todo_api.modules.tags.schemas import TagListResult, TagSummary
from ai_todo_api.schemas import ApiResponse


router = APIRouter(prefix="/v1/tags", tags=["tags"])


@router.get("")
def list_tags(
    q: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[TagListResult]:
    repository = TagRepository(db, user.id)
    tags = repository.list_tags(query=q, limit=limit)
    return ApiResponse(
        data=TagListResult(
            items=[TagSummary(id=tag.id, name=tag.name) for tag in tags],
            total_count=repository.count_tags(query=q),
        )
    )
