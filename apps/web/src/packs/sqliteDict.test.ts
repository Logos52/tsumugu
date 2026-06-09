import { describe, it, expect, beforeAll } from "vitest";
import initSqlJs from "sql.js";
import type { SqlJsStatic } from "sql.js";

import type { VaultIO } from "@tsumugu/engine";

import {
  buildSqliteAsset,
  buildBilingualRows,
  buildMonolingualRows,
  type CedictData,
  type MonoDictData,
} from "../../../../scripts/gen/lib/dictPackaging.js";
import { createBandShardedDict, DICT_ASSET_PATHS } from "./sqliteDict.js";

let SQL: SqlJsStatic;

beforeAll(async () => {
  SQL = await initSqlJs();
});

class MemoryVault implements VaultIO {
  constructor(
    private readonly textFiles: Record<string, string> = {},
    private readonly byteFiles: Record<string, Uint8Array> = {},
  ) {}

  async readText(path: string): Promise<string | null> {
    return this.textFiles[path] ?? null;
  }
  async writeText(): Promise<void> {}
  async readBytes(path: string): Promise<Uint8Array | null> {
    return this.byteFiles[path] ?? null;
  }
  async writeBytes(): Promise<void> {}
}

const LANG = "zh-Hant";
const CEDICT: CedictData = {
  熱鬧: { py: "re4 nao5", g: ["bustling", "lively"], s: "热闹" },
  罕見: { py: "han3 jian4", g: ["rare"], s: "罕见" },
};
const TOCFL = { 熱鬧: { level: "TOCFL-2" } };
const FREQ = { 罕見: 80000 };

describe("createBandShardedDict", () => {
  it("reads bilingual + mono sqlite when present", async () => {
    const bilingualBytes = buildSqliteAsset(
      SQL,
      buildBilingualRows(CEDICT, TOCFL, FREQ),
    );
    const mono: MonoDictData = {
      熱鬧: { gloss: "人多又吵的樣子。", level: "TOCFL-2" },
    };
    const monoBytes = buildSqliteAsset(SQL, buildMonolingualRows(mono));

    const vault = new MemoryVault(
      {},
      {
        [DICT_ASSET_PATHS.bilingualSqlite(LANG)]: bilingualBytes,
        [DICT_ASSET_PATHS.monoSqlite(LANG)]: monoBytes,
      },
    );

    const dict = createBandShardedDict({
      vault,
      lang: LANG,
      initSql: async () => SQL,
    });

    const entry = await dict.lookup("熱鬧");
    expect(entry?.definitions?.en?.gloss).toBe("bustling");
    expect(entry?.definitions?.zh?.gloss).toBe("人多又吵的樣子。");
    expect(entry?.level).toBe("TOCFL-2");
  });

  it("falls back to JSON core shard when sqlite absent", async () => {
    const vault = new MemoryVault({
      [DICT_ASSET_PATHS.coreShard(LANG)]: JSON.stringify({
        熱鬧: CEDICT["熱鬧"],
      }),
    });

    const dict = createBandShardedDict({ vault, lang: LANG, initSql: async () => SQL });
    const entry = await dict.lookup("熱鬧");
    expect(entry?.definitions?.en?.senses).toHaveLength(2);
  });

  it("lazy-loads higher-band shard on core miss", async () => {
    const vault = new MemoryVault({
      [DICT_ASSET_PATHS.coreShard(LANG)]: JSON.stringify({}),
      [DICT_ASSET_PATHS.bandShard(LANG, "tocfl-7")]: JSON.stringify({
        罕見: CEDICT["罕見"],
      }),
    });

    const dict = createBandShardedDict({ vault, lang: LANG, initSql: async () => SQL });
    const entry = await dict.lookup("罕見");
    expect(entry?.gloss).toContain("rare");
  });

  it("falls back to legacy dict.json when shards absent", async () => {
    const vault = new MemoryVault({
      [DICT_ASSET_PATHS.legacyDict(LANG)]: JSON.stringify({
        你好: { py: "ni3 hao3", g: ["hello"], s: "你好" },
      }),
    });

    const dict = createBandShardedDict({ vault, lang: LANG, initSql: async () => SQL });
    const entry = await dict.lookup("你好");
    expect(entry?.gloss).toBe("hello");
  });

  it("returns undefined when no assets are present", async () => {
    const dict = createBandShardedDict({
      vault: new MemoryVault(),
      lang: LANG,
      initSql: async () => SQL,
    });
    expect(await dict.lookup("不存在")).toBeUndefined();
  });
});