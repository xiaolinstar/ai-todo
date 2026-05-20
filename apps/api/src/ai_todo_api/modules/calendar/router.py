from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ai_todo_api.auth.deps import CurrentUser, get_current_user
from ai_todo_api.db.session import get_db
from ai_todo_api.modules.calendar.repository import CalendarEventRepository
from ai_todo_api.modules.calendar.schemas import (
    CalendarEventDetailResult,
    CalendarEventListResult,
    CreateCalendarEventInput,
    CreateCalendarEventResult,
    DeleteCalendarEventResult,
    UpdateCalendarEventInput,
    UpdateCalendarEventResult,
)
from ai_todo_api.modules.calendar.service import CalendarEventNotFoundError, CalendarEventService
from ai_todo_api.schemas import ApiError, ApiResponse, ErrorResponse


router = APIRouter(prefix="/v1/calendar", tags=["calendar"])


def _calendar_service(db: Session, user: CurrentUser) -> CalendarEventService:
    return CalendarEventService(CalendarEventRepository(db, user.id), user.id, user.timezone)


def _not_found(event_id: str) -> JSONResponse:
    body = ErrorResponse(
        error=ApiError(code="NOT_FOUND", message=f"Calendar event {event_id} was not found."),
    )
    return JSONResponse(status_code=404, content=body.model_dump(by_alias=True))


def _validation_error(message: str) -> JSONResponse:
    body = ErrorResponse(error=ApiError(code="VALIDATION_ERROR", message=message))
    return JSONResponse(status_code=400, content=body.model_dump(by_alias=True))


@router.get("/today")
def list_calendar_today(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[CalendarEventListResult]:
    items = _calendar_service(db, user).list_today()
    return ApiResponse(data=CalendarEventListResult(items=items))


@router.get("/events")
def list_calendar_events(
    from_date: str | None = Query(default=None, alias="from"),
    to_date: str | None = Query(default=None, alias="to"),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[CalendarEventListResult]:
    items = _calendar_service(db, user).list_events(
        from_date=from_date,
        to_date=to_date,
        limit=limit,
    )
    return ApiResponse(data=CalendarEventListResult(items=items))


@router.get("/events/{event_id}")
def get_calendar_event(
    event_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> JSONResponse:
    service = _calendar_service(db, user)

    try:
        event = service.get(event_id)
    except CalendarEventNotFoundError:
        return _not_found(event_id)

    body = ApiResponse(data=CalendarEventDetailResult(calendar_event=event))
    return JSONResponse(status_code=200, content=body.model_dump(by_alias=True))


@router.post("/events")
def create_calendar_event(
    input_data: CreateCalendarEventInput,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> JSONResponse:
    service = _calendar_service(db, user)

    try:
        event = service.create(input_data)
    except ValueError as error:
        return _validation_error(str(error))

    body = ApiResponse(data=CreateCalendarEventResult(calendar_event=event))
    return JSONResponse(status_code=201, content=body.model_dump(by_alias=True))


@router.patch("/events/{event_id}")
def update_calendar_event(
    event_id: str,
    input_data: UpdateCalendarEventInput,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> JSONResponse:
    service = _calendar_service(db, user)

    try:
        event = service.update(event_id, input_data)
    except CalendarEventNotFoundError:
        return _not_found(event_id)
    except ValueError as error:
        return _validation_error(str(error))

    body = ApiResponse(data=UpdateCalendarEventResult(calendar_event=event))
    return JSONResponse(status_code=200, content=body.model_dump(by_alias=True))


@router.delete("/events/{event_id}")
def delete_calendar_event(
    event_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> JSONResponse:
    service = _calendar_service(db, user)

    try:
        deleted_id = service.delete(event_id)
    except CalendarEventNotFoundError:
        return _not_found(event_id)

    body = ApiResponse(data=DeleteCalendarEventResult(id=deleted_id))
    return JSONResponse(status_code=200, content=body.model_dump(by_alias=True))
