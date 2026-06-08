#!/usr/bin/env node
/**
 * Smoke test: build artifacts exist and P0 tool names are registered.
 */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(scriptDir, "..");
const distEntry = path.join(pkgRoot, "dist/index.js");

const EXPECTED_TOOLS = [
  "whoami",
  "today",
  "reminder_find",
  "reminder_create",
  "reminder_create_sourced",
  "reminder_list",
  "reminder_list_by_source",
  "reminder_update_by_source",
  "reminder_complete_by_source",
  "contact_search",
  "calendar_today",
  "calendar_create"
];

if (!fs.existsSync(distEntry)) {
  console.error("Missing dist/index.js — run pnpm --filter @ai-todo/mcp build");
  process.exit(1);
}

const stat = fs.statSync(distEntry);
if (stat.size < 1000) {
  console.error("dist/index.js looks too small");
  process.exit(1);
}

const serverSrc = fs.readFileSync(path.join(pkgRoot, "src/server.ts"), "utf8");
for (const name of EXPECTED_TOOLS) {
  if (!serverSrc.includes(`"${name}"`)) {
    console.error(`P0 tool not found in server.ts: ${name}`);
    process.exit(1);
  }
}

console.log(`ai-todo-mcp smoke OK (${EXPECTED_TOOLS.length} P0 tools, dist ${stat.size} bytes)`);
