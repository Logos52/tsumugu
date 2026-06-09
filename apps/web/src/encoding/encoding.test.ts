// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi } from "vitest";
import {
  WordStore,
  ensureSrs,
  reviewSrs,
  initSrsState,
  type LanguagePack,
  type PreparedContent,
  type Clock,
  type WordEntry,
} from "@tsumugu/engine";
import { AppState, resolveDictDefault } from "../state.js";
import { MemoryVault } from "../host/fsVault.js";
import { CLS } from "../ui/classes.js";
import { encodingArtifactPath, mountEncoding } from "./encoding.js";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../examples/encoding/熱鬧.encoding.json",
);
const RENAO_FIXTURE = readFileSync(fixturePath, "utf8");

const zhPack: LanguagePack = {
  id: "zh-Hant",
  name: "zh-Hant test",
  segmenter: (text) => [{ text, start: 0, end: text.length, isWord: true }],
  dictionaryProvider: () => undefined,
  phoneticLayer: { id: "none", reading: () => undefined },
  levelingModel: () => undefined,
};

const nightMarketContent: PreparedContent = {
  schema: "tsumugu/prepared-content@1",
  lang: "zh-Hant",
  tokens: [{ text: "熱鬧", isWord: true }],
  glossary: {
    熱鬧: {
      term: "熱鬧",
      gloss: "lively; bustling",
      reading: "ㄖㄜˋ ㄋㄠˋ / rè nào",
      explanation: "fallback explanation",
      examples: ["那裡很熱鬧。"],
    },
  },
};

function fixedClock(at: Date): Clock {
  return { now: () => at };
}

function appWithRenao(opts?: {
  guessFirst?: boolean;
  vault?: MemoryVault;
  srs?: WordEntry["srs"];
  withFixture?: boolean;
}): AppState {
  const vault = opts?.vault ?? new MemoryVault();
  if (opts?.withFixture !== false) {
    vault.writeText(encodingArtifactPath("zh-Hant", "熱鬧"), RENAO_FIXTURE);
  }

  const store = new WordStore();
  const entry: WordEntry = {
    lang: "zh-Hant",
    word: "熱鬧",
    status: "l2",
    flagNote: "confuses with 鬧鐘",
    related: [
      { lang: "zh-Hant", word: "夜市" },
      { lang: "zh-Hant", word: "安靜" },
      { lang: "zh-Hant", word: "鬧鐘" },
    ],
  };
  if (opts?.srs) entry.srs = opts.srs;
  else ensureSrs(entry, fixedClock(new Date("2020-01-01T00:00:00Z")));
  store.upsert(entry);

  // A second due word for the SRS rail queue.
  const other: WordEntry = { lang: "zh-Hant", word: "夜市", status: "l1" };
  ensureSrs(other, fixedClock(new Date("2020-01-01T00:00:00Z")));
  store.upsert(other);

  return new AppState({
    pack: zhPack,
    store,
    content: nightMarketContent,
    vault,
    clock: fixedClock(new Date("2026-06-09T12:00:00Z")),
    settings: opts?.guessFirst ? { guessFirst: true } : undefined,
  });
}

async function waitForPage(root: HTMLElement): Promise<void> {
  await vi.waitFor(() => {
    expect(root.querySelector(`.${CLS.encodingPage}`)?.childElementCount).toBeGreaterThan(2);
  });
}

describe("resolveDictDefault", () => {
  it("reads dictDefault directly", () => {
    expect(resolveDictDefault({ dictDefault: "zh" })).toBe("zh");
    expect(resolveDictDefault({ dictDefault: "en" })).toBe("en");
  });
});

describe("mountEncoding — 熱鬧 fixture", () => {
  it("emphasizes the headword in example sentences via highlightSpans", async () => {
    const root = document.createElement("div");
    mountEncoding(root, appWithRenao(), "熱鬧");
    await waitForPage(root);

    const cn = [...root.querySelectorAll(`.${CLS.sentCn}`)].map((el) => el.innerHTML);
    expect(cn.some((html) => html.includes("<em>熱鬧</em>"))).toBe(true);
  });

  it("renders defgrid, four sentence rows, grounding marker, and flag end-to-end", async () => {
    const root = document.createElement("div");
    mountEncoding(root, appWithRenao(), "熱鬧");
    await waitForPage(root);

    expect(root.querySelector(`.${CLS.defGrid}`)).not.toBeNull();
    expect(root.querySelectorAll(`.${CLS.sentRow}`).length).toBe(5);
    expect(root.querySelectorAll(`.${CLS.sentWave}`).length).toBe(5);
    expect(root.querySelector(".tsg-encoding-audio-sec")).not.toBeNull();
    expect(root.querySelector(`.${CLS.groundingMarker}`)?.textContent).toBe("memory device");
    expect(root.textContent).toContain("confuses with 鬧鐘");
    expect(root.textContent).toContain("lively · bustling · buzzing with activity");
    expect(root.textContent).toContain("人多、又吵又有活力");
    expect(root.textContent).toContain("heat + market-noise");
    expect(root.querySelector(`.${CLS.relatedLink}[href="#/encoding/%E5%AE%89%E9%9D%9C"]`)).not.toBeNull();
    expect(root.querySelector(`.${CLS.encodingRail}`)).not.toBeNull();
    expect(root.querySelector(`.${CLS.encodingPage}`)).not.toBeNull();
  });

  it("guessFirst hides definitions until reveal", async () => {
    const root = document.createElement("div");
    mountEncoding(root, appWithRenao({ guessFirst: true }), "熱鬧");
    await waitForPage(root);

    const grid = root.querySelector(`.${CLS.defGrid}`);
    expect(grid?.classList.contains(CLS.encodingHidden)).toBe(true);

    const reveal = [...root.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Reveal definitions"),
    );
    expect(reveal).not.toBeNull();
    reveal?.click();
    expect(grid?.classList.contains(CLS.encodingHidden)).toBe(false);
  });

  it("opening encoding does not change SRS state", async () => {
    const clock = fixedClock(new Date("2026-06-09T12:00:00Z"));
    const srs = initSrsState(clock);
    const reviewed = reviewSrs(srs, "good", clock);
    const app = appWithRenao({ srs: reviewed });
    app.clock = clock;

    const before = JSON.stringify(app.getEntry("熱鬧")?.srs);
    const root = document.createElement("div");
    mountEncoding(root, app, "熱鬧");
    await waitForPage(root);
    const after = JSON.stringify(app.getEntry("熱鬧")?.srs);

    expect(after).toBe(before);
  });

  it("falls back to mergeHover when no encoding artifact is present", async () => {
    const vault = new MemoryVault();
    const root = document.createElement("div");
    mountEncoding(root, appWithRenao({ vault, withFixture: false }), "熱鬧");
    await waitForPage(root);
    expect(root.textContent).toContain("fallback explanation");
  });

  it("writes dictDefault when the definition pill is toggled", async () => {
    const app = appWithRenao();
    const root = document.createElement("div");
    mountEncoding(root, app, "熱鬧");
    await waitForPage(root);

    expect(app.settings.dictDefault).toBe("zh");

    const english = [...root.querySelectorAll("button")].find((b) => b.textContent === "English");
    english?.click();
    expect(app.settings.dictDefault).toBe("en");

    const zh = [...root.querySelectorAll("button")].find((b) => b.textContent === "簡明中文");
    zh?.click();
    expect(app.settings.dictDefault).toBe("zh");
  });

  it("grades from the rail and persists SRS without auto-grading on open", async () => {
    const clock = fixedClock(new Date("2026-06-09T12:00:00Z"));
    const app = appWithRenao();
    app.clock = clock;
    const before = app.getEntry("熱鬧")?.srs?.reps ?? 0;

    const root = document.createElement("div");
    mountEncoding(root, app, "熱鬧");
    await waitForPage(root);
    expect(app.getEntry("熱鬧")?.srs?.reps).toBe(before);

    const good = [...root.querySelectorAll("button")].find((b) => b.textContent?.startsWith("Good"));
    good?.click();
    await vi.waitFor(() => {
      expect((app.getEntry("熱鬧")?.srs?.reps ?? 0)).toBeGreaterThan(before);
    });
  });
});