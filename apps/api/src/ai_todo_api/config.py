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
    wechat_reminder_template_id: str | None = Field(default=None)
    rate_limit_enabled: bool = Field(default=True)
    rate_limit_wechat_login_per_minute: int = Field(default=10, ge=1)
    session_token_ttl_days: int = Field(default=30, ge=1)
    pat_default_max_idle_days: int | None = Field(default=90)
    pat_max_ttl_days: int | None = Field(default=365)
    notification_worker_poll_seconds: int = Field(default=30, ge=1)
    notification_worker_batch_size: int = Field(default=50, ge=1)
    notification_max_attempts: int = Field(default=3, ge=1)
    release_tag: str | None = Field(default=None)
    git_sha: str | None = Field(default=None)
    icp_beian_text: str | None = Field(default="苏ICP备2026011017号-7")
    public_security_beian_text: str | None = Field(default="苏公网安备32010602012480号")


settings = Settings()
