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


def update_user_profile(
    session: Session,
    *,
    user_id: str,
    display_name: str | None,
    avatar_url: str | None,
) -> UserModel:
    user = get_user(session, user_id)
    if user is None:
        raise ValueError("User was not found.")

    if display_name is not None:
        cleaned = display_name.strip()
        if not cleaned:
            raise ValueError("Display name cannot be empty.")
        user.display_name = cleaned[:255]

    if avatar_url is not None:
        cleaned_avatar = avatar_url.strip()
        user.avatar_url = cleaned_avatar or None

    user.updated_at = now_utc()
    session.add(user)
    session.commit()
    session.refresh(user)
    return user
