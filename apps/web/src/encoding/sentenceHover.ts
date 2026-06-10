/**
 * Interactive 例句 text on the encoding page — segment, highlight the headword,
 * hover/click any word for the definition popup + encoding deep-dive.
 */

import {
  computeHighlightSpans,
  statusColorClass,
  type TextSpan,
  type Token,
} from "@tsumugu/engine";
import { segmentLiveText } from "../packs/jiebaSegment.js";
import { createWordPopup, type WordPopupController } from "../hover/wordPopup.js";
import type { AppState } from "../state.js";
import { el } from "../ui/dom.js";
import { CLS } from "../ui/classes.js";

export interface SentenceHoverController {
  mountSentence(
    host: HTMLElement,
    text: string,
    opts: { headword: string; highlightSpans?: TextSpan[] },
  ): void;
  destroy(): void;
}

function spansForSentence(
  text: string,
  headword: string,
  highlightSpans?: TextSpan[],
): TextSpan[] {
  return highlightSpans?.length ? highlightSpans : computeHighlightSpans(text, headword);
}

function tokenIsHeadword(start: number, end: number, marks: TextSpan[]): boolean {
  return marks.some((m) => start < m.end && end > m.start);
}

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

function paintTokens(
  host: HTMLElement,
  tokens: Token[],
  marks: TextSpan[],
  app: AppState,
  popup: WordPopupController,
): void {
  host.replaceChildren();
  for (const token of tokens) {
    if (!token.isWord) {
      host.append(renderPunct(token.text));
      continue;
    }

    const word = token.text;
    const status = app.getStatus(word);
    const classes = [
      CLS.token,
      CLS.word,
      statusColorClass(status),
      tokenIsHeadword(token.start, token.end, marks) ? "tsg-sent-headword" : "",
    ].filter(Boolean);

    const span = el("span", {
      class: classes.join(" "),
      dataset: { word },
      tabIndex: 0,
      text: word,
    });
    if (app.getEntry(word)?.flagged) span.classList.add(CLS.flagged);
    const open = (): void => {
      popup.open(word, span);
    };
    span.addEventListener("mouseenter", open);
    span.addEventListener("focus", open);
    span.addEventListener("click", (ev) => {
      ev.stopPropagation();
      open();
    });
    host.append(span);
  }
}

export function createSentenceHover(app: AppState): SentenceHoverController {
  const popup: WordPopupController = createWordPopup(app);
  const hostSeq = new WeakMap<HTMLElement, number>();

  function mountSentence(
    host: HTMLElement,
    text: string,
    opts: { headword: string; highlightSpans?: TextSpan[] },
  ): void {
    const seq = (hostSeq.get(host) ?? 0) + 1;
    hostSeq.set(host, seq);
    host.replaceChildren();
    if (!text) return;

    const marks = spansForSentence(text, opts.headword, opts.highlightSpans);

    void segmentLiveText(text, app.pack)
      .then((tokens) => {
        if (hostSeq.get(host) !== seq) return;
        paintTokens(host, tokens, marks, app, popup);
      })
      .catch(() => {
        if (hostSeq.get(host) !== seq) return;
        host.textContent = text;
      });
  }

  return {
    mountSentence,
    destroy(): void {
      popup.destroy();
    },
  };
}