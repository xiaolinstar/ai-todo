import hashlib
import secrets


TOKEN_PREFIX = "aitodo_"


def generate_api_token() -> str:
    return f"{TOKEN_PREFIX}{secrets.token_urlsafe(32)}"


def hash_api_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
