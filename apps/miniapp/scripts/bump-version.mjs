#!/usr/bin/env node
/**
 * Bump @ai-todo/miniapp version and keep all sources in sync.
 *
 * Usage:
 *   node scripts/bump-version.mjs patch     # 0.8.3 -> 0.8.4
 *   node scripts/bump-version.mjs minor     # 0.8.3 -> 0.9.0
 *   node scripts/bump-version.mjs major     # 0.8.3 -> 1.0.0
 *   node scripts/bump-version.mjs 0.9.0     # explicit
 *
 * Side effects:
 *   - apps/miniapp/package.json (version)
 *   - apps/miniapp/miniprogram/lib/version.ts (MINIAPP_VERSION)
 *   - apps/miniapp/project.config.json (versionName)
 *
 * Dry-run by default; pass --write to actually mutate files.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const miniappRoot = resolve(scriptDir, '..');
const packageJsonPath = resolve(miniappRoot, 'package.json');
const versionTsPath = resolve(miniappRoot, 'miniprogram/lib/version.ts');
const projectConfigPath = resolve(miniappRoot, 'project.config.json');

const args = process.argv.slice(2);
const write = args.includes('--write');
const bumpArg = args.find((a) => !a.startsWith('--'));
if (!bumpArg) {
  console.error('Usage: node scripts/bump-version.mjs <patch|minor|major|x.y.z> [--write]');
  process.exit(2);
}

function parseVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (!m) throw new Error(`Invalid semver: ${v}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function nextVersion(current, bump) {
  const [major, minor, patch] = parseVersion(current);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  if (bump === 'patch') return `${major}.${minor}.${patch + 1}`;
  // explicit
  if (/^\d+\.\d+\.\d+$/.test(bump)) return bump;
  throw new Error(`Unknown bump: ${bump}`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function bumpPkgVersion(pkg, newVersion) {
  const updated = { ...pkg, version: newVersion };
  return JSON.stringify(updated, null, 2) + '\n';
}

function bumpVersionTs(content, newVersion) {
  // Replace the literal in `export const MINIAPP_VERSION = "..."` or `'...'`.
  return content.replace(
    /export const MINIAPP_VERSION = (["'])([^"']+)\1;/,
    (_match, quote) => `export const MINIAPP_VERSION = ${quote}${newVersion}${quote};`,
  );
}

function bumpProjectConfigVersionName(projectConfig, newVersion) {
  return { ...projectConfig, versionName: newVersion };
}

function main() {
  const pkg = readJson(packageJsonPath);
  const current = pkg.version;
  const next = nextVersion(current, bumpArg);

  if (current === next) {
    console.error(`Version already ${current}; nothing to do.`);
    process.exit(1);
  }

  const versionTs = readFileSync(versionTsPath, 'utf8');
  const projectConfig = readJson(projectConfigPath);

  const newPkg = bumpPkgVersion(pkg, next);
  const newVersionTs = bumpVersionTs(versionTs, next);
  const newProjectConfig = bumpProjectConfigVersionName(projectConfig, next);

  console.log(`package.json:        ${current} -> ${next}`);
  console.log(`version.ts:          ${current} -> ${next}`);
  console.log(`project.config.json: versionName ${current} -> ${next}`);

  if (!write) {
    console.log('\n[DRY-RUN] Re-run with --write to apply.');
    return;
  }

  writeFileSync(packageJsonPath, newPkg, 'utf8');
  writeFileSync(versionTsPath, newVersionTs, 'utf8');
  writeFileSync(projectConfigPath, JSON.stringify(newProjectConfig, null, 2) + '\n', 'utf8');
  console.log('\n[OK] Files updated.');
}

main();
