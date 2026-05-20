from ai_todo_api.schemas import CamelModel


class CreateApiTokenInput(CamelModel):
    name: str
    scopes: list[str] = ["read", "write", "contact:read", "contact:write"]
    expires_at: str | None = None


class ApiTokenSummary(CamelModel):
    id: str
    name: str
    scopes: list[str]
    expires_at: str | None = None
    last_used_at: str | None = None
    revoked_at: str | None = None
    created_at: str


class CreateApiTokenResult(CamelModel):
    id: str
    token: str
    name: str
    scopes: list[str]
    expires_at: str | None = None


class ApiTokenListResult(CamelModel):
    items: list[ApiTokenSummary]


class RevokeApiTokenResult(CamelModel):
    id: str
    revoked: bool = True
