#!/usr/bin/env node
/**
 * Export verified deploy-manifest fields to GitHub step outputs.
 */
import { appendFileSync, readFileSync } from "node:fs";

function setOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    appendFileSync(outputPath, `${name}=${value ?? ""}\n`, "utf8");
  } else {
    console.log(`${name}=${value ?? ""}`);
  }
}

const manifestPath = process.argv[2] ?? "manifest/deploy-manifest.json";
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const targetSha = process.env.TARGET_SHA?.trim() || "";
const gitSha = manifest.gitSha || "";

if (targetSha && gitSha !== targetSha) {
  console.error(`Manifest gitSha '${gitSha}' does not match requested target_sha '${targetSha}'.`);
  process.exit(1);
}

const apiImage = manifest.artifacts?.api?.image || "";
const fingerprint = manifest.fingerprint || "";

if (!gitSha || !apiImage || !fingerprint) {
  console.error("Manifest is missing gitSha, artifacts.api.image, or fingerprint.");
  process.exit(1);
}

setOutput("git_sha", gitSha);
setOutput("api_image", apiImage);
setOutput("fingerprint", fingerprint);
