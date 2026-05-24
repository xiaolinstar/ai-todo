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
  miniapp-conventions.md  # 微信小程序规范（对齐 party-helper）
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
pnpm cli today --json # terminal 2
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

## Production Deploy

生产环境通过 **xiaolin-gateway** 提供 `https://wodi.games`，API 宿主机端口 **8082**。

See [docs/deploy.md](docs/deploy.md) for Docker deployment, gateway routing, WeChat domain setup, and CI/CD. **Release runbook:** [docs/release-runbook.md](docs/release-runbook.md).

## WeChat Miniapp

Native WeChat miniapp MVP in `apps/miniapp/`. See [apps/miniapp/README.md](apps/miniapp/README.md).

```bash
pnpm dev:api   # start API first
pnpm build:wechat   # if you changed miniapp .ts/.scss
# Then open apps/miniapp in WeChat DevTools (disable domain check for local dev)
```
