from ai_todo_api.schemas import CamelModel


class UserSummary(CamelModel):
    id: str
    username: str | None = None
    display_name: str
    avatar_url: str | None = None
    timezone: str


class MeResult(CamelModel):
    user: UserSummary


class UpdateProfileInput(CamelModel):
    display_name: str | None = None
    avatar_url: str | None = None


class UpdateProfileResult(CamelModel):
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
