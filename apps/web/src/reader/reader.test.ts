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
import { mountReader, clampSplitFraction } from "./reader.js";

describe("clampSplitFraction", () => {
  it("maps pointer x to a 20–80% fraction of the container", () => {
    expect(clampSplitFraction(50, 0, 100)).toBeCloseTo(0.5, 5);
    expect(clampSplitFraction(70, 0, 100)).toBeCloseTo(0.7, 5);
    expect(clampSplitFraction(5, 0, 100)).toBe(0.2); // clamped low
    expect(clampSplitFraction(95, 0, 100)).toBe(0.8); // clamped high
    expect(clampSplitFraction(120, 20, 100)).toBeCloseTo(0.8, 5); // offset by container left
    expect(clampSplitFraction(0, 0, 0)).toBe(0.5); // no layout → safe midpoint
  });
});

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
    // Default the fixture to "all" so plain mouseenter opens the card (these
    // tests exercise popup content/grading). The product default is "shift";
    // its gating is covered by its own test below.
    settings: { hoverMode: "all", ...settings },
  });
}

function wordSpan(root: HTMLElement, word: string): HTMLSpanElement {
  const span = root.querySelector<HTMLSpanElement>(`[data-word="${word}"]`);
  if (!span) throw new Error(`no span for "${word}"`);
  return span;
}

function key(_root: HTMLElement, k: string): void {
  // The reader listens on document (so grade keys work while hovering); dispatch
  // there so a detached test root still reaches the handler.
  document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
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

  it("renders zhuyin ruby above each char when phonetics is on", () => {
    const app = buildApp({ phonetics: true });
    const root = document.createElement("div");
    const view = mountReader(root, app);

    // "你好" has a prebaked reading ("nǐ hǎo") that aligns 1:1 with its chars,
    // so it renders as <ruby> with one <rt> per character.
    const span = wordSpan(root, "你好");
    expect(span.querySelector("ruby")).not.toBeNull();
    const rts = span.querySelectorAll("rt");
    expect(rts.length).toBe(2);
    expect(rts[0]?.textContent).toBe("nǐ");
    expect(rts[1]?.textContent).toBe("hǎo");
    // Base glyphs are preserved, in order, as the ruby's direct <span> children.
    const base = [...span.querySelectorAll("ruby > span")]
      .map((s) => s.textContent)
      .join("");
    expect(base).toBe("你好");
    // "世界" has no prebaked reading → falls back to plain text (no ruby).
    expect(wordSpan(root, "世界").querySelector("ruby")).toBeNull();
    expect(wordSpan(root, "世界").textContent).toBe("世界");

    view.unmount();
  });

  it("gates zhuyin to unknown words by default; phoneticsAllWords reveals every word", () => {
    // Default phonetics opts into the phonetic visual but NOT the all-words scope,
    // so CSS hides the ruby over known/l4/ignored words (status-class gated).
    const gated = buildApp({ phonetics: true });
    const root1 = document.createElement("div");
    const v1 = mountReader(root1, gated);
    const text1 = root1.querySelector<HTMLElement>(`.${CLS.readerText}`);
    expect(text1?.dataset.visual).toBe("phonetic");
    expect(text1?.dataset.ruby).toBeUndefined();
    // The ruby is still in the DOM (CSS, not JS, does the gating) so grading a
    // word live re-gates it without a re-render.
    expect(wordSpan(root1, "你好").querySelector("ruby")).not.toBeNull();
    v1.unmount();

    const all = buildApp({ phonetics: true, phoneticsAllWords: true });
    const root2 = document.createElement("div");
    const v2 = mountReader(root2, all);
    expect(root2.querySelector<HTMLElement>(`.${CLS.readerText}`)?.dataset.ruby).toBe("all");
    v2.unmount();
  });

  it("opens the word card on click even in shift hover mode", () => {
    // Product default is hoverMode "shift" — hover stays quiet without Shift. A
    // deliberate click must still open the card (the behavior users expect), so
    // you never need to discover the Shift modifier.
    const app = buildApp({ hoverMode: "shift" });
    const root = document.createElement("div");
    const view = mountReader(root, app);
    expect(root.querySelector(`.${CLS.popup}`)).toBeNull();
    wordSpan(root, "你好").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(root.querySelector(`.${CLS.popup}`)).not.toBeNull();
    view.unmount();
  });

  it("renders newline non-word tokens as visible <br> line breaks", () => {
    // Transcript-style content: word tokens separated by a pure "\n" cue break,
    // plus a token mixing text and a newline ("foo\nbar").
    const content: PreparedContent = {
      schema: "tsumugu/prepared-content@1",
      lang: "zh-Hant",
      tokens: [
        { text: "你好", isWord: true },
        { text: "\n", isWord: false },
        { text: "世界", isWord: true },
        { text: "foo\nbar", isWord: false },
      ],
      glossary: {},
    };
    const app = new AppState({
      pack: fakePack(),
      content,
      store: new WordStore(),
    });
    const root = document.createElement("div");
    const view = mountReader(root, app);

    const text = root.querySelector(`.${CLS.readerText}`);
    expect(text).not.toBeNull();
    // Pure "\n" token → one <br>; "foo\nbar" token → one more <br>: two total.
    const brs = text?.querySelectorAll("br") ?? [];
    expect(brs.length).toBe(2);
    // The mixed token keeps its surrounding text around the break.
    expect(text?.textContent).toContain("foo");
    expect(text?.textContent).toContain("bar");
    // Word tokens are unaffected — still interactive spans.
    expect(wordSpan(root, "你好").classList.contains(CLS.word)).toBe(true);
    expect(wordSpan(root, "世界").classList.contains(CLS.word)).toBe(true);

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

  it("shift mode (the default) keeps the card closed on plain hover, opens on shift-hover", () => {
    const app = buildApp({ hoverMode: "shift" });
    const root = document.createElement("div");
    const view = mountReader(root, app);
    const span = wordSpan(root, "你好");
    span.dispatchEvent(new MouseEvent("mouseenter")); // no shift → quiet
    expect(root.querySelector(`.${CLS.popup}`)).toBeNull();
    span.dispatchEvent(new MouseEvent("mouseenter", { shiftKey: true })); // shift → opens
    expect(root.querySelector(`.${CLS.popup}`)).not.toBeNull();
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
