import * as esbuild from "esbuild";
import { mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "dist/index.js",
  sourcemap: true,
  target: "node18",
  external: []
});
