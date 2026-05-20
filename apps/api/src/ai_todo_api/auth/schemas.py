from ai_todo_api.schemas import CamelModel


class UserSummary(CamelModel):
    id: str
    display_name: str
    timezone: str


class MeResult(CamelModel):
    user: UserSummary
