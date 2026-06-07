import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const miniappRoot = resolve(scriptDir, "..");
const repoRoot = resolve(miniappRoot, "../..");
const miniprogramRoot = resolve(miniappRoot, "miniprogram");
const appJsonPath = resolve(miniprogramRoot, "app.json");

const PAGE_SOURCE_EXTS = [".ts", ".wxml", ".scss", ".json"];
const MAX_MEDIA_BYTES = 200 * 1024;
const MEDIA_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".mp3", ".wav", ".aac", ".m4a"]);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const path = resolve(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...walk(path));
    else if (stat.isFile()) files.push(path);
  }
  return files;
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function assertSourceBundle(basePath, label, extensions) {
  for (const ext of extensions) {
    const path = `${basePath}${ext}`;
    if (!existsSync(path)) {
      fail(`${label} is missing ${relative(repoRoot, path)}`);
    }
  }
}

function assertNoTrackedGeneratedFiles() {
  try {
    const tracked = execSync(
      'git ls-files "apps/miniapp/miniprogram/**/*.js" "apps/miniapp/miniprogram/**/*.wxss"',
      { cwd: repoRoot, encoding: "utf8" }
    ).trim();
    if (tracked) {
      fail(
        "Generated miniapp .js/.wxss must not be tracked in git (use DevTools plugins or git rm):\n" +
          tracked
      );
    }
  } catch {
    // git unavailable — skip
  }
}

function assertTabBarIcons(appJson) {
  const list = appJson.tabBar?.list ?? [];
  for (const item of list) {
    const label = item.pagePath || item.text || "tabBar item";
    if (!item.iconPath || !item.selectedIconPath) {
      fail(`tabBar list item "${label}" is missing iconPath/selectedIconPath`);
      continue;
    }
    for (const iconPath of [item.iconPath, item.selectedIconPath]) {
      const fullPath = resolve(miniprogramRoot, iconPath);
      if (!existsSync(fullPath)) {
        fail(`tabBar icon not found: ${relative(repoRoot, fullPath)}`);
      }
    }
  }
}

assertSourceBundle(resolve(miniprogramRoot, "app"), "app", [".ts", ".scss"]);
if (!existsSync(appJsonPath)) {
  fail(`missing ${relative(repoRoot, appJsonPath)}`);
}

if (!process.exitCode) {
  const appJson = readJson(appJsonPath);
  assertTabBarIcons(appJson);
  for (const page of appJson.pages ?? []) {
    assertSourceBundle(resolve(miniprogramRoot, page), `app.json page ${page}`, PAGE_SOURCE_EXTS);
  }
}

assertSourceBundle(
  resolve(miniprogramRoot, "custom-tab-bar/index"),
  "custom tab bar",
  PAGE_SOURCE_EXTS
);

for (const file of walk(miniprogramRoot)) {
  if (extname(file) !== ".json") continue;
  try {
    readJson(file);
  } catch (error) {
    fail(`invalid JSON in ${relative(repoRoot, file)}: ${error.message}`);
  }
}

for (const file of walk(miniprogramRoot)) {
  if (extname(file) !== ".ts") continue;
  const source = readFileSync(file, "utf8");
  const result = ts.transpileModule(source, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2015,
      module: ts.ModuleKind.CommonJS,
      strict: true
    }
  });

  const errors = (result.diagnostics ?? []).filter(
    (item) => item.category === ts.DiagnosticCategory.Error
  );
  if (errors.length <= 0) continue;

  fail(`TypeScript syntax errors in ${relative(repoRoot, file)}:`);
  for (const error of errors) {
    fail(`  - ${ts.flattenDiagnosticMessageText(error.messageText, " ")}`);
  }
}

function assertNoHardcodedVisualTokens() {
  const allowedScss = new Set([
    resolve(miniprogramRoot, "styles/todo-design-tokens.scss"),
    resolve(miniprogramRoot, "styles/tokens.scss")
  ]);
  const hexRe = /#[0-9a-fA-F]{3,8}\b/g;
  const fontFamilyRe = /font-family\s*:/i;
  for (const file of walk(miniprogramRoot)) {
    if (extname(file) !== ".scss") continue;
    if (allowedScss.has(file)) continue;
    const source = readFileSync(file, "utf8");
    const rel = relative(repoRoot, file);
    if (hexRe.test(source)) {
      fail(
        `hardcoded hex color in ${rel} — use var(--todo-*) from styles/todo-design-tokens.scss (see docs/miniapp-design-tokens.md)`
      );
    }
    if (fontFamilyRe.test(source)) {
      const hasLiteralStack = /font-family\s*:\s*(?!var\(--todo-font-family)/i.test(source);
      if (hasLiteralStack) {
        fail(
          `hardcoded font-family in ${rel} — use var(--todo-font-family-base) (see docs/miniapp-design-tokens.md)`
        );
      }
    }
  }

  const allowedTs = new Set([resolve(miniprogramRoot, "lib/design-tokens.ts")]);
  const tsHexRe = /"#[0-9A-Fa-f]{3,8}"/;
  for (const file of walk(miniprogramRoot)) {
    if (extname(file) !== ".ts") continue;
    if (allowedTs.has(file)) continue;
    const source = readFileSync(file, "utf8");
    if (tsHexRe.test(source)) {
      fail(
        `hardcoded color string in ${relative(repoRoot, file)} — import from lib/design-tokens.ts`
      );
    }
  }
}

assertNoTrackedGeneratedFiles();
assertNoHardcodedVisualTokens();

function assertMediaSizeLimit() {
  for (const file of walk(miniprogramRoot)) {
    const ext = extname(file).toLowerCase();
    if (!MEDIA_EXTS.has(ext)) continue;
    const size = statSync(file).size;
    if (size <= MAX_MEDIA_BYTES) continue;
    fail(
      `media asset exceeds WeChat 200KB limit (${Math.round(size / 1024)}KB): ${relative(repoRoot, file)} — ` +
        "compress, resize, or move unused masters outside miniprogram/"
    );
  }
}

assertMediaSizeLimit();

if (!process.exitCode) {
  console.log("ai-todo wechat miniprogram static checks passed");
}
