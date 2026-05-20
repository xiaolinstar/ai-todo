from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ai_todo_api.auth.deps import CurrentUser, get_current_user
from ai_todo_api.db.session import get_db
from ai_todo_api.modules.reminders.repository import ReminderRepository
from ai_todo_api.modules.reminders.schemas import (
    CompleteReminderInput,
    CompleteReminderResult,
    CreateReminderInput,
    CreateReminderResult,
    DeleteReminderResult,
    ReminderDetailResult,
    ReminderListResult,
    RescheduleReminderInput,
    RescheduleReminderResult,
    UpdateReminderInput,
    UpdateReminderResult,
)
from ai_todo_api.modules.reminders.service import ReminderNotFoundError, ReminderService
from ai_todo_api.schemas import ApiError, ApiResponse, ErrorResponse


router = APIRouter(prefix="/v1/reminders", tags=["reminders"])


def _reminder_service(db: Session, user: CurrentUser) -> ReminderService:
    return ReminderService(ReminderRepository(db, user.id), user.id, user.timezone)


def _not_found(reminder_id: str) -> JSONResponse:
    body = ErrorResponse(
        error=ApiError(code="NOT_FOUND", message=f"Reminder {reminder_id} was not found."),
    )
    return JSONResponse(status_code=404, content=body.model_dump(by_alias=True))


def _validation_error(message: str) -> JSONResponse:
    body = ErrorResponse(error=ApiError(code="VALIDATION_ERROR", message=message))
    return JSONResponse(status_code=400, content=body.model_dump(by_alias=True))


@router.get("")
def list_reminders(
    status: str | None = None,
    from_date: str | None = Query(default=None, alias="from"),
    to_date: str | None = Query(default=None, alias="to"),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[ReminderListResult]:
    items = _reminder_service(db, user).list_reminders(
        status=status,
        from_date=from_date,
        to_date=to_date,
        limit=limit,
    )
    return ApiResponse(data=ReminderListResult(items=items))


@router.get("/today")
def list_reminders_today(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[ReminderListResult]:
    items = _reminder_service(db, user).list_today()
    return ApiResponse(data=ReminderListResult(items=items))


@router.get("/{reminder_id}")
def get_reminder(
    reminder_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> JSONResponse:
    service = _reminder_service(db, user)

    try:
        reminder = service.get(reminder_id)
    except ReminderNotFoundError:
        return _not_found(reminder_id)

    body = ApiResponse(data=ReminderDetailResult(reminder=reminder))
    return JSONResponse(status_code=200, content=body.model_dump(by_alias=True))


@router.post("")
def create_reminder(
    input_data: CreateReminderInput,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> JSONResponse:
    service = _reminder_service(db, user)

    try:
        reminder = service.create(input_data)
    except ValueError as error:
        return _validation_error(str(error))

    body = ApiResponse(data=CreateReminderResult(reminder=reminder))
    return JSONResponse(status_code=201, content=body.model_dump(by_alias=True))


@router.post("/{reminder_id}/complete")
def complete_reminder(
    reminder_id: str,
    input_data: CompleteReminderInput | None = None,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> JSONResponse:
    service = _reminder_service(db, user)

    try:
        reminder = service.complete(reminder_id, input_data)
    except ReminderNotFoundError:
        return _not_found(reminder_id)

    body = ApiResponse(data=CompleteReminderResult(reminder=reminder))
    return JSONResponse(status_code=200, content=body.model_dump(by_alias=True))


@router.post("/{reminder_id}/reschedule")
def reschedule_reminder(
    reminder_id: str,
    input_data: RescheduleReminderInput,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> JSONResponse:
    service = _reminder_service(db, user)

    try:
        reminder = service.reschedule(reminder_id, input_data)
    except ReminderNotFoundError:
        return _not_found(reminder_id)
    except ValueError as error:
        return _validation_error(str(error))

    body = ApiResponse(data=RescheduleReminderResult(reminder=reminder))
    return JSONResponse(status_code=200, content=body.model_dump(by_alias=True))


@router.patch("/{reminder_id}")
def update_reminder(
    reminder_id: str,
    input_data: UpdateReminderInput,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> JSONResponse:
    service = _reminder_service(db, user)

    try:
        reminder = service.update(reminder_id, input_data)
    except ReminderNotFoundError:
        return _not_found(reminder_id)
    except ValueError as error:
        return _validation_error(str(error))

    body = ApiResponse(data=UpdateReminderResult(reminder=reminder))
    return JSONResponse(status_code=200, content=body.model_dump(by_alias=True))


@router.delete("/{reminder_id}")
def delete_reminder(
    reminder_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> JSONResponse:
    service = _reminder_service(db, user)

    try:
        deleted_id = service.delete(reminder_id)
    except ReminderNotFoundError:
        return _not_found(reminder_id)

    body = ApiResponse(data=DeleteReminderResult(id=deleted_id))
    return JSONResponse(status_code=200, content=body.model_dump(by_alias=True))
