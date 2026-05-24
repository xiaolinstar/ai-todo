# ai-todo API

FastAPI backend for ai-todo.

## Local Development

```bash
cd apps/api
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -e ".[dev]"
docker compose up -d postgres
alembic upgrade head
python -m ai_todo_api
```

The API listens on `http://127.0.0.1:3100` by default.

Configuration is read from `AI_TODO_*` environment variables. Copy `.env.example` for local
PostgreSQL defaults.

```bash
cp .env.example .env
```

## Authentication (MVP)

MVP supports **Bearer API tokens** and an optional **development user fallback**
(`AI_TODO_ALLOW_DEV_AUTH=true`, default). Without `Authorization`, requests run as
`user_dev`. With `Authorization: Bearer aitodo_…`, requests run as the token owner.
See `docs/tech-decisions.md`.

Write requests accept `Idempotency-Key` and are recorded in `command_logs`.

## Current Endpoints

- `GET /`
- `GET /v1/health`
- `GET /v1/me`
- `POST /v1/auth/wechat/login` — miniapp `wx.login` code exchange (requires `AI_TODO_WECHAT_APP_ID/SECRET`)
- `GET /v1/api-tokens`
- `POST /v1/api-tokens`
- `DELETE /v1/api-tokens/{token_id}`
- `GET /v1/today`
- `GET /v1/reminders` — 列表（`status`、`from`、`to`、`limit`）
- `GET /v1/reminders/today` — 今日待办（含无截止 pending、逾期 pending）
- `GET /v1/reminders/{reminder_id}`
- `POST /v1/reminders`
- `PATCH /v1/reminders/{reminder_id}`
- `POST /v1/reminders/{reminder_id}/complete`
- `POST /v1/reminders/{reminder_id}/reschedule`
- `DELETE /v1/reminders/{reminder_id}` — 软删除
- `GET /v1/calendar/events` — 日程列表（`from`、`to`、`limit`）
- `GET /v1/calendar/today` — 今日日程
- `GET /v1/calendar/events/{event_id}`
- `POST /v1/calendar/events`
- `PATCH /v1/calendar/events/{event_id}`
- `DELETE /v1/calendar/events/{event_id}` — 软删除
- `POST /v1/contacts`
- `GET /v1/contacts`
- `GET /v1/contacts/{contact_id}`
- `PATCH /v1/contacts/{contact_id}`

## Persistence

The API uses SQLAlchemy 2.x and Alembic. Migrations create `users`, `reminders`, and contact
tables with `user_id` foreign keys. Tests override the database dependency with an in-memory
SQLite database, while local development uses PostgreSQL through `AI_TODO_DATABASE_URL`.

Run migrations after pulling:

```bash
alembic upgrade head
```

## Production Deploy

Docker + PostgreSQL，宿主机 **8082** → 容器 3100。HTTPS 由 [xiaolin-gateway](https://github.com/xiaolinstar/xiaolin-gateway) 反代 `https://wodi.games`。

See **[docs/deploy.md](../../docs/deploy.md)**。

```bash
cd apps/api
cp .env.production.example .env.production
# 编辑 POSTGRES_PASSWORD、微信 AppID/Secret
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
curl http://127.0.0.1:8082/v1/health
```

国内服务器若 `pip install` 构建失败，见 deploy.md — 默认已使用腾讯云 PyPI 镜像。

Production must set `AI_TODO_ALLOW_DEV_AUTH=false`. Miniapp auth uses WeChat login.
