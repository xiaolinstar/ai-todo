#!/usr/bin/env node
/**
 * WeChat mini program CI helper (miniprogram-ci).
 *
 * Prerequisites:
 * 1. project.private.config.json with real appid
 * 2. Upload key: save private.wxYOUR_APPID.key in apps/miniapp/ (gitignored)
 * 3. Optional: ci.env with WECHAT_CI_PRIVATE_KEY_PATH=./private.wxYOUR_APPID.key
 *
 * Usage (from apps/miniapp):
 *   pnpm preview [-- --page pages/reminders/reminders]
 *   pnpm upload [-- --desc "备注"]
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ci = require("miniprogram-ci");

const scriptDir = dirname(fileURLToPath(import.meta.url));
const miniappRoot = resolve(scriptDir, "..");
const privateConfigPath = resolve(miniappRoot, "project.private.config.json");
const previewDir = resolve(miniappRoot, ".preview");
const previewQrPath = resolve(previewDir, "preview.jpg");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readAppId() {
  if (process.env.WECHAT_CI_APPID) {
    return process.env.WECHAT_CI_APPID.trim();
  }
  if (!existsSync(privateConfigPath)) {
    fail("Missing appid. Create project.private.config.json or set WECHAT_CI_APPID.");
  }
  const appid = readJson(privateConfigPath).appid?.trim();
  if (!appid || appid === "touristid") {
    fail("Set a real appid in project.private.config.json (not touristid).");
  }
  return appid;
}

function readPrivateKeyPath() {
  const configured = process.env.WECHAT_CI_PRIVATE_KEY_PATH?.trim();
  if (configured) {
    const resolved = configured.startsWith("./")
      ? resolve(miniappRoot, configured.slice(2))
      : configured;
    if (!existsSync(resolved)) {
      fail(`Private key not found: ${resolved}`);
    }
    return resolved;
  }

  const candidates = readdirSync(miniappRoot)
    .filter((name) => /^private\.wx[a-f0-9]+\.key$/i.test(name))
    .map((name) => resolve(miniappRoot, name));
  if (candidates.length === 1) {
    return candidates[0];
  }
  if (candidates.length > 1) {
    fail(
      "Multiple private.wx*.key files in apps/miniapp — set WECHAT_CI_PRIVATE_KEY_PATH in ci.env"
    );
  }

  fail(
    [
      "Set WECHAT_CI_PRIVATE_KEY_PATH in ci.env, or place private.wxYOUR_APPID.key in apps/miniapp/.",
      "Download from 微信公众平台 → 开发管理 → 小程序代码上传 → 上传密钥",
      "Example: WECHAT_CI_PRIVATE_KEY_PATH=./private.wxYOUR_APPID.key"
    ].join("\n")
  );
}

function readVersion() {
  const versionFile = resolve(miniappRoot, "miniprogram/lib/version.ts");
  const match = readFileSync(versionFile, "utf8").match(/MINIAPP_VERSION\s*=\s*"([^"]+)"/);
  return match?.[1] ?? readJson(resolve(miniappRoot, "package.json")).version ?? "0.0.0";
}

function readFlag(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function fail(message) {
  console.error(`miniapp-ci: ${message}`);
  process.exit(1);
}

function createProject() {
  return new ci.Project({
    appid: readAppId(),
    type: "miniProgram",
    projectPath: miniappRoot,
    privateKeyPath: readPrivateKeyPath(),
    ignores: ["node_modules/**/*", ".preview/**/*"]
  });
}

function baseOptions(project) {
  const robot = Number.parseInt(process.env.WECHAT_CI_ROBOT ?? "1", 10);
  const pagePath = readFlag("--page");
  const searchQuery = readFlag("--query");
  const desc =
    readFlag("--desc") ??
    process.env.WECHAT_CI_DESC ??
    `ai-todo ${readVersion()} local ci`;

  const options = {
    project,
    desc,
    setting: {
      useProjectConfig: true
    },
    robot: Number.isFinite(robot) ? robot : 1,
    onProgressUpdate: (event) => {
      if (event?.message) {
        console.log(event.message);
      }
    }
  };

  if (pagePath) {
    options.pagePath = pagePath;
  }
  if (searchQuery) {
    options.searchQuery = searchQuery;
  }

  return options;
}

async function runPreview() {
  mkdirSync(previewDir, { recursive: true });
  const project = createProject();
  const result = await ci.preview({
    ...baseOptions(project),
    qrcodeFormat: "image",
    qrcodeOutputDest: previewQrPath
  });
  console.log(`Preview QR saved: ${previewQrPath}`);
  if (result?.subPackageInfo) {
    console.log("Subpackages:", JSON.stringify(result.subPackageInfo));
  }
}

async function runUpload() {
  const project = createProject();
  const version = readVersion();
  const result = await ci.upload({
    ...baseOptions(project),
    version
  });
  console.log(`Uploaded version ${version}`);
  if (result?.subPackageInfo) {
    console.log("Subpackages:", JSON.stringify(result.subPackageInfo));
  }
}

async function main() {
  const command = process.argv[2];
  if (command === "preview") {
    await runPreview();
    return;
  }
  if (command === "upload") {
    await runUpload();
    return;
  }
  fail("Usage: node scripts/miniapp-ci.mjs <preview|upload> [-- --page PATH] [-- --desc TEXT]");
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
