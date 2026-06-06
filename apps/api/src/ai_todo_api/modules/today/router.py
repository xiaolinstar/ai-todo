from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ai_todo_api.auth.deps import CurrentUser, get_current_user
from ai_todo_api.common.time import today_in_timezone
from ai_todo_api.db.session import get_db
from ai_todo_api.modules.calendar.repository import CalendarEventRepository
from ai_todo_api.modules.calendar.service import CalendarEventService
from ai_todo_api.modules.contacts.links import ContactLinkService
from ai_todo_api.modules.reminders.repository import ReminderRepository
from ai_todo_api.modules.reminders.service import ReminderService
from ai_todo_api.modules.today.schemas import TodayResult
from ai_todo_api.schemas import ApiResponse


router = APIRouter(prefix="/v1", tags=["today"])


@router.get("/today")
def today(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> ApiResponse[TodayResult]:
    links = ContactLinkService(db, user.id)
    reminder_service = ReminderService(
        ReminderRepository(db, user.id),
        user.id,
        user.timezone,
        links,
    )
    calendar_service = CalendarEventService(
        CalendarEventRepository(db, user.id),
        user.id,
        user.timezone,
        links,
    )
    result = TodayResult(
        date=today_in_timezone(user.timezone),
        timezone=user.timezone,
        reminders=reminder_service.list_today().items,
        calendar_events=calendar_service.list_today().items,
    )

    return ApiResponse(data=result)
