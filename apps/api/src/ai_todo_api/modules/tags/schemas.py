from ai_todo_api.schemas import CamelModel


class TagSummary(CamelModel):
    id: str
    name: str


class TagListResult(CamelModel):
    items: list[TagSummary]
    total_count: int
