import type { ContactSummary, ReminderSummary, CalendarEventSummary } from "@ai-todo/shared";

import {
  printEmptyList,
  printListSummary,
  printNextPageHint,
  type ListSummaryMeta
} from "./list-output";

const TITLE_MAX = 72;
const ID_MAX = 14;

export function truncateText(value: string, max = TITLE_MAX): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}

function displayWidth(value: string): number {
  let width = 0;
  for (const char of value) {
    width += isWideChar(char) ? 2 : 1;
  }
  return width;
}

function isWideChar(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe10 && code <= 0xfe19) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6)
  );
}

function fit(value: string | undefined, width: number): string {
  const raw = value || "-";
  if (displayWidth(raw) <= width) {
    return `${raw}${" ".repeat(width - displayWidth(raw))}`;
  }
  let result = "";
  for (const char of raw) {
    if (displayWidth(`${result}${char}…`) > width) {
      break;
    }
    result += char;
  }
  return `${result}…${" ".repeat(Math.max(0, width - displayWidth(`${result}…`)))}`;
}

function row(values: Array<[string | undefined, number]>): string {
  return values.map(([value, width]) => fit(value, width)).join("  ").trimEnd();
}

function separator(widths: number[]): string {
  return widths.map((width) => "-".repeat(width)).join("  ");
}

function printTableHeader(columns: Array<[string, number]>): void {
  console.log(row(columns));
  console.log(separator(columns.map(([, width]) => width)));
}

function shortId(id: string, prefix = ""): string {
  const normalized = prefix && id.startsWith(prefix) ? id.slice(prefix.length) : id;
  return normalized.length <= ID_MAX ? normalized : normalized.slice(0, ID_MAX);
}

export function formatHumanDateTime(value?: string): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  return formatter.format(date).replace(",", "");
}

function formatHumanRange(startAt: string, endAt?: string): string {
  const start = formatHumanDateTime(startAt);
  if (!endAt) {
    return start;
  }
  const startDate = new Date(startAt);
  const endDate = new Date(endAt);
  if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
    const sameDay =
      startDate.getFullYear() === endDate.getFullYear() &&
      startDate.getMonth() === endDate.getMonth() &&
      startDate.getDate() === endDate.getDate();
    if (sameDay) {
      const time = new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(endDate);
      return `${start}-${time}`;
    }
  }
  return `${start}-${formatHumanDateTime(endAt)}`;
}

export function renderContactListPage(
  items: ContactSummary[],
  meta: Omit<ListSummaryMeta, "pageCount">
): void {
  if (items.length === 0) {
    printEmptyList(meta.query ? "No matching contacts." : "No contacts.");
    return;
  }

  printListSummary({ ...meta, pageCount: items.length });
  printTableHeader([["NAME", 28], ["HANDLE", 20], ["EMAIL", 28], ["PHONE", 16], ["ID", ID_MAX]]);

  for (const contact of items) {
    console.log(
      row([
        [contact.displayName, 28],
        [`@${contact.handle}`, 20],
        [contact.primaryEmail, 28],
        [contact.primaryPhone, 16],
        [shortId(contact.id), ID_MAX]
      ])
    );
  }
  printNextPageHint({ ...meta, pageCount: items.length });
}

export function renderReminderListPage(
  items: ReminderSummary[],
  meta: Omit<ListSummaryMeta, "pageCount">,
  options: { showStatus?: boolean } = {}
): void {
  if (items.length === 0) {
    printEmptyList("No reminders.");
    return;
  }

  printListSummary({ ...meta, pageCount: items.length });
  const hasSource = items.some((item) => item.source);
  const columns: Array<[string, number]> = [];
  if (options.showStatus) columns.push(["STATUS", 10]);
  columns.push(["TITLE", 48]);
  if (hasSource) columns.push(["SOURCE", 12]);
  columns.push(["CONTACTS", 18], ["DUE", 13], ["ID", ID_MAX]);
  printTableHeader(columns);

  for (const reminder of items) {
    const contacts =
      reminder.contacts && reminder.contacts.length > 0
        ? reminder.contacts.map((contact) => contact.displayName).join(", ")
        : "";
    const values: Array<[string | undefined, number]> = [];
    if (options.showStatus) values.push([reminder.status, 10]);
    values.push([truncateText(reminder.title, 48), 48]);
    if (hasSource) values.push([reminder.source, 12]);
    values.push([contacts, 18], [formatHumanDateTime(reminder.dueAt), 13], [shortId(reminder.id, "rem_"), ID_MAX]);
    console.log(row(values));
  }
  printNextPageHint({ ...meta, pageCount: items.length });
}

export function renderCalendarListPage(
  items: CalendarEventSummary[],
  meta: Omit<ListSummaryMeta, "pageCount">
): void {
  if (items.length === 0) {
    printEmptyList("No calendar events.");
    return;
  }

  printListSummary({ ...meta, pageCount: items.length });
  printTableHeader([["WHEN", 25], ["TITLE", 42], ["LOCATION", 28], ["ID", ID_MAX]]);

  for (const event of items) {
    console.log(
      row([
        [formatHumanRange(event.startAt, event.endAt), 25],
        [truncateText(event.title, 42), 42],
        [event.location, 28],
        [shortId(event.id), ID_MAX]
      ])
    );
  }
  printNextPageHint({ ...meta, pageCount: items.length });
}
