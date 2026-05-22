from ai_todo_api.schemas import CamelModel


class UserSummary(CamelModel):
    id: str
    display_name: str
    timezone: str


class MeResult(CamelModel):
    user: UserSummary


class WechatLoginInput(CamelModel):
    code: str


class WechatLoginResult(CamelModel):
    access_token: str
    user: UserSummary
