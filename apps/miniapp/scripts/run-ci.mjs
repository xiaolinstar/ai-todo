#!/usr/bin/env node
/**
 * Launch miniapp-ci with Node flags required on Node.js 25+.
 * Usage: node scripts/run-ci.mjs <preview|upload> [args...]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const localStorageFile = resolve(tmpdir(), 'miniapp-ci.localstorage');
const localStorageFlag = `--localstorage-file=${localStorageFile}`;
const childArgs = process.argv.slice(2);

if (!existsSync(localStorageFile)) {
  writeFileSync(localStorageFile, '');
}

// miniprogram-ci forks worker processes; they must inherit the flag via NODE_OPTIONS.
const nodeOptions = process.env.NODE_OPTIONS
  ? `${process.env.NODE_OPTIONS} ${localStorageFlag}`
  : localStorageFlag;

const result = spawnSync(
  process.execPath,
  [localStorageFlag, resolve(scriptDir, 'miniapp-ci.mjs'), ...childArgs],
  { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: nodeOptions } },
);

process.exit(result.status ?? 1);
