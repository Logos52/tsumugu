/**
 * Sticky hover/click definition popup — shared by the encoding page 例句 rows.
 * Mirrors the reader popup (definitions toggle, speak, encoding deep-dive) without
 * inline grading (that stays on the reader transcript).
 */

import {
  lookupPrebaked,
  mergeHover,
  type Definition,
  type EnDefinition,
  type MonoDefinition,
  type PreparedContent,
  type ResolvedHover,
} from "@tsumugu/engine";
import { acceptZhDefinition } from "../encoding/accept.js";
import type { AppState } from "../state.js";
import { resolveDictDefault } from "../state.js";
import { el, clear } from "../ui/dom.js";
import { CLS } from "../ui/classes.js";

const PORTAL_CLASS = "tsg-popup-portal";

function resolvePopupDefinitions(
  hover: ResolvedHover,
): { en?: Definition | EnDefinition; zh?: Definition | MonoDefinition } {
  const en =
    hover.definitions?.en ??
    (hover.gloss
      ? {
          gloss: hover.gloss,
          ...(hover.explanation ? { explanation: hover.explanation } : {}),
        }
      : undefined);
  const zh = acceptZhDefinition(hover.definitions?.zh);
  const out: { en?: Definition; zh?: Definition } = {};
  if (en?.gloss) out.en = en;
  if (zh) out.zh = zh;
  return out;
}

function secondaryBlurb(
  def: Definition | EnDefinition | MonoDefinition | undefined,
): string {
  if (!def) return "";
  if ("monolingual" in def && def.monolingual) return def.illustration ?? "";
  return def.explanation ?? "";
}

function wordFromEventTarget(target: EventTarget | null): Element | null {
  if (!target || !(target instanceof Node)) return null;
  if (target instanceof Element) return target.closest(`.${CLS.word}`);
  return target.parentElement?.closest(`.${CLS.word}`) ?? null;
}

function positionPopup(anchor: HTMLElement, popup: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  const margin = 6;
  const width = popup.offsetWidth || 320;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  let top = rect.bottom + margin;
  const height = popup.offsetHeight || 200;
  if (top + height > window.innerHeight - 8) {
    top = Math.max(8, rect.top - height - margin);
  }
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
}

export interface WordPopupController {
  open(word: string, anchor: HTMLElement): void;
  close(): void;
  destroy(): void;
}

export function createWordPopup(
  app: AppState,
  opts?: { content?: PreparedContent | null },
): WordPopupController {
  let popup: HTMLElement | null = null;
  let anchorEl: HTMLElement | null = null;
  let popupSeq = 0;

  function close(): void {
    popupSeq++;
    popup?.remove();
    popup = null;
    anchorEl = null;
  }

  function renderPopup(host: HTMLElement, word: string, hover: ResolvedHover): void {
    clear(host);

    const head = el("div", { class: CLS.popupTerm });
    head.append(el("span", { text: hover.term }));
    head.append(
      el("button", {
        class: CLS.btn,
        type: "button",
        text: "🔊",
        title: "Speak",
        on: {
          click: (ev) => {
            ev.stopPropagation();
            app.speak(word);
          },
        },
      }),
    );
    head.append(
      el("a", {
        class: CLS.btn,
        text: "↗",
        title: "Encoding page — etymology, examples, mnemonics",
        attrs: { href: `#/encoding/${encodeURIComponent(word)}` },
        on: {
          click: (ev) => {
            ev.stopPropagation();
          },
        },
      }),
    );
    host.append(head);

    if (hover.reading) {
      host.append(el("div", { class: CLS.popupReading, text: hover.reading }));
    }

    const definitions = resolvePopupDefinitions(hover);
    let visibleLang: "en" | "zh" = resolveDictDefault(app.settings);
    if (!definitions[visibleLang]) {
      visibleLang = definitions.en ? "en" : "zh";
    }

    const meaning = el("div", {});
    const glossEl = el("div", { class: CLS.popupGloss });
    const explainEl = el("div", { class: CLS.popupExplain });
    meaning.append(glossEl, explainEl);

    function paintDefinition(lang: "en" | "zh"): void {
      const def = definitions[lang];
      glossEl.textContent = def?.gloss ?? "";
      const blurb = secondaryBlurb(def);
      explainEl.textContent = blurb;
      explainEl.style.display = blurb ? "" : "none";
    }

    const hasBoth = !!definitions.en && !!definitions.zh;
    if (hasBoth) {
      const toggle = el("div", { class: CLS.defToggle });
      const segEn = el("button", {
        class: `${CLS.defSeg}${visibleLang === "en" ? ` ${CLS.defSegOn}` : ""}`,
        text: "English",
        type: "button",
        on: {
          click: (ev) => {
            ev.stopPropagation();
            visibleLang = "en";
            paintDefinition("en");
            segEn.classList.add(CLS.defSegOn);
            segZh.classList.remove(CLS.defSegOn);
          },
        },
      });
      const segZh = el("button", {
        class: `${CLS.defSeg}${visibleLang === "zh" ? ` ${CLS.defSegOn}` : ""}`,
        text: "簡明中文",
        type: "button",
        on: {
          click: (ev) => {
            ev.stopPropagation();
            visibleLang = "zh";
            paintDefinition("zh");
            segZh.classList.add(CLS.defSegOn);
            segEn.classList.remove(CLS.defSegOn);
          },
        },
      });
      toggle.append(segEn, segZh);
      meaning.prepend(toggle);
    }

    if (definitions.en || definitions.zh) {
      paintDefinition(visibleLang);
      host.append(meaning);
    } else {
      host.append(el("p", { class: CLS.popupGloss, text: "No definition yet." }));
    }
  }

  function open(word: string, anchor: HTMLElement): void {
    close();
    const seq = ++popupSeq;
    anchorEl = anchor;

    const host = el("div", { class: `${CLS.popup} ${PORTAL_CLASS}` });
    popup = host;
    document.body.append(host);
    positionPopup(anchor, host);

    const content = opts?.content ?? app.content;
    const prebaked = content ? lookupPrebaked(content, word) : undefined;
    const custom = app.getEntry(word)?.custom;

    void Promise.resolve(app.pack.dictionaryProvider(word))
      .then((dict) => {
        if (seq !== popupSeq || popup !== host) return;
        const hover = mergeHover({ word, prebaked, custom, dict: dict ?? undefined });
        renderPopup(host, word, hover);
        if (anchorEl) positionPopup(anchorEl, host);
      })
      .catch(() => {
        if (seq !== popupSeq || popup !== host) return;
        const hover = mergeHover({ word, prebaked, custom });
        renderPopup(host, word, hover);
        if (anchorEl) positionPopup(anchorEl, host);
      });
  }

  function onDocPointerDown(ev: PointerEvent): void {
    if (!popup) return;
    const t = ev.target;
    if (t instanceof Node && popup.contains(t)) return;
    if (wordFromEventTarget(t)) return;
    close();
  }

  function onKeyDown(ev: KeyboardEvent): void {
    if (ev.key === "Escape") close();
  }

  function onReposition(): void {
    if (popup && anchorEl) positionPopup(anchorEl, popup);
  }

  document.addEventListener("pointerdown", onDocPointerDown);
  document.addEventListener("keydown", onKeyDown);
  window.addEventListener("scroll", onReposition, true);
  window.addEventListener("resize", onReposition);

  return {
    open,
    close,
    destroy(): void {
      close();
      document.removeEventListener("pointerdown", onDocPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    },
  };
}