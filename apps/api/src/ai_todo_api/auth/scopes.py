from ai_todo_api.auth.context import AuthContext


class ForbiddenError(Exception):
    pass


def has_scope(auth: AuthContext, scope: str) -> bool:
    if "write" in auth.scopes:
        return True
    return scope in auth.scopes


def require_scope(auth: AuthContext, scope: str) -> None:
    if not has_scope(auth, scope):
        raise ForbiddenError(f"Missing required scope: {scope}")


def require_write(auth: AuthContext) -> None:
    require_scope(auth, "write")


def is_write_method(method: str) -> bool:
    return method.upper() in {"POST", "PATCH", "PUT", "DELETE"}
