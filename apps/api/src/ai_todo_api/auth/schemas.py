from ai_todo_api.schemas import CamelModel


class UserSummary(CamelModel):
    id: str
    username: str | None = None
    display_name: str
    timezone: str


class MeResult(CamelModel):
    user: UserSummary


class WechatLoginInput(CamelModel):
    code: str


class WechatLoginResult(CamelModel):
    access_token: str
    token_type: str = "session"
    user: UserSummary


class DevIssuePatInput(CamelModel):
    name: str = "CLI Local"


class DevIssuePatResult(CamelModel):
    id: str
    token: str
    name: str
    token_type: str = "pat"
    scopes: list[str]
