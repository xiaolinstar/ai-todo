# ai-todo

AI-native reminder, calendar, and contact backend with a structured CLI for agents (OpenClaw, Claude, etc.)—no built-in NL parsing.

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

## Agents (OpenClaw / Claude / Cursor)

Use the structured CLI with `--json`—no built-in natural language on the server.

```bash
pnpm dev:api          # terminal 1
pnpm cli -- today --json   # terminal 2 (or: node apps/cli/dist/index.js)
```

- Command reference: [docs/agent-usage.md](docs/agent-usage.md)
- Installable skill: [skills/ai-todo/SKILL.md](skills/ai-todo/SKILL.md)

## API Development

The backend uses Python + FastAPI.

```bash
python3 -m venv apps/api/.venv
apps/api/.venv/bin/python -m pip install -e "apps/api[dev]"
(cd apps/api && docker compose up -d postgres && .venv/bin/alembic upgrade head)
pnpm dev:api
```

The API listens on `http://127.0.0.1:3100`.
