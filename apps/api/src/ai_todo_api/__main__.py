from ai_todo_api.config import settings
from ai_todo_api.main import app


def main() -> None:
    import uvicorn

    uvicorn.run(app, host=settings.host, port=settings.port)


if __name__ == "__main__":
    main()
