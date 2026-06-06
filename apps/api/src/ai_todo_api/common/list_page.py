from dataclasses import dataclass
from typing import Generic, TypeVar

from ai_todo_api.schemas import CamelModel


ItemT = TypeVar("ItemT")


@dataclass
class ListPage(Generic[ItemT]):
    items: list[ItemT]
    total_count: int
    next_cursor: str | None = None
    has_more: bool = False


class ListPageMeta(CamelModel):
    total_count: int
    next_cursor: str | None = None
    has_more: bool = False
