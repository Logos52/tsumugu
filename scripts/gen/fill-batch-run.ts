/**
 * One-shot batch dictionary fill runner — reads a prepared file + fill JSON,
 * applies, verifies with --fix. Used by the orchestrator after agent fill.
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const [prepared, fill, ...rest] = process.argv.slice(2);
if (!prepared || !fill) {
  console.error("usage: tsx scripts/gen/fill-batch-run.ts <prepared.json> <fill.json> [--store ws.json]");
  process.exit(1);
}

const pack = "--pack-module packs/private/index.ts";
const store = rest.includes("--store") ? `--store ${rest[rest.indexOf("--store") + 1]}` : "";

function run(args: string[]): number {
  const r = spawnSync("pnpm", ["gen", ...args], { cwd: root, stdio: "inherit", shell: false });
  return r.status ?? 1;
}

let code = run(["dict-fill", "--in", prepared, "--apply", fill]);
if (code !== 0) process.exit(code);

code = run([
  "verify",
  "--in",
  prepared,
  "--lang",
  "zh-Hant",
  pack,
  "--fix",
  ...(store ? store.split(" ") : []),
]);
process.exit(code);