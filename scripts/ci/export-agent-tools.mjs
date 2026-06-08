#!/usr/bin/env node
/**
 * Export @ai-todo/agent-protocol tool catalog to JSON (for MCP generators / docs).
 * Requires packages/agent-protocol to be built first.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const distEntry = path.join(repoRoot, "packages/agent-protocol/dist/index.js");
const outDir = path.join(repoRoot, "packages/agent-protocol/dist");
const outFile = path.join(outDir, "agent-tools.json");

const mod = await import(pathToFileURL(distEntry).href);
const payload = {
  schemaVersion: 1,
  package: "@ai-todo/agent-protocol",
  tools: mod.AI_TODO_AGENT_TOOLS,
  guidelines: [...mod.AI_TODO_AGENT_GUIDELINES]
};

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Wrote ${outFile} (${payload.tools.length} tools)`);
