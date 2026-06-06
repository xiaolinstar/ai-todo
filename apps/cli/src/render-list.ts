import type { ContactSummary, ReminderSummary, CalendarEventSummary } from "@ai-todo/shared";

import { printEmptyList, printListSummary, type ListSummaryMeta } from "./list-output";

export function renderContactListPage(
  items: ContactSummary[],
  meta: Omit<ListSummaryMeta, "pageCount">
): void {
  if (items.length === 0) {
    printEmptyList(meta.query ? "未找到匹配的联系人" : "暂无联系人");
    return;
  }

  printListSummary({ ...meta, pageCount: items.length });

  for (const contact of items) {
    const detailParts = [
      contact.company,
      contact.primaryEmail ? `<${contact.primaryEmail}>` : undefined,
      contact.primaryPhone || undefined
    ].filter(Boolean);

    console.log(`• ${contact.displayName}`);
    console.log(`  @${contact.handle}${detailParts.length > 0 ? ` · ${detailParts.join(" · ")}` : ""}`);
    console.log(`  ${contact.id}`);
  }
}

export function renderReminderListPage(
  items: ReminderSummary[],
  meta: Omit<ListSummaryMeta, "pageCount">
): void {
  if (items.length === 0) {
    printEmptyList("暂无提醒");
    return;
  }

  printListSummary({ ...meta, pageCount: items.length });

  for (const reminder of items) {
    const due = reminder.dueAt ? ` · ${reminder.dueAt}` : "";
    const contacts =
      reminder.contacts && reminder.contacts.length > 0
        ? ` · ${reminder.contacts.map((contact) => contact.displayName).join("、")}`
        : "";
    console.log(`• [${reminder.status}] ${reminder.title}${due}${contacts}`);
    console.log(`  ${reminder.id}`);
  }
}

export function renderCalendarListPage(
  items: CalendarEventSummary[],
  meta: Omit<ListSummaryMeta, "pageCount">
): void {
  if (items.length === 0) {
    printEmptyList("暂无日程");
    return;
  }

  printListSummary({ ...meta, pageCount: items.length });

  for (const event of items) {
    const end = event.endAt ? ` → ${event.endAt}` : "";
    const place = event.location ? ` · ${event.location}` : "";
    console.log(`• ${event.title}`);
    console.log(`  ${event.startAt}${end}${place}`);
    console.log(`  ${event.id}`);
  }
}
