from dataclasses import dataclass

from fastapi import Depends
from sqlalchemy.orm import Session

from ai_todo_api.auth.service import ensure_dev_user
from ai_todo_api.config import settings
from ai_todo_api.db.session import get_db


@dataclass(frozen=True)
class CurrentUser:
    id: str
    display_name: str
    timezone: str


def get_current_user(db: Session = Depends(get_db)) -> CurrentUser:
    """MVP: always resolve the configured development user (no WeChat login yet)."""
    user = ensure_dev_user(
        db,
        user_id=settings.dev_user_id,
        display_name=settings.dev_user_display_name,
        timezone=settings.timezone,
    )
    return CurrentUser(
        id=user.id,
        display_name=user.display_name,
        timezone=user.timezone,
    )
