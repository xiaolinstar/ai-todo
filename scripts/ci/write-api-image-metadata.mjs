#!/usr/bin/env node
/**
 * Write API image metadata for PR build-only runs.
 */
import { writeFileSync } from "node:fs";

const metadata = {
  image: process.env.API_IMAGE_NAME ?? "",
  digest: process.env.API_IMAGE_DIGEST ?? "",
  push: process.env.IMAGE_PUSHED === "true",
};

if (!metadata.image || !metadata.digest) {
  console.error("API_IMAGE_NAME and API_IMAGE_DIGEST are required.");
  process.exit(1);
}

writeFileSync("api-image-metadata.json", `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
