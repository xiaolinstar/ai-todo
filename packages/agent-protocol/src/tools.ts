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
    jsonFlag: "--json"
  },
  {
    name: "ai_todo_today",
    description: "List today's pending reminders and calendar events.",
    command: "ai-todo today",
    jsonFlag: "--json"
  },
  {
    name: "ai_todo_reminder_create",
    description: "Create a reminder. Use ISO-8601 for dueAt in user timezone.",
    command:
      'ai-todo reminder create --title "<title>" [--due "<iso>"] [--notes "<text>"]',
    jsonFlag: "--json",
    notes: "Prefer structured flags; do not rely on server-side NL parsing."
  },
  {
    name: "ai_todo_reminder_list",
    description: "List reminders; optional status pending|completed|cancelled.",
    command: "ai-todo reminder list [--status pending]",
    jsonFlag: "--json"
  },
  {
    name: "ai_todo_reminder_complete",
    description: "Mark a reminder completed by id.",
    command: "ai-todo reminder done <reminder_id>",
    jsonFlag: "--json"
  },
  {
    name: "ai_todo_reminder_reschedule",
    description: "Reschedule reminder due/remind times.",
    command: 'ai-todo reminder reschedule <reminder_id> --due "<iso>"',
    jsonFlag: "--json"
  },
  {
    name: "ai_todo_reminder_delete",
    description: "Soft-delete a reminder.",
    command: "ai-todo reminder delete <reminder_id>",
    jsonFlag: "--json"
  },
  {
    name: "ai_todo_calendar_create",
    description: "Create a calendar event with start/end ISO times.",
    command:
      'ai-todo calendar add --title "<title>" --start "<iso>" [--end "<iso>"] [--location "<text>"]',
    jsonFlag: "--json"
  },
  {
    name: "ai_todo_calendar_update",
    description: "Update a calendar event title, times, location, or linked contacts.",
    command:
      'ai-todo calendar update <event_id> [--title "<title>"] [--start "<iso>"] [--end "<iso>"]',
    jsonFlag: "--json"
  },
  {
    name: "ai_todo_calendar_today",
    description: "List calendar events for today.",
    command: "ai-todo calendar today",
    jsonFlag: "--json"
  },
  {
    name: "ai_todo_contact_search",
    description: "Search contacts by name or alias; resolve duplicates with the user.",
    command: 'ai-todo contact search "<query>"',
    jsonFlag: "--json"
  },
  {
    name: "ai_todo_contact_create",
    description: "Create a contact with optional email, phone, company, job title, notes, or alias.",
    command:
      'ai-todo contact add "<name>" [--email "<email>"] [--phone "<phone>"] [--company "<company>"] [--job-title "<title>"] [--notes "<text>"] [--alias "<alias>"]',
    jsonFlag: "--json"
  },
  {
    name: "ai_todo_contact_update",
    description: "Update contact name, email, phone, company, job title, alias, or notes.",
    command:
      'ai-todo contact update <contact_id> [--name "<name>"] [--email "<email>"] [--phone "<phone>"] [--company "<company>"] [--job-title "<title>"] [--notes "<text>"]',
    jsonFlag: "--json"
  }
];

export const AI_TODO_AGENT_GUIDELINES = [
  "Always pass --json when invoking commands programmatically.",
  "Parse natural language in the agent; call ai-todo with structured fields only.",
  "On contact name ambiguity, run contact search and ask the user to pick an id.",
  "Set AI_TODO_TOKEN or ~/.ai-todo/settings.json (url + token) before agent calls.",
  "Set AI_TODO_API_URL if the API is not on http://127.0.0.1:3100.",
  "Exit code is non-zero when the API returns ok: false."
] as const;
