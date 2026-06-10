// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import {
  WordStore,
  ensureSrs,
  type LanguagePack,
  type Token,
  type DictEntry,
  type WordEntry,
  type Clock,
} from "@tsumugu/engine";
import { AppState } from "../state.js";
import { CLS } from "../ui/classes.js";
import { mountReview } from "./review.js";

/** Minimal inline pack: only the members the review view touches. */
function fakePack(dict: Record<string, DictEntry> = {}): LanguagePack {
  return {
    id: "demo",
    name: "Demo",
    segmenter(text: string): Token[] {
      return [{ text, start: 0, end: text.length, isWord: true }];
    },
    dictionaryProvider(word: string): DictEntry | undefined {
      return dict[word];
    },
    phoneticLayer: {
      id: "none",
      reading(): string | undefined {
        return undefined;
      },
    },
    levelingModel(): undefined {
      return undefined;
    },
  };
}

/** A clock fixed at a given moment. */
function fixedClock(at: Date): Clock {
  return { now: () => at };
}

/** A store with one word whose SRS is due in the past (so it's due now). */
function dueStore(word: string): WordStore {
  const store = new WordStore();
  const entry: WordEntry = { lang: "demo", word, status: "l1" };
  ensureSrs(entry, fixedClock(new Date("2020-01-01T00:00:00Z")));
  store.upsert(entry);
  return store;
}

describe("mountReview", () => {
  it("renders the card term for a due word", () => {
    const store = dueStore("你好");
    const app = new AppState({
      pack: fakePack(),
      store,
      settings: { studyLang: "demo" },
      clock: fixedClock(new Date("2026-06-04T00:00:00Z")),
    });
    const root = document.createElement("div");

    const view = mountReview(root, app);

    const term = root.querySelector(`.${CLS.cardTerm}`);
    expect(term?.textContent).toBe("你好");
    view.unmount();
    expect(root.children.length).toBe(0);
  });

  it("reveals the back (reading + gloss) on Reveal, then advances on Pass", async () => {
    const word = "你好";
    const store = dueStore(word);
    const app = new AppState({
      pack: fakePack({ [word]: { term: word, gloss: "hello", reading: "ㄋㄧˇ ㄏㄠˇ" } }),
      store,
      settings: { studyLang: "demo" },
      clock: fixedClock(new Date("2026-06-04T00:00:00Z")),
    });
    const root = document.createElement("div");
    mountReview(root, app);

    // Back is empty until Reveal.
    expect(root.querySelector(`.${CLS.popupGloss}`)).toBeNull();

    const revealBtn = [...root.querySelectorAll("button")].find(
      (b) => b.textContent === "Reveal",
    );
    expect(revealBtn).toBeTruthy();
    revealBtn!.click();
    await vi.waitFor(() => {
      expect(root.querySelector(`.${CLS.popupGloss}`)?.textContent).toBe("hello");
    });
    expect(root.querySelector(`.${CLS.popupReading}`)?.textContent).toBe("ㄋㄧˇ ㄏㄠˇ");

    // Encoding anchor with the right dataset + href.
    const anchor = root.querySelector<HTMLAnchorElement>(`.${CLS.cardBack} a.${CLS.btn}`);
    expect(anchor?.dataset.encoding).toBe(word);
    expect(anchor?.getAttribute("href")).toBe(`#/encoding/${encodeURIComponent(word)}`);

    // Capture due before grading.
    const before = app.getEntry(word)?.srs?.due;
    expect(before).toBeTruthy();

    const passBtn = [...root.querySelectorAll("button")].find(
      (b) => b.textContent === "Pass",
    );
    expect(passBtn).toBeTruthy();
    passBtn!.click();

    // The stored due advanced into the future.
    const after = app.getEntry(word)?.srs?.due;
    expect(after).toBeTruthy();
    expect(new Date(after!).getTime()).toBeGreaterThan(new Date(before!).getTime());

    // Queue had one card → summary renders (coverage line loads async).
    await vi.waitFor(() => {
      expect(root.querySelector(`.${CLS.review}`)?.textContent).toContain("1 reviewed");
    });
    await vi.waitFor(() => {
      expect(root.querySelector(`.${CLS.encodingCoverage}`)?.textContent).toMatch(
        /encoded \d+ · bare \d+ · stab encoded/,
      );
    });
  });

  it("uses the custom gloss/reading when present (no dictionary call)", async () => {
    const word = "獨自";
    const store = new WordStore();
    const entry: WordEntry = {
      lang: "demo",
      word,
      status: "l2",
      custom: { term: word, gloss: "alone", reading: "ㄉㄨˊ ㄗˋ" },
    };
    ensureSrs(entry, fixedClock(new Date("2020-01-01T00:00:00Z")));
    store.upsert(entry);

    const provider = vi.fn(() => undefined);
    const pack = fakePack();
    pack.dictionaryProvider = provider;

    const app = new AppState({
      pack,
      store,
      settings: { studyLang: "demo" },
      clock: fixedClock(new Date("2026-06-04T00:00:00Z")),
    });
    const root = document.createElement("div");
    mountReview(root, app);

    [...root.querySelectorAll("button")]
      .find((b) => b.textContent === "Reveal")!
      .click();
    await vi.waitFor(() => {
      expect(root.querySelector(`.${CLS.popupGloss}`)?.textContent).toBe("alone");
    });
    expect(root.querySelector(`.${CLS.popupReading}`)?.textContent).toBe("ㄉㄨˊ ㄗˋ");
    expect(provider).not.toHaveBeenCalled();
  });

  it("renders the empty state with metrics when nothing is due", async () => {
    const store = new WordStore();
    // A known word so metrics have something to show; not due (no SRS).
    store.upsert({ lang: "demo", word: "好", status: "known" });
    const app = new AppState({
      pack: fakePack(),
      store,
      settings: { studyLang: "demo" },
      clock: fixedClock(new Date("2026-06-04T00:00:00Z")),
    });
    const root = document.createElement("div");
    mountReview(root, app);

    expect(root.querySelector(`.${CLS.review}`)?.textContent).toContain(
      "No words at levels 1–4 yet",
    );
    expect(root.querySelector(`.${CLS.metrics}`)?.textContent).toContain("known 1");
    await vi.waitFor(() => {
      expect(root.querySelector(`.${CLS.encodingCoverage}`)?.textContent).toMatch(
        /encoded 0 · bare 0 · stab encoded — \/ bare —/,
      );
    });
    expect(root.querySelector(`.${CLS.card}`)).toBeNull();
  });

  it("reveals loopable waveform rows when an encoding artifact is present", async () => {
    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const { MemoryVault } = await import("../host/fsVault.js");
    const { encodingArtifactPath } = await import("../encoding/encoding.js");

    const fixturePath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../../examples/encoding/熱鬧.encoding.json",
    );
    const vault = new MemoryVault();
    vault.writeText(encodingArtifactPath("zh-Hant", "熱鬧"), readFileSync(fixturePath, "utf8"));

    const store = new WordStore();
    const entry: WordEntry = { lang: "zh-Hant", word: "熱鬧", status: "l1" };
    ensureSrs(entry, fixedClock(new Date("2020-01-01T00:00:00Z")));
    store.upsert(entry);

    const app = new AppState({
      pack: fakePack(),
      store,
      vault,
      settings: { studyLang: "zh-Hant" },
      clock: fixedClock(new Date("2026-06-04T00:00:00Z")),
    });
    const root = document.createElement("div");
    mountReview(root, app);

    [...root.querySelectorAll("button")].find((b) => b.textContent === "Reveal")!.click();
    await vi.waitFor(() => {
      expect(root.querySelectorAll(".tsg-sent-wave").length).toBeGreaterThan(0);
    });
    expect(root.textContent).toContain("lively");
  });

  it("includes zh-Hant level 1–4 words without prior SRS", () => {
    const store = new WordStore();
    store.upsert({ lang: "zh-Hant", word: "播客", status: "l1" });
    store.upsert({ lang: "zh-Hant", word: "桂林", status: "l2" });
    const app = new AppState({
      pack: fakePack(),
      store,
      settings: { studyLang: "zh-Hant" },
      clock: fixedClock(new Date("2026-06-04T00:00:00Z")),
    });
    const root = document.createElement("div");
    mountReview(root, app);
    expect(root.querySelector(`.${CLS.cardTerm}`)?.textContent).toBe("播客");
  });

  it("shows only Pass and Fail grading controls", () => {
    const store = dueStore("你好");
    const app = new AppState({
      pack: fakePack(),
      store,
      settings: { studyLang: "demo" },
      clock: fixedClock(new Date("2026-06-04T00:00:00Z")),
    });
    const root = document.createElement("div");
    mountReview(root, app);

    const labels = [...root.querySelectorAll(`.${CLS.cardControls} button`)].map(
      (b) => b.textContent,
    );
    expect(labels).toEqual(["Fail", "Pass"]);
    expect(labels).not.toContain("Again");
    expect(labels).not.toContain("Good");
  });

  it("toggles 簡明中文 and English definitions when both are present", async () => {
    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const { MemoryVault } = await import("../host/fsVault.js");
    const { encodingArtifactPath } = await import("../encoding/encoding.js");

    const fixturePath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../../examples/encoding/熱鬧.encoding.json",
    );
    const vault = new MemoryVault();
    vault.writeText(encodingArtifactPath("zh-Hant", "熱鬧"), readFileSync(fixturePath, "utf8"));

    const store = new WordStore();
    const entry: WordEntry = { lang: "zh-Hant", word: "熱鬧", status: "l1" };
    ensureSrs(entry, fixedClock(new Date("2020-01-01T00:00:00Z")));
    store.upsert(entry);

    const app = new AppState({
      pack: fakePack(),
      store,
      vault,
      settings: { studyLang: "zh-Hant", dictDefault: "zh" },
      clock: fixedClock(new Date("2026-06-04T00:00:00Z")),
    });
    const root = document.createElement("div");
    mountReview(root, app);

    [...root.querySelectorAll("button")].find((b) => b.textContent === "Reveal")!.click();
    await vi.waitFor(() => {
      expect(root.querySelector(`.${CLS.defToggle}`)).toBeTruthy();
    });

    const zhBtn = [...root.querySelectorAll(`.${CLS.defToggle} button`)].find(
      (b) => b.textContent === "簡明中文",
    );
    const enBtn = [...root.querySelectorAll(`.${CLS.defToggle} button`)].find(
      (b) => b.textContent === "English",
    );
    expect(zhBtn?.classList.contains(CLS.defSegOn)).toBe(true);
    expect(root.querySelector(`.${CLS.popupGloss}`)?.textContent).toContain("人多");

    enBtn!.click();
    expect(enBtn?.classList.contains(CLS.defSegOn)).toBe(true);
    expect(root.querySelector(`.${CLS.popupGloss}`)?.textContent).toContain("lively");
    expect(app.settings.dictDefault).toBe("en");

    zhBtn!.click();
    expect(zhBtn?.classList.contains(CLS.defSegOn)).toBe(true);
    expect(app.settings.dictDefault).toBe("zh");
  });

  it("navigates to the encoding route when the card term is clicked", () => {
    const word = "你好";
    const store = dueStore(word);
    const app = new AppState({
      pack: fakePack(),
      store,
      settings: { studyLang: "demo" },
      clock: fixedClock(new Date("2026-06-04T00:00:00Z")),
    });
    const emitSpy = vi.spyOn(app, "emit");
    const root = document.createElement("div");
    mountReview(root, app);

    const term = root.querySelector<HTMLElement>(`.${CLS.cardTerm}`);
    term!.click();

    expect(location.hash).toBe(`#/encoding/${encodeURIComponent(word)}`);
    expect(emitSpy).toHaveBeenCalledWith("change");
  });
});
