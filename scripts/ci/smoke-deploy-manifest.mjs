#!/usr/bin/env node
/**
 * Smoke-test deploy manifest generation without embedding shell setup in workflow YAML.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const workDir = mkdtempSync(path.join(tmpdir(), "ai-todo-manifest-"));
const zeroDigest = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
const zeroSha = "0000000000000000000000000000000000000000000000000000";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: workDir,
    stdio: "inherit",
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(process.execPath, [path.join(repoRoot, "scripts/ci/write-deploy-manifest.mjs")], {
  env: {
    ...process.env,
    API_IMAGE: `${process.env.API_IMAGE_NAME ?? "ghcr.io/xiaolinstar/ai-todo-api"}@${zeroDigest}`,
    API_IMAGE_DIGEST: zeroDigest,
    MINIAPP_ARTIFACT_SHA: zeroSha,
    GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY ?? "xiaolinstar/ai-todo",
    GITHUB_SHA: process.env.GITHUB_SHA ?? "0000000000000000000000000000000000000000",
    GITHUB_REF: process.env.GITHUB_REF ?? "refs/heads/main",
    GITHUB_RUN_ID: process.env.GITHUB_RUN_ID ?? "0",
  },
});

run(process.execPath, [
  path.join(repoRoot, "scripts/ci/verify-deploy-manifest.mjs"),
  "deploy-manifest.json",
]);
