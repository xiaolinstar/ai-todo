#!/usr/bin/env node
/**
 * Classify a CD release by comparing the currently deployed API gitSha with the
 * target manifest gitSha.
 */
import { appendFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const targetSha = (process.env.TARGET_SHA || "").trim();
const publicApiUrl = (process.env.CD_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
const outDir = process.env.CD_CLASSIFICATION_DIR || "cd-report";

function setOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    appendFileSync(outputPath, `${name}=${value ?? ""}\n`, "utf8");
  } else {
    console.log(`${name}=${value ?? ""}`);
  }
}

function git(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", options.allowFailure ? "pipe" : "inherit"],
  }).trim();
}

function commitExists(sha) {
  if (!sha) return false;
  try {
    git(["cat-file", "-e", `${sha}^{commit}`], { allowFailure: true });
    return true;
  } catch {
    return false;
  }
}

function parentOf(sha) {
  try {
    return git(["rev-parse", `${sha}^`], { allowFailure: true });
  } catch {
    return "";
  }
}

async function fetchCurrentGitSha() {
  if (!publicApiUrl) {
    return { gitSha: "", error: "CD_PUBLIC_API_URL is not set" };
  }
  try {
    const response = await fetch(`${publicApiUrl}/v1/health`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      return { gitSha: "", error: `/v1/health returned HTTP ${response.status}` };
    }
    const payload = await response.json();
    return { gitSha: String(payload?.data?.gitSha || "").trim(), error: "" };
  } catch (error) {
    return { gitSha: "", error: error?.message || String(error) };
  }
}

function classifyFiles(files) {
  const schemaFiles = files.filter(
    (file) => file.startsWith("apps/api/alembic/versions/") && file.endsWith(".py"),
  );
  const dbRuntimeFiles = files.filter(
    (file) =>
      file.startsWith("apps/api/alembic/") ||
      file.startsWith("apps/api/src/ai_todo_api/db/") ||
      file === "apps/api/alembic.ini",
  );
  const infraFiles = files.filter(
    (file) =>
      file.startsWith(".github/workflows/") ||
      file.startsWith("apps/api/deploy/") ||
      file.startsWith("apps/api/docker-compose") ||
      file.startsWith("docs/env/") ||
      file === "apps/api/.env.production.example" ||
      file === "apps/api/.env.staging.example",
  );

  let releaseClass = "app-only";
  if (schemaFiles.length > 0) {
    releaseClass = "schema-change";
  } else if (infraFiles.length > 0) {
    releaseClass = "infra-change";
  }

  return {
    releaseClass,
    schemaFiles,
    dbRuntimeFiles,
    infraFiles,
    dbBackupRecommended: schemaFiles.length > 0 || dbRuntimeFiles.length > 0,
  };
}

function buildMarkdown(result) {
  const lines = [
    "## Release Classification",
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| Class | **${result.releaseClass}** |`,
    `| Current API gitSha | \`${result.currentGitSha || "unknown"}\` |`,
    `| Compare base | \`${result.compareBase || "unknown"}\` |`,
    `| Target gitSha | \`${result.targetSha}\` |`,
    `| Alembic migration changes | ${result.schemaFiles.length} |`,
    `| DB runtime changes | ${result.dbRuntimeFiles.length} |`,
    `| Infra/deploy changes | ${result.infraFiles.length} |`,
    `| DB backup recommended | ${result.dbBackupRecommended ? "yes" : "no"} |`,
  ];

  if (result.currentGitShaError) {
    lines.push("", `> Current API gitSha lookup warning: ${result.currentGitShaError}`);
  }

  if (result.schemaFiles.length > 0) {
    lines.push(
      "",
      "### Database Notice",
      "",
      "This release includes Alembic migration files. Confirm production backup and expand/deploy/backfill/contract compatibility before production deploy. CD rollback restores app code/image only; it does not rollback PostgreSQL schema or data.",
    );
  }

  if (result.changedFiles.length > 0) {
    lines.push("", "### Changed Files", "");
    for (const file of result.changedFiles.slice(0, 40)) {
      lines.push(`- \`${file}\``);
    }
    if (result.changedFiles.length > 40) {
      lines.push(`- ... ${result.changedFiles.length - 40} more`);
    }
  }

  return lines.join("\n");
}

async function main() {
  if (!/^[0-9a-fA-F]{40}$/.test(targetSha)) {
    throw new Error(`TARGET_SHA must be a full commit SHA; got '${targetSha}'.`);
  }

  const current = await fetchCurrentGitSha();
  let compareBase = "";
  if (commitExists(current.gitSha)) {
    compareBase = current.gitSha;
  } else {
    compareBase = parentOf(targetSha);
  }

  if (!commitExists(compareBase)) {
    throw new Error(`Could not resolve compare base for target '${targetSha}'.`);
  }

  const diffOutput = git(["diff", "--name-only", `${compareBase}..${targetSha}`]);
  const changedFiles = diffOutput ? diffOutput.split("\n").filter(Boolean) : [];
  const classification = classifyFiles(changedFiles);
  const result = {
    schemaVersion: 1,
    targetSha,
    currentGitSha: current.gitSha,
    currentGitShaError: current.error,
    compareBase,
    changedFiles,
    ...classification,
  };

  setOutput("release_class", result.releaseClass);
  setOutput("has_schema_changes", result.schemaFiles.length > 0 ? "true" : "false");
  setOutput("has_db_runtime_changes", result.dbRuntimeFiles.length > 0 ? "true" : "false");
  setOutput("has_infra_changes", result.infraFiles.length > 0 ? "true" : "false");
  setOutput("db_backup_recommended", result.dbBackupRecommended ? "true" : "false");
  setOutput("current_git_sha", result.currentGitSha);
  setOutput("compare_base", result.compareBase);

  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "release-classification.json");
  const mdPath = path.join(outDir, "release-classification.md");
  const markdown = buildMarkdown(result);
  await writeFile(jsonPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(mdPath, `${markdown}\n`, "utf8");

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    appendFileSync(summaryPath, `${markdown}\n`, "utf8");
  }

  if (result.schemaFiles.length > 0) {
    console.log(
      "::warning title=Schema change detected::Alembic migration files changed. Confirm production backup and rollback boundaries.",
    );
  } else if (result.infraFiles.length > 0) {
    console.log("::notice title=Infra/deploy change detected::Review deploy and volume-sensitive changes.");
  } else {
    console.log("::notice title=App-only release::No Alembic migration changes detected.");
  }
  console.log(markdown);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
