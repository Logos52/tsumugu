/**
 * Reader view — the heart of Phase 1 (PRD §5.8, §2.1).
 *
 * Renders prepared content token-by-token with status coloring, drives the
 * offline hover popup (prebaked + custom + dict, merged), and wires grading,
 * flagging, and keyboard navigation. Framework-free: builds DOM with `el()`
 * and listens on the `AppState` event bus to recolor in place without a full
 * re-render.
 */

import {
  statusColorClass,
  hotkeyToStatus,
  isKnown,
  lookupPrebaked,
  mergeHover,
  type PreparedToken,
  type ResolvedHover,
} from "@tsumugu/engine";

import type { AppState, ViewController } from "../state.js";
import { el, clear } from "../ui/dom.js";
import { CLS, toneClass } from "../ui/classes.js";

/** Labels shown on the grading row, in order; each maps via `hotkeyToStatus`. */
const GRADE_LABELS = ["1", "2", "3", "4", "K", "X"] as const;

/**
 * Mount the reader into `root`. Returns a controller whose `unmount()` removes
 * the keydown handler, the change subscription, and any open popup, then clears
 * `root`.
 */
export function mountReader(root: HTMLElement, app: AppState): ViewController {
  // ── empty state ────────────────────────────────────────────────────────────
  if (!app.content) {
    clear(root);
    root.append(
      el(
        "div",
        { class: CLS.reader },
        el("p", { text: "No content loaded. Generate or open a reading to begin." }),
      ),
    );
    return { unmount: () => clear(root) };
  }

  const content = app.content;

  // The word spans we render, paired with their surface form, in document
  // order. Used for keyboard navigation and in-place recoloring.
  const wordSpans: { word: string; span: HTMLSpanElement }[] = [];

  let activeIndex = 0;
  let popup: HTMLElement | null = null;
  // Monotonic token so a slow dictionaryProvider for a closed/replaced popup
  // never paints stale content.
  let popupSeq = 0;

  // ── render ──────────────────────────────────────────────────────────────────
  const container = el("div", { class: CLS.reader });
  const text = el("div", { class: CLS.readerText });
  container.append(text);

  for (const token of content.tokens) {
    if (!token.isWord) {
      text.append(renderPunct(token.text));
      continue;
    }
    const span = renderWord(token);
    wordSpans.push({ word: token.text, span });
    text.append(span);
  }

  clear(root);
  root.append(container);

  /**
   * Render a non-word token, making any embedded "\n" line breaks visible.
   * The text is split on newlines and rendered as a punctuation span whose
   * pieces are joined by `<br>` elements: `"foo\nbar"` → text "foo", `<br>`,
   * text "bar"; a token that is purely "\n" becomes a single `<br>`. Tokens
   * without newlines render exactly as before (a single span of text).
   */
  function renderPunct(text: string): HTMLSpanElement {
    const span = el("span", { class: CLS.punct });
    const parts = text.split("\n");
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) span.append(el("br"));
      const piece = parts[i];
      if (piece) span.append(piece);
    }
    return span;
  }

  /** Build a word span with its status color, flagged marker, and tone wrap. */
  function renderWord(token: PreparedToken): HTMLSpanElement {
    const word = token.text;
    const status = app.getStatus(word);
    const span = el("span", {
      class: `${CLS.token} ${CLS.word} ${statusColorClass(status)}`,
      dataset: { word },
      tabIndex: 0,
    });
    if (app.getEntry(word)?.flagged) span.classList.add(CLS.flagged);
    paintWordContent(span, word);

    span.addEventListener("mouseenter", () => openPopup(word, span));
    span.addEventListener("focus", () => openPopup(word, span));
    return span;
  }

  /** Render the inner characters of a word span (tone-colored or plain). */
  function paintWordContent(span: HTMLSpanElement, word: string): void {
    clear(span);
    if (app.settings.toneColoring) {
      let tones: number[] | undefined;
      try {
        // Pass the word's pre-baked reading so tone coloring works offline
        // from content alone (no live dictionary needed).
        const reading = lookupPrebaked(content, word)?.reading;
        tones = app.pack.phoneticLayer.toneClasses?.(word, reading);
      } catch {
        tones = undefined;
      }
      const chars = [...word];
      if (tones && tones.length === chars.length) {
        for (let i = 0; i < chars.length; i++) {
          const n = tones[i];
          span.append(
            el("span", { class: n != null ? toneClass(n) : "", text: chars[i] ?? "" }),
          );
        }
        return;
      }
    }
    span.textContent = word;
  }

  /** Re-read every word's status and swap its color class (no re-render). */
  function recolor(): void {
    for (const { word, span } of wordSpans) {
      const cls = statusColorClass(app.getStatus(word));
      for (const c of [...span.classList]) {
        if (c.startsWith("tsg-status-")) span.classList.remove(c);
      }
      span.classList.add(cls);
      span.classList.toggle(CLS.flagged, !!app.getEntry(word)?.flagged);
    }
  }

  // ── popup ───────────────────────────────────────────────────────────────────

  function closePopup(): void {
    popupSeq++;
    if (popup) {
      popup.remove();
      popup = null;
    }
  }

  /** Open (replacing any existing) the hover popup for `word`, near `span`. */
  function openPopup(word: string, span: HTMLSpanElement): void {
    closePopup();
    const seq = ++popupSeq;

    const host = el("div", { class: CLS.popup });
    popup = host;
    span.append(host);

    const prebaked = lookupPrebaked(content, word);
    const custom = app.getEntry(word)?.custom;

    const dictResult = app.pack.dictionaryProvider(word);
    Promise.resolve(dictResult)
      .then((dict) => {
        if (seq !== popupSeq || popup !== host) return; // stale / closed
        const hover = mergeHover({ word, prebaked, custom, dict: dict ?? undefined });
        renderPopup(host, word, hover);
      })
      .catch(() => {
        if (seq !== popupSeq || popup !== host) return;
        const hover = mergeHover({ word, prebaked, custom });
        renderPopup(host, word, hover);
      });
  }

  /** Paint a resolved hover into the popup host. */
  function renderPopup(
    host: HTMLElement,
    word: string,
    hover: ResolvedHover,
  ): void {
    clear(host);

    // Term (always visible) + audio button.
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
    host.append(head);

    // Reading (always visible — you can guess from form).
    if (hover.reading) {
      host.append(el("div", { class: CLS.popupReading, text: hover.reading }));
    }

    // Gloss + explanation. Under guess-first these are concealed until reveal.
    const meaning = el("div", {});
    if (hover.gloss) {
      meaning.append(el("div", { class: CLS.popupGloss, text: hover.gloss }));
    }
    if (hover.explanation) {
      meaning.append(el("div", { class: CLS.popupExplain, text: hover.explanation }));
    }

    if (app.settings.guessFirst && (hover.gloss || hover.explanation)) {
      meaning.classList.add(CLS.popupHidden);
      const reveal = el("button", {
        class: CLS.btn,
        type: "button",
        text: "Reveal",
        on: {
          click: (ev) => {
            ev.stopPropagation();
            meaning.classList.remove(CLS.popupHidden);
            reveal.remove();
          },
        },
      });
      reveal.addEventListener("keydown", (ev) => {
        if (ev.key === " " || ev.key === "Enter") {
          ev.preventDefault();
          ev.stopPropagation();
          meaning.classList.remove(CLS.popupHidden);
          reveal.remove();
        }
      });
      host.append(reveal);
    }
    host.append(meaning);

    // Examples.
    if (hover.examples && hover.examples.length > 0) {
      const ex = el("ul", { class: CLS.popupExamples });
      for (const e of hover.examples) ex.append(el("li", { text: e }));
      host.append(ex);
    }

    // Hán-Việt bridge box.
    if (hover.bridge) {
      const b = hover.bridge;
      const box = el("div", { class: CLS.popupBridge });
      if (b.etymon) box.append(el("div", { text: b.etymon }));
      if (b.bridgeReading) box.append(el("div", { text: b.bridgeReading }));
      if (b.morphemes && b.morphemes.length > 0) {
        const ul = el("ul", {});
        for (const m of b.morphemes) {
          const parts = [m.surface, m.etymon, m.reading, m.gloss].filter(
            (p): p is string => !!p,
          );
          ul.append(el("li", { text: parts.join(" · ") }));
        }
        box.append(ul);
      }
      host.append(box);
    }

    // Grading row: one button per label, each bound to its mapped status.
    const grades = el("div", { class: CLS.popupGrades });
    for (const label of GRADE_LABELS) {
      const status = hotkeyToStatus(label);
      if (!status) continue;
      grades.append(
        el("button", {
          class: CLS.btn,
          type: "button",
          text: label,
          on: {
            click: (ev) => {
              ev.stopPropagation();
              app.gradeWord(word, status);
              closePopup();
            },
          },
        }),
      );
    }
    host.append(grades);
  }

  // ── keyboard navigation ─────────────────────────────────────────────────────

  function setActive(index: number): void {
    if (wordSpans.length === 0) return;
    const clamped = Math.max(0, Math.min(index, wordSpans.length - 1));
    const prev = wordSpans[activeIndex];
    if (prev) prev.span.classList.remove(CLS.active);
    activeIndex = clamped;
    const cur = wordSpans[activeIndex];
    if (!cur) return;
    cur.span.classList.add(CLS.active);
    cur.span.focus();
    openPopup(cur.word, cur.span);
  }

  function nextUnknown(): void {
    if (wordSpans.length === 0) return;
    const n = wordSpans.length;
    for (let step = 1; step <= n; step++) {
      const idx = (activeIndex + step) % n;
      const entry = wordSpans[idx];
      if (entry && !isKnown(app.getStatus(entry.word))) {
        setActive(idx);
        return;
      }
    }
  }

  function onKeyDown(ev: KeyboardEvent): void {
    const cur = wordSpans[activeIndex];

    if (ev.key === "Escape") {
      closePopup();
      return;
    }
    if (ev.key === "ArrowRight" || ev.key === "l") {
      ev.preventDefault();
      setActive(activeIndex + 1);
      return;
    }
    if (ev.key === "ArrowLeft" || ev.key === "h") {
      ev.preventDefault();
      setActive(activeIndex - 1);
      return;
    }
    if (ev.key === "n") {
      ev.preventDefault();
      nextUnknown();
      return;
    }
    if (ev.key === "f") {
      ev.preventDefault();
      if (!cur) return;
      if (app.getEntry(cur.word)?.flagged) app.unflagWord(cur.word);
      else app.flagWord(cur.word);
      return;
    }
    const status = hotkeyToStatus(ev.key);
    if (status && cur) {
      ev.preventDefault();
      app.gradeWord(cur.word, status);
      closePopup();
    }
  }

  root.addEventListener("keydown", onKeyDown);

  // Recolor (no re-render) whenever the store changes.
  const offChange = app.on("change", () => recolor());

  // Establish an initial active word.
  if (wordSpans.length > 0) {
    const first = wordSpans[0];
    if (first) first.span.classList.add(CLS.active);
  }

  return {
    unmount() {
      root.removeEventListener("keydown", onKeyDown);
      offChange();
      closePopup();
      clear(root);
    },
  };
}
