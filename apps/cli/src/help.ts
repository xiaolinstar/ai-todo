import { settingsPath } from "./settings";

export function printHelp(): void {
  console.log(`ai-todo — reminders, calendar, and contacts

Config ${settingsPath()}:
  { "url": "https://xingxiaolin.cn", "token": "aitodo_xxx" }

  Token: WeChat miniapp → Mine → CLI / Agent tokens
  Override: AI_TODO_TOKEN, AI_TODO_API_URL (else local http://ai-todo-api.localhost:8880)

Flags: --json  --limit <n>  --cursor <token>  --idempotency-key <uuid>

Core:
  ai-todo login --token <pat>
  ai-todo logout
  ai-todo today
  ai-todo whoami
  ai-todo version

Reminders:
  ai-todo reminder create --title <text> [--due <iso>] [--remind <iso>] [--notes <text>] [--tag <name> ...] [--source <name>] [--external-id <id>]
  ai-todo reminder list|ls [-a|--all] [--status pending|in_progress|completed|cancelled] [--sort due|created|completed|updated] [--q <query>] [--tag <name> ...] [--source <name>] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--limit <n>] [--cursor <token>]
  ai-todo reminder find --source <name> --external-id <id>
  ai-todo reminder show|inspect|done|delete <id_or_prefix>
  ai-todo reminder done|delete --source <name> --external-id <id>
  ai-todo reminder update <id> [--title <text>] [--notes <text>] [--tag <name> ...] [--status pending|in_progress|completed] [--due <iso>] [--remind <iso>] [--contact <id> ...]
  ai-todo reminder track add <id> <text>
  ai-todo reminder reschedule <id> --due <iso> [--remind <iso>]
  ai-todo add <title>

  Human list defaults: pending reminders sorted by due time. Use -a to include all statuses.
  Reminder table IDs omit the rem_ prefix. Use 4+ characters, e.g. ai-todo reminder inspect c1f6.
  Use --json for full machine-readable output.
  WeChat push reminders: not available when creating via CLI/Agent — enable in the WeChat miniapp.

Tags:
  ai-todo tag list [--q <query>] [--sort usage|name|updated] [--limit <n>]
  ai-todo tag create --name <text> [--color <palette_color>]
  ai-todo tag update <id> [--name <text>] [--color <palette_color>]
  ai-todo tag delete <id>

Calendar:
  ai-todo calendar today|list|add|show|update|delete ...
  ai-todo calendar list [--date YYYY-MM-DD] [--limit <n>] [--cursor <token>]
  ai-todo calendar add --title <text> --start <iso> [--end <iso>] [--location <text>]

Contacts:
  ai-todo contact add|list|search|show|update|delete ...
  ai-todo contact list [--limit <n>] [--cursor <token>]
  ai-todo contact search <query> [--limit <n>] [--cursor <token>]

Agents: https://github.com/xiaolinstar/ai-todo/blob/main/docs/agent-usage.md`);
}
