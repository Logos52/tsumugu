/**
 * Pull-SRS review view (PRD §5, §8).
 *
 * Queue = level 1–4 words from the vault word store (`studyLang`), FSRS-initialized
 * on first encounter, then due-now cards. Reveal shows gloss + loopable term/sentence
 * waveforms (encoding-layer audio when present).
 */

import {
  REVIEW_STATUSES,
  lookupPrebaked,
  mergeHover,
  prepareReviewQueue,
  reviewSrs,
  type SrsRating,
  type WordEntry,
} from "@tsumugu/engine";
import {
  computeEncodingCoverageStats,
  formatEncodingCoverageLine,
} from "../encoding/coverage.js";
import { acceptEncodingContent } from "../encoding/accept.js";
import {
  appendExampleWaveformRow,
  appendTermWaveformRow,
  emptyWaveformCollections,
  loadEncodingAudioBinding,
  loadEncodingDoc,
  mountEncodingWaveforms,
} from "../encoding/audioUi.js";
import { resolveTermAudioPath } from "../voice/encodingAudio.js";
import type { SentenceWaveforms } from "../voice/sentenceWaveform.js";
import type { AppState, ViewController } from "../state.js";
import { el, clear } from "../ui/dom.js";
import { CLS } from "../ui/classes.js";

const REVEAL_EXAMPLE_LIMIT = 2;

export function mountReview(root: HTMLElement, app: AppState): ViewController {
  const lang = app.studyLang;
  const { queue, initialized } = prepareReviewQueue(app.store.all(lang), app.clock);
  if (initialized > 0) void app.saveStore();

  let index = 0;
  let reviewed = 0;
  let revealWaves: SentenceWaveforms | null = null;
  let revealKeyHandler: ((ev: KeyboardEvent) => void) | null = null;

  function destroyRevealAudio(): void {
    revealWaves?.destroy();
    revealWaves = null;
    if (revealKeyHandler) {
      document.removeEventListener("keydown", revealKeyHandler);
      revealKeyHandler = null;
    }
  }

  function navigateToEncoding(word: string): void {
    app.emit("change");
    location.hash = `#/encoding/${encodeURIComponent(word)}`;
  }

  function learningCount(): number {
    return app.store.all(lang).filter((e) => REVIEW_STATUSES.includes(e.status)).length;
  }

  function emptyMessage(): string {
    if (learningCount() === 0) {
      return "No words at levels 1–4 yet. In the reader, press 1–4 on a word to study it.";
    }
    return "Nothing due right now — Tsumugu never nags.";
  }

  function renderEmpty(): void {
    const m = app.metrics(lang);
    const shell = el(
      "div",
      { class: CLS.review },
      el("p", { text: emptyMessage() }),
      el(
        "p",
        { class: CLS.metrics },
        `known ${m.knownCount} · learning ${learningCount()} · due 0`,
      ),
    );
    root.append(shell);
    void computeEncodingCoverageStats(app, lang).then((stats) => {
      shell.append(
        el("p", { class: CLS.encodingCoverage, text: formatEncodingCoverageLine(stats) }),
      );
    });
  }

  function renderSummary(): void {
    const shell = el(
      "div",
      { class: CLS.review },
      el("p", { text: `${reviewed} reviewed` }),
    );
    root.append(shell);
    void computeEncodingCoverageStats(app, lang).then((stats) => {
      shell.append(
        el("p", { class: CLS.encodingCoverage, text: formatEncodingCoverageLine(stats) }),
      );
    });
  }

  function grade(word: string, rating: SrsRating): void {
    destroyRevealAudio();
    const e = app.store.get(lang, word);
    if (e?.srs) app.store.setSrs(lang, word, reviewSrs(e.srs, rating, app.clock));
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

    const doc = await loadEncodingDoc(app, entry.word);
    const audioBinding = await loadEncodingAudioBinding(app, entry.word);
    const prebaked = app.content ? lookupPrebaked(app.content, entry.word) : undefined;
    const hover = mergeHover({
      word: entry.word,
      ...(prebaked ? { prebaked } : {}),
      ...(custom ? { custom } : {}),
    });
    const { examples } = acceptEncodingContent(doc, hover);
    const termPath = resolveTermAudioPath(audioBinding, doc);
    const hasAudio = Boolean(termPath) || examples.length > 0;

    if (hasAudio) {
      const audioHost = el("div", { class: "tsg-review-reveal-audio" });
      const collections = emptyWaveformCollections();

      if (termPath || entry.word) {
        appendTermWaveformRow(audioHost, {
          term: entry.word,
          audioPath: termPath,
          collections,
          label: "Term",
        });
      }

      for (const [i, ex] of examples.slice(0, REVEAL_EXAMPLE_LIMIT).entries()) {
        appendExampleWaveformRow(audioHost, {
          term: entry.word,
          ex,
          index: i,
          audioBinding,
          doc,
          app,
          collections,
        });
      }

      back.append(audioHost);

      destroyRevealAudio();
      try {
        revealWaves = await mountEncodingWaveforms(app, collections);
        revealKeyHandler = (ev) => {
          revealWaves?.key(ev);
        };
        document.addEventListener("keydown", revealKeyHandler);
      } catch {
        /* wavesurfer unavailable — ▶ still speaks via Web Speech */
      }
    }

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
    destroyRevealAudio();
    clear(root);
    if (queue.length === 0) {
      renderEmpty();
      return;
    }
    const entry = queue[index];
    if (!entry) {
      renderSummary();
      return;
    }
    renderCard(entry);
  }

  render();

  return {
    unmount(): void {
      destroyRevealAudio();
      clear(root);
    },
  };
}