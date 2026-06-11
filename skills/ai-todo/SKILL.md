---
name: ai-todo
description: Manage personal reminders, calendar events, and contacts via the ai-todo structured CLI or MCP server. Use when the user asks about todos, reminders, schedule, today agenda, contacts, or wants OpenClaw/Claude to create, list, complete, or reschedule items. For email/ticket/jira integrations, use source + external-id for idempotent reminder writes. Prefer MCP tools when configured (see docs/mcp-setup.md); otherwise call ai-todo with --json. Do not expect server-side natural language parsing—parse time and titles in the agent, then call ai-todo with --json.
---

# ai-todo Agent Skill

## Quick principles

1. **Always use `--json`** for programmatic calls; parse `ok` / `data` / `error.code`.
2. **No NL parsing on the server.** Parse time, title, and recipient in the agent; pass structured fields.
3. **ISO-8601 with timezone** for all time fields (e.g. `2026-05-20T14:00:00+08:00`). Default to the user's local offset (`+08:00` for Asia/Shanghai); never naive timestamps.
4. **Contacts: search before write.** Run `ai-todo contact search "<name>" --json`; if multiple matches, ask user to pick by `id` or `handle`.
5. **Auth via settings file or env.** `~/.ai-todo/settings.json` holds `url` + `token`; or `export AI_TODO_TOKEN`. No `login` step in normal flow.
6. **External source keys** (`--source` + `--external-id`): use for email Message-ID, ticket ids, etc. Run `reminder find` before create to avoid duplicates. `source` is the business origin (`email`, `jira`), not the HTTP client type.
7. **Writes**: pass `--idempotency-key <uuid>` when the host supports it.
8. **Don't trust subcommand `--help`** — see *CLI quirks* below. When in doubt, read `docs/agent-usage.md` in the ai-todo repo.

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

## MCP vs CLI

- **MCP** (when the host supports stdio MCP — Cursor, Claude Desktop, VS Code MCP, etc.): use registered tools (`whoami`, `today`, `reminder_find`, …). See `docs/mcp-setup.md`. MCP wraps CLI; same PAT. Prefer MCP for structured calls without shell.
- **CLI** (always available): full command surface; use when MCP is not configured, for scripts/CI, or for commands not exposed as MCP tools (contact CRUD, token admin, etc.).

MCP is not a simpler install than CLI — it is a **protocol adapter** for MCP-capable hosts. Do not assume Cursor-only.

## Decision: reminder vs calendar event

**One-sentence rule**: *Does this need to be ticked `done`? Yes → reminder. No → calendar event.*

This is codified in the project's own `docs/initial-planning.md`: **Reminder 管「事情和完成」，Calendar 管「时间和安排」**. The strongest data-model difference is lifecycle — only `Reminder` has a `status` field (`pending` / `completed` / `cancelled`); `CalendarEvent` does not.

| Aspect | Calendar event | Reminder |
|---|---|---|
| Nature | Time **block** (occupies start–end) | Action **item** / nudge |
| Lifecycle | Expires naturally — no status field | `pending` → `completed` (or `cancelled`); needs explicit `done` |
| Time | `start` required, `end` typical | `due` optional (no-due reminders show in `today`) |
| Examples | Meetings, flights, appointments, on-call shifts, parties | Submit expenses, reply to email, buy supplies, call back, daily standup prep |

**Anti-pattern: do not create a reminder as "N min before meeting" pre-notification for a calendar event.** CalendarEvent has no `--remind-before` flag today; that's a CLI gap, not a reason to promote an event into a fake task. If a user genuinely needs a push before a meeting, surface the gap and ask — don't compensate with a duplicate object that pollutes the to-do list with items they can't meaningfully complete.

If unsure, ask the user. Default to event when the item has a specific start time and the user said nothing about completion tracking.

## Core commands

| Task | Command |
|------|---------|
| Today overview | `ai-todo today --json` |
| Update user profile | `ai-todo profile update --name "…" [--avatar-url "…"] --json` |
| Create reminder | `ai-todo reminder create --title "…" [--due "…"] [--remind "…"] [--notes "…"] [--contact <id> ...] --json` |
| Create with source | `ai-todo reminder create --title "…" --source "<source>" --external-id "<id>" [--source-meta '{"subject":"…"}'] --idempotency-key <uuid> --json` |
| Find by source | `ai-todo reminder find --source "<source>" --external-id "<id>" --json` |
| List by source | `ai-todo reminder list --source "<source>" [--status pending] --json` |
| List reminders | `ai-todo reminder list [--status pending\|completed\|cancelled] [--sort due\|created\|completed] [--from YYYY-MM-DD] [--to YYYY-MM-DD] --json` |
| Show reminder | `ai-todo reminder show <id> --json` |
| Update reminder | `ai-todo reminder update <id> [--title "…"] [--notes "…"] [--due "…"] [--remind "…"] [--contact <id> ...] --json` |
| Update by source | `ai-todo reminder update --source "<source>" --external-id "<id>" [--title "…"] [--due "…"] --json` |
| Mark in progress | `ai-todo reminder update <id> --status in_progress --json` |
| Complete | `ai-todo reminder done <id> --json` |
| Complete by source | `ai-todo reminder done --source "<source>" --external-id "<id>" --json` |
| Reschedule | `ai-todo reminder reschedule <id> --due "…" [--remind "…"] --json` |
| Delete reminder | `ai-todo reminder delete <id> --json` |
| Delete by source | `ai-todo reminder delete --source "<source>" --external-id "<id>" --json` |
| Create event | `ai-todo calendar add --title "…" --start "…" [--end "…"] [--location "…"] [--contact <id> ...] --json` |
| Update event | `ai-todo calendar update <event_id> [--title "…"] [--start "…"] [--end "…"] [--location "…"] [--description "…"] [--contact <id> ...] --json` |
| Today's events | `ai-todo calendar today --json` |
| Delete event | `ai-todo calendar delete <event_id> --json` |
| Search contact | `ai-todo contact search "<query>" --json` |
| Add contact | `ai-todo contact add "<name>" [--handle "…"] [--email "…"] [--phone "…"] [--company "…"] [--job-title "…"] [--notes "…"] --json` |
| Update contact | `ai-todo contact update <id_or_handle> [--name "…"] [--handle "…"] [--email "…"] [--phone "…"] [--company "…"] [--job-title "…"] [--notes "…"] [--alias "…"] --json` |
| Delete contact | `ai-todo contact delete <id_or_handle> --json` |

Shorthand (human): `ai-todo add "title only"` creates a reminder without due date (shows in today).

Programmatic catalog: `@ai-todo/agent-protocol` or `packages/agent-protocol/dist/agent-tools.json`.

## Write guides

### Reminder — what each field is for

A reminder is **an action item**. Title says what action; structured fields carry time and people.

| Flag | What goes here |
|---|---|
| `--title` | **Imperative verb + object**: "回复王总报价邮件", "交本月报销". Do **not** put just a name ("王总"); do **not** stuff context that belongs in `--notes`. |
| `--due` | Deadline. Optional — a reminder without `--due` still shows in `today` until completed. |
| `--remind` | Explicit notification time, distinct from `--due`. Use only when the wakeup time should differ from the deadline (e.g. due 周五下班前, remind 周四上午). |
| `--notes` | Free-form context: links, qualifiers, multi-line background. |
| `--contact <id_or_handle>` | Repeatable. Link the human(s) involved. The response returns `data.reminder.contacts[]` with `displayName` + `primaryEmail` already attached — **never stuff contact info into the title**. |
| `--source` / `--external-id` | Business-origin key (e.g. `email` + `<Message-ID>`, `jira` + `PROJ-123`). Use together so the row is idempotent across syncs. |
| `--source-meta` | JSON object with origin context (e.g. `{"subject":"…","from":"…"}`). **Must be a JSON object, not an array or scalar** (`VALIDATION_ERROR` otherwise). |
| `--idempotency-key <uuid>` | Pass when the host supports it; protects against duplicate creates on retries. |

Example:
```bash
ai-todo reminder create \
  --title "回复王总报价确认邮件" \
  --due "2026-05-21T10:00:00+08:00" \
  --contact wangzong \
  --notes "对方上次回复在 2026-05-15，关注价格和交付期" \
  --json
```

### Calendar event — what each field is for

A calendar event is **a time block**. Title is a noun phrase; time and place go in their own fields.

| Flag | What goes here |
|---|---|
| `--title` | **Noun phrase**: "产品评审", "数智化部党员大会". Do **not** prefix with "提醒/Remind"; do **not** stuff the location or "必须参加" into the title. |
| `--start` / `--end` | ISO with TZ offset. **Always include `--end` for meetings** — events without `--end` are interpreted as point-in-time. |
| `--location` | Physical room, address, or video link. **Use it** — don't append to title. |
| `--contact <id_or_handle>` | Repeatable. Attendees. |
| `--description` | **Only on `update`**, not on `add`. Set post-creation if you need extended notes (agenda, file numbers, etc.). |

**CLI does not expose `--remind-before` on calendar.** Do not work around with a side-reminder (see *Decision* above). Surface the gap and ask the user.

Example:
```bash
ai-todo calendar add \
  --title "产品评审" \
  --start "2026-05-20T14:00:00+08:00" \
  --end   "2026-05-20T15:00:00+08:00" \
  --location "南京·虎踞路81号·20楼会议室A" \
  --contact wangzong --contact linweiqian \
  --json
```

### Contact — field-by-field

A contact is **a person record**. Structured fields beat free-form notes. Always `contact search` first.

| Flag | Server field | When / how to fill |
|---|---|---|
| `<name>` positional / `--name` | `displayName` | **Required.** Canonical full name ("张晓培"), not nickname or role ("张姐"/"王总"). |
| `--handle` | `handle` | Override only when the auto-generated slug (pinyin: 张晓培 → `zhangxiaopei`) would collide or read poorly. Format: `[a-z0-9-]+`. |
| `--email` | `methods[]` of `type=email, label="work", isPrimary=true` | Work email. CLI hardcodes the label; for multiple emails or non-work labels use the HTTP API directly. |
| `--phone` | `methods[]` of `type=phone, label="mobile", isPrimary=true` | Same pattern as email. |
| `--company` | `company` | Full organization name. **Match the format peers already use in the system** (e.g. align with siblings' "中国移动通信集团 /"). |
| `--job-title` | `title` | Actual job role at company ("产品总监", "前端工程师"). Skip if unknown. Don't conflate with relationship tags like "总部接口人" — those go in `--notes`. |
| `--alias` *(update only; appends)* | `aliases[]` | Search keywords the user is likely to type later: "王总", English name, role label. Each call appends one. Improves later `contact search` hit rate. |
| `--notes` | `notes` | Free-form context that doesn't fit a structured field: relationship tag ("总部接口人 / 深圳"), city, how met, account numbers, prefers-WeChat. Newlines OK. Use `<tag> / <subtag>` format for scanability. |

Filling rules:
1. **Required: `name` only.** Everything else optional.
2. **Always `ai-todo contact search "<name>" --json` first.** Multiple matches → ask user to pick by `id` or `handle`.
3. **Prefer structured fields over notes.** If it fits `company` / `title`, don't dump into `notes`.
4. `linkedUserId` and `nickname` have **no CLI flag** — `linkedUserId` is server-set when a contact links to a registered user; `nickname` is auto-derived into `aliases`. Ignore both in agent code.

Example (new contact with the typical fields):
```bash
ai-todo contact add "张松蕾" \
  --email "zhangsonglei@chinamobile.com" \
  --company "中国移动通信集团 /" \
  --notes "总部接口人 / 北京" \
  --json
```

## Examples: user request → commands

**1. Time-bound task with contact** — 「明天上午十点提醒我给王总发报价邮件」
1. Resolve date in user timezone → `2026-05-21T10:00:00+08:00`.
2. `ai-todo contact search "王总" --json` → pick `contact_id`.
3. `ai-todo reminder create --title "给王总发报价邮件" --due "2026-05-21T10:00:00+08:00" --contact <id> --json`
4. Surface `data.reminder.id` and recipient from `data.reminder.contacts[0]`.

**2. Untimed task** — 「提醒我交本月报销」
1. `ai-todo reminder create --title "交本月报销" --json` (no `--due`)
2. Item shows in `today` until marked done. Surface `data.reminder.id`.

**3. Meeting with location** — 「周五下午 4 点产品评审会，会议室 A」
1. Resolve dates → start `2026-05-22T16:00:00+08:00`, end (assume 1h) `2026-05-22T17:00:00+08:00`.
2. `ai-todo calendar add --title "产品评审" --start "…" --end "…" --location "会议室 A" --json`
3. **Do not** add a companion "15 分钟前" reminder (see *Decision* above).

**4. Multi-attendee meeting** — 「下周一上午 10 点和张晓培、林伟谦周会」
1. `ai-todo contact search "张晓培" --json` and `... "林伟谦" --json` → collect both `contact_id`.
2. Resolve start/end times.
3. `ai-todo calendar add --title "周会" --start "…" --end "…" --contact <id1> --contact <id2> --json`

**5. Email → reminder, idempotent** — 「把这封邮件做成待办，别重复建」
1. Parse email `Message-ID`, subject, suggested due time in the agent.
2. `ai-todo reminder find --source email --external-id "<Message-ID>" --json`.
3. If found → `reminder update --source email --external-id "<Message-ID>" --title "…" --due "…" --json`.
4. Else → `reminder create --title "…" --source email --external-id "<Message-ID>" --source-meta '{"subject":"…"}' --due "…" --idempotency-key <uuid> --json`.
5. If `data.created` is `false`, treat as existing row and run `find` again.

**6. Ticket closed → complete the linked reminder** — 「JIRA PROJ-123 关单了，对应提醒勾掉」
1. `ai-todo reminder find --source jira --external-id "PROJ-123" --json`.
2. `ai-todo reminder done --source jira --external-id "PROJ-123" --json`.

**7. Today's agenda** — 「今天有什么安排」
1. `ai-todo today --json`.
2. Summarize `data.reminders` and `data.calendarEvents` **separately** — they are different concepts (see *Decision* above); never merge them into one list.

## CLI quirks

- **No per-subcommand `--help` dispatcher.** `ai-todo <sub> --help` prints a one-line `Usage:` and exits with error code 1. There is no real help text per subcommand.
- **Top-level `ai-todo --help` is also incomplete.** Missing: `--description` (calendar update), `--contact` (calendar add/update, reminder create), `--source-meta` (reminder create), and **all `contact` create/update flags**.
- **Authoritative references** when in doubt:
  - Patterns & workflows: `/home/xiaolin/AgentProjects/ai-todo/docs/agent-usage.md`
  - Data model & field semantics: `docs/data-model.md`
  - Complete flag surface: source under `apps/cli/src/commands/`

## Errors

- If `ok: false`, show `error.code` and `error.message`; do not retry blindly on `VALIDATION_ERROR`.
- `NOT_FOUND` → id may be wrong or deleted; for source lookups, create instead of update.
- `CONTACT_NOT_FOUND` → unknown contact handle/id passed via `--contact`. Re-run `contact search`.
- `VALIDATION_ERROR` on `sourceMeta` → must be a JSON object (not array, not scalar).

## More detail

Repository docs (`/home/xiaolin/AgentProjects/ai-todo/docs/`):
- **`data-model.md`** — entity fields, handle auto-generation, status enums
- **`agent-usage.md`** — agent patterns, sourced reminders, idempotency-key
- **`api-design.md`** — HTTP contract, error codes
- **`initial-planning.md`** §"核心区别" — the rationale behind reminder ≠ event
- **`cli-design.md`** — CLI conventions and constraints
- **`mcp-setup.md`** — stdio MCP server, tool registry, host configuration
