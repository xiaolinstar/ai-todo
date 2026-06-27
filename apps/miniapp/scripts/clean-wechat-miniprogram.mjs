import { existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const miniappRoot = resolve(scriptDir, '..');
const repoRoot = resolve(miniappRoot, '../..');
const miniprogramRoot = resolve(miniappRoot, 'miniprogram');

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

if (!existsSync(miniprogramRoot)) {
  console.error(`missing ${relative(repoRoot, miniprogramRoot)}`);
  process.exit(1);
}

let removed = 0;
for (const file of walk(miniprogramRoot)) {
  const ext = extname(file);
  if (ext !== '.js' && ext !== '.wxss') continue;
  unlinkSync(file);
  removed += 1;
  console.log(`removed ${relative(repoRoot, file)}`);
}

console.log(`wechat miniprogram clean ok (${removed} files)`);
