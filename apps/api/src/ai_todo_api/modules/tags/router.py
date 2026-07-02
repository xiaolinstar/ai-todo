from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ai_todo_api.auth.deps import get_current_user
from ai_todo_api.auth.context import CurrentUser
from ai_todo_api.db.session import get_db
from ai_todo_api.modules.tags.repository import TagRepository
from ai_todo_api.modules.tags.schemas import (
    CreateTagInput,
    DeleteTagResult,
    TagDetailResult,
    TagListResult,
    UpdateTagInput,
)
from ai_todo_api.errors import ErrorCode, wire_code
from ai_todo_api.schemas import ApiError, ApiResponse, ErrorResponse


router = APIRouter(prefix="/v1/tags", tags=["tags"])


def _validation_error(message: str) -> JSONResponse:
    body = ErrorResponse(error=ApiError(code=wire_code(ErrorCode.VAL_INVALID_INPUT), message=message))
    return JSONResponse(status_code=400, content=body.model_dump(by_alias=True))


def _not_found(tag_id: str) -> JSONResponse:
    body = ErrorResponse(
        error=ApiError(code=wire_code(ErrorCode.BIZ_NOT_FOUND), message=f"Tag {tag_id} was not found."),
    )
    return JSONResponse(status_code=404, content=body.model_dump(by_alias=True))


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
            items=tags,
            total_count=repository.count_tags(query=q),
        )
    )


@router.post("")
def create_tag(
    input_data: CreateTagInput,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> JSONResponse:
    repository = TagRepository(db, user.id)
    try:
        tag = repository.create_tag(input_data.name, color=input_data.color)
    except ValueError as error:
        return _validation_error(str(error))
    body = ApiResponse(data=TagDetailResult(tag=tag))
    return JSONResponse(status_code=201, content=body.model_dump(by_alias=True))


@router.patch("/{tag_id}")
def update_tag(
    tag_id: str,
    input_data: UpdateTagInput,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> JSONResponse:
    repository = TagRepository(db, user.id)
    try:
        tag = repository.update_tag(tag_id, name=input_data.name, color=input_data.color)
    except ValueError as error:
        return _validation_error(str(error))
    if tag is None:
        return _not_found(tag_id)
    body = ApiResponse(data=TagDetailResult(tag=tag))
    return JSONResponse(status_code=200, content=body.model_dump(by_alias=True))


@router.delete("/{tag_id}")
def delete_tag(
    tag_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> JSONResponse:
    repository = TagRepository(db, user.id)
    if not repository.delete_tag(tag_id):
        return _not_found(tag_id)
    body = ApiResponse(data=DeleteTagResult(id=tag_id))
    return JSONResponse(status_code=200, content=body.model_dump(by_alias=True))
