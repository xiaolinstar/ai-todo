from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ai_todo_api.common.cursor import InvalidCursorError
from ai_todo_api.auth.context import AuthContext, CurrentUser
from ai_todo_api.auth.deps import get_auth_context, get_current_user, get_idempotency_key
from ai_todo_api.common.write import run_write
from ai_todo_api.db.models import CalendarEventModel
from ai_todo_api.db.session import get_db
from ai_todo_api.modules.calendar.repository import CalendarEventRepository
from ai_todo_api.modules.contacts.links import ContactLinkService
from ai_todo_api.modules.contacts.service import ContactNotFoundError
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
from ai_todo_api.modules.notifications.notify_fields import resolve_wechat_notify_requested
from ai_todo_api.modules.notifications.service import NotificationDeliveryService
from ai_todo_api.errors import ErrorCode, wire_code
from ai_todo_api.schemas import ApiError, ApiResponse, ErrorResponse


router = APIRouter(prefix="/v1/calendar", tags=["calendar"])


def _calendar_service(db: Session, user: CurrentUser) -> CalendarEventService:
    return CalendarEventService(
        CalendarEventRepository(db, user.id),
        user.id,
        user.timezone,
        ContactLinkService(db, user.id),
    )


def _sync_calendar_notifications(db: Session, user_id: str, event_id: str) -> None:
    event = db.get(CalendarEventModel, event_id)
    if event is None or event.user_id != user_id:
        return
    NotificationDeliveryService(db, user_id).sync_calendar_event_target(event)


def _not_found(event_id: str) -> JSONResponse:
    body = ErrorResponse(
        error=ApiError(code=wire_code(ErrorCode.BIZ_NOT_FOUND), message=f"Calendar event {event_id} was not found."),
    )
    return JSONResponse(status_code=404, content=body.model_dump(by_alias=True))


def _validation_error(message: str) -> JSONResponse:
    body = ErrorResponse(error=ApiError(code=wire_code(ErrorCode.VAL_INVALID_INPUT), message=message))
    return JSONResponse(status_code=400, content=body.model_dump(by_alias=True))


def _contact_not_found(contact_id: str) -> JSONResponse:
    body = ErrorResponse(
        error=ApiError(code=wire_code(ErrorCode.BIZ_CONTACT_NOT_FOUND), message=f"Contact {contact_id} was not found."),
    )
    return JSONResponse(status_code=404, content=body.model_dump(by_alias=True))


def _event_id_from_data(data: dict) -> list[str]:
    event = data.get("calendarEvent") or {}
    event_id = event.get("id") or data.get("id")
    return [event_id] if event_id else []


@router.get("/today")
def list_calendar_today(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[CalendarEventListResult]:
    return ApiResponse(data=_calendar_service(db, user).list_today())


@router.get("/events", response_model=None)
def list_calendar_events(
    from_date: str | None = Query(default=None, alias="from"),
    to_date: str | None = Query(default=None, alias="to"),
    limit: int = Query(default=50, ge=1, le=100),
    cursor: str | None = None,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[CalendarEventListResult] | JSONResponse:
    try:
        result = _calendar_service(db, user).list_events(
            from_date=from_date,
            to_date=to_date,
            limit=limit,
            cursor=cursor,
        )
    except InvalidCursorError as error:
        body = ErrorResponse(error=ApiError(code=wire_code(ErrorCode.VAL_INVALID_CURSOR), message=str(error)))
        return JSONResponse(status_code=400, content=body.model_dump(by_alias=True))
    return ApiResponse(data=result)


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
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
    idempotency_key: str | None = Depends(get_idempotency_key),
) -> JSONResponse:
    user = CurrentUser.from_auth(auth)
    service = _calendar_service(db, user)

    def handler() -> JSONResponse:
        try:
            event = service.create(
                input_data,
                wechat_notify_requested=resolve_wechat_notify_requested(
                    client_source=auth.client_source,
                    session=db,
                    user_id=user.id,
                    requested=input_data.wechat_notify_requested,
                ),
            )
        except ContactNotFoundError as error:
            return _contact_not_found(str(error))
        except ValueError as error:
            return _validation_error(str(error))
        body = ApiResponse(data=CreateCalendarEventResult(calendar_event=event))
        return JSONResponse(status_code=201, content=body.model_dump(by_alias=True))

    return run_write(
        db,
        auth,
        operation="create_calendar_event",
        idempotency_key=idempotency_key,
        target_type="calendar_event",
        input_summary=input_data.model_dump(by_alias=True),
        handler=handler,
        extract_target_ids=_event_id_from_data,
    )


@router.patch("/events/{event_id}")
def update_calendar_event(
    event_id: str,
    input_data: UpdateCalendarEventInput,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
    idempotency_key: str | None = Depends(get_idempotency_key),
) -> JSONResponse:
    user = CurrentUser.from_auth(auth)
    service = _calendar_service(db, user)

    def handler() -> JSONResponse:
        try:
            event = service.update(event_id, input_data)
        except CalendarEventNotFoundError:
            return _not_found(event_id)
        except ContactNotFoundError as error:
            return _contact_not_found(str(error))
        except ValueError as error:
            return _validation_error(str(error))
        _sync_calendar_notifications(db, user.id, event_id)
        body = ApiResponse(data=UpdateCalendarEventResult(calendar_event=event))
        return JSONResponse(status_code=200, content=body.model_dump(by_alias=True))

    return run_write(
        db,
        auth,
        operation="update_calendar_event",
        idempotency_key=idempotency_key,
        target_type="calendar_event",
        input_summary={"eventId": event_id, **input_data.model_dump(by_alias=True)},
        handler=handler,
        extract_target_ids=_event_id_from_data,
    )


@router.delete("/events/{event_id}")
def delete_calendar_event(
    event_id: str,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
    idempotency_key: str | None = Depends(get_idempotency_key),
) -> JSONResponse:
    user = CurrentUser.from_auth(auth)
    service = _calendar_service(db, user)

    def handler() -> JSONResponse:
        try:
            deleted_id = service.delete(event_id)
        except CalendarEventNotFoundError:
            return _not_found(event_id)
        _sync_calendar_notifications(db, user.id, event_id)
        body = ApiResponse(data=DeleteCalendarEventResult(id=deleted_id))
        return JSONResponse(status_code=200, content=body.model_dump(by_alias=True))

    return run_write(
        db,
        auth,
        operation="delete_calendar_event",
        idempotency_key=idempotency_key,
        target_type="calendar_event",
        input_summary={"eventId": event_id},
        handler=handler,
        extract_target_ids=lambda data: [data["id"]],
    )
