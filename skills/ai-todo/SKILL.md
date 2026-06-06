---
name: ai-todo
description: Manage personal reminders, calendar events, and contacts via the ai-todo structured CLI. Use when the user asks about todos, reminders, schedule, today agenda, contacts, or wants OpenClaw/Claude to create, list, complete, or reschedule items. Do not expect server-side natural language parsing—parse time and titles in the agent, then call ai-todo with --json.
---

# ai-todo Agent Skill

## Principles

1. **Always use `--json`** for programmatic calls.
2. **Never** call NL parse endpoints; they are out of scope.
3. **Structured fields only**: `--title`, `--due`, `--start`, ISO-8601 with timezone (e.g. `2026-05-20T14:00:00+08:00`).
4. **Contacts**: run `ai-todo contact search "<name>" --json` before writes; if multiple matches, ask the user to pick `contact_id`.
5. **Auth**: write `~/.ai-todo/settings.json` (`url` + `token` from miniapp PAT) or `export AI_TODO_TOKEN` for agents. No `login` step in normal flow.
6. After setup, commands need **no** `--url`; connection comes from settings or env.

## Setup check

```bash
# ~/.ai-todo/settings.json
# { "url": "https://wodi.games", "token": "aitodo_xxx" }

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
| Update current user profile | `ai-todo profile update --name "…" [--avatar-url "…"] --json` |
| Create reminder | `ai-todo reminder create --title "…" [--due "…"] [--contact <id> ...] --json` |
| List reminders | `ai-todo reminder list [--status pending] --json` |
| Show reminder | `ai-todo reminder show <reminder_id> --json` |
| Update reminder | `ai-todo reminder update <id> [--title "…"] [--notes "…"] [--due "…"] [--remind "…"] [--contact <id> ...] --json` |
| Complete | `ai-todo reminder done <reminder_id> --json` |
| Reschedule | `ai-todo reminder reschedule <id> --due "…" [--remind "…"] --json` |
| Delete reminder | `ai-todo reminder delete <id> --json` |
| Create event | `ai-todo calendar add --title "…" --start "…" [--end "…"] [--contact <id> ...] --json` |
| Update event | `ai-todo calendar update <event_id> [--title "…"] [--start "…"] --json` |
| Today events | `ai-todo calendar today --json` |
| Search contact | `ai-todo contact search "…" --json` |
| Add contact | `ai-todo contact add "…" [--email "…"] --json` |
| Update contact | `ai-todo contact update <contact_id> [--name "…"] [--email "…"] --json` |
| Delete contact | `ai-todo contact delete <contact_id_or_handle> --json` |

Shorthand (human): `ai-todo add "title only"` creates a reminder without due date (shows in today).

## Example: user request → commands

User: 「明天上午十点提醒我给王总发报价邮件」

1. Resolve date in agent timezone → `2026-05-21T10:00:00+08:00`
2. `ai-todo contact search "王总" --json` → confirm single match or ask user
3. `ai-todo reminder create --title "给客户王总发报价邮件" --due "2026-05-21T10:00:00+08:00" --contact <contact_id> --json`
4. Reply with `data.reminder.id` and summary

User: 「晚上 6 点联系小明完成作业」

1. `ai-todo contact search "小明" --json` → pick `contact_id`
2. `ai-todo reminder create --title "联系小明完成作业" --due "2026-05-20T18:00:00+08:00" --contact <contact_id> --json`
3. Response includes `data.reminder.contacts[]` with display name and primary email for later email-cli

User: 「今天有什么安排」

1. `ai-todo today --json`
2. Summarize `data.reminders` and `data.calendarEvents`

## Errors

- If `ok: false`, show `error.code` and `error.message`; do not retry blindly on `VALIDATION_ERROR`.
- `NOT_FOUND` → id may be wrong or deleted.

## More detail

Repository docs: `docs/agent-usage.md`, `docs/api-design.md`.
