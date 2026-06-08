#!/usr/bin/env node
/**
 * Resolve CD input to a verified CI run id.
 *
 * Normal flow: release tag -> commit SHA -> latest successful CI push run.
 * Rollback flow: explicit ci_run_id bypasses tag lookup.
 */
import { appendFileSync } from "node:fs";

const tagPattern = /^v[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$/;
const inputRunId = process.env.INPUT_RUN_ID?.trim() || "";
const inputReleaseTag = process.env.INPUT_RELEASE_TAG?.trim() || "";
const repo = process.env.GITHUB_REPOSITORY || process.env.REPOSITORY || "";
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";

function setOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    appendFileSync(outputPath, `${name}=${value ?? ""}\n`, "utf8");
  } else {
    console.log(`${name}=${value ?? ""}`);
  }
}

async function githubGet(path) {
  if (!repo || !token) {
    throw new Error("GITHUB_REPOSITORY and GH_TOKEN are required.");
  }
  const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status} for ${path}: ${body}`);
  }

  return response.json();
}

async function resolveTagCommit(tag) {
  const ref = await githubGet(`/git/ref/tags/${encodeURIComponent(tag)}`);
  let object = ref.object || {};

  if (object.type === "tag") {
    const tagObject = await githubGet(`/git/tags/${object.sha}`);
    object = tagObject.object || {};
  }

  if (object.type !== "commit" || !object.sha) {
    throw new Error(`release_tag '${tag}' does not point to a commit.`);
  }

  return object.sha;
}

async function resolveSuccessfulCiRun(targetSha) {
  const query = new URLSearchParams({
    event: "push",
    status: "completed",
    head_sha: targetSha,
    per_page: "20",
  });
  const payload = await githubGet(`/actions/workflows/ci.yml/runs?${query}`);
  const run = (payload.workflow_runs || []).find(
    (item) => item.head_sha === targetSha && item.conclusion === "success",
  );

  if (!run?.id) {
    throw new Error(
      "No successful CI push run found for the release tag commit. " +
        "Make sure the tag points to a commit already pushed to main with green CI, " +
        "or provide ci_run_id explicitly for rollback.",
    );
  }

  return String(run.id);
}

async function main() {
  if (inputRunId) {
    if (!/^[0-9]+$/.test(inputRunId)) {
      throw new Error(`ci_run_id must be numeric; got '${inputRunId}'.`);
    }
    setOutput("run_id", inputRunId);
    setOutput("target_sha", "");
    setOutput("release_tag", inputReleaseTag);
    console.log(`Using explicit CI run id: ${inputRunId}`);
    return;
  }

  if (!inputReleaseTag) {
    throw new Error(
      "release_tag is required for normal CD. Use a version tag such as v0.5.7, " +
        "or provide ci_run_id for rollback.",
    );
  }
  if (!tagPattern.test(inputReleaseTag)) {
    throw new Error(`release_tag must look like v0.5.7; got '${inputReleaseTag}'.`);
  }

  const targetSha = await resolveTagCommit(inputReleaseTag);
  if (!/^[0-9a-fA-F]{40}$/.test(targetSha)) {
    throw new Error(`Resolved tag target must be a full commit SHA; got '${targetSha}'.`);
  }

  console.log(`Resolved release tag ${inputReleaseTag} -> ${targetSha}`);
  const runId = await resolveSuccessfulCiRun(targetSha);
  console.log(`Resolved CI run id: ${runId}`);

  setOutput("run_id", runId);
  setOutput("target_sha", targetSha);
  setOutput("release_tag", inputReleaseTag);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
