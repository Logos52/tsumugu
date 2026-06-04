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
      clock: fixedClock(new Date("2026-06-04T00:00:00Z")),
    });
    const root = document.createElement("div");

    const view = mountReview(root, app);

    const term = root.querySelector(`.${CLS.cardTerm}`);
    expect(term?.textContent).toBe("你好");
    view.unmount();
    expect(root.children.length).toBe(0);
  });

  it("reveals the back (reading + gloss) on Reveal, then advances on Good", async () => {
    const word = "你好";
    const store = dueStore(word);
    const app = new AppState({
      pack: fakePack({ [word]: { term: word, gloss: "hello", reading: "ㄋㄧˇ ㄏㄠˇ" } }),
      store,
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
    await Promise.resolve(); // dictionaryProvider is awaited
    await Promise.resolve();

    expect(root.querySelector(`.${CLS.popupGloss}`)?.textContent).toBe("hello");
    expect(root.querySelector(`.${CLS.popupReading}`)?.textContent).toBe("ㄋㄧˇ ㄏㄠˇ");

    // Encoding anchor with the right dataset + href.
    const anchor = root.querySelector<HTMLAnchorElement>(`.${CLS.cardBack} a.${CLS.btn}`);
    expect(anchor?.dataset.encoding).toBe(word);
    expect(anchor?.getAttribute("href")).toBe(`#/encoding/${encodeURIComponent(word)}`);

    // Capture due before grading.
    const before = app.getEntry(word)?.srs?.due;
    expect(before).toBeTruthy();

    const goodBtn = [...root.querySelectorAll("button")].find(
      (b) => b.textContent === "Good",
    );
    expect(goodBtn).toBeTruthy();
    goodBtn!.click();

    // The stored due advanced into the future.
    const after = app.getEntry(word)?.srs?.due;
    expect(after).toBeTruthy();
    expect(new Date(after!).getTime()).toBeGreaterThan(new Date(before!).getTime());

    // Queue had one card → summary renders.
    expect(root.querySelector(`.${CLS.review}`)?.textContent).toContain("1 reviewed");
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
      clock: fixedClock(new Date("2026-06-04T00:00:00Z")),
    });
    const root = document.createElement("div");
    mountReview(root, app);

    [...root.querySelectorAll("button")]
      .find((b) => b.textContent === "Reveal")!
      .click();
    await Promise.resolve();

    expect(root.querySelector(`.${CLS.popupGloss}`)?.textContent).toBe("alone");
    expect(root.querySelector(`.${CLS.popupReading}`)?.textContent).toBe("ㄉㄨˊ ㄗˋ");
    expect(provider).not.toHaveBeenCalled();
  });

  it("renders the empty state with metrics when nothing is due", () => {
    const store = new WordStore();
    // A known word so metrics have something to show; not due (no SRS).
    store.upsert({ lang: "demo", word: "好", status: "known" });
    const app = new AppState({
      pack: fakePack(),
      store,
      clock: fixedClock(new Date("2026-06-04T00:00:00Z")),
    });
    const root = document.createElement("div");
    mountReview(root, app);

    const review = root.querySelector(`.${CLS.review}`);
    expect(review?.textContent).toContain("Nothing due");
    expect(root.querySelector(`.${CLS.metrics}`)?.textContent).toContain("known 1");
    expect(root.querySelector(`.${CLS.card}`)).toBeNull();
  });

  it("navigates to the encoding route when the card term is clicked", () => {
    const word = "你好";
    const store = dueStore(word);
    const app = new AppState({
      pack: fakePack(),
      store,
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
