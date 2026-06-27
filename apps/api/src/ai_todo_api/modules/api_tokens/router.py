from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ai_todo_api.auth.context import AuthContext
from ai_todo_api.auth.deps import (
    get_auth_context_bearer_required,
    get_client_source,
    get_idempotency_key,
)
from ai_todo_api.auth.scopes import ForbiddenError, require_write
from ai_todo_api.common.write import run_write
from ai_todo_api.db.session import get_db
from ai_todo_api.modules.api_tokens.schemas import (
    ApiTokenListResult,
    CreateApiTokenInput,
    RevokeAllApiTokensResult,
    RevokeApiTokenResult,
)
from ai_todo_api.modules.api_tokens.service import ApiTokenNotFoundError, ApiTokenService
from ai_todo_api.errors import ErrorCode, wire_code
from ai_todo_api.schemas import ApiError, ApiResponse, ErrorResponse


router = APIRouter(prefix="/v1/api-tokens", tags=["api-tokens"])


def _forbidden(message: str) -> JSONResponse:
    body = ErrorResponse(error=ApiError(code="FORBIDDEN", message=message))
    return JSONResponse(status_code=403, content=body.model_dump(by_alias=True))


@router.get("")
def list_api_tokens(
    auth: AuthContext = Depends(get_auth_context_bearer_required),
    db: Session = Depends(get_db),
) -> ApiResponse[ApiTokenListResult]:
    items = ApiTokenService(db).list_pats(auth.user_id)
    return ApiResponse(data=ApiTokenListResult(items=items))


@router.post("")
def create_api_token(
    input_data: CreateApiTokenInput,
    auth: AuthContext = Depends(get_auth_context_bearer_required),
    db: Session = Depends(get_db),
    client_source: str = Depends(get_client_source),
    idempotency_key: str | None = Depends(get_idempotency_key),
) -> JSONResponse:
    try:
        require_write(auth)
    except ForbiddenError as error:
        return _forbidden(str(error))

    def handler() -> JSONResponse:
        try:
            result = ApiTokenService(db).create(auth, input_data, client_kind=client_source)
        except ValueError as error:
            body = ErrorResponse(
                error=ApiError(code=wire_code(ErrorCode.VAL_INVALID_INPUT), message=str(error)),
            )
            return JSONResponse(status_code=400, content=body.model_dump(by_alias=True))

        body = ApiResponse(data=result)
        return JSONResponse(status_code=201, content=body.model_dump(by_alias=True))

    return run_write(
        db,
        auth,
        operation="create_api_token",
        idempotency_key=idempotency_key,
        target_type="api_token",
        input_summary={"name": input_data.name, "scopes": input_data.scopes},
        handler=handler,
        extract_target_ids=lambda data: [data["id"]],
    )


@router.post("/revoke-all")
def revoke_all_api_tokens(
    auth: AuthContext = Depends(get_auth_context_bearer_required),
    db: Session = Depends(get_db),
    idempotency_key: str | None = Depends(get_idempotency_key),
) -> JSONResponse:
    try:
        require_write(auth)
    except ForbiddenError as error:
        return _forbidden(str(error))

    def handler() -> JSONResponse:
        count = ApiTokenService(db).revoke_all_pats(auth.user_id)
        body = ApiResponse(data=RevokeAllApiTokensResult(revoked_count=count))
        return JSONResponse(status_code=200, content=body.model_dump(by_alias=True))

    return run_write(
        db,
        auth,
        operation="revoke_all_api_tokens",
        idempotency_key=idempotency_key,
        target_type="api_token",
        input_summary={},
        handler=handler,
        extract_target_ids=lambda _data: [],
    )


@router.delete("/{token_id}")
def revoke_api_token(
    token_id: str,
    auth: AuthContext = Depends(get_auth_context_bearer_required),
    db: Session = Depends(get_db),
    idempotency_key: str | None = Depends(get_idempotency_key),
) -> JSONResponse:
    try:
        require_write(auth)
    except ForbiddenError as error:
        return _forbidden(str(error))

    def handler() -> JSONResponse:
        try:
            revoked_id = ApiTokenService(db).revoke_pat(auth.user_id, token_id)
        except ApiTokenNotFoundError:
            body = ErrorResponse(
                error=ApiError(code=wire_code(ErrorCode.BIZ_NOT_FOUND), message=f"API token {token_id} was not found."),
            )
            return JSONResponse(status_code=404, content=body.model_dump(by_alias=True))

        body = ApiResponse(data=RevokeApiTokenResult(id=revoked_id))
        return JSONResponse(status_code=200, content=body.model_dump(by_alias=True))

    return run_write(
        db,
        auth,
        operation="revoke_api_token",
        idempotency_key=idempotency_key,
        target_type="api_token",
        input_summary={"tokenId": token_id},
        handler=handler,
        extract_target_ids=lambda data: [data["id"]],
    )
