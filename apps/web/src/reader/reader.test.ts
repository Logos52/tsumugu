// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";

import {
  WordStore,
  type LanguagePack,
  type PreparedContent,
  type DictEntry,
} from "@tsumugu/engine";

import { AppState, type AppSettings } from "../state.js";
import { CLS } from "../ui/classes.js";
import { mountReader } from "./reader.js";

// ── fixtures ─────────────────────────────────────────────────────────────────

/** A minimal zh-Hant pack: segmenter unused (content is pre-tokenized). */
function fakePack(): LanguagePack {
  return {
    id: "zh-Hant",
    name: "Chinese (Traditional)",
    segmenter: () => [],
    dictionaryProvider: (word): DictEntry => ({
      term: word,
      gloss: `dict gloss for ${word}`,
      reading: "dict-reading",
    }),
    phoneticLayer: {
      id: "zhuyin",
      reading: () => "ㄋㄧˇ ㄏㄠˇ",
      toneClasses: () => undefined,
    },
    levelingModel: () => undefined,
  };
}

/** Two word tokens + punctuation; "你好" carries a prebaked glossary entry. */
function fixtureContent(): PreparedContent {
  return {
    schema: "tsumugu/prepared-content@1",
    lang: "zh-Hant",
    tokens: [
      { text: "你好", isWord: true },
      { text: "，", isWord: false },
      { text: "世界", isWord: true },
      { text: "。", isWord: false },
    ],
    glossary: {
      你好: {
        term: "你好",
        gloss: "hello",
        reading: "nǐ hǎo",
        explanation: "A common greeting.",
      },
    },
  };
}

function buildApp(settings?: Partial<AppSettings>): AppState {
  return new AppState({
    pack: fakePack(),
    content: fixtureContent(),
    store: new WordStore(),
    settings,
  });
}

function wordSpan(root: HTMLElement, word: string): HTMLSpanElement {
  const span = root.querySelector<HTMLSpanElement>(`[data-word="${word}"]`);
  if (!span) throw new Error(`no span for "${word}"`);
  return span;
}

function key(root: HTMLElement, k: string): void {
  root.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
}

// ── tests ────────────────────────────────────────────────────────────────────

describe("mountReader", () => {
  it("renders word spans with the 'new' status color class", () => {
    const app = buildApp();
    const root = document.createElement("div");
    const view = mountReader(root, app);

    const span = wordSpan(root, "你好");
    expect(span.classList.contains(CLS.word)).toBe(true);
    expect(span.classList.contains("tsg-status-new")).toBe(true);
    // Punctuation renders as CLS.punct.
    expect(root.querySelector(`.${CLS.punct}`)?.textContent).toBe("，");

    view.unmount();
  });

  it("renders an empty-state hint when content is null", () => {
    const app = new AppState({ pack: fakePack(), content: null, store: new WordStore() });
    const root = document.createElement("div");
    const view = mountReader(root, app);

    expect(root.querySelector(`.${CLS.reader}`)).not.toBeNull();
    expect(root.querySelector(`.${CLS.word}`)).toBeNull();
    expect(root.textContent).toMatch(/No content/i);

    view.unmount();
  });

  it("grades the active word via a digit keydown and recolors in place", () => {
    const app = buildApp();
    const root = document.createElement("div");
    const view = mountReader(root, app);

    // Default active word is the first ("你好"). Press "3" → l3.
    key(root, "3");
    expect(app.getStatus("你好")).toBe("l3");
    expect(wordSpan(root, "你好").classList.contains("tsg-status-l3")).toBe(true);
    expect(wordSpan(root, "你好").classList.contains("tsg-status-new")).toBe(false);

    view.unmount();
  });

  it("'f' flags the active word and reflects CLS.flagged", () => {
    const app = buildApp();
    const root = document.createElement("div");
    const view = mountReader(root, app);

    key(root, "f");
    expect(app.getEntry("你好")?.flagged).toBe(true);
    expect(wordSpan(root, "你好").classList.contains(CLS.flagged)).toBe(true);

    // Toggle back off.
    key(root, "f");
    expect(app.getEntry("你好")?.flagged).toBeFalsy();
    expect(wordSpan(root, "你好").classList.contains(CLS.flagged)).toBe(false);

    view.unmount();
  });

  it("'n' moves active to the next unknown word", () => {
    const app = buildApp();
    // Mark the first word known so "n" must skip past it.
    app.gradeWord("你好", "known");

    const root = document.createElement("div");
    const view = mountReader(root, app);

    key(root, "n");
    // "世界" is still "new" (unknown) → it becomes active.
    expect(wordSpan(root, "世界").classList.contains(CLS.active)).toBe(true);
    expect(wordSpan(root, "你好").classList.contains(CLS.active)).toBe(false);

    view.unmount();
  });

  it("shows the prebaked gloss on mouseenter (reveal not required without guessFirst)", async () => {
    const app = buildApp({ guessFirst: false });
    const root = document.createElement("div");
    const view = mountReader(root, app);

    wordSpan(root, "你好").dispatchEvent(new MouseEvent("mouseenter"));
    await Promise.resolve();

    const popup = root.querySelector(`.${CLS.popup}`);
    expect(popup).not.toBeNull();
    expect(popup?.querySelector(`.${CLS.popupTerm}`)?.textContent).toContain("你好");
    expect(popup?.querySelector(`.${CLS.popupGloss}`)?.textContent).toBe("hello");
    expect(popup?.querySelector(`.${CLS.popupReading}`)?.textContent).toBe("nǐ hǎo");

    view.unmount();
  });

  it("guess-first hides the gloss until Reveal is pressed", async () => {
    const app = buildApp({ guessFirst: true });
    const root = document.createElement("div");
    const view = mountReader(root, app);

    wordSpan(root, "你好").dispatchEvent(new MouseEvent("mouseenter"));
    await Promise.resolve();

    const popup = root.querySelector<HTMLElement>(`.${CLS.popup}`);
    expect(popup).not.toBeNull();
    // Gloss exists but its wrapper is concealed.
    const hidden = popup?.querySelector(`.${CLS.popupHidden}`);
    expect(hidden).not.toBeNull();
    expect(hidden?.querySelector(`.${CLS.popupGloss}`)?.textContent).toBe("hello");
    // Reading stays visible regardless.
    expect(popup?.querySelector(`.${CLS.popupReading}`)).not.toBeNull();

    // Click Reveal → wrapper un-hides.
    const reveal = [...(popup?.querySelectorAll("button") ?? [])].find(
      (b) => b.textContent === "Reveal",
    );
    expect(reveal).toBeTruthy();
    reveal?.click();
    expect(popup?.querySelector(`.${CLS.popupHidden}`)).toBeNull();

    view.unmount();
  });

  it("clicking a grade button grades the word and closes the popup", async () => {
    const app = buildApp({ guessFirst: false });
    const root = document.createElement("div");
    const view = mountReader(root, app);

    wordSpan(root, "世界").dispatchEvent(new MouseEvent("mouseenter"));
    await Promise.resolve();

    const popup = root.querySelector<HTMLElement>(`.${CLS.popup}`);
    const grade1 = [...(popup?.querySelectorAll(`.${CLS.popupGrades} button`) ?? [])].find(
      (b) => b.textContent === "1",
    ) as HTMLButtonElement | undefined;
    expect(grade1).toBeTruthy();
    grade1?.click();

    expect(app.getStatus("世界")).toBe("l1");
    expect(root.querySelector(`.${CLS.popup}`)).toBeNull();

    view.unmount();
  });

  it("the audio button calls app.speak", async () => {
    const app = buildApp({ guessFirst: false });
    const speak = vi.spyOn(app, "speak");
    const root = document.createElement("div");
    const view = mountReader(root, app);

    wordSpan(root, "你好").dispatchEvent(new MouseEvent("mouseenter"));
    await Promise.resolve();

    const audioBtn = root.querySelector<HTMLButtonElement>(`.${CLS.popupTerm} button`);
    audioBtn?.click();
    expect(speak).toHaveBeenCalledWith("你好");

    view.unmount();
  });

  it("Escape closes an open popup", async () => {
    const app = buildApp({ guessFirst: false });
    const root = document.createElement("div");
    const view = mountReader(root, app);

    wordSpan(root, "你好").dispatchEvent(new MouseEvent("mouseenter"));
    await Promise.resolve();
    expect(root.querySelector(`.${CLS.popup}`)).not.toBeNull();

    key(root, "Escape");
    expect(root.querySelector(`.${CLS.popup}`)).toBeNull();

    view.unmount();
  });

  it("unmount detaches the keydown handler (later keys do nothing)", () => {
    const app = buildApp();
    const root = document.createElement("div");
    const view = mountReader(root, app);
    view.unmount();

    // root is cleared and the listener removed; grading must not happen.
    key(root, "3");
    expect(app.getStatus("你好")).toBe("new");
    expect(root.children.length).toBe(0);
  });
});
