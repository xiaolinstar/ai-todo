import type { TagSummary } from "@ai-todo/shared";

import type { CliContext } from "../context";
import { handleApi, positionalAfter, readFlagValue } from "../context";
import { readListLimit } from "../pagination";

type TagSort = "usage" | "name" | "updated";

export async function runTagList(ctx: CliContext, argv: string[]): Promise<void> {
  const limit = readListLimit(argv);
  const sort = readTagSort(argv);
  if (process.exitCode) {
    return;
  }

  await handleApi(
    ctx,
    await ctx.client.listTags({
      q: readFlagValue(argv, "--q"),
      limit,
      sort,
    }),
    (data) => {
      if (ctx.json) {
        return;
      }
      console.log(`Tags · ${data.totalCount}`);
      if (data.items.length === 0) {
        console.log("  None");
        return;
      }
      for (const tag of data.items) {
        console.log(formatTagRow(tag));
      }
    }
  );
}

export async function runTagCreate(ctx: CliContext, argv: string[]): Promise<void> {
  const name = readFlagValue(argv, "--name") ?? positionalAfter(argv, "create", "add");
  if (!name) {
    console.error("Usage: ai-todo tag create --name <text> [--color <palette_color>]");
    process.exitCode = 1;
    return;
  }

  await handleApi(
    ctx,
    await ctx.client.createTag({
      name,
      color: readFlagValue(argv, "--color"),
    }),
    (data) => {
      if (!ctx.json) {
        console.log(`Created tag: ${data.tag.name} (${data.tag.id})`);
      }
    }
  );
}

export async function runTagUpdate(ctx: CliContext, argv: string[]): Promise<void> {
  const tagId = argv[2];
  if (!tagId || tagId.startsWith("-")) {
    console.error("Usage: ai-todo tag update <tag_id> [--name <text>] [--color <palette_color>]");
    process.exitCode = 1;
    return;
  }
  const name = readFlagValue(argv, "--name");
  const color = readFlagValue(argv, "--color");
  if (!name && !color) {
    console.error("Provide --name or --color to update");
    process.exitCode = 1;
    return;
  }

  await handleApi(ctx, await ctx.client.updateTag(tagId, { name, color }), (data) => {
    if (!ctx.json) {
      console.log(`Updated tag: ${data.tag.name} (${data.tag.id})`);
    }
  });
}

export async function runTagDelete(ctx: CliContext, argv: string[]): Promise<void> {
  const tagId = argv[2];
  if (!tagId || tagId.startsWith("-")) {
    console.error("Usage: ai-todo tag delete <tag_id>");
    process.exitCode = 1;
    return;
  }

  await handleApi(ctx, await ctx.client.deleteTag(tagId), (data) => {
    if (!ctx.json) {
      console.log(`Deleted tag: ${data.id}`);
    }
  });
}

function readTagSort(argv: string[]): TagSort | undefined {
  const raw = readFlagValue(argv, "--sort");
  if (!raw) {
    return undefined;
  }
  if (raw === "usage" || raw === "name" || raw === "updated") {
    return raw;
  }
  console.error("Invalid --sort. Use one of: usage, name, updated.");
  process.exitCode = 1;
  return undefined;
}

function formatTagRow(tag: TagSummary): string {
  const count = tag.usageCount ?? 0;
  const lastUsed = tag.lastUsedAt ? `, last used ${tag.lastUsedAt}` : ", unused";
  return `- ${tag.name} (${tag.id}) ${count} reminders${lastUsed}`;
}

declare const process: { exitCode?: number };
