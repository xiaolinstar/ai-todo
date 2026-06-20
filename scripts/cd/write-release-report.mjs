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
    `| Release class | **${report.classification.releaseClass || "unknown"}** |`,
    `| DB backup recommended | ${report.classification.dbBackupRecommended ? "yes" : "no"} |`,
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

  if (report.classification.hasSchemaChanges) {
    lines.push(
      "",
      "### Database notice",
      "",
      "This release includes Alembic migration changes. CD rollback restores app code/image only; PostgreSQL schema and data are not automatically rolled back.",
    );
  }

  return lines.join("\n");
}

async function main() {
  const needs = {
    resolve_manifest: process.env.CD_STEP_RESOLVE_MANIFEST,
    classify_release: process.env.CD_STEP_CLASSIFY_RELEASE,
    deploy: process.env.CD_STEP_DEPLOY,
    post_deploy_verify: process.env.CD_STEP_POST_DEPLOY_VERIFY,
    publish_accepted: process.env.CD_STEP_PUBLISH_ACCEPTED,
    deploy_failed: process.env.CD_STEP_DEPLOY_FAILED,
    rollback: process.env.CD_STEP_ROLLBACK,
    post_rollback_verify: process.env.CD_STEP_POST_ROLLBACK_VERIFY,
    release_not_adopted: process.env.CD_STEP_RELEASE_NOT_ADOPTED,
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
    classification: {
      releaseClass: process.env.CD_RELEASE_CLASS || null,
      hasSchemaChanges: process.env.CD_HAS_SCHEMA_CHANGES === "true",
      hasDbRuntimeChanges: process.env.CD_HAS_DB_RUNTIME_CHANGES === "true",
      hasInfraChanges: process.env.CD_HAS_INFRA_CHANGES === "true",
      dbBackupRecommended: process.env.CD_DB_BACKUP_RECOMMENDED === "true",
      currentGitSha: process.env.CD_CURRENT_GIT_SHA || null,
      compareBase: process.env.CD_COMPARE_BASE || null,
    },
    outcome,
    steps: {
      resolveManifest: stepResult("resolve_manifest", needs),
      classifyRelease: stepResult("classify_release", needs),
      deploy: stepResult("deploy", needs),
      postDeployVerify: stepResult("post_deploy_verify", needs),
      publishAccepted: stepResult("publish_accepted", needs),
      deployFailed: stepResult("deploy_failed", needs),
      rollback: stepResult("rollback", needs),
      postRollbackVerify: stepResult("post_rollback_verify", needs),
      releaseNotAdopted: stepResult("release_not_adopted", needs),
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
