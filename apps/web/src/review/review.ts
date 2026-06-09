/**
 * Pull-SRS review view (PRD §5, §8).
 *
 * No scheduler: the queue is built once on mount from the words that are due
 * "now" (`getDue`), and the view walks it card by card. Grading a card calls
 * `reviewSrs` to advance the FSRS state, persists, and moves on. When the queue
 * is exhausted (or was empty to begin with) a summary is shown — Tsumugu never
 * nags.
 */

import { getDue, reviewSrs, type SrsRating, type WordEntry } from "@tsumugu/engine";
import {
  computeEncodingCoverageStats,
  formatEncodingCoverageLine,
} from "../encoding/coverage.js";
import type { AppState, ViewController } from "../state.js";
import { el, clear } from "../ui/dom.js";
import { CLS } from "../ui/classes.js";

export function mountReview(root: HTMLElement, app: AppState): ViewController {
  // Build the queue once on mount; the view owns its own index.
  const queue: WordEntry[] = getDue(app.store.all(app.lang), app.clock);
  let index = 0;
  let reviewed = 0;

  function navigateToEncoding(word: string): void {
    app.emit("change");
    // The encoding/wiki route is hash-based; setting the hash triggers the host
    // router. Kept side-effect-light so happy-dom tests don't depend on layout.
    location.hash = `#/encoding/${encodeURIComponent(word)}`;
  }

  async function renderEmpty(): Promise<void> {
    const m = app.metrics();
    const coverage = formatEncodingCoverageLine(await computeEncodingCoverageStats(app));
    root.append(
      el(
        "div",
        { class: CLS.review },
        el("p", { text: "Nothing due — Tsumugu never nags." }),
        el(
          "p",
          { class: CLS.metrics },
          `known ${m.knownCount} · due ${m.dueCount ?? 0}`,
        ),
        el("p", { class: CLS.encodingCoverage, text: coverage }),
      ),
    );
  }

  async function renderSummary(): Promise<void> {
    const coverage = formatEncodingCoverageLine(await computeEncodingCoverageStats(app));
    root.append(
      el(
        "div",
        { class: CLS.review },
        el("p", { text: `${reviewed} reviewed` }),
        el("p", { class: CLS.encodingCoverage, text: coverage }),
      ),
    );
  }

  function grade(word: string, rating: SrsRating): void {
    const e = app.getEntry(word);
    if (e?.srs) app.store.setSrs(app.lang, word, reviewSrs(e.srs, rating, app.clock));
    void app.saveStore();
    reviewed += 1;
    index += 1;
    render();
  }

  async function reveal(entry: WordEntry, back: HTMLElement): Promise<void> {
    clear(back);
    const custom = entry.custom;
    let reading = custom?.reading;
    let gloss = custom?.gloss;
    if (gloss == null) {
      const dict = await app.pack.dictionaryProvider(entry.word);
      if (dict) {
        if (reading == null) reading = dict.reading;
        gloss = dict.gloss;
      }
    }
    if (reading) back.append(el("div", { class: CLS.popupReading, text: reading }));
    if (gloss) back.append(el("div", { class: CLS.popupGloss, text: gloss }));

    const href = `#/encoding/${encodeURIComponent(entry.word)}`;
    back.append(
      el("a", {
        class: CLS.btn,
        text: "Open encoding page",
        dataset: { encoding: entry.word },
        attrs: { href },
        on: {
          click: (ev) => {
            ev.preventDefault();
            navigateToEncoding(entry.word);
          },
        },
      }),
    );
  }

  function renderCard(entry: WordEntry): void {
    const back = el("div", { class: CLS.cardBack });
    let revealed = false;

    const term = el("div", {
      class: CLS.cardTerm,
      text: entry.word,
      tabIndex: 0,
      on: {
        click: () => navigateToEncoding(entry.word),
      },
    });

    const revealBtn = el("button", {
      class: CLS.btn,
      text: "Reveal",
      type: "button",
      on: {
        click: () => {
          if (revealed) return;
          revealed = true;
          revealBtn.remove();
          void reveal(entry, back);
        },
      },
    });

    const controls = el(
      "div",
      { class: CLS.cardControls },
      gradeButton("Again", "again", entry.word),
      gradeButton("Hard", "hard", entry.word),
      gradeButton("Good", "good", entry.word),
      gradeButton("Easy", "easy", entry.word),
    );

    root.append(el("div", { class: CLS.card }, term, revealBtn, back, controls));
  }

  function gradeButton(label: string, rating: SrsRating, word: string): HTMLButtonElement {
    return el("button", {
      class: CLS.btn,
      text: label,
      type: "button",
      on: { click: () => grade(word, rating) },
    });
  }

  function render(): void {
    clear(root);
    if (queue.length === 0) {
      void renderEmpty();
      return;
    }
    const entry = queue[index];
    if (!entry) {
      void renderSummary();
      return;
    }
    renderCard(entry);
  }

  render();

  return {
    unmount(): void {
      clear(root);
    },
  };
}
