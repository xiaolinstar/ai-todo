from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ai_todo_api.auth.context import AuthContext, CurrentUser
from ai_todo_api.auth.deps import get_auth_context, get_current_user, get_idempotency_key
from ai_todo_api.common.write import run_write
from ai_todo_api.db.session import get_db
from ai_todo_api.modules.notifications.schemas import (
    NotificationSettingsResult,
    NotificationStatusResult,
    UpdateNotificationSettingsInput,
    WechatSubscriptionResult,
    WechatSubscriptionResultInput,
)
from ai_todo_api.modules.notifications.service import (
    NotificationDeliveryService,
    NotificationTargetNotFoundError,
    NotificationValidationError,
)
from ai_todo_api.schemas import ApiError, ApiResponse, ErrorResponse


router = APIRouter(prefix="/v1/notifications", tags=["notifications"])


def _service(db: Session, user_id: str) -> NotificationDeliveryService:
    return NotificationDeliveryService(db, user_id)


def _validation_error(message: str) -> JSONResponse:
    body = ErrorResponse(error=ApiError(code="VALIDATION_ERROR", message=message))
    return JSONResponse(status_code=400, content=body.model_dump(by_alias=True))


def _target_not_found(target_id: str) -> JSONResponse:
    body = ErrorResponse(
        error=ApiError(code="NOT_FOUND", message=f"Notification target {target_id} was not found."),
    )
    return JSONResponse(status_code=404, content=body.model_dump(by_alias=True))


def _delivery_id_from_data(data: dict) -> list[str]:
    delivery_id = data.get("deliveryId")
    return [delivery_id] if delivery_id else []


@router.get("/settings")
def get_notification_settings(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[NotificationSettingsResult]:
    settings = _service(db, user.id).get_settings()
    return ApiResponse(data=NotificationSettingsResult(settings=settings))


@router.put("/settings")
def update_notification_settings(
    input_data: UpdateNotificationSettingsInput,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
    idempotency_key: str | None = Depends(get_idempotency_key),
) -> JSONResponse:
    def handler() -> JSONResponse:
        settings = _service(db, auth.user_id).update_settings(input_data)
        body = ApiResponse(data=NotificationSettingsResult(settings=settings))
        return JSONResponse(status_code=200, content=body.model_dump(by_alias=True))

    return run_write(
        db,
        auth,
        operation="update_notification_settings",
        idempotency_key=idempotency_key,
        target_type="notification_settings",
        input_summary=input_data.model_dump(by_alias=True),
        handler=handler,
    )


@router.post("/wechat/subscription-result")
def record_wechat_subscription_result(
    input_data: WechatSubscriptionResultInput,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
    idempotency_key: str | None = Depends(get_idempotency_key),
) -> JSONResponse:
    def handler() -> JSONResponse:
        try:
            accepted, delivery, quota_remaining = _service(
                db,
                auth.user_id,
            ).record_wechat_subscription_result(
                template_key=input_data.template_key,
                template_id=input_data.template_id,
                result=input_data.result,
                target_type=input_data.target_type,
                target_id=input_data.target_id,
            )
        except NotificationTargetNotFoundError as error:
            return _target_not_found(str(error))
        except NotificationValidationError as error:
            return _validation_error(str(error))

        body = ApiResponse(
            data=WechatSubscriptionResult(
                accepted=accepted,
                delivery_id=delivery.id if delivery else None,
                status=delivery.status if delivery else None,
                quota_remaining=quota_remaining,
            )
        )
        return JSONResponse(status_code=200, content=body.model_dump(by_alias=True))

    return run_write(
        db,
        auth,
        operation="record_wechat_subscription_result",
        idempotency_key=idempotency_key,
        target_type="notification_delivery",
        input_summary=input_data.model_dump(by_alias=True),
        handler=handler,
        extract_target_ids=_delivery_id_from_data,
    )


@router.get("/status")
def list_notification_status(
    target_type: str | None = Query(default=None),
    target_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[NotificationStatusResult]:
    items = _service(db, user.id).list_deliveries(
        target_type=target_type,
        target_id=target_id,
        limit=limit,
    )
    return ApiResponse(data=NotificationStatusResult(items=items))
