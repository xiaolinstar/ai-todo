/**
 * Agent tool catalog for ai-todo CLI / HTTP API.
 * Host agents (OpenClaw, Claude, Cursor) map these to shell or MCP tools.
 */
export interface AgentToolSpec {
  name: string;
  description: string;
  command: string;
  jsonFlag: string;
  notes?: string;
}

export const AI_TODO_AGENT_TOOLS: AgentToolSpec[] = [
  {
    name: "ai_todo_whoami",
    description: "Get current user id, display name, and timezone.",
    command: "ai-todo whoami",
    jsonFlag: "--json",
  },
  {
    name: "ai_todo_today",
    description:
      "List today's open reminders (pending and in_progress) and calendar events.",
    command: "ai-todo today",
    jsonFlag: "--json",
  },
  {
    name: "ai_todo_reminder_create",
    description: "Create a reminder. Use ISO-8601 for dueAt in user timezone.",
    command:
      'ai-todo reminder create --title "<title>" [--due "<iso>"] [--notes "<text>"] [--tag "<name>" ...] [--contact <id> ...]',
    jsonFlag: "--json",
    notes:
      "Prefer structured flags; do not rely on server-side NL parsing. When the caller has a stable external key (email Message-ID, ticket id), use ai_todo_reminder_create_sourced instead.",
  },
  {
    name: "ai_todo_reminder_find",
    description:
      "Look up a reminder by business source and external id (idempotent read before create/update).",
    command:
      'ai-todo reminder find --source "<source>" --external-id "<external_id>"',
    jsonFlag: "--json",
    notes:
      "source is the business origin (email, jira, wechat), not x-client-source.",
  },
  {
    name: "ai_todo_reminder_create_sourced",
    description:
      "Create a reminder keyed by source + externalId. API returns created=false when the pair already exists.",
    command:
      'ai-todo reminder create --title "<title>" --source "<source>" --external-id "<external_id>" [--due "<iso>"] [--notes "<text>"] [--tag "<name>" ...] [--source-meta \'<json>\'] [--contact <id> ...]',
    jsonFlag: "--json",
    notes:
      "Run ai_todo_reminder_find first when unsure; pass --idempotency-key on writes.",
  },
  {
    name: "ai_todo_reminder_list_by_source",
    description:
      "List reminders filtered by business source (e.g. email, jira).",
    command:
      'ai-todo reminder list --source "<source>" [--status pending|in_progress|completed|cancelled]',
    jsonFlag: "--json",
  },
  {
    name: "ai_todo_reminder_list",
    description:
      "List reminders; optional status, tag filter, or full-text q across title/notes/tags/track entries.",
    command:
      'ai-todo reminder list [--status pending] [--tag "<name>"] [--q "<query>"]',
    jsonFlag: "--json",
  },
  {
    name: "ai_todo_reminder_show",
    description: "Get a single reminder by id.",
    command: "ai-todo reminder show <reminder_id>",
    jsonFlag: "--json",
  },
  {
    name: "ai_todo_reminder_update",
    description:
      "Update reminder title, notes, due/remind times, or linked contacts by id.",
    command:
      'ai-todo reminder update <reminder_id> [--title "<title>"] [--notes "<text>"] [--tag "<name>" ...] [--status pending|in_progress|completed] [--due "<iso>"] [--remind "<iso>"] [--contact <id> ...]',
    jsonFlag: "--json",
  },
  {
    name: "ai_todo_reminder_update_by_source",
    description: "Update a reminder located by source + externalId.",
    command:
      'ai-todo reminder update --source "<source>" --external-id "<external_id>" [--title "<title>"] [--notes "<text>"] [--status pending|in_progress|completed] [--due "<iso>"] [--remind "<iso>"] [--contact <id> ...]',
    jsonFlag: "--json",
  },
  {
    name: "ai_todo_reminder_complete",
    description: "Mark a reminder completed by id.",
    command: "ai-todo reminder done <reminder_id>",
    jsonFlag: "--json",
  },
  {
    name: "ai_todo_reminder_complete_by_source",
    description: "Mark a reminder completed by source + externalId.",
    command:
      'ai-todo reminder done --source "<source>" --external-id "<external_id>"',
    jsonFlag: "--json",
  },
  {
    name: "ai_todo_reminder_reschedule",
    description: "Reschedule reminder due/remind times by id.",
    command:
      'ai-todo reminder reschedule <reminder_id> --due "<iso>" [--remind "<iso>"]',
    jsonFlag: "--json",
  },
  {
    name: "ai_todo_reminder_reschedule_by_source",
    description: "Reschedule a reminder by source + externalId.",
    command:
      'ai-todo reminder reschedule --source "<source>" --external-id "<external_id>" --due "<iso>" [--remind "<iso>"]',
    jsonFlag: "--json",
  },
  {
    name: "ai_todo_reminder_delete",
    description: "Soft-delete a reminder by id.",
    command: "ai-todo reminder delete <reminder_id>",
    jsonFlag: "--json",
  },
  {
    name: "ai_todo_reminder_delete_by_source",
    description: "Soft-delete a reminder by source + externalId.",
    command:
      'ai-todo reminder delete --source "<source>" --external-id "<external_id>"',
    jsonFlag: "--json",
  },
  {
    name: "ai_todo_reminder_track_add",
    description: "Append a dated track entry (max 30 chars) to a reminder.",
    command: 'ai-todo reminder track add <reminder_id> "<text>"',
    jsonFlag: "--json",
  },
  {
    name: "ai_todo_calendar_create",
    description: "Create a calendar event with start/end ISO times.",
    command:
      'ai-todo calendar add --title "<title>" --start "<iso>" [--end "<iso>"] [--location "<text>"]',
    jsonFlag: "--json",
  },
  {
    name: "ai_todo_calendar_update",
    description:
      "Update a calendar event title, times, location, or linked contacts.",
    command:
      'ai-todo calendar update <event_id> [--title "<title>"] [--start "<iso>"] [--end "<iso>"]',
    jsonFlag: "--json",
  },
  {
    name: "ai_todo_calendar_today",
    description: "List calendar events for today.",
    command: "ai-todo calendar today",
    jsonFlag: "--json",
  },
  {
    name: "ai_todo_contact_search",
    description:
      "Search contacts by name or alias; resolve duplicates with the user.",
    command: 'ai-todo contact search "<query>"',
    jsonFlag: "--json",
  },
  {
    name: "ai_todo_contact_create",
    description:
      "Create a contact with optional email, phone, company, job title, notes, or alias.",
    command:
      'ai-todo contact add "<name>" [--email "<email>"] [--phone "<phone>"] [--company "<company>"] [--job-title "<title>"] [--notes "<text>"] [--alias "<alias>"]',
    jsonFlag: "--json",
  },
  {
    name: "ai_todo_contact_update",
    description:
      "Update contact name, email, phone, company, job title, alias, or notes.",
    command:
      'ai-todo contact update <contact_id> [--name "<name>"] [--email "<email>"] [--phone "<phone>"] [--company "<company>"] [--job-title "<title>"] [--notes "<text>"]',
    jsonFlag: "--json",
  },
];

export const AI_TODO_AGENT_GUIDELINES = [
  "Always pass --json when invoking commands programmatically.",
  "Parse natural language in the agent; call ai-todo with structured fields only.",
  "On contact name ambiguity, run contact search and ask the user to pick an id.",
  "Set AI_TODO_TOKEN or ~/.ai-todo/settings.json (url + token) before agent calls.",
  "Set AI_TODO_API_URL if the API is not on http://ai-todo-api.localhost:8880.",
  "Exit code is non-zero when the API returns ok: false.",
  "source and external_id identify the business origin (email, jira, wechat message); they are not the HTTP x-client-source header (cli, miniapp, agent).",
  "Idempotent writes: run reminder find --source ... --external-id ... first; if found, update/done/delete by source; otherwise create with --source and --external-id.",
  "source_meta is optional JSON for display/audit only (e.g. email subject); the API does not parse natural language from it.",
  "source is not a fixed enum; use a stable lowercase slug per integrating system.",
  "Pass --idempotency-key <uuid> (or HTTP Idempotency-Key) on create/update writes to survive agent retries.",
  "Reminder status: pending (not started), in_progress (actively working), completed. Use reminder update --status in_progress when a ticket/email item is underway but not done.",
] as const;
