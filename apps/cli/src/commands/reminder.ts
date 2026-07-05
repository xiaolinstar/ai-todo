import type { ReminderStatus } from "@ai-todo/shared";

import { printWechatNotifyCliNotice } from "../messages";
import type { CliContext } from "../context";
import {
  handleApi,
  hasFlag,
  positionalAfter,
  readFlagValue,
  readRepeatedFlag
} from "../context";
import { readListCursor, readListLimit } from "../pagination";
import { formatReminderStatus, renderReminderListPage } from "../render-list";

type ReminderSortFlag = "created_at" | "due_at" | "completed_at" | "updated_at";

function readReminderSort(argv: string[], all: boolean, status?: ReminderStatus): ReminderSortFlag {
  const raw = readFlagValue(argv, "--sort");
  if (!raw) {
    if (status === "completed") {
      return "completed_at";
    }
    return all ? "created_at" : "due_at";
  }
  if (raw === "created" || raw === "created_at") {
    return "created_at";
  }
  if (raw === "due" || raw === "due_at") {
    return "due_at";
  }
  if (raw === "completed" || raw === "completed_at") {
    return "completed_at";
  }
  if (raw === "updated" || raw === "updated_at") {
    return "updated_at";
  }
  console.error("Invalid --sort. Use one of: due, created, completed.");
  process.exitCode = 1;
  return all ? "created_at" : "due_at";
}

function sortedReminders<T extends { dueAt?: string; completedAt?: string; status: string }>(
  items: T[],
  sort: ReminderSortFlag,
  showAll: boolean
): T[] {
  const statusRank: Record<string, number> = {
    pending: 0,
    in_progress: 1,
    completed: 2,
    cancelled: 3
  };
  const timestamp = (value?: string): number => {
    if (!value) return Number.POSITIVE_INFINITY;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
  };
  return [...items].sort((a, b) => {
    if (showAll) {
      const rank = (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
      if (rank !== 0) return rank;
    }
    if (sort === "completed_at") {
      return timestamp(a.completedAt) - timestamp(b.completedAt);
    }
    if (sort === "created_at") {
      return 0;
    }
    return timestamp(a.dueAt) - timestamp(b.dueAt);
  });
}

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
      contactIds: readRepeatedFlag(argv, "--contact"),
      tagNames: readRepeatedFlag(argv, "--tag")
    }),
    (data) => {
      if (!ctx.json) {
        console.log(`${data.created === false ? "Existing reminder" : "Created reminder"}: ${data.reminder.title}`);
        console.log(`ID: ${data.reminder.id}`);
        if (data.reminder.dueAt) {
          console.log(`Due: ${data.reminder.dueAt}`);
        }
        if (data.reminder.source && data.reminder.externalId) {
          console.log(`Source: ${data.reminder.source} / ${data.reminder.externalId}`);
        }
        if (data.created !== false) {
          printWechatNotifyCliNotice();
        }
      }
    }
  );
}

export async function runReminderList(ctx: CliContext, argv: string[]): Promise<void> {
  const all = hasFlag(argv, "-a") || hasFlag(argv, "--all");
  const status = all ? undefined : ((readFlagValue(argv, "--status") as ReminderStatus | undefined) ?? "pending");
  const sort = readReminderSort(argv, all, status);
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
      q: readFlagValue(argv, "--q"),
      tags: readRepeatedFlag(argv, "--tag"),
      from: readFlagValue(argv, "--from"),
      to: readFlagValue(argv, "--to"),
      limit,
      cursor,
      sort
    }),
    (data) => {
      if (ctx.json) {
        return;
      }
      renderReminderListPage(sortedReminders(data.items, sort, all), {
        label: all
          ? "Reminders · all statuses"
          : `Reminders · ${status ? formatReminderStatus(status) : "all"}`,
        totalCount: data.totalCount,
        hasMore: data.hasMore,
        nextCursor: data.nextCursor,
        nextPageHint: "ai-todo reminder list"
      }, { showStatus: all });
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

export async function runReminderShow(ctx: CliContext, argv: string[], anchor = "show"): Promise<void> {
  const id = await resolveReminderId(ctx, argv, anchor, "inspect", "ls");
  if (!id) {
    console.error("Usage: ai-todo reminder show|inspect <reminder_id_or_prefix>");
    process.exitCode = 1;
    return;
  }
  await handleApi(ctx, await ctx.client.getReminder(id), (data) => {
    if (ctx.json) {
      return;
    }
    const r = data.reminder;
    console.log(`${r.title} (${r.id})`);
    console.log(`Status: ${formatReminderStatus(r.status)}`);
    if (r.dueAt) {
      console.log(`Due: ${r.dueAt}`);
    }
    if (r.remindAt) {
      console.log(`Remind: ${r.remindAt}`);
    }
    if (r.source && r.externalId) {
      console.log(`Source: ${r.source} / ${r.externalId}`);
    }
    if (r.notes) {
      console.log(`Notes: ${r.notes}`);
    }
    if (r.tags && r.tags.length > 0) {
      console.log(`Tags: ${r.tags.map((tag) => tag.name).join(", ")}`);
    }
    if (r.trackEntries && r.trackEntries.length > 0) {
      console.log("Track:");
      for (const entry of r.trackEntries) {
        console.log(`  ${entry.dateLabel} ${entry.text}`);
      }
    }
    if (r.contacts && r.contacts.length > 0) {
      console.log(
        `Contacts: ${r.contacts.map((c) => `${c.displayName} (@${c.handle})`).join(", ")}`
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
      console.log(`Completed reminder: ${data.reminder.title}`);
      console.log(`ID: ${data.reminder.id}`);
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
  const tagNames = readRepeatedFlag(argv, "--tag");
  const hasContacts = hasFlag(argv, "--contact");
  const hasTags = hasFlag(argv, "--tag");
  const hasNotes = hasFlag(argv, "--notes");
  const status = readFlagValue(argv, "--status") as ReminderStatus | undefined;

  if (
    !title &&
    notes === undefined &&
    due === undefined &&
    remind === undefined &&
    !hasContacts &&
    !hasTags &&
    !status
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
      status,
      dueAt: due,
      remindAt: remind,
      contactIds: hasContacts ? contactIds : undefined,
      tagNames: hasTags ? tagNames : undefined
    }),
    (data) => {
      if (!ctx.json) {
        const r = data.reminder;
        console.log(`Updated reminder: ${r.title} (${r.id})`);
        if (r.dueAt) {
          console.log(`Due: ${r.dueAt}`);
        }
        if (r.remindAt) {
          console.log(`Remind: ${r.remindAt}`);
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
        console.log(`Rescheduled reminder: ${data.reminder.title}`);
        if (data.reminder.dueAt) {
          console.log(`New due: ${data.reminder.dueAt}`);
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
      console.log(`Deleted reminder: ${data.id}`);
    }
  });
}

export async function runReminderTrackAdd(ctx: CliContext, argv: string[]): Promise<void> {
  const rawId = trackAddReminderId(argv);
  if (!rawId) {
    console.error("Usage: ai-todo reminder track add <reminder_id> <text>");
    process.exitCode = 1;
    return;
  }
  const id = rawId.startsWith("rem_") ? rawId : await resolveReminderIdPrefix(ctx, rawId);
  if (!id) {
    return;
  }
  const text = readTextAfterId(argv, rawId);
  if (!text) {
    console.error("Usage: ai-todo reminder track add <reminder_id> <text>");
    process.exitCode = 1;
    return;
  }
  await handleApi(ctx, await ctx.client.addReminderTrackEntry(id, { text }), (data) => {
    if (ctx.json) {
      return;
    }
    const latest = data.reminder.trackEntries?.[0];
    if (latest) {
      console.log(`Added track entry: ${latest.dateLabel} ${latest.text}`);
    }
    console.log(`Reminder: ${data.reminder.title} (${data.reminder.id})`);
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
  tags?: { name: string }[];
  trackEntries?: { dateLabel: string; text: string }[];
  contacts?: { displayName: string; handle: string }[];
}): void {
  console.log(`${r.title} (${r.id})`);
  console.log(`Status: ${formatReminderStatus(r.status)}`);
  if (r.dueAt) {
    console.log(`Due: ${r.dueAt}`);
  }
  if (r.remindAt) {
    console.log(`Remind: ${r.remindAt}`);
  }
  if (r.source && r.externalId) {
    console.log(`Source: ${r.source} / ${r.externalId}`);
  }
  if (r.notes) {
    console.log(`Notes: ${r.notes}`);
  }
  if (r.tags && r.tags.length > 0) {
    console.log(`Tags: ${r.tags.map((tag) => tag.name).join(", ")}`);
  }
  if (r.trackEntries && r.trackEntries.length > 0) {
    console.log("Track:");
    for (const entry of r.trackEntries) {
      console.log(`  ${entry.dateLabel} ${entry.text}`);
    }
  }
  if (r.contacts && r.contacts.length > 0) {
    console.log(`Contacts: ${r.contacts.map((c) => `${c.displayName} (@${c.handle})`).join(", ")}`);
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
    return resolveReminderIdPrefix(ctx, id);
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

async function resolveReminderIdPrefix(ctx: CliContext, raw: string): Promise<string | undefined> {
  const value = raw.trim();
  if (!value) {
    return undefined;
  }
  if (value.startsWith("rem_")) {
    return value;
  }
  if (value.length < 4) {
    console.error("Reminder ID prefix must be at least 4 characters.");
    process.exitCode = 1;
    return undefined;
  }

  const response = await ctx.client.listReminders({ limit: 500 });
  if (!response.ok) {
    await handleApi(ctx, response, () => {});
    return undefined;
  }

  const matches = response.data.items.filter((item) => {
    const short = item.id.startsWith("rem_") ? item.id.slice(4) : item.id;
    return short.startsWith(value) || item.id.startsWith(value);
  });

  if (matches.length === 0) {
    console.error(`No reminder matches ID prefix "${value}".`);
    process.exitCode = 1;
    return undefined;
  }
  if (matches.length > 1) {
    const ids = matches
      .slice(0, 8)
      .map((item) => (item.id.startsWith("rem_") ? item.id.slice(4, 16) : item.id.slice(0, 12)))
      .join(", ");
    console.error(`ID prefix "${value}" is ambiguous. Matches: ${ids}`);
    process.exitCode = 1;
    return undefined;
  }

  return matches[0].id;
}

function trackAddReminderId(argv: string[]): string | undefined {
  const args = argv.filter((arg) => !arg.startsWith("-"));
  const addIndex = args.indexOf("add");
  if (addIndex < 0 || addIndex + 1 >= args.length) {
    return undefined;
  }
  const candidate = args[addIndex + 1];
  return candidate || undefined;
}

function readTextAfterId(argv: string[], reminderId: string): string | undefined {
  const args = argv.filter((arg) => !arg.startsWith("-"));
  const idIndex = args.indexOf(reminderId);
  if (idIndex < 0) {
    return undefined;
  }
  const text = args.slice(idIndex + 1).join(" ").trim();
  return text || undefined;
}

declare const process: { exitCode?: number };
