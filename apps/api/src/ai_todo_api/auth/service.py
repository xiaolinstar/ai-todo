from ai_todo_api.common.time import now_utc
from ai_todo_api.db.models import UserModel
from sqlalchemy import select
from sqlalchemy.orm import Session


def ensure_dev_user(
    session: Session,
    *,
    user_id: str,
    display_name: str,
    timezone: str,
) -> UserModel:
    user = session.get(UserModel, user_id)

    if user is not None:
        return user

    now = now_utc()
    user = UserModel(
        id=user_id,
        display_name=display_name,
        timezone=timezone,
        created_at=now,
        updated_at=now,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def get_user(session: Session, user_id: str) -> UserModel | None:
    return session.scalar(select(UserModel).where(UserModel.id == user_id))
