from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ai_todo_api.auth.deps import CurrentUser, get_current_user
from ai_todo_api.db.session import get_db
from ai_todo_api.modules.contacts.repository import ContactRepository
from ai_todo_api.modules.contacts.schemas import (
    ContactDetailResult,
    ContactListResult,
    CreateContactInput,
    CreateContactResult,
)
from ai_todo_api.modules.contacts.service import ContactNotFoundError, ContactService
from ai_todo_api.schemas import ApiError, ApiResponse, ErrorResponse


router = APIRouter(prefix="/v1/contacts", tags=["contacts"])


@router.post("")
def create_contact(
    input_data: CreateContactInput,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> JSONResponse:
    contact_service = ContactService(ContactRepository(db, user.id), user.id)

    try:
        contact = contact_service.create(input_data)
    except ValueError as error:
        body = ErrorResponse(error=ApiError(code="VALIDATION_ERROR", message=str(error)))
        return JSONResponse(status_code=400, content=body.model_dump(by_alias=True))

    body = ApiResponse(data=CreateContactResult(contact=contact))
    return JSONResponse(status_code=201, content=body.model_dump(by_alias=True))


@router.get("")
def search_contacts(
    q: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[ContactListResult]:
    contact_service = ContactService(ContactRepository(db, user.id), user.id)
    items = contact_service.search(q, limit)
    return ApiResponse(data=ContactListResult(items=items))


@router.get("/{contact_id}")
def get_contact(
    contact_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> JSONResponse:
    contact_service = ContactService(ContactRepository(db, user.id), user.id)

    try:
        contact = contact_service.get(contact_id)
    except ContactNotFoundError:
        body = ErrorResponse(
            error=ApiError(code="CONTACT_NOT_FOUND", message=f"Contact {contact_id} was not found."),
        )
        return JSONResponse(status_code=404, content=body.model_dump(by_alias=True))

    body = ApiResponse(data=ContactDetailResult(contact=contact))
    return JSONResponse(status_code=200, content=body.model_dump(by_alias=True))
