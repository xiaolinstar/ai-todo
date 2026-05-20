#!/usr/bin/env node

import { buildContext } from "./context";
import { printHelp } from "./help";
import * as calendar from "./commands/calendar";
import * as contact from "./commands/contact";
import * as core from "./commands/core";
import * as reminder from "./commands/reminder";

const argv = process.argv.slice(2);
const command = argv[0] ?? "help";
const sub = argv[1];
const ctx = buildContext(argv);

async function main(): Promise<void> {
  switch (command) {
    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;
    case "login":
      await core.runLogin(ctx, argv);
      break;
    case "whoami":
      await core.runWhoami(ctx);
      break;
    case "today":
      await core.runToday(ctx);
      break;
    case "add":
      await reminder.runReminderCreate(ctx, argv);
      break;
    case "list":
      await reminder.runReminderList(ctx, argv);
      break;
    case "done":
      await reminder.runReminderDone(ctx, argv);
      break;
    case "reschedule":
      await reminder.runReminderReschedule(ctx, argv);
      break;
    case "reminder": {
      const action = sub ?? "help";
      if (action === "create") {
        await reminder.runReminderCreate(ctx, argv);
      } else if (action === "list") {
        await reminder.runReminderList(ctx, argv);
      } else if (action === "show") {
        await reminder.runReminderShow(ctx, argv);
      } else if (action === "done" || action === "complete") {
        await reminder.runReminderDone(ctx, argv);
      } else if (action === "update") {
        await reminder.runReminderUpdate(ctx, argv);
      } else if (action === "reschedule") {
        await reminder.runReminderReschedule(ctx, argv);
      } else if (action === "delete") {
        await reminder.runReminderDelete(ctx, argv);
      } else {
        console.error("Usage: ai-todo reminder <create|list|show|done|update|reschedule|delete>");
        process.exitCode = 1;
      }
      break;
    }
    case "calendar": {
      const action = sub ?? "help";
      if (action === "today") {
        await calendar.runCalendarToday(ctx);
      } else if (action === "list") {
        await calendar.runCalendarList(ctx, argv);
      } else if (action === "add") {
        await calendar.runCalendarAdd(ctx, argv);
      } else if (action === "show") {
        await calendar.runCalendarShow(ctx, argv);
      } else if (action === "delete") {
        await calendar.runCalendarDelete(ctx, argv);
      } else {
        console.error("Usage: ai-todo calendar <today|list|add|show|delete>");
        process.exitCode = 1;
      }
      break;
    }
    case "contact": {
      const action = sub ?? "help";
      if (action === "add") {
        await contact.runContactAdd(ctx, argv);
      } else if (action === "search") {
        await contact.runContactSearch(ctx, argv);
      } else if (action === "show") {
        await contact.runContactShow(ctx, argv);
      } else {
        console.error("Usage: ai-todo contact <add|search|show>");
        process.exitCode = 1;
      }
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unexpected CLI error.");
  process.exitCode = 1;
});

declare const process: {
  argv: string[];
  exitCode?: number;
};
