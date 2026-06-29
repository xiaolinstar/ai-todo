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
8. **WeChat push reminders**: CLI and MCP **cannot** enable WeChat subscription notifications when creating reminders or calendar events. Only the WeChat miniapp can toggle this. If the user asks for WeChat push, create the item normally and tell them to enable it in the miniapp (edit page → WeChat reminder switch).
9. **Don't trust subcommand `--help`** — see _CLI quirks_ below. When in doubt, read `docs/agent-usage.md` in the ai-todo repo.

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

- **MCP** (when the host supports stdio MCP — Cursor, Claude Desktop, VS Code MCP, etc.): use registered P0 tools — `whoami`, `today`, `reminder_find`, `reminder_create`, `reminder_create_sourced`, `reminder_list`, `reminder_list_by_source`, `reminder_update_by_source`, `reminder_complete_by_source`, `contact_search`, `calendar_today`, `calendar_create`. See `docs/mcp-setup.md`. MCP wraps CLI; same PAT. Prefer MCP for structured calls without shell. Contact CRUD, reminder delete, token admin, etc. still need CLI.
- **CLI** (always available): full command surface; use when MCP is not configured, for scripts/CI, or for commands not exposed as MCP tools (contact CRUD, token admin, etc.).

MCP is not a simpler install than CLI — it is a **protocol adapter** for MCP-capable hosts. Do not assume Cursor-only.

## WeChat subscription reminders

WeChat **订阅消息**（到期/开始时推送到微信）与 CLI 写入是分开的：

| Client            | Create default                                             | Enable / disable                          |
| ----------------- | ---------------------------------------------------------- | ----------------------------------------- |
| WeChat miniapp    | Follows user notification prefs (`defaultReminderEnabled`) | Create/edit toggle + re-authorize in list |
| CLI / MCP / Agent | **`wechatNotifyRequested: false`** — no WeChat push        | **Not supported** — no CLI flag           |

**Read-only API fields** (present in `reminder list/show`, `calendar` responses, `today --json`):

- `wechatNotifyRequested` — user wants WeChat push for this item
- `wechatNotifyStatus` — delivery state: `none` | `pending` | `sending` | `sent` | `failed` | `no_quota` | `skipped`

**Agent rules:**

1. Do **not** promise WeChat push for items you just created via CLI/MCP unless the user will enable it in the miniapp.
2. If the user explicitly asks for 「微信提醒 / 微信通知 / 订阅消息」 when creating via Agent, **still create** the reminder/event, then reply: _已在待办/日历中创建；微信推送需在小程序编辑页开启「微信提醒」并完成授权。_
3. When summarizing existing items, you may mention `wechatNotifyStatus` if the user cares about delivery (e.g. `pending` = 待开启授权).
4. MCP tools (`reminder_create`, `calendar_create`, etc.) inherit the same limitation — they wrap CLI with client source `cli`.

## Decision: reminder vs calendar event

**One-sentence rule**: _Does this need to be ticked `done`? Yes → reminder. No → calendar event._

This is codified in the project's own `docs/initial-planning.md`: **Reminder 管「事情和完成」，Calendar 管「时间和安排」**. The strongest data-model difference is lifecycle — only `Reminder` has a `status` field (`pending` / `in_progress` / `completed` / `cancelled`); `CalendarEvent` does not.

| Aspect    | Calendar event                                           | Reminder                                                                                                    |
| --------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Nature    | Time **block** (occupies start–end)                      | Action **item** / nudge                                                                                     |
| Lifecycle | Expires naturally — no status field                      | `pending` → `in_progress` → `completed` (or back to `pending`; `cancelled` internal); needs explicit `done` |
| Time      | `start` required, `end` typical                          | `due` optional (no-due reminders show in `today`)                                                           |
| Examples  | Meetings, flights, appointments, on-call shifts, parties | Submit expenses, reply to email, buy supplies, call back, daily standup prep                                |

**Anti-pattern: do not create a reminder as "N min before meeting" pre-notification for a calendar event.** CalendarEvent has no `--remind-before` flag today; that's a CLI gap, not a reason to promote an event into a fake task. If a user genuinely needs a push before a meeting, surface the gap and ask — don't compensate with a duplicate object that pollutes the to-do list with items they can't meaningfully complete.

If unsure, ask the user. Default to event when the item has a specific start time and the user said nothing about completion tracking.

## Core commands

| Task               | Command                                                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Today overview     | `ai-todo today --json` (open reminders + today's events)                                                                                                             |
| Read profile       | `ai-todo whoami --json` (display name, timezone; edit avatar/name in WeChat miniapp **Mine**)                                                                        |
| Create reminder    | `ai-todo reminder create --title "…" [--due "…"] [--remind "…"] [--notes "…"] [--contact <id> ...] --json`                                                           |
| Create with source | `ai-todo reminder create --title "…" --source "<source>" --external-id "<id>" [--source-meta '{"subject":"…"}'] --idempotency-key <uuid> --json`                     |
| Find by source     | `ai-todo reminder find --source "<source>" --external-id "<id>" --json`                                                                                              |
| List by source     | `ai-todo reminder list --source "<source>" [--status pending\|in_progress\|completed\|cancelled] --json`                                                             |
| List reminders     | `ai-todo reminder list [--status pending\|in_progress\|completed\|cancelled] [--sort due\|created\|completed] [--from YYYY-MM-DD] [--to YYYY-MM-DD] --json`          |
| Show reminder      | `ai-todo reminder show <id> --json`                                                                                                                                  |
| Update reminder    | `ai-todo reminder update <id> [--title "…"] [--notes "…"] [--status pending\|in_progress\|completed] [--due "…"] [--remind "…"] [--contact <id> ...] --json`         |
| Update by source   | `ai-todo reminder update --source "<source>" --external-id "<id>" [--title "…"] [--status …] [--due "…"] --json`                                                     |
| Mark in progress   | `ai-todo reminder update <id> --status in_progress --json`                                                                                                           |
| Complete           | `ai-todo reminder done <id> --json`                                                                                                                                  |
| Complete by source | `ai-todo reminder done --source "<source>" --external-id "<id>" --json`                                                                                              |
| Reschedule         | `ai-todo reminder reschedule <id> --due "…" [--remind "…"] --json`                                                                                                   |
| Delete reminder    | `ai-todo reminder delete <id> --json`                                                                                                                                |
| Delete by source   | `ai-todo reminder delete --source "<source>" --external-id "<id>" --json`                                                                                            |
| Create event       | `ai-todo calendar add --title "…" --start "…" [--end "…"] [--location "…"] [--contact <id> ...] --json`                                                              |
| Update event       | `ai-todo calendar update <event_id> [--title "…"] [--start "…"] [--end "…"] [--location "…"] [--description "…"] [--contact <id> ...] --json`                        |
| Today's events     | `ai-todo calendar today --json`                                                                                                                                      |
| Show event         | `ai-todo calendar show <event_id> --json`                                                                                                                            |
| Delete event       | `ai-todo calendar delete <event_id> --json`                                                                                                                          |
| List contacts      | `ai-todo contact list [--limit <n>] [--cursor <token>] --json`                                                                                                       |
| Search contact     | `ai-todo contact search "<query>" --json`                                                                                                                            |
| Show contact       | `ai-todo contact show <id_or_handle> --json`                                                                                                                         |
| Add contact        | `ai-todo contact add "<name>" [--handle "…"] [--email "…"] [--phone "…"] [--company "…"] [--job-title "…"] [--notes "…"] --json`                                     |
| Update contact     | `ai-todo contact update <id_or_handle> [--name "…"] [--handle "…"] [--email "…"] [--phone "…"] [--company "…"] [--job-title "…"] [--notes "…"] [--alias "…"] --json` |
| Delete contact     | `ai-todo contact delete <id_or_handle> --json`                                                                                                                       |

Shorthand (human): `ai-todo add "title only"` creates a reminder without due date (shows in today).

Programmatic catalog: `@ai-todo/agent-protocol` or `packages/agent-protocol/dist/agent-tools.json`.

## Write guides

### Reminder — what each field is for

A reminder is **an action item**. Title says what action; structured fields carry time and people.

| Flag                         | What goes here                                                                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--title`                    | **Imperative verb + object**: "回复王总报价邮件", "交本月报销". Do **not** put just a name ("王总"); do **not** stuff context that belongs in `--notes`.                                    |
| `--due`                      | Deadline. Optional — a reminder without `--due` still shows in `today` until completed.                                                                                                     |
| `--remind`                   | Explicit notification time, distinct from `--due`. Use only when the wakeup time should differ from the deadline (e.g. due 周五下班前, remind 周四上午).                                    |
| `--notes`                    | Free-form context: links, qualifiers, multi-line background.                                                                                                                                |
| `--contact <id_or_handle>`   | Repeatable. Link the human(s) involved. The response returns `data.reminder.contacts[]` with `displayName` + `primaryEmail` already attached — **never stuff contact info into the title**. |
| `--source` / `--external-id` | Business-origin key (e.g. `email` + `<Message-ID>`, `jira` + `PROJ-123`). Use together so the row is idempotent across syncs.                                                               |
| `--source-meta`              | JSON object with origin context (e.g. `{"subject":"…","from":"…"}`). **Must be a JSON object, not an array or scalar** (`VAL_INVALID_INPUT` otherwise).                                     |
| `--status` _(update only)_   | `pending` (not started), `in_progress` (actively working), `completed`. Use on `reminder update` when the item is underway but not done.                                                    |
| `--idempotency-key <uuid>`   | Pass when the host supports it; protects against duplicate creates on retries.                                                                                                              |

**WeChat push:** CLI has no `--wechat-notify` flag. Created items have `wechatNotifyRequested: false`. Direct users to the miniapp to enable WeChat reminders.

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

| Flag                       | What goes here                                                                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--title`                  | **Noun phrase**: "产品评审", "数智化部党员大会". Do **not** prefix with "提醒/Remind"; do **not** stuff the location or "必须参加" into the title. |
| `--start` / `--end`        | ISO with TZ offset. **Always include `--end` for meetings** — events without `--end` are interpreted as point-in-time.                             |
| `--location`               | Physical room, address, or video link. **Use it** — don't append to title.                                                                         |
| `--contact <id_or_handle>` | Repeatable. Attendees.                                                                                                                             |
| `--description`            | **Only on `update`**, not on `add`. Set post-creation if you need extended notes (agenda, file numbers, etc.).                                     |

**CLI does not expose `--remind-before` on calendar.** Do not work around with a side-reminder (see _Decision_ above). Surface the gap and ask the user.

**WeChat push:** same as reminders — CLI/MCP cannot enable; use the miniapp edit toggle.

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

| Flag                               | Server field                                                | When / how to fill                                                                                                                                                                                         |
| ---------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<name>` positional / `--name`     | `displayName`                                               | **Required.** Canonical full name ("张晓培"), not nickname or role ("张姐"/"王总").                                                                                                                        |
| `--handle`                         | `handle`                                                    | Override only when the auto-generated slug (pinyin: 张晓培 → `zhangxiaopei`) would collide or read poorly. Format: `[a-z0-9-]+`.                                                                           |
| `--email`                          | `methods[]` of `type=email, label="work", isPrimary=true`   | Work email. CLI hardcodes the label; for multiple emails or non-work labels use the HTTP API directly.                                                                                                     |
| `--phone`                          | `methods[]` of `type=phone, label="mobile", isPrimary=true` | Same pattern as email.                                                                                                                                                                                     |
| `--company`                        | `company`                                                   | Full organization name. **Match the format peers already use in the system** (e.g. align with siblings' "中国移动通信集团 /").                                                                             |
| `--job-title`                      | `title`                                                     | Actual job role at company ("产品总监", "前端工程师"). Skip if unknown. Don't conflate with relationship tags like "总部接口人" — those go in `--notes`.                                                   |
| `--alias` _(update only; appends)_ | `aliases[]`                                                 | Search keywords the user is likely to type later: "王总", English name, role label. Each call appends one. Improves later `contact search` hit rate.                                                       |
| `--notes`                          | `notes`                                                     | Free-form context that doesn't fit a structured field: relationship tag ("总部接口人 / 深圳"), city, how met, account numbers, prefers-WeChat. Newlines OK. Use `<tag> / <subtag>` format for scanability. |

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

## Upcoming window (on skill trigger)

When this skill is invoked for **any** user request, run this lightweight check **before** completing the main task (or in parallel when safe). Do not add CLI flags, scripts, `/loop`, or dedup state files.

1. `ai-todo whoami --json` → read `data.user.timezone` (default `Asia/Shanghai` if missing).
2. Query upcoming items (shell, `--json`):
   - `ai-todo calendar list --date <today YYYY-MM-DD> --json`
   - `ai-todo calendar list --date <tomorrow YYYY-MM-DD> --json` (covers cross-midnight 5h window)
   - `ai-todo reminder list --status pending --from <today> --to <tomorrow> --json`
   - `ai-todo reminder list --status in_progress --from <today> --to <tomorrow> --json`
3. Filter in memory — schedule time must fall in `(now, now + 5 hours]`:
   - **Calendar events**: `startAt`
   - **Reminders**: `remindAt || dueAt` (skip if neither is set)
4. If any matches, print a short plain-text block to the user (terminal or chat) **before** the main answer:

```
── 近 5 小时 ──
• [日程] 16:00 变更工单中引入AI稽核能力 (evt_xxx)
• [提醒] 17:30 回复王总邮件 (rem_xxx)
──────────────
```

Format times in the user's timezone (HH:mm). Omit the block when the list is empty. Do not embed this in CLI stdout when the user asked for machine-readable `--json` output from a single command — this block is agent narration only.

## Examples: user request → commands

**1. Time-bound task with contact** — 「明天上午十点提醒我给王总发报价邮件」

1. Resolve date in user timezone → `2026-05-21T10:00:00+08:00`.
2. `ai-todo contact search "王总" --json` → pick `contact_id`.
3. `ai-todo reminder create --title "给王总发报价邮件" --due "2026-05-21T10:00:00+08:00" --contact <id> --json`
4. Surface `data.reminder.id` and recipient from `data.reminder.contacts[0]`.
5. If the user wanted **WeChat push**, say it is off for CLI-created items (`wechatNotifyRequested: false`) and they must enable it in the miniapp.

**1b. Same, but user asked for WeChat push** — 「明天十点微信提醒我发报价」
1–3. Same as above. 4. Tell user: item created; open miniapp → edit this reminder → turn on **微信提醒** and complete subscription authorization.

**2. Untimed task** — 「提醒我交本月报销」

1. `ai-todo reminder create --title "交本月报销" --json` (no `--due`)
2. Item shows in `today` until marked done. Surface `data.reminder.id`.

**3. Meeting with location** — 「周五下午 4 点产品评审会，会议室 A」

1. Resolve dates → start `2026-05-22T16:00:00+08:00`, end (assume 1h) `2026-05-22T17:00:00+08:00`.
2. `ai-todo calendar add --title "产品评审" --start "…" --end "…" --location "会议室 A" --json`
3. **Do not** add a companion "15 分钟前" reminder (see _Decision_ above).

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
2. Summarize `data.reminders` and `data.calendarEvents` **separately** — they are different concepts (see _Decision_ above); never merge them into one list.

## CLI quirks

- **No per-subcommand `--help` dispatcher.** `ai-todo <sub> --help` prints a one-line `Usage:` and exits with error code 1. There is no real help text per subcommand.
- **Top-level `ai-todo --help` is also incomplete.** Missing: `--description` (calendar update), `--contact` (calendar add/update, reminder create), `--source-meta` (reminder create), and **all `contact` create/update flags**.
- **Authoritative references** when in doubt:
  - Patterns & workflows: `docs/agent-usage.md` (in the ai-todo repo)
  - Data model & field semantics: `docs/data-model.md`
  - Complete flag surface: `apps/cli/src/commands/` and `apps/cli/src/help.ts`

## Errors

- If `ok: false`, show `error.code` and `error.message`; do not retry blindly on `VAL_INVALID_INPUT`.
- `BIZ_NOT_FOUND` → id may be wrong or deleted; for source lookups, create instead of update.
- `BIZ_CONTACT_NOT_FOUND` → unknown contact handle/id passed via `--contact`. Re-run `contact search`.
- `VAL_INVALID_INPUT` on `sourceMeta` → must be a JSON object (not array, not scalar).
- Legacy wire strings (`NOT_FOUND`, `VALIDATION_ERROR`, etc.) may still appear in old logs; treat as equivalent when using `@ai-todo/shared` matchers.

## More detail

Repository docs (`docs/` in the ai-todo repo):

- **`data-model.md`** — entity fields, handle auto-generation, status enums
- **`agent-usage.md`** — agent patterns, sourced reminders, idempotency-key
- **`api-design.md`** — HTTP contract, error codes
- **`initial-planning.md`** §"核心区别" — the rationale behind reminder ≠ event
- **`cli-design.md`** — CLI conventions and constraints
- **`mcp-setup.md`** — stdio MCP server, tool registry, host configuration
