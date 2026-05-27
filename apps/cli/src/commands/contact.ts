import type { ContactSummary, CreateContactInput } from "@ai-todo/shared";

import type { CliContext } from "../context";
import { handleApi, positionalAfter, readFlagValue } from "../context";

export async function runContactAdd(ctx: CliContext, argv: string[]): Promise<void> {
  const displayName = positionalAfter(argv, "contact", "add");
  if (!displayName) {
    console.error(
      "Usage: ai-todo contact add <name> [--handle <handle>] [--email <v>] [--phone <v>]"
    );
    process.exitCode = 1;
    return;
  }

  const methods: CreateContactInput["methods"] = [];
  const handle = readFlagValue(argv, "--handle");
  const email = readFlagValue(argv, "--email");
  const phone = readFlagValue(argv, "--phone");
  const alias = readFlagValue(argv, "--alias");

  if (email) {
    methods.push({ type: "email", value: email, label: "work", isPrimary: true });
  }
  if (phone) {
    methods.push({ type: "phone", value: phone, label: "mobile", isPrimary: true });
  }

  await handleApi(
    ctx,
    await ctx.client.createContact({
      displayName,
      handle,
      methods,
      aliases: alias ? [alias] : []
    }),
    (data) => {
      if (!ctx.json) {
        console.log(`已创建联系人：${data.contact.displayName}`);
        console.log(`标识：${data.contact.handle}`);
        console.log(`ID：${data.contact.id}`);
      }
    }
  );
}

export async function runContactSearch(ctx: CliContext, argv: string[]): Promise<void> {
  const query = positionalAfter(argv, "contact", "search");
  if (!query) {
    console.error("Usage: ai-todo contact search <query>");
    process.exitCode = 1;
    return;
  }
  await handleApi(ctx, await ctx.client.searchContacts(query), (data) => {
    if (ctx.json) {
      return;
    }
    renderContactList(data.items);
  });
}

export async function runContactList(ctx: CliContext): Promise<void> {
  await handleApi(ctx, await ctx.client.searchContacts(), (data) => {
    if (ctx.json) {
      return;
    }
    renderContactList(data.items);
  });
}

export async function runContactShow(ctx: CliContext, argv: string[]): Promise<void> {
  const id = positionalAfter(argv, "contact", "show");
  if (!id) {
    console.error("Usage: ai-todo contact show <contact_id_or_handle>");
    process.exitCode = 1;
    return;
  }
  await handleApi(ctx, await ctx.client.getContact(id), (data) => {
    if (ctx.json) {
      return;
    }
    const c = data.contact;
    console.log(`${c.displayName} (@${c.handle}, ${c.id})`);
    console.log(`标识来源：${c.handleSource === "generated" ? "自动生成" : "手动设置"}`);
    if (c.linkedUserId) {
      console.log(`平台用户：${c.linkedUserId}`);
    }
    if (c.primaryEmail) {
      console.log(`邮箱：${c.primaryEmail}`);
    }
    if (c.primaryPhone) {
      console.log(`电话：${c.primaryPhone}`);
    }
    if (c.aliases.length > 0) {
      console.log(`别名：${c.aliases.join(", ")}`);
    }
    if (c.methods.length > 0) {
      console.log("联系方式：");
      for (const method of c.methods) {
        const primary = method.isPrimary ? "，主要" : "";
        const label = method.label ? `，${method.label}` : "";
        console.log(`- ${method.type}${label}${primary}：${method.value}`);
      }
    }
    if (c.notes) {
      console.log(`备注：${c.notes}`);
    }
  });
}

export async function runContactUpdate(ctx: CliContext, argv: string[]): Promise<void> {
  const id = positionalAfter(argv, "contact", "update");
  if (!id) {
    console.error(
      "Usage: ai-todo contact update <contact_id_or_handle> [--handle <handle>] [--name <text>] [--email <v>] [--phone <v>] [--alias <v>] [--notes <text>]"
    );
    process.exitCode = 1;
    return;
  }

  const displayName = readFlagValue(argv, "--name");
  const handle = readFlagValue(argv, "--handle");
  const email = readFlagValue(argv, "--email");
  const phone = readFlagValue(argv, "--phone");
  const alias = readFlagValue(argv, "--alias");
  const notes = readFlagValue(argv, "--notes");
  const hasNotes = argv.includes("--notes");

  if (!displayName && !handle && !email && !phone && !alias && !hasNotes) {
    console.error("Provide at least one field to update");
    process.exitCode = 1;
    return;
  }

  const methods: CreateContactInput["methods"] = [];
  if (email) {
    methods.push({ type: "email", value: email, label: "work", isPrimary: true });
  }
  if (phone) {
    methods.push({ type: "phone", value: phone, label: "mobile", isPrimary: true });
  }

  await handleApi(
    ctx,
    await ctx.client.updateContact(id, {
      displayName,
      handle,
      notes: hasNotes ? notes : undefined,
      methods: methods.length > 0 ? methods : undefined,
      aliases: alias ? [alias] : undefined
    }),
    (data) => {
      if (!ctx.json) {
        console.log(
          `已更新联系人：${data.contact.displayName} (@${data.contact.handle}, ${data.contact.id})`
        );
      }
    }
  );
}

function renderContactList(items: ContactSummary[]): void {
  if (items.length === 0) {
    console.log("未找到联系人");
    return;
  }

  for (const contact of items) {
    const email = contact.primaryEmail ? ` <${contact.primaryEmail}>` : "";
    const phone = contact.primaryPhone ? ` ${contact.primaryPhone}` : "";
    const company = contact.company ? ` · ${contact.company}` : "";
    console.log(`- ${contact.displayName}${company}${email}${phone} (@${contact.handle}, ${contact.id})`);
  }
}

declare const process: { exitCode?: number };
