from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AI_TODO_")

    host: str = Field(default="127.0.0.1")
    port: int = Field(default=3100)
    timezone: str = Field(default="Asia/Shanghai")
    database_url: str = Field(
        default="postgresql+psycopg://ai_todo:ai_todo@127.0.0.1:5432/ai_todo"
    )
    dev_user_id: str = Field(default="user_dev")
    dev_user_display_name: str = Field(default="开发用户")
    allow_dev_auth: bool = Field(default=True)
    wechat_app_id: str | None = Field(default=None)
    wechat_app_secret: str | None = Field(default=None)
    rate_limit_enabled: bool = Field(default=True)
    rate_limit_wechat_login_per_minute: int = Field(default=10, ge=1)
    session_token_ttl_days: int = Field(default=30, ge=1)


settings = Settings()
