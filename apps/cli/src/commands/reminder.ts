import type { ReminderStatus } from "@ai-todo/shared";

import type { CliContext } from "../context";
import {
  handleApi,
  hasFlag,
  positionalAfter,
  readFlagValue,
  readRepeatedFlag
} from "../context";
import { readListCursor, readListLimit } from "../pagination";
import { renderReminderListPage } from "../render-list";

export async function runReminderCreate(ctx: CliContext, argv: string[]): Promise<void> {
  const title = readFlagValue(argv, "--title") ?? positionalAfter(argv, "add", "create");
  if (!title) {
    console.error(
      "Usage: ai-todo reminder create --title <text> [--due <iso>] [--source <name>] [--external-id <id>]"
    );
    process.exitCode = 1;
    return;
  }

  const sourceMeta = readSourceMeta(argv);
  if (process.exitCode) {
    return;
  }

  await handleApi(
    ctx,
    await ctx.client.createReminder({
      title,
      dueAt: readFlagValue(argv, "--due"),
      remindAt: readFlagValue(argv, "--remind"),
      notes: readFlagValue(argv, "--notes"),
      source: readFlagValue(argv, "--source"),
      externalId: readFlagValue(argv, "--external-id"),
      sourceMeta,
      contactIds: readRepeatedFlag(argv, "--contact")
    }),
    (data) => {
      if (!ctx.json) {
        console.log(`${data.created === false ? "已存在提醒" : "已创建提醒"}：${data.reminder.title}`);
        console.log(`ID：${data.reminder.id}`);
        if (data.reminder.dueAt) {
          console.log(`截止：${data.reminder.dueAt}`);
        }
        if (data.reminder.source && data.reminder.externalId) {
          console.log(`来源：${data.reminder.source} / ${data.reminder.externalId}`);
        }
      }
    }
  );
}

export async function runReminderList(ctx: CliContext, argv: string[]): Promise<void> {
  const status = readFlagValue(argv, "--status") as ReminderStatus | undefined;
  const limit = readListLimit(argv);
  const cursor = readListCursor(argv);
  if (process.exitCode) {
    return;
  }

  await handleApi(
    ctx,
    await ctx.client.listReminders({
      status,
      source: readFlagValue(argv, "--source"),
      from: readFlagValue(argv, "--from"),
      to: readFlagValue(argv, "--to"),
      limit,
      cursor
    }),
    (data) => {
      if (ctx.json) {
        return;
      }
      renderReminderListPage(data.items, {
        label: "提醒",
        totalCount: data.totalCount,
        hasMore: data.hasMore,
        nextCursor: data.nextCursor,
        nextPageHint: "ai-todo reminder list"
      });
    }
  );
}

export async function runReminderFind(ctx: CliContext, argv: string[]): Promise<void> {
  const source = readFlagValue(argv, "--source");
  const externalId = readFlagValue(argv, "--external-id");
  if (!source || !externalId) {
    console.error("Usage: ai-todo reminder find --source <name> --external-id <id>");
    process.exitCode = 1;
    return;
  }
  await handleApi(ctx, await ctx.client.findReminderBySource(source, externalId), (data) => {
    if (ctx.json) {
      return;
    }
    renderReminderDetail(data.reminder);
  });
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
    if (r.source && r.externalId) {
      console.log(`来源：${r.source} / ${r.externalId}`);
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
  const id = await resolveReminderId(ctx, argv, "done", "complete");
  if (!id) {
    console.error("Usage: ai-todo reminder done <reminder_id> OR --source <name> --external-id <id>");
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
  const id = await resolveReminderId(ctx, argv, "update");
  if (!id) {
    console.error(
      "Usage: ai-todo reminder update <reminder_id> [--title <text>] OR --source <name> --external-id <id> [fields]"
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
  const id = await resolveReminderId(ctx, argv, "reschedule");
  const due = readFlagValue(argv, "--due");
  const remind = readFlagValue(argv, "--remind");
  if (!id || (!due && !remind)) {
    console.error(
      "Usage: ai-todo reminder reschedule <reminder_id> --due <iso> OR --source <name> --external-id <id> --due <iso>"
    );
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
  const id = await resolveReminderId(ctx, argv, "delete");
  if (!id) {
    console.error("Usage: ai-todo reminder delete <reminder_id> OR --source <name> --external-id <id>");
    process.exitCode = 1;
    return;
  }
  await handleApi(ctx, await ctx.client.deleteReminder(id), (data) => {
    if (!ctx.json) {
      console.log(`已删除提醒：${data.id}`);
    }
  });
}

function renderReminderDetail(r: {
  id: string;
  title: string;
  status: ReminderStatus;
  dueAt?: string;
  remindAt?: string;
  source?: string;
  externalId?: string;
  notes?: string;
  contacts?: { displayName: string; handle: string }[];
}): void {
  console.log(`${r.title} (${r.id})`);
  console.log(`状态：${r.status}`);
  if (r.dueAt) {
    console.log(`截止：${r.dueAt}`);
  }
  if (r.remindAt) {
    console.log(`通知：${r.remindAt}`);
  }
  if (r.source && r.externalId) {
    console.log(`来源：${r.source} / ${r.externalId}`);
  }
  if (r.notes) {
    console.log(`备注：${r.notes}`);
  }
  if (r.contacts && r.contacts.length > 0) {
    console.log(`联系人：${r.contacts.map((c) => `${c.displayName} (@${c.handle})`).join(", ")}`);
  }
}

function readSourceMeta(argv: string[]): Record<string, unknown> | undefined {
  const raw = readFlagValue(argv, "--source-meta");
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error("source meta must be an object");
    }
    return parsed as Record<string, unknown>;
  } catch {
    console.error("--source-meta must be a JSON object, for example '{\"subject\":\"...\"}'");
    process.exitCode = 1;
    return undefined;
  }
}

async function resolveReminderId(
  ctx: CliContext,
  argv: string[],
  ...anchors: string[]
): Promise<string | undefined> {
  const id = positionalAfter(argv, ...anchors);
  if (id) {
    return id;
  }

  const source = readFlagValue(argv, "--source");
  const externalId = readFlagValue(argv, "--external-id");
  if (!source && !externalId) {
    return undefined;
  }
  if (!source || !externalId) {
    console.error("--source and --external-id must be provided together.");
    process.exitCode = 1;
    return undefined;
  }

  const response = await ctx.client.findReminderBySource(source, externalId);
  if (!response.ok) {
    await handleApi(ctx, response, () => {});
    return undefined;
  }
  return response.data.reminder.id;
}

declare const process: { exitCode?: number };
