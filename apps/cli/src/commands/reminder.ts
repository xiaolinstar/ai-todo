import type { ReminderStatus } from "@ai-todo/shared";

import type { CliContext } from "../context";
import { handleApi, positionalAfter, readFlagValue } from "../context";

export async function runReminderCreate(ctx: CliContext, argv: string[]): Promise<void> {
  const title = readFlagValue(argv, "--title") ?? positionalAfter(argv, "add", "create");
  if (!title) {
    console.error("Usage: ai-todo reminder create --title <text> [--due <iso>]");
    process.exitCode = 1;
    return;
  }

  await handleApi(
    ctx,
    await ctx.client.createReminder({
      title,
      dueAt: readFlagValue(argv, "--due"),
      remindAt: readFlagValue(argv, "--remind"),
      notes: readFlagValue(argv, "--notes")
    }),
    (data) => {
      if (!ctx.json) {
        console.log(`已创建提醒：${data.reminder.title}`);
        console.log(`ID：${data.reminder.id}`);
        if (data.reminder.dueAt) {
          console.log(`截止：${data.reminder.dueAt}`);
        }
      }
    }
  );
}

export async function runReminderList(ctx: CliContext, argv: string[]): Promise<void> {
  const status = readFlagValue(argv, "--status") as ReminderStatus | undefined;
  await handleApi(
    ctx,
    await ctx.client.listReminders({
      status,
      from: readFlagValue(argv, "--from"),
      to: readFlagValue(argv, "--to")
    }),
    (data) => {
      if (ctx.json) {
        return;
      }
      if (data.items.length === 0) {
        console.log("暂无提醒");
        return;
      }
      for (const reminder of data.items) {
        const due = reminder.dueAt ? ` @ ${reminder.dueAt}` : "";
        console.log(`- [${reminder.status}] ${reminder.title}${due} (${reminder.id})`);
      }
    }
  );
}

export async function runReminderShow(ctx: CliContext, argv: string[]): Promise<void> {
  const id = positionalAfter(argv, "show");
  if (!id) {
    console.error("Usage: ai-todo reminder show <reminder_id>");
    process.exitCode = 1;
    return;
  }
  await handleApi(ctx, await ctx.client.getReminder(id), (data) => {
    if (ctx.json) {
      return;
    }
    const r = data.reminder;
    console.log(`${r.title} (${r.id})`);
    console.log(`状态：${r.status}`);
    if (r.dueAt) {
      console.log(`截止：${r.dueAt}`);
    }
    if (r.notes) {
      console.log(`备注：${r.notes}`);
    }
  });
}

export async function runReminderDone(ctx: CliContext, argv: string[]): Promise<void> {
  const id = positionalAfter(argv, "done", "complete");
  if (!id) {
    console.error("Usage: ai-todo reminder done <reminder_id>");
    process.exitCode = 1;
    return;
  }
  await handleApi(ctx, await ctx.client.completeReminder(id), (data) => {
    if (!ctx.json) {
      console.log(`已完成提醒：${data.reminder.title}`);
      console.log(`ID：${data.reminder.id}`);
    }
  });
}

export async function runReminderUpdate(ctx: CliContext, argv: string[]): Promise<void> {
  const id = positionalAfter(argv, "update");
  if (!id) {
    console.error("Usage: ai-todo reminder update <reminder_id> [--title <text>]");
    process.exitCode = 1;
    return;
  }
  const title = readFlagValue(argv, "--title");
  const notes = readFlagValue(argv, "--notes");
  if (!title && notes === undefined) {
    console.error("Provide at least --title or --notes");
    process.exitCode = 1;
    return;
  }
  await handleApi(
    ctx,
    await ctx.client.updateReminder(id, { title, notes }),
    (data) => {
      if (!ctx.json) {
        console.log(`已更新提醒：${data.reminder.title} (${data.reminder.id})`);
      }
    }
  );
}

export async function runReminderReschedule(ctx: CliContext, argv: string[]): Promise<void> {
  const id = positionalAfter(argv, "reschedule");
  const due = readFlagValue(argv, "--due");
  const remind = readFlagValue(argv, "--remind");
  if (!id || (!due && !remind)) {
    console.error("Usage: ai-todo reminder reschedule <reminder_id> --due <iso> [--remind <iso>]");
    process.exitCode = 1;
    return;
  }
  await handleApi(
    ctx,
    await ctx.client.rescheduleReminder(id, { dueAt: due, remindAt: remind }),
    (data) => {
      if (!ctx.json) {
        console.log(`已改期：${data.reminder.title}`);
        if (data.reminder.dueAt) {
          console.log(`新截止：${data.reminder.dueAt}`);
        }
      }
    }
  );
}

export async function runReminderDelete(ctx: CliContext, argv: string[]): Promise<void> {
  const id = positionalAfter(argv, "delete");
  if (!id) {
    console.error("Usage: ai-todo reminder delete <reminder_id>");
    process.exitCode = 1;
    return;
  }
  await handleApi(ctx, await ctx.client.deleteReminder(id), (data) => {
    if (!ctx.json) {
      console.log(`已删除提醒：${data.id}`);
    }
  });
}

declare const process: { exitCode?: number };
