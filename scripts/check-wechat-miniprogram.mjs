import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const miniprogramRoot = resolve(root, "apps/miniapp/miniprogram");
const appJsonPath = resolve(miniprogramRoot, "app.json");

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

const appTs = resolve(miniprogramRoot, "app.ts");
const appJs = resolve(miniprogramRoot, "app.js");
const appScss = resolve(miniprogramRoot, "app.scss");
const appWxss = resolve(miniprogramRoot, "app.wxss");

for (const path of [appTs, appJs, appScss, appWxss]) {
  if (!existsSync(path)) fail(`missing ${relative(root, path)}`);
}

if (!existsSync(appJsonPath)) {
  fail(`missing ${relative(root, appJsonPath)}`);
} else {
  const appJson = readJson(appJsonPath);
  for (const page of appJson.pages ?? []) {
    const pageBase = resolve(miniprogramRoot, page);
    for (const ext of [".ts", ".js", ".wxml", ".scss", ".wxss", ".json"]) {
      const path = `${pageBase}${ext}`;
      if (!existsSync(path)) fail(`app.json page is missing ${relative(root, path)}`);
    }
  }
}

for (const file of walk(miniprogramRoot)) {
  if (extname(file) !== ".json") continue;
  try {
    readJson(file);
  } catch (error) {
    fail(`invalid JSON in ${relative(root, file)}: ${error.message}`);
  }
}

for (const file of walk(miniprogramRoot)) {
  if (extname(file) !== ".ts") continue;
  const source = readFileSync(file, "utf8");
  const result = ts.transpileModule(source, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: true
    }
  });

  const errors = (result.diagnostics ?? []).filter(
    (item) => item.category === ts.DiagnosticCategory.Error
  );
  if (errors.length <= 0) continue;

  fail(`TypeScript syntax errors in ${relative(root, file)}:`);
  for (const error of errors) {
    fail(`  - ${ts.flattenDiagnosticMessageText(error.messageText, " ")}`);
  }
}

const customTabBarBase = resolve(miniprogramRoot, "custom-tab-bar/index");
for (const ext of [".ts", ".js", ".wxml", ".scss", ".wxss", ".json"]) {
  const path = `${customTabBarBase}${ext}`;
  if (!existsSync(path)) {
    fail(`custom tab bar is missing ${relative(root, path)}`);
  }
}

if (!process.exitCode) {
  console.log("ai-todo wechat miniprogram static checks passed");
}
