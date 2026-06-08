#!/usr/bin/env node
/**
 * Validate GitHub deploy secret presence from expression-provided booleans.
 */
import { appendFileSync } from "node:fs";

function present(name) {
  return process.env[name] === "true";
}

function setOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    appendFileSync(outputPath, `${name}=${value}\n`, "utf8");
  }
}

const environmentName = process.env.CD_ENVIRONMENT || "production";
const missing = [];
if (!present("DEPLOY_HOST_PRESENT")) missing.push("DEPLOY_HOST");
if (!present("DEPLOY_USER_PRESENT")) missing.push("DEPLOY_USER");

const hasKey = present("DEPLOY_SSH_KEY_PRESENT");
const hasPassword = present("DEPLOY_PASSWORD_PRESENT");
if (!hasKey && !hasPassword) {
  missing.push("DEPLOY_SSH_KEY or DEPLOY_PASSWORD");
}

if (missing.length > 0) {
  console.error(
    `::error::Missing GitHub secrets in environment '${environmentName}' (or repository): ${missing.join(", ")}`,
  );
  console.error("Configure them in GitHub Settings > Secrets and variables > Actions.");
  process.exit(1);
}

setOutput("configured", "true");
setOutput("auth", hasKey ? "ssh_key" : "password");
