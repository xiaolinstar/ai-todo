from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import HTMLResponse

from ai_todo_api.auth.router import router as auth_router
from ai_todo_api.auth.service import ensure_dev_user
from ai_todo_api.config import settings
from ai_todo_api.db.session import SessionLocal
from ai_todo_api.modules.calendar.router import router as calendar_router
from ai_todo_api.modules.contacts.router import router as contacts_router
from ai_todo_api.modules.reminders.router import router as reminders_router
from ai_todo_api.modules.today.router import router as today_router
from ai_todo_api.preview import preview_page
from ai_todo_api.schemas import ApiResponse


@asynccontextmanager
async def lifespan(_: FastAPI):
    with SessionLocal() as session:
        ensure_dev_user(
            session,
            user_id=settings.dev_user_id,
            display_name=settings.dev_user_display_name,
            timezone=settings.timezone,
        )
    yield


app = FastAPI(title="ai-todo API", version="0.1.0", lifespan=lifespan)


@app.get("/", response_class=HTMLResponse)
def preview() -> str:
    return preview_page()


@app.get("/v1/health")
def healthcheck() -> ApiResponse[dict[str, str]]:
    return ApiResponse(data={"service": "ai-todo-api", "status": "ok"})


app.include_router(auth_router)
app.include_router(reminders_router)
app.include_router(calendar_router)
app.include_router(contacts_router)
app.include_router(today_router)
