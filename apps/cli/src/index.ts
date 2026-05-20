#!/usr/bin/env node

declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  exitCode?: number;
};

interface CliOptions {
  json: boolean;
  apiUrl: string;
}

const args = process.argv.slice(2);
const command = args[0] ?? "help";

function readOption(name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function hasFlag(name: string): boolean {
  return args.includes(name);
}

const options: CliOptions = {
  json: hasFlag("--json"),
  apiUrl: readOption("--api-url") ?? process.env.AI_TODO_API_URL ?? "http://localhost:3100"
};

function printHelp(): void {
  console.log(`ai-todo

Usage:
  ai-todo login
  ai-todo today
  ai-todo list [--status pending|completed|cancelled]
  ai-todo add <text>
  ai-todo done <reminder_id>
  ai-todo reschedule <reminder_id> --due "2026-05-25 10:00"
  ai-todo calendar today
  ai-todo calendar list [--date YYYY-MM-DD]
  ai-todo calendar add --title <text> --start <iso> [--end <iso>] [--location <text>]
  ai-todo contact add <name> [--email value] [--phone value] [--alias value]
  ai-todo contact search <query>
  ai-todo contact show <contact_id>

This is the initial CLI scaffold. See docs/cli-design.md for the MVP command contract.`);
}

function textArgAfter(commandName: string): string | undefined {
  const start = args.indexOf(commandName);
  if (start < 0) {
    return undefined;
  }

  const values: string[] = [];
  const commandArgs = args.slice(start + 1);

  for (let index = 0; index < commandArgs.length; index += 1) {
    const arg = commandArgs[index];

    if (arg === "--api-url") {
      index += 1;
      continue;
    }

    if (arg.startsWith("--")) {
      continue;
    }

    values.push(arg);
  }

  return values.length > 0 ? values.join(" ") : undefined;
}

function positionalArgAfter(...commandNames: string[]): string | undefined {
  let start = -1;

  for (const commandName of commandNames) {
    const index = args.indexOf(commandName);
    if (index > start) {
      start = index;
    }
  }

  if (start < 0) {
    return undefined;
  }

  const values: string[] = [];
  const commandArgs = args.slice(start + 1);

  for (let index = 0; index < commandArgs.length; index += 1) {
    const arg = commandArgs[index];

    if (arg === "--api-url" || arg === "--email" || arg === "--phone" || arg === "--alias") {
      index += 1;
      continue;
    }

    if (arg.startsWith("--")) {
      continue;
    }

    values.push(arg);
  }

  return values.length > 0 ? values.join(" ") : undefined;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  headers.set("x-client-source", "cli");

  const response = await fetch(`${options.apiUrl}${path}`, {
    ...init,
    headers
  });

  return (await response.json()) as T;
}

function print(value: unknown): void {
  if (options.json) {
    console.log(JSON.stringify(value, null, 2));
  } else {
    console.log(String(value));
  }
}

async function addReminder(): Promise<void> {
  const title = textArgAfter("add");

  if (!title) {
    console.error("Usage: ai-todo add <text>");
    process.exitCode = 1;
    return;
  }

  const result = await request<{
    ok: boolean;
    data?: {
      reminder: {
        id: string;
        title: string;
        status: string;
        dueAt?: string;
      };
    };
    error?: {
      code: string;
      message: string;
    };
  }>("/v1/reminders", {
    method: "POST",
    body: JSON.stringify({
      title
    })
  });

  if (options.json) {
    print(result);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (!result.ok || !result.data) {
    console.error(result.error?.message ?? "Failed to create reminder.");
    process.exitCode = 1;
    return;
  }

  console.log(`已创建提醒：${result.data.reminder.title}`);
  console.log(`ID：${result.data.reminder.id}`);
}

async function showToday(): Promise<void> {
  const result = await request<{
    ok: boolean;
    data?: {
      date: string;
      timezone: string;
      reminders: Array<{
        id: string;
        title: string;
        status: string;
      }>;
      calendarEvents: Array<{
        id: string;
        title: string;
        startAt: string;
        endAt?: string;
        location?: string;
      }>;
    };
  }>("/v1/today");

  if (options.json) {
    print(result);
    return;
  }

  if (!result.ok || !result.data) {
    console.error("Failed to load today.");
    process.exitCode = 1;
    return;
  }

  console.log(`${result.data.date} (${result.data.timezone})`);
  console.log("提醒：");

  if (result.data.reminders.length === 0) {
    console.log("  暂无");
  } else {
    for (const reminder of result.data.reminders) {
      console.log(`  - [${reminder.status}] ${reminder.title} (${reminder.id})`);
    }
  }

  console.log("日程：");
  if (result.data.calendarEvents.length === 0) {
    console.log("  暂无");
  } else {
    for (const event of result.data.calendarEvents) {
      const end = event.endAt ? ` - ${event.endAt}` : "";
      const place = event.location ? ` @ ${event.location}` : "";
      console.log(`  - ${event.title} (${event.startAt}${end})${place} (${event.id})`);
    }
  }
}

async function calendarToday(): Promise<void> {
  const result = await request<{
    ok: boolean;
    data?: {
      items: Array<{
        id: string;
        title: string;
        startAt: string;
        endAt?: string;
        location?: string;
      }>;
    };
    error?: { message: string };
  }>("/v1/calendar/today");

  if (options.json) {
    print(result);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (!result.ok || !result.data) {
    console.error(result.error?.message ?? "Failed to load calendar today.");
    process.exitCode = 1;
    return;
  }

  if (result.data.items.length === 0) {
    console.log("今日暂无日程");
    return;
  }

  for (const event of result.data.items) {
    const end = event.endAt ? ` - ${event.endAt}` : "";
    const place = event.location ? ` @ ${event.location}` : "";
    console.log(`- ${event.title} (${event.startAt}${end})${place} (${event.id})`);
  }
}

async function calendarList(): Promise<void> {
  const date = readOption("--date");
  const path = date
    ? `/v1/calendar/events?from=${encodeURIComponent(date)}&to=${encodeURIComponent(date)}`
    : "/v1/calendar/events";

  const result = await request<{
    ok: boolean;
    data?: {
      items: Array<{
        id: string;
        title: string;
        startAt: string;
        endAt?: string;
      }>;
    };
    error?: { message: string };
  }>(path);

  if (options.json) {
    print(result);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (!result.ok || !result.data) {
    console.error(result.error?.message ?? "Failed to list calendar events.");
    process.exitCode = 1;
    return;
  }

  if (result.data.items.length === 0) {
    console.log("暂无日程");
    return;
  }

  for (const event of result.data.items) {
    const end = event.endAt ? ` - ${event.endAt}` : "";
    console.log(`- ${event.title} (${event.startAt}${end}) (${event.id})`);
  }
}

async function calendarAdd(): Promise<void> {
  const title = readOption("--title");
  const start = readOption("--start");
  const end = readOption("--end");
  const location = readOption("--location");

  if (!title || !start) {
    console.error("Usage: ai-todo calendar add --title <text> --start <iso> [--end <iso>]");
    process.exitCode = 1;
    return;
  }

  const result = await request<{
    ok: boolean;
    data?: {
      calendarEvent: {
        id: string;
        title: string;
        startAt: string;
        endAt?: string;
      };
    };
    error?: { message: string };
  }>("/v1/calendar/events", {
    method: "POST",
    body: JSON.stringify({
      title,
      startAt: start,
      endAt: end,
      location
    })
  });

  if (options.json) {
    print(result);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (!result.ok || !result.data) {
    console.error(result.error?.message ?? "Failed to create calendar event.");
    process.exitCode = 1;
    return;
  }

  const event = result.data.calendarEvent;
  console.log(`已创建日程：${event.title}`);
  console.log(`ID：${event.id}`);
  console.log(`开始：${event.startAt}`);
  if (event.endAt) {
    console.log(`结束：${event.endAt}`);
  }
}

async function listReminders(): Promise<void> {
  const status = readOption("--status");
  const path = status
    ? `/v1/reminders?status=${encodeURIComponent(status)}`
    : "/v1/reminders";

  const result = await request<{
    ok: boolean;
    data?: {
      items: Array<{
        id: string;
        title: string;
        status: string;
        dueAt?: string;
      }>;
    };
    error?: { message: string };
  }>(path);

  if (options.json) {
    print(result);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (!result.ok || !result.data) {
    console.error(result.error?.message ?? "Failed to list reminders.");
    process.exitCode = 1;
    return;
  }

  if (result.data.items.length === 0) {
    console.log("暂无提醒");
    return;
  }

  for (const reminder of result.data.items) {
    const due = reminder.dueAt ? ` @ ${reminder.dueAt}` : "";
    console.log(`- [${reminder.status}] ${reminder.title}${due} (${reminder.id})`);
  }
}

async function rescheduleReminder(): Promise<void> {
  const reminderId = textArgAfter("reschedule");
  const due = readOption("--due");

  if (!reminderId || !due) {
    console.error("Usage: ai-todo reschedule <reminder_id> --due <datetime>");
    process.exitCode = 1;
    return;
  }

  const result = await request<{
    ok: boolean;
    data?: {
      reminder: {
        id: string;
        title: string;
        dueAt?: string;
        remindAt?: string;
      };
    };
    error?: { message: string };
  }>(`/v1/reminders/${encodeURIComponent(reminderId)}/reschedule`, {
    method: "POST",
    body: JSON.stringify({ dueAt: due })
  });

  if (options.json) {
    print(result);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (!result.ok || !result.data) {
    console.error(result.error?.message ?? "Failed to reschedule reminder.");
    process.exitCode = 1;
    return;
  }

  console.log(`已改期：${result.data.reminder.title}`);
  if (result.data.reminder.dueAt) {
    console.log(`新截止时间：${result.data.reminder.dueAt}`);
  }
}

async function completeReminder(): Promise<void> {
  const reminderId = textArgAfter("done");

  if (!reminderId) {
    console.error("Usage: ai-todo done <reminder_id>");
    process.exitCode = 1;
    return;
  }

  const result = await request<{
    ok: boolean;
    data?: {
      reminder: {
        id: string;
        title: string;
        status: string;
      };
    };
    error?: {
      code: string;
      message: string;
    };
  }>(`/v1/reminders/${encodeURIComponent(reminderId)}/complete`, {
    method: "POST",
    body: JSON.stringify({})
  });

  if (options.json) {
    print(result);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (!result.ok || !result.data) {
    console.error(result.error?.message ?? "Failed to complete reminder.");
    process.exitCode = 1;
    return;
  }

  console.log(`已完成提醒：${result.data.reminder.title}`);
  console.log(`ID：${result.data.reminder.id}`);
}

interface ContactMethodInput {
  type: "email" | "phone";
  value: string;
  label?: string;
  isPrimary?: boolean;
}

interface ContactDetail {
  id: string;
  displayName: string;
  nickname?: string | null;
  company?: string | null;
  title?: string | null;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  methods?: Array<{
    type: string;
    value: string;
    isPrimary: boolean;
  }>;
  aliases?: string[];
}

async function addContact(): Promise<void> {
  const displayName = positionalArgAfter("contact", "add");

  if (!displayName) {
    console.error("Usage: ai-todo contact add <name> [--email value] [--phone value]");
    process.exitCode = 1;
    return;
  }

  const methods: ContactMethodInput[] = [];
  const email = readOption("--email");
  const phone = readOption("--phone");
  const alias = readOption("--alias");

  if (email) {
    methods.push({ type: "email", value: email, label: "work", isPrimary: true });
  }

  if (phone) {
    methods.push({ type: "phone", value: phone, label: "mobile", isPrimary: true });
  }

  const result = await request<{
    ok: boolean;
    data?: {
      contact: ContactDetail;
    };
    error?: {
      code: string;
      message: string;
    };
  }>("/v1/contacts", {
    method: "POST",
    body: JSON.stringify({
      displayName,
      methods,
      aliases: alias ? [alias] : []
    })
  });

  if (options.json) {
    print(result);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (!result.ok || !result.data) {
    console.error(result.error?.message ?? "Failed to create contact.");
    process.exitCode = 1;
    return;
  }

  console.log(`已创建联系人：${result.data.contact.displayName}`);
  console.log(`ID：${result.data.contact.id}`);
}

async function searchContacts(): Promise<void> {
  const query = positionalArgAfter("contact", "search");
  const path = query ? `/v1/contacts?q=${encodeURIComponent(query)}` : "/v1/contacts";
  const result = await request<{
    ok: boolean;
    data?: {
      items: ContactDetail[];
    };
    error?: {
      code: string;
      message: string;
    };
  }>(path);

  if (options.json) {
    print(result);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (!result.ok || !result.data) {
    console.error(result.error?.message ?? "Failed to search contacts.");
    process.exitCode = 1;
    return;
  }

  if (result.data.items.length === 0) {
    console.log("未找到联系人");
    return;
  }

  for (const contact of result.data.items) {
    const email = contact.primaryEmail ? ` <${contact.primaryEmail}>` : "";
    console.log(`- ${contact.displayName}${email} (${contact.id})`);
  }
}

async function showContact(): Promise<void> {
  const contactId = positionalArgAfter("contact", "show");

  if (!contactId) {
    console.error("Usage: ai-todo contact show <contact_id>");
    process.exitCode = 1;
    return;
  }

  const result = await request<{
    ok: boolean;
    data?: {
      contact: ContactDetail;
    };
    error?: {
      code: string;
      message: string;
    };
  }>(`/v1/contacts/${encodeURIComponent(contactId)}`);

  if (options.json) {
    print(result);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (!result.ok || !result.data) {
    console.error(result.error?.message ?? "Failed to load contact.");
    process.exitCode = 1;
    return;
  }

  const contact = result.data.contact;
  console.log(`${contact.displayName} (${contact.id})`);
  if (contact.primaryEmail) {
    console.log(`邮箱：${contact.primaryEmail}`);
  }
  if (contact.primaryPhone) {
    console.log(`电话：${contact.primaryPhone}`);
  }
  if (contact.aliases && contact.aliases.length > 0) {
    console.log(`别名：${contact.aliases.join(", ")}`);
  }
}

async function main(): Promise<void> {
  const subcommand = args[1];

  switch (command) {
    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;
    case "add":
      await addReminder();
      break;
    case "today":
      await showToday();
      break;
    case "list":
      await listReminders();
      break;
    case "done":
      await completeReminder();
      break;
    case "reschedule":
      await rescheduleReminder();
      break;
    case "calendar":
      if (subcommand === "today") {
        await calendarToday();
      } else if (subcommand === "list") {
        await calendarList();
      } else if (subcommand === "add") {
        await calendarAdd();
      } else {
        console.error("Usage: ai-todo calendar <today|list|add>");
        process.exitCode = 1;
      }
      break;
    case "contact":
      if (subcommand === "add") {
        await addContact();
      } else if (subcommand === "search") {
        await searchContacts();
      } else if (subcommand === "show") {
        await showContact();
      } else {
        console.error("Usage: ai-todo contact <add|search|show>");
        process.exitCode = 1;
      }
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unexpected CLI error.");
  process.exitCode = 1;
});
