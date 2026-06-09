// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { WordStore, type LanguagePack, type PreparedContent } from "@tsumugu/engine";
import { AppState } from "../state.js";
import { CLS } from "../ui/classes.js";
import { mountReader } from "./reader.js";

function dualDefPack(): LanguagePack {
  return {
    id: "zh-Hant",
    name: "zh-Hant test",
    segmenter: () => [],
    dictionaryProvider: () => undefined,
    phoneticLayer: { id: "none", reading: () => undefined },
    levelingModel: () => undefined,
  };
}

function dualDefContent(): PreparedContent {
  return {
    schema: "tsumugu/prepared-content@2",
    lang: "zh-Hant",
    tokens: [{ text: "熱鬧", isWord: true }],
    glossary: {
      熱鬧: {
        term: "熱鬧",
        gloss: "lively; bustling",
        definitions: {
          en: {
            gloss: "lively; bustling",
            explanation: "Busy, crowded, and full of cheerful noise.",
          },
          zh: {
            gloss: "人多、又吵又有活力。",
            illustration: "像夜市、廟會那種氣氛。",
            level: "TOCFL-B1",
            monolingual: true,
          },
        },
      },
    },
  };
}

function buildApp(explanationLang: "en" | "zh" | "target" = "en"): AppState {
  return new AppState({
    pack: dualDefPack(),
    content: dualDefContent(),
    store: new WordStore(),
    settings: { hoverMode: "all", guessFirst: false, explanationLang },
  });
}

function openPopup(root: HTMLElement): HTMLElement {
  const span = root.querySelector<HTMLSpanElement>(`[data-word="熱鬧"]`);
  if (!span) throw new Error("missing word span");
  span.dispatchEvent(new MouseEvent("mouseenter"));
  const popup = root.querySelector<HTMLElement>(`.${CLS.popup}`);
  if (!popup) throw new Error("popup did not open");
  return popup;
}

describe("reader popup definition flip", () => {
  it("shows the default English card and flips to 簡明中文", async () => {
    const app = buildApp("en");
    const root = document.createElement("div");
    const view = mountReader(root, app);

    const popup = openPopup(root);
    await Promise.resolve();

    expect(popup.querySelectorAll(`.${CLS.defToggle} button`)).toHaveLength(2);
    expect(popup.querySelector(`.${CLS.popupGloss}`)?.textContent).toBe("lively; bustling");
    expect(popup.querySelector(`.${CLS.popupExplain}`)?.textContent).toContain("cheerful noise");

    const zhBtn = [...popup.querySelectorAll(`.${CLS.defToggle} button`)].find(
      (b) => b.textContent === "簡明中文",
    );
    zhBtn?.click();

    expect(popup.querySelector(`.${CLS.popupGloss}`)?.textContent).toBe("人多、又吵又有活力。");
    expect(popup.querySelector(`.${CLS.popupExplain}`)?.textContent).toContain("夜市");
    expect(zhBtn?.classList.contains(CLS.defSegOn)).toBe(true);

    view.unmount();
  });

  it("leads with 簡明中文 when that is the persisted default", async () => {
    const app = buildApp("zh");
    const root = document.createElement("div");
    const view = mountReader(root, app);

    const popup = openPopup(root);
    await Promise.resolve();

    expect(popup.querySelector(`.${CLS.popupGloss}`)?.textContent).toBe("人多、又吵又有活力。");
    expect(
      [...popup.querySelectorAll(`.${CLS.defToggle} button`)].find(
        (b) => b.textContent === "簡明中文",
      )?.classList.contains(CLS.defSegOn),
    ).toBe(true);

    view.unmount();
  });

  it("omits the flip control when only one definition is available", async () => {
    const app = buildApp("en");
    const content = dualDefContent();
    delete content.glossary["熱鬧"]!.definitions?.zh;
    app.content = content;

    const root = document.createElement("div");
    const view = mountReader(root, app);
    const popup = openPopup(root);
    await Promise.resolve();

    expect(popup.querySelector(`.${CLS.defToggle}`)).toBeNull();
    expect(popup.querySelector(`.${CLS.popupGloss}`)?.textContent).toBe("lively; bustling");

    view.unmount();
  });

  it("guess-first hides the visible definition until reveal", async () => {
    const app = buildApp("en");
    app.updateSettings({ guessFirst: true });
    const root = document.createElement("div");
    const view = mountReader(root, app);

    const popup = openPopup(root);
    await Promise.resolve();

    expect(popup.querySelector(`.${CLS.popupHidden}`)).not.toBeNull();
    const reveal = [...popup.querySelectorAll("button")].find((b) => b.textContent === "Reveal");
    reveal?.click();
    expect(popup.querySelector(`.${CLS.popupHidden}`)).toBeNull();
    expect(popup.querySelector(`.${CLS.popupGloss}`)?.textContent).toBe("lively; bustling");

    view.unmount();
  });
});