from dataclasses import dataclass


DEFAULT_SCOPES = ("read", "write", "contact:read", "contact:write")


@dataclass(frozen=True)
class AuthContext:
    user_id: str
    username: str | None
    display_name: str
    avatar_url: str | None
    timezone: str
    api_token_id: str | None
    token_type: str | None
    scopes: tuple[str, ...]
    client_source: str


@dataclass(frozen=True)
class CurrentUser:
    id: str
    username: str | None
    display_name: str
    avatar_url: str | None
    timezone: str

    @classmethod
    def from_auth(cls, auth: AuthContext) -> "CurrentUser":
        return cls(
            id=auth.user_id,
            username=auth.username,
            display_name=auth.display_name,
            avatar_url=auth.avatar_url,
            timezone=auth.timezone,
        )
