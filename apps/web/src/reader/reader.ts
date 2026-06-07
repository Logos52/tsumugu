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
import { mountTranscriptSync, type TranscriptController } from "./transcript.js";
import { createVoicePlayer, type VoicePlayer } from "../voice/player.js";
import { createWordAudioPlayer, type WordAudioPlayer } from "../voice/wordAudio.js";
import { createSectionAudioPlayer, type SectionAudioPlayer } from "../voice/sectionAudio.js";

/** Labels shown on the grading row, in order; each maps via `hotkeyToStatus`. */
const GRADE_LABELS = ["1", "2", "3", "4", "K", "X"] as const;

/**
 * Pointer x → the left (video) pane's fraction of the split, clamped to 20–80%
 * so neither pane can be dragged shut. Pure (the splitter drag uses it).
 */
export function clampSplitFraction(clientX: number, left: number, width: number): number {
  if (width <= 0) return 0.5;
  return Math.max(0.2, Math.min(0.8, (clientX - left) / width));
}

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
  // Hoverable word spans rendered into the section-summary line (rebuilt when the
  // active section changes); recolored alongside the body on grade.
  let summaryWordSpans: { word: string; span: HTMLSpanElement }[] = [];
  let summarySeq = 0; // guards async segmentation against rapid section changes

  let activeIndex = 0;
  // The word the keyboard grades / flags: set by hover OR arrow-nav, so pressing
  // 1–4/K/X always targets the word you're actually looking at.
  let currentWord: string | null = null;
  let activeSpan: HTMLElement | null = null;
  // The cue under the word you're hovering / focused on, so Space plays the
  // sentence your mouse is on (-1 until the first word is hovered/focused).
  let hoveredCue = -1;
  let popup: HTMLElement | null = null;
  // Monotonic token so a slow dictionaryProvider for a closed/replaced popup
  // never paints stale content.
  let popupSeq = 0;

  // ── render ──────────────────────────────────────────────────────────────────
  const container = el("div", { class: CLS.reader });
  const text = el("div", { class: CLS.readerText });
  // Opt into the Migaku visual model (zhuyin ruby + colored-underline grading,
  // no background fill) when phonetics is on; the default fill model otherwise.
  if (app.settings.phonetics) text.dataset.visual = "migaku";
  container.append(text);

  // One element per token (word OR punctuation span), index-aligned with
  // content.tokens, so the transcript sync can highlight a cue's token range.
  const tokenEls: (HTMLElement | null)[] = [];
  for (const token of content.tokens) {
    if (!token.isWord) {
      const punct = renderPunct(token.text);
      punct.dataset.ti = String(tokenEls.length); // token index → cue (click-to-activate)
      text.append(punct);
      tokenEls.push(punct);
      continue;
    }
    const span = renderWord(token);
    span.dataset.ti = String(tokenEls.length);
    wordSpans.push({ word: token.text, span });
    text.append(span);
    tokenEls.push(span);
  }

  clear(root);
  root.append(container);

  // Synced-reader (M4): when a timed transcript is bound to this content, mount
  // the player/scrubber panel and highlight the playing cue in our own text.
  // Inert when there's no transcript, so plain reading (and the reader tests)
  // are unaffected.
  // Voice notes (M1): build a cue-aware player when a manifest is bound to this
  // reading, voice notes are enabled, and a vault can serve the audio bytes.
  // Inert otherwise — the transport + shadowing controls don't appear.
  const voicePlayer: VoicePlayer | null =
    app.transcript && app.voiceNotes && app.vault && app.settings.voiceNotesEnabled
      ? createVoicePlayer({
          vault: app.vault,
          binding: app.voiceNotes,
          cues: app.transcript.cues,
          speak: (t) => app.speak(t),
        })
      : null;

  // Per-word audio (M3): play the hover 🔊 in the Serena voice when a word-audio
  // manifest is bound; falls back to Web Speech per word. Inert otherwise.
  const wordAudioPlayer: WordAudioPlayer | null =
    app.wordAudio && app.vault
      ? createWordAudioPlayer({ vault: app.vault, binding: app.wordAudio, speak: (t) => app.speak(t) })
      : null;

  const sectionAudioPlayer: SectionAudioPlayer | null =
    app.transcript && app.sectionAudio && app.vault
      ? createSectionAudioPlayer({ vault: app.vault, binding: app.sectionAudio, speak: (t) => app.speak(t) })
      : null;

  const transcriptCtl: TranscriptController | null = app.transcript
    ? mountTranscriptSync({
        host: container,
        tokens: content.tokens,
        transcript: app.transcript,
        tokenEls,
        showTranslation: app.settings.showTranslation,
        player: voicePlayer,
        voiceSlow: app.settings.voiceSlow,
        onSlowToggle: (slow) => app.updateSettings({ voiceSlow: slow }),
        serenaOnClick: app.settings.serenaOnClick,
        onSerenaToggle: (on) => app.updateSettings({ serenaOnClick: on }),
        vault: app.vault,
        voiceNotes: app.voiceNotes,
        sectionPlayer: sectionAudioPlayer,
        speak: (t) => app.speak(t),
        renderSummary: (container, t) => renderSummaryInto(container, t),
        onToggleTranslation: () =>
          app.updateSettings({ showTranslation: !app.settings.showTranslation }),
      })
    : null;

  // Transcript layout. CSS + (for theater) one DOM move drive all three; the
  // active-cue token spans are reused, so the layouts can never drift.
  if (app.transcript) {
    const layout = app.settings.transcriptLayout;
    const hasVideo = !!app.transcript.videoId;
    const playerEl = hasVideo ? container.querySelector(".tsg-player") : null;
    if (layout === "theater" && playerEl) {
      // The playing line rides on the bottom of the video (no-fill underline
      // visual so colors read over the picture; only the active cue is shown).
      container.classList.add("tsg-reader-theater");
      text.classList.add("tsg-subtitle-layout");
      text.dataset.visual = "migaku";
      playerEl.appendChild(text);
    } else if (layout === "subtitle" || layout === "theater") {
      container.classList.add("tsg-reader-subtitle");
      text.classList.add("tsg-subtitle-layout");
    } else if (hasVideo) {
      container.classList.add("tsg-reader-split");
      mountSplitter(container, text);
    }
  }

  /** Drag-divider between the video pane and the text pane; resizes both. */
  function mountSplitter(host: HTMLElement, textEl: HTMLElement): void {
    const splitter = el("div", { class: "tsg-splitter", attrs: { title: "Drag to resize the panes" } });
    host.insertBefore(splitter, textEl);
    let dragging = false;
    const onMove = (e: MouseEvent): void => {
      if (!dragging) return;
      const rect = host.getBoundingClientRect();
      const f = clampSplitFraction(e.clientX, rect.left, rect.width);
      host.style.setProperty("--tsg-split", String(f));
      host.style.setProperty("--tsg-split-r", String(1 - f));
    };
    const onUp = (): void => {
      dragging = false;
      splitter.classList.remove("tsg-dragging");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    splitter.addEventListener("mousedown", (e) => {
      dragging = true;
      e.preventDefault();
      splitter.classList.add("tsg-dragging");
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

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

  /** Whether hovering `word` should open the card, per settings.hoverMode. */
  function shouldHover(word: string, ev: MouseEvent): boolean {
    const mode = app.settings.hoverMode;
    if (mode === "all") return true;
    if (mode === "shift") return ev.shiftKey;
    return !isKnown(app.getStatus(word)); // "unknown" — Migaku-style
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

    // Hover (or keyboard focus) marks this the current word AND shows its card;
    // leaving the word (and its popup, which is a child) hides the card again.
    // Hover (or keyboard focus) marks this the current word and shows its card.
    // The card is STICKY: it does not vanish on mouse-leave (so you can move onto
    // it and click 1–4/K/X). Dismiss by clicking off it, Escape, or hovering
    // another word (see onDocMouseDown / onKeyDown / openPopup).
    span.addEventListener("mouseenter", (ev) => {
      setCurrent(word, span);
      if (shouldHover(word, ev)) openPopup(word, span);
    });
    span.addEventListener("focus", () => {
      setCurrent(word, span);
      // In shift mode the card stays quiet on plain focus (e.g. a click, which
      // plays the sentence) — keyboard word-nav still opens it via setActive.
      if (app.settings.hoverMode !== "shift") openPopup(word, span);
    });
    return span;
  }

  /**
   * Render the inner content of a word span. Three independently-toggled
   * layers: zhuyin ruby ABOVE each character (`settings.phonetics`,
   * Migaku-style), tone-coloring of the glyphs (`settings.toneColoring`), and
   * the plain glyphs. Ruby and tone-coloring both need a per-syllable reading
   * that aligns 1:1 with the word's characters; when it doesn't, we fall back
   * gracefully (tone spans, then plain text).
   */
  function paintWordContent(span: HTMLSpanElement, word: string): void {
    clear(span);
    const chars = [...word];

    // Fast path: nothing to annotate.
    if (!app.settings.phonetics && !app.settings.toneColoring) {
      span.textContent = word;
      return;
    }

    const reading = readingFor(word);
    const syllables = reading ? reading.split(/\s+/).filter(Boolean) : [];
    const aligned = syllables.length === chars.length;
    // Tones drive coloring of both the glyph and (when ruby is shown) the rt.
    const tones = app.settings.toneColoring ? tonesFor(word, reading) : undefined;

    // Zhuyin ruby above each char (needs a per-char-aligned reading).
    if (app.settings.phonetics && aligned) {
      const ruby = el("ruby", { class: CLS.ruby });
      for (let i = 0; i < chars.length; i++) {
        const t = tones?.[i];
        const cls = t != null ? toneClass(t) : "";
        ruby.append(el("span", { class: cls, text: chars[i] ?? "" }));
        ruby.append(el("rt", { class: cls, text: syllables[i] ?? "" }));
      }
      span.append(ruby);
      return;
    }

    // Tone coloring only (no ruby): per-char colored glyphs.
    if (tones && tones.length === chars.length) {
      for (let i = 0; i < chars.length; i++) {
        const n = tones[i];
        span.append(
          el("span", { class: n != null ? toneClass(n) : "", text: chars[i] ?? "" }),
        );
      }
      return;
    }

    span.textContent = word;
  }

  /**
   * The word's pre-baked reading, zhuyin part only (drops any "/ pinyin"
   * variant suffix). Offline-safe: reads from content, never a live dict.
   */
  function readingFor(word: string): string | undefined {
    try {
      const raw = lookupPrebaked(content, word)?.reading;
      if (!raw) return undefined;
      const zhuyin = raw.split("/")[0]?.trim();
      return zhuyin || undefined;
    } catch {
      return undefined;
    }
  }

  /** Per-syllable tone classes for a word from its reading (pack-computed). */
  function tonesFor(word: string, reading: string | undefined): number[] | undefined {
    try {
      return app.pack.phoneticLayer.toneClasses?.(word, reading);
    } catch {
      return undefined;
    }
  }

  /** Re-read a span's status and swap its color / flagged class in place. */
  function recolorSpan(word: string, span: HTMLElement): void {
    const cls = statusColorClass(app.getStatus(word));
    for (const c of [...span.classList]) {
      if (c.startsWith("tsg-status-")) span.classList.remove(c);
    }
    span.classList.add(cls);
    span.classList.toggle(CLS.flagged, !!app.getEntry(word)?.flagged);
  }

  /** Re-read every word's status and swap its color class (no re-render). */
  function recolor(): void {
    for (const { word, span } of wordSpans) recolorSpan(word, span);
    for (const { word, span } of summaryWordSpans) recolorSpan(word, span); // section summary
  }

  /**
   * Render a string (a section summary) into `container` as hoverable, gradable
   * word spans — the same machinery as the body text — so the Chinese summary
   * gets the same hover card / grading as the transcript. Segments via the pack;
   * a seq guard drops a stale async segmentation if the section changed again.
   */
  function renderSummaryInto(container: HTMLElement, text: string): void {
    const seq = ++summarySeq;
    clear(container);
    summaryWordSpans = [];
    if (!text) return;
    const apply = (tokens: readonly { text: string; isWord: boolean }[]): void => {
      if (seq !== summarySeq) return; // a newer summary superseded this one
      for (const tk of tokens) {
        if (!tk.isWord) {
          container.append(renderPunct(tk.text));
          continue;
        }
        const span = renderWord({ text: tk.text, isWord: true });
        summaryWordSpans.push({ word: tk.text, span });
        container.append(span);
      }
    };
    try {
      const toks = app.pack.segmenter(text);
      if (toks instanceof Promise) void toks.then(apply).catch(() => container.replaceChildren(text));
      else apply(toks);
    } catch {
      container.textContent = text; // segmentation failed → plain text, still readable
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
            if (wordAudioPlayer) wordAudioPlayer.playWord(word);
            else app.speak(word);
          },
        },
      }),
    );
    // Deep dive → the word's encoding page (etymology, examples, mnemonics,
    // bridge). Progressive disclosure: the rich helper is one click away, not
    // crammed into the hover card.
    head.append(
      el("button", {
        class: CLS.btn,
        type: "button",
        text: "↗",
        title: "Encoding page — etymology, examples, mnemonics",
        on: {
          click: (ev) => {
            ev.stopPropagation();
            location.hash = `#/encoding/${encodeURIComponent(word)}`;
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
          dataset: { grade: label },
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

  /** Mark `word`/`span` the current target (moves the active box; no scroll). */
  function setCurrent(word: string, span: HTMLElement): void {
    currentWord = word;
    if (activeSpan && activeSpan !== span) activeSpan.classList.remove(CLS.active);
    activeSpan = span;
    span.classList.add(CLS.active);
    // Track the sentence this word belongs to so Space plays the hovered line.
    if (transcriptCtl) {
      const ti = Number(span.dataset.ti);
      if (Number.isInteger(ti)) hoveredCue = transcriptCtl.cueForToken(ti);
    }
  }

  function setActive(index: number): void {
    if (wordSpans.length === 0) return;
    const clamped = Math.max(0, Math.min(index, wordSpans.length - 1));
    activeIndex = clamped;
    const cur = wordSpans[activeIndex];
    if (!cur) return;
    setCurrent(cur.word, cur.span);
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
    // Don't hijack typing in the toolbar (select / checkbox / file input).
    const tag = (ev.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

    if (ev.key === "Escape") {
      // Esc leaves shadowing first (if engaged), else dismisses the hover popup.
      if (transcriptCtl?.isShadowing()) {
        ev.preventDefault();
        transcriptCtl.toggleShadowing();
        return;
      }
      closePopup();
      return;
    }
    // The practice bar follows the active sentence (always visible); `[` / `]`
    // nudge the nearest loop edge. Loop itself is the 🔁 button (so `l` stays
    // next-word). These don't collide with any existing binding.
    if (transcriptCtl?.isPracticeBarOpen()) {
      if (ev.key === "[") {
        ev.preventDefault();
        transcriptCtl.practiceNudge(-1);
        return;
      }
      if (ev.key === "]") {
        ev.preventDefault();
        transcriptCtl.practiceNudge(1);
        return;
      }
    }
    // Sentence navigation: ↑ / ↓ and `,` / `.` move to a line and play it (in
    // the selected source — video or Serena). Space replays / pauses it.
    if (transcriptCtl && (ev.key === "ArrowDown" || ev.key === ".")) {
      ev.preventDefault();
      transcriptCtl.nextCue();
      return;
    }
    if (transcriptCtl && (ev.key === "ArrowUp" || ev.key === ",")) {
      ev.preventDefault();
      transcriptCtl.prevCue();
      return;
    }
    // Space: while shadowing, advance to the next cue (hear → repeat → Space);
    // otherwise it pauses/plays the synced video (so you can stop to read a line).
    if (ev.key === " " || ev.code === "Space") {
      if (tag === "BUTTON") return; // let a focused button activate normally
      if (transcriptCtl?.isShadowing()) {
        ev.preventDefault();
        transcriptCtl.shadowAdvance();
        return;
      }
      // While "play from here" voice playback owns the highlight, Space stops it
      // rather than starting the video over the top of it.
      if (transcriptCtl?.isVoiceDriving()) {
        ev.preventDefault();
        transcriptCtl.stopVoice();
        return;
      }
      if (transcriptCtl) {
        ev.preventDefault();
        // Space plays the sentence you're hovering / focused on; while something
        // is playing it pauses instead, so it still works during a watch.
        if (transcriptCtl.isPlaying()) transcriptCtl.togglePlay();
        else if (hoveredCue >= 0) transcriptCtl.playCueInVideo(hoveredCue);
        else transcriptCtl.playCurrentSentence();
      }
      return;
    }
    // `t` toggles the current line's sentence translation.
    if (ev.key === "t" || ev.key === "T") {
      ev.preventDefault();
      app.updateSettings({ showTranslation: !app.settings.showTranslation });
      return;
    }
    // `v` flips the click/Space audio source: video clip ↔ Serena's voice.
    if ((ev.key === "v" || ev.key === "V") && transcriptCtl) {
      ev.preventDefault();
      transcriptCtl.toggleSerenaSource();
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
      if (!currentWord) return;
      if (app.getEntry(currentWord)?.flagged) app.unflagWord(currentWord);
      else app.flagWord(currentWord);
      return;
    }
    const status = hotkeyToStatus(ev.key);
    if (status && currentWord) {
      ev.preventDefault();
      app.gradeWord(currentWord, status);
      closePopup();
    }
  }

  /** Click off the card (and not on a word) dismisses the sticky popup. */
  function onDocMouseDown(ev: MouseEvent): void {
    if (!popup) return;
    const t = ev.target as Element | null;
    if (t && (popup.contains(t) || t.closest?.(`.${CLS.word}`))) return;
    closePopup();
  }

  /** Click a sentence (any token) → play just that one sentence in the video. */
  function onTextClick(ev: MouseEvent): void {
    if (!transcriptCtl) return;
    const node = (ev.target as Element | null)?.closest<HTMLElement>("[data-ti]");
    const ti = node?.dataset.ti;
    if (ti === undefined) return;
    const cue = transcriptCtl.cueForToken(Number(ti));
    if (cue >= 0) transcriptCtl.playCueInVideo(cue);
  }

  // Global so a grade key works while you're hovering with the mouse (focus is
  // on <body>, not the reader, so a root-level listener would never fire).
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("mousedown", onDocMouseDown);
  text.addEventListener("click", onTextClick);

  // Recolor (no re-render) whenever the store changes; also reflect a live
  // translation toggle (settings changes emit "change" too).
  const offChange = app.on("change", () => {
    recolor();
    transcriptCtl?.setTranslationVisible(app.settings.showTranslation);
  });

  // Establish an initial current word (so a grade key works before any hover).
  if (wordSpans.length > 0) {
    const first = wordSpans[0];
    if (first) setCurrent(first.word, first.span);
  }

  return {
    unmount() {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onDocMouseDown);
      offChange();
      transcriptCtl?.destroy();
      voicePlayer?.destroy();
      wordAudioPlayer?.destroy();
      sectionAudioPlayer?.destroy();
      closePopup();
      clear(root);
    },
  };
}
