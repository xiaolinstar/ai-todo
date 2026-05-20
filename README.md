# ai-todo

AI-native reminder, calendar, contact, and CLI workspace.

## Workspace

```text
apps/
  api/
  cli/
  miniapp/
  ios/
  android/
  harmony/
packages/
  shared/
  api-client/
  agent-protocol/
  config/
docs/
  tech-decisions.md  # 技术决策（小程序原生、开发用户等）
```

## First Commands

```bash
pnpm install
pnpm typecheck
pnpm build
```

## API Development

The backend uses Python + FastAPI.

```bash
python3 -m venv apps/api/.venv
apps/api/.venv/bin/python -m pip install -e "apps/api[dev]"
(cd apps/api && docker compose up -d postgres && .venv/bin/alembic upgrade head)
pnpm dev:api
```

The API listens on `http://127.0.0.1:3100`.
