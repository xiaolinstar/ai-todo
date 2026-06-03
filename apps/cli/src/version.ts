import { readFileSync } from "node:fs";
import { join } from "node:path";

const PACKAGE_JSON = join(__dirname, "..", "package.json");

export function getCliVersion(): string {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8")) as { version: string };
  return pkg.version;
}
