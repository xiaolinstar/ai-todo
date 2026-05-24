#!/usr/bin/env node
/**
 * Build deploy-manifest.json and sha256 fingerprint for CD verification.
 *
 * Env:
 *   GITHUB_REPOSITORY, GITHUB_SHA, GITHUB_REF, GITHUB_RUN_ID
 *   API_IMAGE, API_IMAGE_DIGEST (required on main publish)
 *   MINIAPP_ARTIFACT_SHA (optional, hash of miniapp-dist tarball)
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

function fingerprintOf(payload) {
  const hash = createHash("sha256").update(stableStringify(payload)).digest("hex");
  return `sha256:${hash}`;
}

const apiImage = process.env.API_IMAGE?.trim() || "";
const apiDigest = process.env.API_IMAGE_DIGEST?.trim() || "";

if (!apiImage || !apiDigest) {
  console.error("API_IMAGE and API_IMAGE_DIGEST are required to publish a deploy manifest.");
  process.exit(1);
}

const body = {
  schemaVersion: 1,
  repository: process.env.GITHUB_REPOSITORY ?? "",
  gitSha: process.env.GITHUB_SHA ?? "",
  gitRef: process.env.GITHUB_REF ?? "",
  runId: process.env.GITHUB_RUN_ID ?? "",
  builtAt: new Date().toISOString(),
  artifacts: {
    api: {
      image: apiImage,
      digest: apiDigest
    },
    miniapp: {
      artifactName: "miniapp-dist",
      contentSha256: process.env.MINIAPP_ARTIFACT_SHA?.trim() || null
    }
  }
};

const fingerprint = fingerprintOf(body);
const manifest = { ...body, fingerprint };

writeFileSync("deploy-manifest.json", `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`deploy-manifest fingerprint=${fingerprint}`);
