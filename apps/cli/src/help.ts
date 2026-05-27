import { settingsPath } from "./settings";

export function printHelp(): void {
  console.log(`ai-todo — structured CLI for reminders, calendar, and contacts

Configuration (~/.ai-todo/settings.json):
  One-time setup (like API keys for other AI tools):
    ai-todo login --url https://wodi.games --token aitodo_xxx
  Local dev:
    ai-todo login --issue-pat
  Example file: apps/cli/settings.example.json

  Priority: AI_TODO_TOKEN / AI_TODO_API_URL env > settings.json > http://127.0.0.1:3100

Auth:
  ai-todo login [--url <url>] [--token aitodo_xxx] [--issue-pat]
  ai-todo whoami
  ai-todo logout

Global flags (commands only):
  --json                 Output API JSON (recommended for agents)
  --idempotency-key <uuid>   Recommended for agent write retries

Today:
  ai-todo today

Reminders (aliases: add, list, done, reschedule):
  ai-todo reminder create --title <text> [--due <iso>] [--notes <text>]
  ai-todo reminder list [--status pending|completed|cancelled] [--from YYYY-MM-DD] [--to YYYY-MM-DD]
  ai-todo reminder show <reminder_id>
  ai-todo reminder done <reminder_id>
  ai-todo reminder update <reminder_id> [--title <text>] [--notes <text>]
  ai-todo reminder reschedule <reminder_id> --due <iso> [--remind <iso>]
  ai-todo reminder delete <reminder_id>
  ai-todo add <title>                    # shorthand create (title only)

Calendar:
  ai-todo calendar today
  ai-todo calendar list [--date YYYY-MM-DD]
  ai-todo calendar add --title <text> --start <iso> [--end <iso>] [--location <text>]
  ai-todo calendar show <event_id>
  ai-todo calendar update <event_id> [--title <text>] [--start <iso>] [--end <iso>]
  ai-todo calendar delete <event_id>

Contacts:
  ai-todo contact add <name> [--handle <handle>] [--email <v>] [--phone <v>] [--alias <v>]
  ai-todo contact list
  ai-todo contact search <query>
  ai-todo contact show <contact_id_or_handle>
  ai-todo contact update <contact_id_or_handle> [--handle <handle>] [--name <text>] [--email <v>] [--phone <v>]

Settings file: ${settingsPath()}

Agents: see docs/agent-usage.md and skills/ai-todo/SKILL.md`);
}
