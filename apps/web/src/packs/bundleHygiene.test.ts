import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Goal-check 10 (PRD §2): the public engine / apps/web host bundles zero
 * dictionary DATA — only algorithms. Licensed dict JSON/SQLite loads at runtime
 * via VaultIO.
 */
const WEB_SRC = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      if (name === "node_modules") continue;
      out.push(...walkTsFiles(path));
    } else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts")) {
      out.push(path);
    }
  }
  return out;
}

describe("apps/web bundle hygiene (no inlined dict data)", () => {
  it("does not statically import dict JSON or private pack data", () => {
    const forbiddenImport = [
      /from\s+["'][^"']*cedict\.json["']/,
      /from\s+["'][^"']*tocfl\.json["']/,
      /from\s+["'][^"']*freq\.json["']/,
      /from\s+["'][^"']*packs\/private/,
    ];
    const offenders: string[] = [];

    for (const file of walkTsFiles(WEB_SRC)) {
      const text = readFileSync(file, "utf8");
      if (/import\s+.*from\s+["'][^"']*\.json["']/.test(text)) {
        offenders.push(`${file}: static JSON import`);
      }
      if (/readFileSync\s*\([^)]*cedict|readFileSync\s*\([^)]*tocfl/.test(text)) {
        offenders.push(`${file}: sync dict file read`);
      }
      for (const pattern of forbiddenImport) {
        if (pattern.test(text)) {
          offenders.push(`${file}: matches ${pattern}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("loads dictionary data only through VaultIO paths", () => {
    const indexSrc = readFileSync(join(WEB_SRC, "packs/index.ts"), "utf8");
    expect(indexSrc).toContain("VaultIO");
    expect(indexSrc).not.toMatch(/readFileSync|import\s+.*cedict/);
  });
});