import type { CreateContactInput } from "@ai-todo/shared";

import type { CliContext } from "../context";
import { handleApi, positionalAfter, readFlagValue } from "../context";
import { readListCursor, readListLimit } from "../pagination";
import { renderContactListPage } from "../render-list";

export async function runContactAdd(ctx: CliContext, argv: string[]): Promise<void> {
  const displayName = positionalAfter(argv, "contact", "add");
  if (!displayName) {
    console.error(
      "Usage: ai-todo contact add <name> [--handle <handle>] [--email <v>] [--phone <v>] [--company <text>] [--job-title <text>] [--notes <text>]"
    );
    process.exitCode = 1;
    return;
  }

  const methods: CreateContactInput["methods"] = [];
  const handle = readFlagValue(argv, "--handle");
  const email = readFlagValue(argv, "--email");
  const phone = readFlagValue(argv, "--phone");
  const alias = readFlagValue(argv, "--alias");
  const company = readFlagValue(argv, "--company");
  const jobTitle = readFlagValue(argv, "--job-title");
  const notes = readFlagValue(argv, "--notes");

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
      company,
      title: jobTitle,
      notes,
      methods,
      aliases: alias ? [alias] : []
    }),
    (data) => {
      if (!ctx.json) {
        console.log(`Created contact: ${data.contact.displayName}`);
        console.log(`Handle: ${data.contact.handle}`);
        console.log(`ID: ${data.contact.id}`);
      }
    }
  );
}

export async function runContactSearch(ctx: CliContext, argv: string[]): Promise<void> {
  const query = positionalAfter(argv, "contact", "search");
  if (!query) {
    console.error("Usage: ai-todo contact search <query> [--limit <n>] [--cursor <token>]");
    process.exitCode = 1;
    return;
  }
  if (process.exitCode) {
    return;
  }

  const limit = readListLimit(argv);
  const cursor = readListCursor(argv);
  await handleApi(
    ctx,
    await ctx.client.searchContacts({ query, limit, cursor }),
    (data) => {
      if (ctx.json) {
        return;
      }
      renderContactListPage(data.items, {
        label: "Contacts",
        totalCount: data.totalCount,
        hasMore: data.hasMore,
        nextCursor: data.nextCursor,
        query,
        nextPageHint: "ai-todo contact search <query>"
      });
    }
  );
}

export async function runContactList(ctx: CliContext, argv: string[]): Promise<void> {
  const limit = readListLimit(argv);
  const cursor = readListCursor(argv);
  if (process.exitCode) {
    return;
  }

  await handleApi(
    ctx,
    await ctx.client.searchContacts({ limit, cursor }),
    (data) => {
      if (ctx.json) {
        return;
      }
      renderContactListPage(data.items, {
        label: "Contacts",
        totalCount: data.totalCount,
        hasMore: data.hasMore,
        nextCursor: data.nextCursor,
        nextPageHint: "ai-todo contact list"
      });
    }
  );
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
    console.log(`Handle source: ${c.handleSource === "generated" ? "generated" : "manual"}`);
    if (c.linkedUserId) {
      console.log(`Linked user: ${c.linkedUserId}`);
    }
    if (c.primaryEmail) {
      console.log(`Email: ${c.primaryEmail}`);
    }
    if (c.primaryPhone) {
      console.log(`Phone: ${c.primaryPhone}`);
    }
    if (c.company) {
      console.log(`Company: ${c.company}`);
    }
    if (c.title) {
      console.log(`Job title: ${c.title}`);
    }
    if (c.aliases.length > 0) {
      console.log(`Aliases: ${c.aliases.join(", ")}`);
    }
    if (c.methods.length > 0) {
      console.log("Contact methods:");
      for (const method of c.methods) {
        const primary = method.isPrimary ? ", primary" : "";
        const label = method.label ? `, ${method.label}` : "";
        console.log(`- ${method.type}${label}${primary}: ${method.value}`);
      }
    }
    if (c.notes) {
      console.log(`Notes: ${c.notes}`);
    }
  });
}

export async function runContactUpdate(ctx: CliContext, argv: string[]): Promise<void> {
  const id = positionalAfter(argv, "contact", "update");
  if (!id) {
    console.error(
      "Usage: ai-todo contact update <contact_id_or_handle> [--handle <handle>] [--name <text>] [--email <v>] [--phone <v>] [--company <text>] [--job-title <text>] [--alias <v>] [--notes <text>]"
    );
    process.exitCode = 1;
    return;
  }

  const displayName = readFlagValue(argv, "--name");
  const handle = readFlagValue(argv, "--handle");
  const email = readFlagValue(argv, "--email");
  const phone = readFlagValue(argv, "--phone");
  const alias = readFlagValue(argv, "--alias");
  const company = readFlagValue(argv, "--company");
  const jobTitle = readFlagValue(argv, "--job-title");
  const notes = readFlagValue(argv, "--notes");
  const hasCompany = argv.includes("--company");
  const hasJobTitle = argv.includes("--job-title");
  const hasNotes = argv.includes("--notes");

  if (!displayName && !handle && !email && !phone && !alias && !hasCompany && !hasJobTitle && !hasNotes) {
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
      company: hasCompany ? company : undefined,
      title: hasJobTitle ? jobTitle : undefined,
      notes: hasNotes ? notes : undefined,
      methods: methods.length > 0 ? methods : undefined,
      aliases: alias ? [alias] : undefined
    }),
    (data) => {
      if (!ctx.json) {
        console.log(
          `Updated contact: ${data.contact.displayName} (@${data.contact.handle}, ${data.contact.id})`
        );
      }
    }
  );
}

export async function runContactDelete(ctx: CliContext, argv: string[]): Promise<void> {
  const id = positionalAfter(argv, "contact", "delete");
  if (!id) {
    console.error("Usage: ai-todo contact delete <contact_id_or_handle>");
    process.exitCode = 1;
    return;
  }

  await handleApi(ctx, await ctx.client.deleteContact(id), (data) => {
    if (!ctx.json) {
      console.log(`Deleted contact: ${data.id}`);
    }
  });
}

declare const process: { exitCode?: number };
