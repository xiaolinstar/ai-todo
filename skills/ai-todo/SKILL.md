---
name: ai-todo
description: Manage personal reminders, calendar events, and contacts via the ai-todo structured CLI or MCP server. Use when the user asks about todos, reminders, schedule, today agenda, contacts, or wants OpenClaw/Claude to create, list, complete, or reschedule items. For email/ticket/jira integrations, use source + external-id for idempotent reminder writes. Prefer MCP tools when configured (see docs/mcp-setup.md); otherwise call ai-todo with --json. Do not expect server-side natural language parsing.
---

# ai-todo Agent Skill

## Principles

1. **Always use `--json`** for programmatic calls.
2. **Never** call NL parse endpoints; they are out of scope.
3. **Structured fields only**: `--title`, `--due`, `--start`, ISO-8601 with timezone (e.g. `2026-05-20T14:00:00+08:00`).
4. **Contacts**: run `ai-todo contact search "<name>" --json` before writes; if multiple matches, ask the user to pick `contact_id`.
5. **Auth**: write `~/.ai-todo/settings.json` (`url` + `token` from miniapp PAT) or `export AI_TODO_TOKEN` for agents. No `login` step in normal flow.
6. After setup, commands need **no** `--url`; connection comes from settings or env.
7. **External source keys** (`--source` + `--external-id`): use for email Message-ID, ticket ids, etc. Run `reminder find` before create to avoid duplicates. `source` is the business origin (`email`, `jira`), not the HTTP client type.
8. **Writes**: pass `--idempotency-key <uuid>` when the host supports it.

## Setup check

```bash
# ~/.ai-todo/settings.json
# { "url": "https://xingxiaolin.cn", "token": "aitodo_xxx" }

ai-todo version --json
ai-todo whoami --json
```

Install globally: `npm install -g @xiaolinstar/ai-todo-cli`

Component versions are independent; see `docs/releases/versioning.md` and `compatibility.md`. Git `release_tag` (CD) may differ from `cli` / `miniapp` / `apiVersion`.

Expect `ok: true` and `data.user.id` (dev: `user_dev`).

## Core commands

| Task | Command |
|------|---------|
| Today overview | `ai-todo today --json` |
| Create reminder | `ai-todo reminder create --title "…" [--due "…"] [--contact <id> ...] --json` |
| Find by source | `ai-todo reminder find --source "<source>" --external-id "<id>" --json` |
| Create with source | `ai-todo reminder create --title "…" --source "<source>" --external-id "<id>" [--source-meta '{"subject":"…"}'] --json` |
| List by source | `ai-todo reminder list --source "<source>" [--status pending] --json` |
| List reminders | `ai-todo reminder list [--status pending] --json` |
| Show reminder | `ai-todo reminder show <reminder_id> --json` |
| Update reminder | `ai-todo reminder update <id> [--title "…"] [--notes "…"] [--due "…"] [--remind "…"] [--contact <id> ...] --json` |
| Update by source | `ai-todo reminder update --source "<source>" --external-id "<id>" [--title "…"] [--due "…"] --json` |
| Mark in progress | `ai-todo reminder update <id> --status in_progress --json` |
| Complete | `ai-todo reminder done <reminder_id> --json` |
| Complete by source | `ai-todo reminder done --source "<source>" --external-id "<id>" --json` |
| Reschedule | `ai-todo reminder reschedule <id> --due "…" [--remind "…"] --json` |
| Delete reminder | `ai-todo reminder delete <id> --json` |
| Delete by source | `ai-todo reminder delete --source "<source>" --external-id "<id>" --json` |
| Create event | `ai-todo calendar add --title "…" --start "…" [--end "…"] [--contact <id> ...] --json` |
| Update event | `ai-todo calendar update <event_id> [--title "…"] [--start "…"] --json` |
| Today events | `ai-todo calendar today --json` |
| Search contact | `ai-todo contact search "…" --json` |
| Add contact | `ai-todo contact add "…" [--email "…"] --json` |
| Update contact | `ai-todo contact update <contact_id> [--name "…"] [--email "…"] --json` |
| Delete contact | `ai-todo contact delete <contact_id_or_handle> --json` |

Shorthand (human): `ai-todo add "title only"` creates a reminder without due date (shows in today).

Programmatic catalog: `@ai-todo/agent-protocol` or `packages/agent-protocol/dist/agent-tools.json`.

## MCP vs CLI

- **MCP** (when the host supports stdio MCP — Cursor, Claude Desktop, VS Code MCP, etc.): use registered tools (`whoami`, `today`, `reminder_find`, …). See `docs/mcp-setup.md`. MCP wraps CLI; same PAT. Prefer MCP for structured calls without shell.
- **CLI** (always available): full command surface; use when MCP is not configured, for scripts/CI, or for commands not exposed as MCP tools (contact CRUD, token admin, etc.).

MCP is not a simpler install than CLI — it is a **protocol adapter** for MCP-capable hosts. Do not assume Cursor-only.

## Example: user request → commands

User: 「明天上午十点提醒我给王总发报价邮件」

1. Resolve date in agent timezone → `2026-05-21T10:00:00+08:00`
2. `ai-todo contact search "王总" --json` → confirm single match or ask user
3. `ai-todo reminder create --title "给客户王总发报价邮件" --due "2026-05-21T10:00:00+08:00" --contact <contact_id> --json`
4. Reply with `data.reminder.id` and summary

User: 「把这封邮件做成待办，别重复建」

1. Parse email `Message-ID`, subject, suggested due time in the agent
2. `ai-todo reminder find --source email --external-id "<Message-ID>" --json`
3. If found → `reminder update --source email --external-id "<Message-ID>" --title "…" --due "…" --json`
4. Else → `reminder create --title "…" --source email --external-id "<Message-ID>" --source-meta '{"subject":"…"}' --due "…" --json`
5. If `data.created` is `false`, treat as existing row and run `find` again

User: 「JIRA PROJ-123 关单了，对应提醒勾掉」

1. `ai-todo reminder find --source jira --external-id "PROJ-123" --json`
2. `ai-todo reminder done --source jira --external-id "PROJ-123" --json`

User: 「今天有什么安排」

1. `ai-todo today --json`
2. Summarize `data.reminders` and `data.calendarEvents`

## Errors

- If `ok: false`, show `error.code` and `error.message`; do not retry blindly on `VALIDATION_ERROR`.
- `NOT_FOUND` → id may be wrong or deleted; for source lookups, create instead of update.

## More detail

Repository docs: `docs/agent-usage.md`, `docs/api-design.md`.
