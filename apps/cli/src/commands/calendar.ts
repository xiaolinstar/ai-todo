import type { CliContext } from "../context";
import { handleApi, positionalAfter, readFlagValue, readRepeatedFlag } from "../context";

export async function runCalendarToday(ctx: CliContext): Promise<void> {
  await handleApi(ctx, await ctx.client.listCalendarToday(), (data) => {
    if (ctx.json) {
      return;
    }
    if (data.items.length === 0) {
      console.log("今日暂无日程");
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
  await handleApi(
    ctx,
    await ctx.client.listCalendarEvents(
      date ? { from: date, to: date } : {}
    ),
    (data) => {
      if (ctx.json) {
        return;
      }
      if (data.items.length === 0) {
        console.log("暂无日程");
        return;
      }
      for (const event of data.items) {
        const end = event.endAt ? ` - ${event.endAt}` : "";
        console.log(`- ${event.title} (${event.startAt}${end}) (${event.id})`);
      }
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
        console.log(`已创建日程：${event.title}`);
        console.log(`ID：${event.id}`);
        console.log(`开始：${event.startAt}`);
        if (event.endAt) {
          console.log(`结束：${event.endAt}`);
        }
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
      console.log(`地点：${e.location}`);
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
      console.log(`已删除日程：${data.id}`);
    }
  });
}

declare const process: { exitCode?: number };
