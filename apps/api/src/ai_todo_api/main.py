import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ai_todo_api.auth.router import router as auth_router
from ai_todo_api.modules.api_tokens.router import router as api_tokens_router
from ai_todo_api.auth.service import ensure_dev_user
from ai_todo_api.config import settings
from ai_todo_api.db.session import SessionLocal, get_db
from ai_todo_api.modules.calendar.router import router as calendar_router
from ai_todo_api.modules.contacts.router import router as contacts_router
from ai_todo_api.modules.notifications.router import router as notifications_router
from ai_todo_api.modules.reminders.router import router as reminders_router
from ai_todo_api.modules.today.router import router as today_router
from ai_todo_api.preview import preview_page
from ai_todo_api.schemas import ApiResponse
from ai_todo_api.version import get_api_version


@asynccontextmanager
async def lifespan(application: FastAPI):
    if settings.allow_dev_auth:
        override = application.dependency_overrides.get(get_db)
        if override is not None:
            session_generator = override()
            try:
                session = next(session_generator)
                ensure_dev_user(
                    session,
                    user_id=settings.dev_user_id,
                    display_name=settings.dev_user_display_name,
                    timezone=settings.timezone,
                )
            finally:
                session_generator.close()
        else:
            with SessionLocal() as session:
                ensure_dev_user(
                    session,
                    user_id=settings.dev_user_id,
                    display_name=settings.dev_user_display_name,
                    timezone=settings.timezone,
                )
    yield


app = FastAPI(title="ai-todo API", version=get_api_version(), lifespan=lifespan)
logger = logging.getLogger(__name__)
static_dir = Path(__file__).parent / "static"
favicon_path = static_dir / "icons" / "ai-todo.svg"
app.mount("/static", StaticFiles(directory=static_dir, check_dir=False), name="static")


def _error_response(
    *,
    status_code: int,
    code: str,
    message: str,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "ok": False,
            "error": {"code": code, "message": message},
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    _: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    return _error_response(
        status_code=422,
        code="VALIDATION_ERROR",
        message="Request validation failed.",
    )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(_: Request, exc: SQLAlchemyError) -> JSONResponse:
    logger.exception("database error")
    message = "Database error."
    if "username" in str(exc).lower() or "identities" in str(exc).lower():
        message = "Database schema is out of date. Run alembic upgrade head on the API host."
    return _error_response(status_code=500, code="DATABASE_ERROR", message=message)


@app.exception_handler(HTTPException)
async def http_exception_handler(_: object, exc: HTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "ok": False,
            "error": {"code": "HTTP_ERROR", "message": str(exc.detail)},
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, HTTPException):
        return await http_exception_handler(request, exc)
    logger.exception("unhandled error")
    return _error_response(
        status_code=500,
        code="INTERNAL_ERROR",
        message="Unexpected server error.",
    )


@app.get("/", response_class=HTMLResponse)
def preview() -> str:
    return preview_page()


@app.get("/favicon.ico", include_in_schema=False)
@app.get("/favicon.svg", include_in_schema=False)
def favicon() -> FileResponse:
    return FileResponse(favicon_path, media_type="image/svg+xml")


@app.get("/v1/health")
def healthcheck() -> ApiResponse[dict[str, str | None]]:
    return ApiResponse(
        data={
            "service": "ai-todo-api",
            "status": "ok",
            "apiVersion": get_api_version(),
            "releaseTag": settings.release_tag,
            "gitSha": settings.git_sha,
        }
    )


@app.get("/v1/health/db")
def health_db(db: Session = Depends(get_db)) -> ApiResponse[dict[str, object]]:
    db.execute(text("SELECT 1"))
    revision = db.execute(text("SELECT version_num FROM alembic_version")).scalar_one_or_none()
    inspector = inspect(db.bind)
    tables = set(inspector.get_table_names())
    users_columns = (
        {column["name"] for column in inspector.get_columns("users")} if "users" in tables else set()
    )
    identities_ok = "identities" in tables
    username_ok = "username" in users_columns
    status = "ok" if identities_ok else "degraded"
    return ApiResponse(
        data={
            "status": status,
            "alembicRevision": revision,
            "identitiesTable": identities_ok,
            "usersHasUsername": username_ok,
        }
    )


app.include_router(auth_router)
app.include_router(api_tokens_router)
app.include_router(reminders_router)
app.include_router(calendar_router)
app.include_router(contacts_router)
app.include_router(notifications_router)
app.include_router(today_router)
