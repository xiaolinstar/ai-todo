#!/usr/bin/env node
/**
 * Build CD release report (JSON + Markdown) for GitHub Step Summary and artifact.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function stepResult(name, needs) {
  const value = needs?.[name];
  if (value === undefined || value === null || value === "") {
    return "skipped";
  }
  return String(value);
}

function deriveOutcome(needs) {
  const deploy = stepResult("deploy", needs);
  const verify = stepResult("post_deploy_verify", needs);
  const rollback = stepResult("rollback", needs);
  const rollbackVerify = stepResult("post_rollback_verify", needs);

  if (deploy !== "success") {
    return "deploy_failed";
  }
  if (verify === "success") {
    return "success";
  }
  if (rollback === "success" && rollbackVerify === "success") {
    return "rolled_back";
  }
  if (rollback === "success") {
    return "rollback_verify_failed";
  }
  if (verify === "failure" && rollback !== "success") {
    return "verify_failed_rollback_failed";
  }
  return "failed";
}

function buildMarkdown(report) {
  const lines = [
    "## CD Release Report",
    "",
    `| Field | Value |`,
    `|-------|-------|`,
    `| Environment | ${report.environment} |`,
    `| Release tag | ${report.releaseTag || "—"} |`,
    `| Git SHA | \`${report.gitSha || "—"}\` |`,
    `| Outcome | **${report.outcome}** |`,
    `| Public API | ${report.publicApiUrl || "—"} |`,
    `| Finished at | ${report.finishedAt} |`,
    "",
    "### Steps",
    "",
    "| Step | Result |",
    "|------|--------|",
  ];

  for (const [key, value] of Object.entries(report.steps)) {
    lines.push(`| ${key} | ${value} |`);
  }

  if (report.verifyError) {
    lines.push("", "### Verify error", "", "```", report.verifyError, "```");
  }

  return lines.join("\n");
}

async function main() {
  const needs = {
    resolve_manifest: process.env.CD_STEP_RESOLVE_MANIFEST,
    deploy: process.env.CD_STEP_DEPLOY,
    post_deploy_verify: process.env.CD_STEP_POST_DEPLOY_VERIFY,
    rollback: process.env.CD_STEP_ROLLBACK,
    post_rollback_verify: process.env.CD_STEP_POST_ROLLBACK_VERIFY,
  };

  const outcome = deriveOutcome(needs);
  const finishedAt = new Date().toISOString();

  const report = {
    schemaVersion: 1,
    environment: process.env.CD_ENVIRONMENT || "production",
    releaseTag: process.env.CD_RELEASE_TAG || null,
    gitSha: process.env.CD_GIT_SHA || null,
    fingerprint: process.env.CD_FINGERPRINT || null,
    ciRunId: process.env.CD_CI_RUN_ID || null,
    publicApiUrl: process.env.CD_PUBLIC_API_URL || null,
    outcome,
    steps: {
      resolveManifest: stepResult("resolve_manifest", needs),
      deploy: stepResult("deploy", needs),
      postDeployVerify: stepResult("post_deploy_verify", needs),
      rollback: stepResult("rollback", needs),
      postRollbackVerify: stepResult("post_rollback_verify", needs),
    },
    verifyError: process.env.CD_VERIFY_ERROR || null,
    finishedAt,
  };

  const outDir = process.env.CD_REPORT_DIR || "cd-report";
  await mkdir(outDir, { recursive: true });

  const jsonPath = path.join(outDir, "release-report.json");
  const mdPath = path.join(outDir, "release-report.md");
  const markdown = buildMarkdown(report);

  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(mdPath, `${markdown}\n`, "utf8");

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    await writeFile(summaryPath, `${markdown}\n`, "utf8");
  }

  console.log(markdown);
  if (outcome !== "success") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
