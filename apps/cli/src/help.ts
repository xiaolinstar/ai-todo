export function printHelp(): void {
  console.log(`ai-todo — structured CLI for reminders, calendar, and contacts

Global flags:
  --json                 Output API JSON (recommended for agents)
  --api-url <url>        API base URL (default: AI_TODO_API_URL or ~/.ai-todo/config.json)

Setup:
  ai-todo login [--api-url <url>]
  ai-todo whoami

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
  ai-todo calendar delete <event_id>

Contacts:
  ai-todo contact add <name> [--email <v>] [--phone <v>] [--alias <v>]
  ai-todo contact search <query>
  ai-todo contact show <contact_id>

Agents: see docs/agent-usage.md and skills/ai-todo/SKILL.md`);
}
