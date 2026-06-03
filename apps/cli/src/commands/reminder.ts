import type { ReminderStatus } from "@ai-todo/shared";

import type { CliContext } from "../context";
import {
  handleApi,
  hasFlag,
  positionalAfter,
  readFlagValue,
  readRepeatedFlag
} from "../context";

export async function runReminderCreate(ctx: CliContext, argv: string[]): Promise<void> {
  const title = readFlagValue(argv, "--title") ?? positionalAfter(argv, "add", "create");
  if (!title) {
    console.error(
      "Usage: ai-todo reminder create --title <text> [--due <iso>] [--contact <contact_id> ...]"
    );
    process.exitCode = 1;
    return;
  }

  await handleApi(
    ctx,
    await ctx.client.createReminder({
      title,
      dueAt: readFlagValue(argv, "--due"),
      remindAt: readFlagValue(argv, "--remind"),
      notes: readFlagValue(argv, "--notes"),
      contactIds: readRepeatedFlag(argv, "--contact")
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
    if (r.remindAt) {
      console.log(`通知：${r.remindAt}`);
    }
    if (r.notes) {
      console.log(`备注：${r.notes}`);
    }
    if (r.contacts && r.contacts.length > 0) {
      console.log(
        `联系人：${r.contacts.map((c) => `${c.displayName} (@${c.handle})`).join(", ")}`
      );
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
    console.error(
      "Usage: ai-todo reminder update <reminder_id> [--title <text>] [--notes <text>] [--due <iso>] [--remind <iso>] [--contact <contact_id_or_handle> ...]"
    );
    process.exitCode = 1;
    return;
  }
  const title = readFlagValue(argv, "--title");
  const notes = readFlagValue(argv, "--notes");
  const due = readFlagValue(argv, "--due");
  const remind = readFlagValue(argv, "--remind");
  const contactIds = readRepeatedFlag(argv, "--contact");
  const hasContacts = hasFlag(argv, "--contact");
  const hasNotes = hasFlag(argv, "--notes");

  if (
    !title &&
    notes === undefined &&
    due === undefined &&
    remind === undefined &&
    !hasContacts
  ) {
    console.error("Provide at least one field to update");
    process.exitCode = 1;
    return;
  }
  await handleApi(
    ctx,
    await ctx.client.updateReminder(id, {
      title,
      notes: hasNotes ? notes : undefined,
      dueAt: due,
      remindAt: remind,
      contactIds: hasContacts ? contactIds : undefined
    }),
    (data) => {
      if (!ctx.json) {
        const r = data.reminder;
        console.log(`已更新提醒：${r.title} (${r.id})`);
        if (r.dueAt) {
          console.log(`截止：${r.dueAt}`);
        }
        if (r.remindAt) {
          console.log(`通知：${r.remindAt}`);
        }
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
