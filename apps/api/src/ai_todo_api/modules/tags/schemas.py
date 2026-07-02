from ai_todo_api.schemas import CamelModel


class TagSummary(CamelModel):
    id: str
    name: str
    color: str = "#007AFF"
    usage_count: int = 0


class TagListResult(CamelModel):
    items: list[TagSummary]
    total_count: int


class CreateTagInput(CamelModel):
    name: str
    color: str | None = None


class UpdateTagInput(CamelModel):
    name: str | None = None
    color: str | None = None


class TagDetailResult(CamelModel):
    tag: TagSummary


class DeleteTagResult(CamelModel):
    id: str
    deleted: bool = True
