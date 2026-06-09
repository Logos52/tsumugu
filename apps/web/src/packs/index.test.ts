import { describe, it, expect } from "vitest";

import type { VaultIO } from "@tsumugu/engine";
import { packForLang } from "./index.js";

class StubVault implements VaultIO {
  constructor(private readonly files: Record<string, string>) {}
  async readText(path: string): Promise<string | null> {
    return this.files[path] ?? null;
  }
  async writeText(): Promise<void> {}
  async readBytes(): Promise<Uint8Array | null> {
    return null;
  }
  async writeBytes(): Promise<void> {}
}

describe("packForLang vault-backed CC-CEDICT", () => {
  it("maps g[] into definitions.en.senses without collapsing", async () => {
    const vault = new StubVault({
      "tsumugu/packs/zh-Hant/dict.json": JSON.stringify({
        熱鬧: {
          py: "re4 nao5",
          g: ["bustling with noise and excitement", "lively"],
          s: "热闹",
        },
      }),
    });
    const pack = packForLang("zh-Hant", { vault });
    expect(pack).not.toBeNull();

    const entry = await pack!.dictionaryProvider("熱鬧");
    expect(entry?.definitions?.en?.gloss).toBe("bustling with noise and excitement");
    expect(entry?.definitions?.en?.senses).toEqual([
      { gloss: "bustling with noise and excitement" },
      { gloss: "lively" },
    ]);
    expect(entry?.gloss).toBe("bustling with noise and excitement; lively");
  });
});