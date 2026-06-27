import { printWechatNotifyCliNotice } from "../messages";
import type { CliContext } from "../context";
import { handleApi, positionalAfter, readFlagValue, readRepeatedFlag } from "../context";
import { readListCursor, readListLimit } from "../pagination";
import { renderCalendarListPage } from "../render-list";

export async function runCalendarToday(ctx: CliContext): Promise<void> {
  await handleApi(ctx, await ctx.client.listCalendarToday(), (data) => {
    if (ctx.json) {
      return;
    }
    if (data.items.length === 0) {
      console.log("No calendar events today.");
      return;
    }
    for (const event of data.items) {
      const end = event.endAt ? ` - ${event.endAt}` : "";
      const place = event.location ? ` @ ${event.location}` : "";
      console.log(`- ${event.title} (${event.startAt}${end})${place} (${event.id})`);
    }
  });
}

export async function runCalendarList(ctx: CliContext, argv: string[]): Promise<void> {
  const date = readFlagValue(argv, "--date");
  const limit = readListLimit(argv);
  const cursor = readListCursor(argv);
  if (process.exitCode) {
    return;
  }

  await handleApi(
    ctx,
    await ctx.client.listCalendarEvents(
      date
        ? { from: date, to: date, limit, cursor }
        : { limit, cursor }
    ),
    (data) => {
      if (ctx.json) {
        return;
      }
      renderCalendarListPage(data.items, {
        label: date ? `Calendar · ${date}` : "Calendar",
        totalCount: data.totalCount,
        hasMore: data.hasMore,
        nextCursor: data.nextCursor,
        nextPageHint: date
          ? "ai-todo calendar list --date <YYYY-MM-DD>"
          : "ai-todo calendar list"
      });
    }
  );
}

export async function runCalendarAdd(ctx: CliContext, argv: string[]): Promise<void> {
  const title = readFlagValue(argv, "--title");
  const start = readFlagValue(argv, "--start");
  const end = readFlagValue(argv, "--end");
  const location = readFlagValue(argv, "--location");

  if (!title || !start) {
    console.error(
      "Usage: ai-todo calendar add --title <text> --start <iso> [--end <iso>] [--contact <contact_id> ...]"
    );
    process.exitCode = 1;
    return;
  }

  await handleApi(
    ctx,
    await ctx.client.createCalendarEvent({
      title,
      startAt: start,
      endAt: end,
      location,
      contactIds: readRepeatedFlag(argv, "--contact")
    }),
    (data) => {
      if (!ctx.json) {
        const event = data.calendarEvent;
        console.log(`Created calendar event: ${event.title}`);
        console.log(`ID: ${event.id}`);
        console.log(`Start: ${event.startAt}`);
        if (event.endAt) {
          console.log(`End: ${event.endAt}`);
        }
        printWechatNotifyCliNotice();
      }
    }
  );
}

export async function runCalendarShow(ctx: CliContext, argv: string[]): Promise<void> {
  const id = positionalAfter(argv, "show");
  if (!id) {
    console.error("Usage: ai-todo calendar show <event_id>");
    process.exitCode = 1;
    return;
  }
  await handleApi(ctx, await ctx.client.getCalendarEvent(id), (data) => {
    if (ctx.json) {
      return;
    }
    const e = data.calendarEvent;
    console.log(`${e.title} (${e.id})`);
    console.log(`${e.startAt}${e.endAt ? ` → ${e.endAt}` : ""}`);
    if (e.location) {
      console.log(`Location: ${e.location}`);
    }
  });
}

export async function runCalendarDelete(ctx: CliContext, argv: string[]): Promise<void> {
  const id = positionalAfter(argv, "delete");
  if (!id) {
    console.error("Usage: ai-todo calendar delete <event_id>");
    process.exitCode = 1;
    return;
  }
  await handleApi(ctx, await ctx.client.deleteCalendarEvent(id), (data) => {
    if (!ctx.json) {
      console.log(`Deleted calendar event: ${data.id}`);
    }
  });
}

export async function runCalendarUpdate(ctx: CliContext, argv: string[]): Promise<void> {
  const id = positionalAfter(argv, "update");
  const title = readFlagValue(argv, "--title");
  const start = readFlagValue(argv, "--start");
  const end = readFlagValue(argv, "--end");
  const location = readFlagValue(argv, "--location");
  const description = readFlagValue(argv, "--description");
  const contactIds = readRepeatedFlag(argv, "--contact");
  const hasContacts = argv.includes("--contact");

  if (!id) {
    console.error(
      "Usage: ai-todo calendar update <event_id> [--title <text>] [--start <iso>] [--end <iso>] [--location <text>] [--contact <contact_id> ...]"
    );
    process.exitCode = 1;
    return;
  }

  if (!title && !start && end === undefined && location === undefined && !description && !hasContacts) {
    console.error("Provide at least one field to update");
    process.exitCode = 1;
    return;
  }

  await handleApi(
    ctx,
    await ctx.client.updateCalendarEvent(id, {
      title,
      startAt: start,
      endAt: end,
      location,
      description,
      contactIds: hasContacts ? contactIds : undefined
    }),
    (data) => {
      if (!ctx.json) {
        const event = data.calendarEvent;
        console.log(`Updated calendar event: ${event.title} (${event.id})`);
      }
    }
  );
}

declare const process: { exitCode?: number };
