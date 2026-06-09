/**
 * Shared encoding-layer audio UI — term + example waveform rows (wavesurfer
 * A/B loop, same as transcript cue rows). Used by the encoding page and review
 * card reveal.
 */

import {
  computeHighlightSpans,
  parseEncodingPage,
  renderHighlightSpans,
  type EncodingPageDoc,
  type ExampleSentence,
} from "@tsumugu/engine";
import type { AppState } from "../state.js";
import { el } from "../ui/dom.js";
import { CLS } from "../ui/classes.js";
import { mountSentenceWaveforms, type SentenceWaveforms } from "../voice/sentenceWaveform.js";
import {
  discoverEncodingAudio,
  resolveSentenceAudioPath,
  resolveTermAudioPath,
  type EncodingAudioBinding,
} from "../voice/encodingAudio.js";
import { resolveExampleAudioSrc } from "../voice/exampleAudio.js";
export interface WaveformRowCollections {
  rows: HTMLElement[];
  waveEls: HTMLElement[];
  playBtns: HTMLButtonElement[];
  loopBtns: HTMLButtonElement[];
  audioPaths: (string | undefined)[];
  texts: string[];
}

export function emptyWaveformCollections(): WaveformRowCollections {
  return {
    rows: [],
    waveEls: [],
    playBtns: [],
    loopBtns: [],
    audioPaths: [],
    texts: [],
  };
}

export function renderExampleHtml(
  text: string,
  term: string,
  spans?: { start: number; end: number }[],
): string {
  const marks = spans?.length ? spans : computeHighlightSpans(text, term);
  return marks.length ? renderHighlightSpans(text, marks) : text;
}

export async function loadEncodingDoc(
  app: AppState,
  term: string,
): Promise<EncodingPageDoc | null> {
  const path = `${app.studyLang}/encoding/${term.normalize("NFC")}.encoding.json`;
  const raw = await app.vault?.readText(path);
  if (!raw) return null;
  return parseEncodingPage(raw);
}

export async function loadEncodingAudioBinding(
  app: AppState,
  term: string,
): Promise<EncodingAudioBinding | null> {
  return discoverEncodingAudio(app.vault, app.studyLang, term);
}

function resolveExampleAudio(
  app: AppState,
  audioBinding: EncodingAudioBinding | null,
  doc: EncodingPageDoc | null,
  index: number,
  ex: ExampleSentence,
): string | undefined {
  const encodingBase = audioBinding?.baseDir ?? `${app.studyLang}/encoding`;
  return (
    resolveSentenceAudioPath(audioBinding, doc, index, encodingBase) ??
    resolveExampleAudioSrc(app.contentBaseDir, ex.audio)
  );
}

/** One 例句 row with ▶ waveform 🔁 looper on the right. */
export function appendExampleWaveformRow(
  host: HTMLElement,
  opts: {
    term: string;
    ex: ExampleSentence;
    index: number;
    audioBinding: EncodingAudioBinding | null;
    doc: EncodingPageDoc | null;
    app: AppState;
    collections: WaveformRowCollections;
    showNumber?: boolean;
  },
): void {
  const { term, ex, index, audioBinding, doc, app, collections, showNumber = true } = opts;
  const row = el("div", { class: CLS.sentRow });
  if (showNumber) row.append(el("span", { class: CLS.sentNum, text: String(index + 1) }));
  row.append(
    el("span", {
      class: CLS.sentCn,
      html: renderExampleHtml(ex.text, term, ex.highlightSpans),
    }),
  );
  if (ex.translation) row.append(el("span", { class: CLS.sentEn, text: ex.translation }));

  const wrap = el("div", { class: CLS.sentWavewrap });
  const pp = el("button", {
    class: CLS.sentWaveBtn,
    text: "▶",
    type: "button",
    title: "Play / pause (Space)",
  });
  const waveEl = el("div", { class: CLS.sentWave });
  const lp = el("button", {
    class: CLS.sentWaveBtn,
    text: "🔁",
    type: "button",
    title: "Loop region (L) — drag on waveform to set A/B",
  });
  wrap.append(pp, waveEl, lp);
  row.append(wrap);
  host.append(row);

  collections.rows.push(row);
  collections.waveEls.push(waveEl);
  collections.playBtns.push(pp);
  collections.loopBtns.push(lp);
  collections.audioPaths.push(resolveExampleAudio(app, audioBinding, doc, index, ex));
  collections.texts.push(ex.text);
}

/** Term-level row with ▶ waveform 🔁 (chorus/shadow the headword clip). */
export function appendTermWaveformRow(
  host: HTMLElement,
  opts: {
    term: string;
    audioPath: string | null | undefined;
    collections: WaveformRowCollections;
    label?: string;
  },
): void {
  const { term, audioPath, collections, label = "Term" } = opts;
  const row = el("div", { class: `${CLS.sentRow} tsg-term-wave-row` });
  row.append(el("span", { class: CLS.sentNum, text: "♪" }));
  row.append(el("span", { class: CLS.sentCn, html: `<b>${term}</b>` }));
  row.append(el("span", { class: CLS.sentEn, text: label }));

  const wrap = el("div", { class: CLS.sentWavewrap });
  const pp = el("button", {
    class: CLS.sentWaveBtn,
    text: "▶",
    type: "button",
    title: "Play / pause term (Space)",
  });
  const waveEl = el("div", { class: CLS.sentWave });
  const lp = el("button", {
    class: CLS.sentWaveBtn,
    text: "🔁",
    type: "button",
    title: "Loop region (L)",
  });
  wrap.append(pp, waveEl, lp);
  row.append(wrap);
  host.append(row);

  collections.rows.push(row);
  collections.waveEls.push(waveEl);
  collections.playBtns.push(pp);
  collections.loopBtns.push(lp);
  collections.audioPaths.push(audioPath ?? undefined);
  collections.texts.push(term);
}

export async function mountEncodingWaveforms(
  app: AppState,
  collections: WaveformRowCollections,
): Promise<SentenceWaveforms> {
  if (collections.rows.length === 0) {
    return { setActive() {}, key: () => false, destroy() {} };
  }
  return mountSentenceWaveforms({
    rows: collections.rows,
    waveEls: collections.waveEls,
    playBtns: collections.playBtns,
    loopBtns: collections.loopBtns,
    audioPaths: collections.audioPaths,
    texts: collections.texts,
    vault: app.vault,
    speak: (t) => app.speak(t),
  });
}