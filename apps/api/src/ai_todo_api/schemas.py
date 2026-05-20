from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict


T = TypeVar("T")


def to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ApiError(CamelModel):
    code: str
    message: str
    details: object | None = None


class ApiResponse(CamelModel, Generic[T]):
    ok: bool = True
    data: T
    request_id: str | None = None


class ErrorResponse(CamelModel):
    ok: bool = False
    error: ApiError
    request_id: str | None = None
