import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as sass from "sass";
import ts from "typescript";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const miniprogramRoot = resolve(root, "apps/miniapp/miniprogram");

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

function transpileTs(file) {
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
  if (errors.length > 0) {
    console.error(`Failed to transpile ${relative(root, file)}`);
    for (const error of errors) {
      console.error(`  - ${ts.flattenDiagnosticMessageText(error.messageText, " ")}`);
    }
    process.exitCode = 1;
    return;
  }

  writeFileSync(file.replace(/\.ts$/, ".js"), result.outputText, "utf8");
}

function compileScss(file) {
  const result = sass.compile(file, { style: "expanded" });
  writeFileSync(file.replace(/\.scss$/, ".wxss"), result.css, "utf8");
}

if (!existsSync(miniprogramRoot)) {
  console.error(`missing ${relative(root, miniprogramRoot)}`);
  process.exit(1);
}

let tsCount = 0;
let scssCount = 0;

for (const file of walk(miniprogramRoot)) {
  if (extname(file) === ".ts") {
    transpileTs(file);
    if (process.exitCode) break;
    tsCount += 1;
  } else if (extname(file) === ".scss") {
    compileScss(file);
    scssCount += 1;
  }
}

if (!process.exitCode) {
  console.log(
    `wechat miniprogram build ok (${tsCount} ts→js, ${scssCount} scss→wxss)`
  );
}
