from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ai_todo_api.auth.context import AuthContext, CurrentUser
from ai_todo_api.auth.deps import get_auth_context, get_current_user, get_idempotency_key
from ai_todo_api.common.cursor import InvalidCursorError
from ai_todo_api.common.write import run_write
from ai_todo_api.db.session import get_db
from ai_todo_api.modules.contacts.links import ContactLinkService
from ai_todo_api.modules.contacts.service import ContactNotFoundError
from ai_todo_api.db.models import ReminderModel
from ai_todo_api.modules.notifications.service import NotificationDeliveryService
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
from ai_todo_api.modules.notifications.notify_fields import resolve_wechat_notify_requested
from ai_todo_api.errors import ErrorCode, wire_code
from ai_todo_api.schemas import ApiError, ApiResponse, ErrorResponse


router = APIRouter(prefix="/v1/reminders", tags=["reminders"])


def _reminder_service(db: Session, user: CurrentUser) -> ReminderService:
    return ReminderService(
        ReminderRepository(db, user.id),
        user.id,
        user.timezone,
        ContactLinkService(db, user.id),
    )


def _sync_reminder_notifications(db: Session, user_id: str, reminder_id: str) -> None:
    reminder = db.get(ReminderModel, reminder_id)
    if reminder is None or reminder.user_id != user_id:
        return
    NotificationDeliveryService(db, user_id).sync_reminder_target(reminder)


def _not_found(reminder_id: str) -> JSONResponse:
    body = ErrorResponse(
        error=ApiError(code="NOT_FOUND", message=f"Reminder {reminder_id} was not found."),
    )
    return JSONResponse(status_code=404, content=body.model_dump(by_alias=True))


def _source_not_found(source: str, external_id: str) -> JSONResponse:
    body = ErrorResponse(
        error=ApiError(
            code="NOT_FOUND",
            message=f"No reminder with source={source} externalId={external_id}.",
        ),
    )
    return JSONResponse(status_code=404, content=body.model_dump(by_alias=True))


def _validation_error(message: str) -> JSONResponse:
    body = ErrorResponse(error=ApiError(code=wire_code(ErrorCode.VAL_INVALID_INPUT), message=message))
    return JSONResponse(status_code=400, content=body.model_dump(by_alias=True))


def _contact_not_found(contact_id: str) -> JSONResponse:
    body = ErrorResponse(
        error=ApiError(code="CONTACT_NOT_FOUND", message=f"Contact {contact_id} was not found."),
    )
    return JSONResponse(status_code=404, content=body.model_dump(by_alias=True))


def _reminder_id_from_data(data: dict) -> list[str]:
    reminder = data.get("reminder") or {}
    reminder_id = reminder.get("id") or data.get("id")
    return [reminder_id] if reminder_id else []


@router.get("", response_model=None)
def list_reminders(
    status: str | None = None,
    source: str | None = None,
    from_date: str | None = Query(default=None, alias="from"),
    to_date: str | None = Query(default=None, alias="to"),
    sort: str = Query(default="created_at"),
    limit: int | None = Query(default=None, ge=1, le=500),
    cursor: str | None = None,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[ReminderListResult] | JSONResponse:
    if sort not in {"created_at", "due_at", "completed_at"}:
        body = ErrorResponse(
            error=ApiError(
                code=wire_code(ErrorCode.VAL_INVALID_INPUT),
                message="sort must be one of: created_at, due_at, completed_at",
            )
        )
        return JSONResponse(status_code=400, content=body.model_dump(by_alias=True))
    try:
        result = _reminder_service(db, user).list_reminders(
            status=status,
            source=source,
            from_date=from_date,
            to_date=to_date,
            limit=limit,
            cursor=cursor,
            sort=sort,
        )
    except InvalidCursorError as error:
        body = ErrorResponse(error=ApiError(code=wire_code(ErrorCode.VAL_INVALID_CURSOR), message=str(error)))
        return JSONResponse(status_code=400, content=body.model_dump(by_alias=True))
    except ValueError as error:
        return _validation_error(str(error))
    return ApiResponse(data=result)


@router.get("/today")
def list_reminders_today(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[ReminderListResult]:
    return ApiResponse(data=_reminder_service(db, user).list_today())


@router.get("/lookup")
def lookup_reminder(
    source: str,
    external_id: str = Query(alias="externalId"),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> JSONResponse:
    service = _reminder_service(db, user)
    try:
        reminder = service.find_by_source(source=source, external_id=external_id)
    except ReminderNotFoundError:
        return _source_not_found(source, external_id)
    except ValueError as error:
        return _validation_error(str(error))

    body = ApiResponse(data=ReminderDetailResult(reminder=reminder))
    return JSONResponse(status_code=200, content=body.model_dump(by_alias=True))


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
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
    idempotency_key: str | None = Depends(get_idempotency_key),
) -> JSONResponse:
    user = CurrentUser.from_auth(auth)
    service = _reminder_service(db, user)

    def handler() -> JSONResponse:
        try:
            reminder, created = service.create(
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
        body = ApiResponse(data=CreateReminderResult(reminder=reminder, created=created))
        return JSONResponse(
            status_code=201 if created else 200,
            content=body.model_dump(by_alias=True),
        )

    return run_write(
        db,
        auth,
        operation="create_reminder",
        idempotency_key=idempotency_key,
        target_type="reminder",
        input_summary=input_data.model_dump(by_alias=True),
        handler=handler,
        extract_target_ids=_reminder_id_from_data,
    )


@router.post("/{reminder_id}/complete")
def complete_reminder(
    reminder_id: str,
    input_data: CompleteReminderInput | None = None,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
    idempotency_key: str | None = Depends(get_idempotency_key),
) -> JSONResponse:
    user = CurrentUser.from_auth(auth)
    service = _reminder_service(db, user)

    def handler() -> JSONResponse:
        try:
            reminder = service.complete(reminder_id, input_data)
        except ReminderNotFoundError:
            return _not_found(reminder_id)
        _sync_reminder_notifications(db, user.id, reminder_id)
        body = ApiResponse(data=CompleteReminderResult(reminder=reminder))
        return JSONResponse(status_code=200, content=body.model_dump(by_alias=True))

    return run_write(
        db,
        auth,
        operation="complete_reminder",
        idempotency_key=idempotency_key,
        target_type="reminder",
        input_summary={"reminderId": reminder_id},
        handler=handler,
        extract_target_ids=_reminder_id_from_data,
    )


@router.post("/{reminder_id}/reschedule")
def reschedule_reminder(
    reminder_id: str,
    input_data: RescheduleReminderInput,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
    idempotency_key: str | None = Depends(get_idempotency_key),
) -> JSONResponse:
    user = CurrentUser.from_auth(auth)
    service = _reminder_service(db, user)

    def handler() -> JSONResponse:
        try:
            reminder = service.reschedule(reminder_id, input_data)
        except ReminderNotFoundError:
            return _not_found(reminder_id)
        except ValueError as error:
            return _validation_error(str(error))
        _sync_reminder_notifications(db, user.id, reminder_id)
        body = ApiResponse(data=RescheduleReminderResult(reminder=reminder))
        return JSONResponse(status_code=200, content=body.model_dump(by_alias=True))

    return run_write(
        db,
        auth,
        operation="reschedule_reminder",
        idempotency_key=idempotency_key,
        target_type="reminder",
        input_summary={"reminderId": reminder_id, **input_data.model_dump(by_alias=True)},
        handler=handler,
        extract_target_ids=_reminder_id_from_data,
    )


@router.patch("/{reminder_id}")
def update_reminder(
    reminder_id: str,
    input_data: UpdateReminderInput,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
    idempotency_key: str | None = Depends(get_idempotency_key),
) -> JSONResponse:
    user = CurrentUser.from_auth(auth)
    service = _reminder_service(db, user)

    def handler() -> JSONResponse:
        try:
            reminder = service.update(reminder_id, input_data)
        except ReminderNotFoundError:
            return _not_found(reminder_id)
        except ContactNotFoundError as error:
            return _contact_not_found(str(error))
        except ValueError as error:
            return _validation_error(str(error))
        _sync_reminder_notifications(db, user.id, reminder_id)
        body = ApiResponse(data=UpdateReminderResult(reminder=reminder))
        return JSONResponse(status_code=200, content=body.model_dump(by_alias=True))

    return run_write(
        db,
        auth,
        operation="update_reminder",
        idempotency_key=idempotency_key,
        target_type="reminder",
        input_summary={"reminderId": reminder_id, **input_data.model_dump(by_alias=True)},
        handler=handler,
        extract_target_ids=_reminder_id_from_data,
    )


@router.delete("/{reminder_id}")
def delete_reminder(
    reminder_id: str,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
    idempotency_key: str | None = Depends(get_idempotency_key),
) -> JSONResponse:
    user = CurrentUser.from_auth(auth)
    service = _reminder_service(db, user)

    def handler() -> JSONResponse:
        try:
            deleted_id = service.delete(reminder_id)
        except ReminderNotFoundError:
            return _not_found(reminder_id)
        _sync_reminder_notifications(db, user.id, reminder_id)
        body = ApiResponse(data=DeleteReminderResult(id=deleted_id))
        return JSONResponse(status_code=200, content=body.model_dump(by_alias=True))

    return run_write(
        db,
        auth,
        operation="delete_reminder",
        idempotency_key=idempotency_key,
        target_type="reminder",
        input_summary={"reminderId": reminder_id},
        handler=handler,
        extract_target_ids=lambda data: [data["id"]],
    )
