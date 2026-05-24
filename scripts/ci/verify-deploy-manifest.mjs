#!/usr/bin/env node
/** Verify deploy-manifest.json fingerprint (used in CD before deploy). */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

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

const path = process.argv[2] ?? "deploy-manifest.json";
const manifest = JSON.parse(readFileSync(path, "utf8"));
const { fingerprint, ...body } = manifest;

if (!fingerprint || typeof fingerprint !== "string") {
  console.error("manifest missing fingerprint");
  process.exit(1);
}

const expected = fingerprintOf(body);
if (fingerprint !== expected) {
  console.error(`fingerprint mismatch: got ${fingerprint}, expected ${expected}`);
  process.exit(1);
}

if (!body.gitSha || !body.artifacts?.api?.image || !body.artifacts?.api?.digest) {
  console.error("manifest missing required fields (gitSha, artifacts.api)");
  process.exit(1);
}

console.log(`manifest OK sha=${body.gitSha} image=${body.artifacts.api.image}`);
