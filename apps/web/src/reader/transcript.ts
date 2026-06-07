/**
 * Transcript synced-reader panel (M4, PRD §7) — "a reader with a synced player".
 *
 * Mounts a player/scrubber above the reader text and highlights the cue that is
 * playing in Tsumugu's OWN rendered tokens. The time source is the sanctioned
 * YouTube IFrame when the transcript carries a videoId, else a local scrubber —
 * so the sync experience works fully offline with zero ToS surface. Only mounted
 * when content has a bound transcript; plain reading is untouched.
 */

import type { PreparedToken, VaultIO } from "@tsumugu/engine";

import { el, clear } from "../ui/dom.js";
import { CLS } from "../ui/classes.js";
import {
  alignCuesToTokens,
  cueIndexAtTime,
  cueTimes,
  shouldLoopBack,
  timelineTime,
  snapToBoundary,
  type TranscriptDoc,
} from "./sync.js";
import { createYouTubePlayer, type VideoPlayer } from "./youtube.js";
import type { VoicePlayer } from "../voice/player.js";
import {
  shadowReducer,
  shadowActive,
  SHADOW_IDLE,
  type ShadowState,
  type ShadowEvent,
} from "../voice/shadowing.js";
import type { VoiceNotesBinding } from "../voice/manifest.js";
import { speakersOf, type VoiceTrack, type SpeakerAssignment } from "../voice/voices.js";
import {
  createPracticeBar as defaultPracticeBarFactory,
  type PracticeBar,
  type PracticeBarFactory,
} from "../voice/practiceBar.js";
import type { SectionAudioPlayer } from "../voice/sectionAudio.js";

export interface TranscriptController {
  destroy(): void;
  /** Toggle play/pause. */
  togglePlay(): void;
  /** Whether the video/clock is currently playing. */
  isPlaying(): boolean;
  /** Play the current highlighted sentence (Space): one-shot, honoring 🎙️. */
  playCurrentSentence(): void;
  /** Flip the click/Space audio source: video clip ↔ Serena's voice (`v`). */
  toggleSerenaSource(): void;
  /** Whether clicking/Space plays Serena instead of the video. */
  isSerenaSource(): boolean;
  /** Show/hide the current line's sentence translation (`t` hotkey / toolbar). */
  setTranslationVisible(on: boolean): void;
  /** Play the current cue's voice note (no-op without a voice player). */
  playCurrentCueVoice(): void;
  /** Play voice notes consecutively from the current cue. */
  playFromCurrentVoice(): void;
  /** Stop voice playback + any chained/shadowing advance. */
  stopVoice(): void;
  /** Toggle shadowing/chorusing mode on the current cue. */
  toggleShadowing(): void;
  /** Whether shadowing is currently engaged. */
  isShadowing(): boolean;
  /** Whether voice playback currently owns the cue highlight (playFrom/shadowing). */
  isVoiceDriving(): boolean;
  /** Advance shadowing to the next cue (Space while shadowing). */
  shadowAdvance(): void;
  /** Open/close the segment-loop practice bar on the current cue (M2.1). */
  togglePracticeBar(): void;
  /** Whether the practice bar is currently open. */
  isPracticeBarOpen(): boolean;
  /** Toggle the practice-bar loop (L while the bar is open). */
  practiceToggleLoop(): void;
  /** Nudge the nearest region edge: -1 earlier (`[`), +1 later (`]`). */
  practiceNudge(dir: -1 | 1): void;
  /** Close the practice bar if open (Esc). */
  practiceCloseBar(): void;
  /** Seek the video clock so the given cue becomes active (used by 🔂). */
  seekToCue(cueIndex: number): void;
  /** Play ONE sentence in the video from its start, stopping at its end (click). */
  playCueInVideo(cueIndex: number): void;
  /** Select a sentence (highlight + voice target) WITHOUT moving the video. */
  selectCue(cueIndex: number): void;
  /** The cue index that owns a token, or -1 (for click-to-select mapping). */
  cueForToken(tokenIndex: number): number;
  /** Step to the next/prev sentence and play it (↑ / ↓ / `,` / `.`), honoring 🎙️. */
  nextCue(): void;
  prevCue(): void;
  /** Toggle "loop this sentence" on the video/scrubber (🔂). */
  toggleVideoLoop(): void;
  /** Whether the video sentence-loop is engaged. */
  isVideoLooping(): boolean;
  /** Open/close the A/B video-loop strip (🆎). */
  toggleLoopStrip(): void;
  /** Whether the A/B loop strip is open. */
  isLoopStripOpen(): boolean;
}

/** mm:ss for the time label. */
function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Schedule a frame, tolerating environments without requestAnimationFrame. */
function schedule(cb: FrameRequestCallback): number {
  return typeof requestAnimationFrame === "function" ? requestAnimationFrame(cb) : 0;
}

export function mountTranscriptSync(opts: {
  host: HTMLElement;
  tokens: readonly PreparedToken[];
  transcript: TranscriptDoc;
  tokenEls: readonly (HTMLElement | null)[];
  showTranslation?: boolean;
  /** Optional voice-note player; when present, voice transport + shadowing appear. */
  player?: VoicePlayer | null;
  /** Initial slow-playback preference (persisted setting). */
  voiceSlow?: boolean;
  /** Called when the slow toggle flips, so the host can persist it. */
  onSlowToggle?: (slow: boolean) => void;
  /** Initial "click plays Serena, parks the video" preference (persisted). */
  serenaOnClick?: boolean;
  /** Called when the 🎙️ source toggle flips, so the host can persist it. */
  onSerenaToggle?: (on: boolean) => void;
  /** Vault + manifest for the practice bar to load cue audio (M2.1). */
  vault?: VaultIO | null;
  voiceNotes?: VoiceNotesBinding | null;
  /** All voice tracks beside the reading; ≥2 shows a per-speaker voice picker. */
  voiceTracks?: VoiceTrack[];
  /** Current speaker → voice id (which option each picker shows as selected). */
  voiceAssignment?: SpeakerAssignment;
  /** Reassign a speaker's voice (the host recomposes + rebuilds the player). */
  onVoiceAssign?: (speaker: string, voiceId: string) => void;
  /** Practice-bar factory (injectable for tests; defaults to the real wavesurfer one). */
  createPracticeBar?: PracticeBarFactory;
  /** Optional section-summary audio player (🔊 on the "now talking about…" line). */
  sectionPlayer?: SectionAudioPlayer | null;
  /** Web Speech fallback (for the section 🔊 when no audio clip exists). */
  speak?: (text: string) => void;
  /**
   * Render the section summary into its container as hoverable words (the reader
   * supplies this so the Chinese summary gets the same hover card as the body).
   * Falls back to plain text when absent.
   */
  renderSummary?: (container: HTMLElement, text: string) => void;
  /** Flip the shared "show English translation" setting (the 譯 transport button). */
  onToggleTranslation?: () => void;
}): TranscriptController {
  const { host, tokens, transcript, tokenEls } = opts;
  const voicePlayer = opts.player ?? null;
  const vault = opts.vault ?? null;
  const voiceNotes = opts.voiceNotes ?? null;
  const practiceFactory = opts.createPracticeBar ?? defaultPracticeBarFactory;
  const canPractice = !!(voicePlayer && vault && voiceNotes);
  const cues = transcript.cues;
  const sections = transcript.sections ?? [];
  const ranges = alignCuesToTokens(tokens, cues);
  const times = cueTimes(cues);
  const sectionTimes = cueTimes(sections);
  const duration = times.reduce((m, t) => Math.max(m, t.end), 0);

  // ── panel UI (prepended above the text) ──────────────────────────────────
  const panel = el("div", { class: CLS.transcript });
  const playerHost = el("div", { class: CLS.player });
  const playBtn = el("button", { class: CLS.btn, type: "button", text: "▶", title: "Play / pause" });
  const scrubber = el("input", {
    class: CLS.scrubber,
    attrs: { type: "range", min: "0", max: String(Math.max(duration, 0.001)), step: "0.05", value: "0" },
  });
  const timeLabel = el("span", { class: CLS.metrics, text: `${fmt(0)} / ${fmt(duration)}` });

  // Voice transport (only when a voice player is bound). Drives playback through
  // the shared cue highlight; shadowing claims Space (handled in reader.ts).
  let slow = opts.voiceSlow ?? false;
  let serenaSource = opts.serenaOnClick ?? false; // click/Space plays Serena, not the video
  let serenaBtn: HTMLButtonElement | null = null;
  let voiceHighlight = false; // when true, voice playback owns the highlight (not the clock)
  let shadow: ShadowState = SHADOW_IDLE;
  let shadowBtn: HTMLButtonElement | null = null;
  let practiceBtn: HTMLButtonElement | null = null;
  // The ⏩ play-through (every line in Serena's voice) doubles as its own stop,
  // like the video's play/pause; `chaining` lights the button while it runs.
  let voiceFromBtn: HTMLButtonElement | null = null;
  let chaining = false;
  // A/B video loop strip (🆎): a timeline whose handles snap to sentence edges.
  // Loops the video between [loopRegion.start, loopRegion.end].
  let loopStripBtn: HTMLButtonElement | null = null;
  let regionPanel: HTMLElement | null = null;
  let loopTrack: HTMLElement | null = null;
  let loopFill: HTMLElement | null = null;
  let regionHandleA: HTMLElement | null = null;
  let regionHandleB: HTMLElement | null = null;
  let loopPlayhead: HTMLElement | null = null;
  let regionLoopBtn: HTMLButtonElement | null = null;
  let loopStripOpen = false;
  let loopRegion: { start: number; end: number } | null = null;
  let regionLooping = false;
  let regionDragEdge: "start" | "end" | null = null;
  // Sentence boundaries (cue starts + ends) the A/B handles snap to.
  const loopBoundaries = [...new Set(times.flatMap((tt) => [tt.start, tt.end]))].sort((a, b) => a - b);
  // Loop the current sentence on the video/scrubber (works without voice notes).
  const videoLoopBtn = el("button", { class: CLS.btn, type: "button", text: "🔂", title: "Loop this sentence on the video" });
  videoLoopBtn.addEventListener("click", () => toggleVideoLoop());
  // A/B video loop strip: drag a range (snaps to sentences) and loop the video.
  loopStripBtn = el("button", { class: CLS.btn, type: "button", text: "🆎", title: "Video A/B loop — drag a range (snaps to sentences)" });
  loopStripBtn.addEventListener("click", () => toggleLoopStrip());
  // Reveal the English translation (off by default); mirrors the toolbar 譯 + `t`,
  // surfaced right in the reader transport where the eye already is.
  const trBtn = el("button", { class: CLS.btn, type: "button", text: "譯", title: "Show English translation" });
  trBtn.addEventListener("click", () => opts.onToggleTranslation?.());
  const transportChildren: (HTMLElement | null)[] = [playBtn, scrubber, timeLabel, videoLoopBtn, loopStripBtn, trBtn];
  if (voicePlayer) {
    const vPlay = el("button", { class: CLS.btn, type: "button", text: "🔊", title: "Play this line's voice note" });
    const vFrom = el("button", { class: CLS.btn, type: "button", text: "⏩", title: "Play through every line in Serena's voice (click again to stop)" });
    voiceFromBtn = vFrom;
    const vStop = el("button", { class: CLS.btn, type: "button", text: "⏹", title: "Stop voice" });
    const vSlow = el("button", { class: CLS.btn, type: "button", text: "🐢", title: "Slow voice (slow take, else 0.85×)" });
    if (slow) vSlow.classList.add(CLS.btnActive);
    const vShadow = el("button", { class: CLS.btn, type: "button", text: "跟讀", title: "Shadowing: hear → repeat → Space to advance (Esc exits)" });
    shadowBtn = vShadow;
    vPlay.addEventListener("click", () => playCurrentCueVoice());
    vFrom.addEventListener("click", () => (chaining ? stopVoice() : playFromCurrentVoice()));
    vStop.addEventListener("click", () => stopVoice());
    vSlow.addEventListener("click", () => {
      slow = !slow;
      vSlow.classList.toggle(CLS.btnActive, slow);
      opts.onSlowToggle?.(slow);
    });
    vShadow.addEventListener("click", () => toggleShadowing());
    const vSrc = el("button", { class: CLS.btn, type: "button", text: "🎙️", title: "Click / Space plays Serena's voice and parks the video on the line (v)" });
    serenaBtn = vSrc;
    if (serenaSource) vSrc.classList.add(CLS.btnActive);
    vSrc.addEventListener("click", () => toggleSerenaSource());
    transportChildren.push(vPlay, vFrom, vStop, vSlow, vShadow, vSrc);
    if (canPractice) {
      const vBar = el("button", { class: CLS.btn, type: "button", text: "🌊", title: "Practice bar: loop a slice of this line (L), nudge edges ([ ]), slow it" });
      practiceBtn = vBar;
      vBar.addEventListener("click", () => togglePracticeBar());
      transportChildren.push(vBar);
    }
  }
  // Per-speaker voice picker — only when the reading has ≥2 voice tracks. A 甲/乙
  // dialogue gets one selector per speaker (so 甲 can be the native speaker and 乙
  // Serena, or any mix); a single-speaker reading gets one global selector.
  // Changing a selector recomposes the binding; the host rebuilds the player.
  let voicePickerRow: HTMLElement | null = null;
  const vTracks = opts.voiceTracks ?? [];
  if (vTracks.length >= 2 && opts.onVoiceAssign) {
    const assign = opts.voiceAssignment ?? {};
    const found = speakersOf(cues.map((c) => c.speaker));
    const speakerKeys = found.length ? found : [""];
    const glyph = (k: string): string => (k === "A" ? "甲" : k === "B" ? "乙" : k || "🗣");
    voicePickerRow = el("div", { class: CLS.transport });
    voicePickerRow.append(el("span", { class: CLS.metrics, text: "🗣" }));
    for (const sp of speakerKeys) {
      const sel = el("select", { class: CLS.btn, title: `Voice for ${glyph(sp)}` });
      for (const t of vTracks) sel.append(el("option", { text: t.label, attrs: { value: t.id } }));
      sel.value = assign[sp] ?? assign[""] ?? vTracks[0]!.id;
      sel.addEventListener("change", () => opts.onVoiceAssign!(sp, sel.value));
      voicePickerRow.append(el("label", { class: CLS.metrics }, speakerKeys.length > 1 ? `${glyph(sp)} ` : "", sel));
    }
  }

  panel.append(playerHost, el("div", { class: CLS.transport }, ...transportChildren));
  if (voicePickerRow) panel.append(voicePickerRow);

  // ── practice bar (M2.1) — collapsible, hidden until opened ────────────────
  const practicePanel = el("div", { class: CLS.practiceBar });
  const waveHost = el("div", { class: CLS.practiceWave });
  const pPlay = el("button", { class: CLS.btn, type: "button", text: "▶", title: "Play / pause the loop" });
  const pLoop = el("button", { class: CLS.btn, type: "button", text: "🔁", title: "Loop the selection (L)" });
  const pSpeed = el("button", { class: CLS.btn, type: "button", text: "1×", title: "Playback speed (pitch-corrected)" });
  const pHint = el("span", { class: CLS.metrics, text: "drag to select · L loop · [ ] nudge edges" });
  practicePanel.style.display = "none";
  practicePanel.append(waveHost, el("div", { class: CLS.transport }, pPlay, pLoop, pSpeed, pHint));
  pPlay.addEventListener("click", () => {
    pauseVideoForVoice();
    practiceBar?.playPause();
  });
  pLoop.addEventListener("click", () => practiceToggleLoop());
  pSpeed.addEventListener("click", () => {
    const r = practiceBar?.cycleSpeed();
    if (r) pSpeed.textContent = `${r}×`;
  });
  panel.append(practicePanel);

  // ── A/B video loop strip (🆎) — collapsible; handles snap to sentences ──────
  regionPanel = el("div", { class: CLS.loopStrip });
  loopTrack = el("div", { class: CLS.loopTrack });
  loopFill = el("div", { class: CLS.loopFill });
  regionHandleA = el("div", { class: CLS.loopHandle, attrs: { "data-edge": "start", title: "Loop start (drag)" } });
  regionHandleB = el("div", { class: CLS.loopHandle, attrs: { "data-edge": "end", title: "Loop end (drag)" } });
  loopPlayhead = el("div", { class: CLS.loopPlayhead });
  for (const tt of times) {
    const tick = el("div", { class: CLS.loopTick });
    tick.style.left = `${pctOf(tt.start)}%`;
    loopTrack.append(tick);
  }
  loopTrack.append(loopFill, regionHandleA, regionHandleB, loopPlayhead);
  regionLoopBtn = el("button", { class: CLS.btn, type: "button", text: "🔁", title: "Loop the A/B selection" });
  regionLoopBtn.addEventListener("click", () => toggleRegionLoop());
  regionPanel.style.display = "none";
  regionPanel.append(
    loopTrack,
    el("div", { class: CLS.transport }, regionLoopBtn, el("span", { class: CLS.metrics, text: "drag the ends · snaps to sentences" })),
  );
  regionHandleA.addEventListener("mousedown", startRegionDrag("start"));
  regionHandleB.addEventListener("mousedown", startRegionDrag("end"));
  loopTrack.addEventListener("mousedown", onTrackMouseDown);
  panel.append(regionPanel);

  // "Now talking about…" — the active section's summary (in the reading's
  // language), with a 🔊 to hear it and an English line under the 譯 toggle.
  const sectionPlayer = opts.sectionPlayer ?? null;
  const sectionPlayBtn = el("button", { class: CLS.btn, type: "button", text: "🔊", title: "Play this section's summary" });
  const sectionLoopBtn = el("button", { class: CLS.btn, type: "button", text: "🔄", title: "Loop this section's commentary (click again to stop)" });
  const sectionTextEl = el("span");
  const sectionTrEl = el("div", { class: CLS.sectionTr });
  sectionPlayBtn.addEventListener("click", () => playCurrentSectionVoice());
  sectionLoopBtn.addEventListener("click", () => toggleSectionLoop());
  const sectionEl = el("div", { class: CLS.section }, sectionPlayBtn, sectionLoopBtn, sectionTextEl, sectionTrEl);
  if (sections.length === 0) sectionEl.style.display = "none";
  const trEl = el("div", { class: CLS.translation });
  let showTr = opts.showTranslation ?? false;
  trEl.style.display = showTr ? "block" : "none";
  trBtn.classList.toggle(CLS.btnActive, showTr);
  // Order under the player: Serena practice bar → this line's English translation
  // → (very bottom) the section summary.
  panel.append(trEl, sectionEl);
  host.prepend(panel);
  // Layout (split vs subtitle) is applied by the reader from settings.

  // ── time source: YouTube IFrame if videoId, else a local clock ───────────
  let player: VideoPlayer | null = null;
  let localTime = 0;
  let playing = false;
  let lastFrameMs: number | null = null;
  let lastCue = -2;
  let raf = 0;
  let destroyed = false;
  // A clicked/arrowed sentence selection that drives the highlight + voice
  // actions WITHOUT moving the video; cleared when the video plays/scrubs.
  let selectedCue: number | null = null;
  // Click-to-play-one-sentence: when playOneCue ≥ 0, the video stops at that
  // cue's end instead of running on. The ▶ button alone plays the whole video.
  let playOneCue = -1;
  let playOneArmed = false; // true once the (async) seek has landed inside the cue

  if (transcript.videoId) {
    void createYouTubePlayer(playerHost, transcript.videoId).then((p) => {
      // The panel may have been torn down while the IFrame API was loading;
      // destroy the late player rather than holding an orphaned reference.
      if (destroyed) {
        p?.destroy();
        return;
      }
      player = p;
    });
  }

  const currentTime = (): number => (player ? player.getCurrentTime() : localTime);

  function setPlaying(on: boolean): void {
    playing = on;
    if (on) selectedCue = null; // playing hands the highlight back to the video clock
    else {
      // Any pause ends a one-shot sentence play; the ▶ button then plays through.
      playOneCue = -1;
      playOneArmed = false;
    }
    playBtn.textContent = on ? "⏸" : "▶";
    if (player) {
      if (on) player.play();
      else player.pause();
    }
    lastFrameMs = null;
  }

  // Seek the active time source (YouTube IFrame or the offline clock) + repaint.
  function seek(t: number): void {
    if (player) player.seekTo(t);
    else localTime = t;
    paint(t);
  }

  playBtn.addEventListener("click", () => setPlaying(!playing));
  scrubber.addEventListener("input", () => {
    selectedCue = null; // scrubbing moves the video → drop the manual selection
    playOneCue = -1; // …and cancels a one-shot sentence play
    playOneArmed = false;
    seek(Number(scrubber.value));
  });

  function highlightCue(idx: number): void {
    if (idx === lastCue) return;
    const prev = lastCue >= 0 ? ranges[lastCue] : undefined;
    if (prev) {
      for (let i = prev.startToken; i < prev.endToken; i++) {
        tokenEls[i]?.classList.remove(CLS.cueActive);
      }
    }
    const next = idx >= 0 ? ranges[idx] : undefined;
    if (next) {
      let first: HTMLElement | null = null;
      for (let i = next.startToken; i < next.endToken; i++) {
        const node = tokenEls[i];
        if (node) {
          node.classList.add(CLS.cueActive);
          if (!first) first = node;
        }
      }
      first?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    }
    lastCue = idx;
    followCue(idx); // the practice bar tracks the active sentence
  }

  function paint(t: number): void {
    // Highlight precedence: voice playback > a manual sentence selection (click /
    // arrows, which do NOT move the video) > the video/scrubber clock.
    if (!voiceHighlight) {
      highlightCue(selectedCue !== null ? selectedCue : cueIndexAtTime(cues, t, times));
    }
    if (document.activeElement !== scrubber) scrubber.value = String(t);
    timeLabel.textContent = `${fmt(t)} / ${fmt(duration)}`;
    if (showTr) trEl.textContent = lastCue >= 0 ? (cues[lastCue]?.tr ?? "— (no translation yet)") : "";
    if (sections.length) {
      // The section follows the highlighted line (selection or clock), so a
      // clicked sentence shows its own section context.
      const focusTime = lastCue >= 0 && times[lastCue] ? times[lastCue]!.start : t;
      const si = cueIndexAtTime(sections, focusTime, sectionTimes);
      activeSection = si;
      const summary = si >= 0 ? sections[si]!.summary : "";
      if (summary !== lastSummaryText) {
        lastSummaryText = summary;
        if (opts.renderSummary) opts.renderSummary(sectionTextEl, summary);
        else sectionTextEl.textContent = summary;
      }
      sectionTrEl.textContent = showTr && si >= 0 ? (sections[si]!.tr ?? "") : "";
    }
    if (loopStripOpen && loopPlayhead) loopPlayhead.style.left = `${pctOf(t)}%`;
  }

  // ── voice notes (M1) ──────────────────────────────────────────────────────
  // The line in focus for voice actions: a manual selection (click / arrows) if
  // set, else the cue under the clock. Clamped to 0.
  function currentCue(): number {
    if (selectedCue !== null) return selectedCue;
    const i = cueIndexAtTime(cues, currentTime(), times);
    return i >= 0 ? i : 0;
  }

  // ── A/B video loop strip (🆎) ──────────────────────────────────────────────
  /** A time as a 0–100% position along the strip. */
  function pctOf(t: number): number {
    return duration > 0 ? Math.max(0, Math.min(100, (t / duration) * 100)) : 0;
  }

  /** Position the region fill + handles from loopRegion. */
  function renderRegion(): void {
    const show = !!loopRegion && duration > 0;
    for (const e of [loopFill, regionHandleA, regionHandleB]) if (e) e.style.display = show ? "block" : "none";
    if (!show || !loopRegion) return;
    const a = pctOf(loopRegion.start);
    const b = pctOf(loopRegion.end);
    if (loopFill) {
      loopFill.style.left = `${a}%`;
      loopFill.style.width = `${Math.max(0, b - a)}%`;
    }
    if (regionHandleA) regionHandleA.style.left = `${a}%`;
    if (regionHandleB) regionHandleB.style.left = `${b}%`;
  }

  /** Default the region to the current sentence when none is set yet. */
  function ensureRegion(): void {
    if (loopRegion) return;
    const i = currentCue();
    if (times[i]) loopRegion = { start: times[i]!.start, end: times[i]!.end };
  }

  function toggleLoopStrip(): void {
    loopStripOpen = !loopStripOpen;
    if (regionPanel) regionPanel.style.display = loopStripOpen ? "block" : "none";
    loopStripBtn?.classList.toggle(CLS.btnActive, loopStripOpen);
    if (loopStripOpen) {
      ensureRegion();
      renderRegion();
    }
  }

  function updateRegionLoopBtn(): void {
    regionLoopBtn?.classList.toggle(CLS.btnActive, regionLooping);
  }

  function toggleRegionLoop(): void {
    ensureRegion();
    regionLooping = !regionLooping;
    updateRegionLoopBtn();
    if (regionLooping && loopRegion) {
      videoLooping = false; // mutually exclusive with the 🔂 sentence-loop
      updateVideoLoopBtn();
      playOneCue = -1;
      playOneArmed = false;
      setPlaying(true);
      seek(loopRegion.start);
    }
  }

  /** Move one edge to a (snapped) time, keeping start ≤ end. */
  function setRegionEdge(edge: "start" | "end", t: number): void {
    if (!loopRegion) loopRegion = { start: t, end: t };
    const s = snapToBoundary(t, loopBoundaries);
    loopRegion =
      edge === "start"
        ? { start: Math.min(s, loopRegion.end), end: loopRegion.end }
        : { start: loopRegion.start, end: Math.max(s, loopRegion.start) };
    renderRegion();
  }

  function onRegionMove(ev: MouseEvent): void {
    if (!regionDragEdge || !loopTrack) return;
    const rect = loopTrack.getBoundingClientRect();
    setRegionEdge(regionDragEdge, timelineTime(ev.clientX, rect.left, rect.width, duration));
  }

  function onRegionUp(): void {
    regionDragEdge = null;
    document.removeEventListener("mousemove", onRegionMove);
    document.removeEventListener("mouseup", onRegionUp);
  }

  function beginRegionDrag(edge: "start" | "end"): void {
    regionDragEdge = edge;
    document.addEventListener("mousemove", onRegionMove);
    document.addEventListener("mouseup", onRegionUp);
  }

  function startRegionDrag(edge: "start" | "end") {
    return (ev: MouseEvent): void => {
      ev.preventDefault();
      ev.stopPropagation();
      beginRegionDrag(edge);
    };
  }

  /** Click on the track body → grab the nearer edge and drag it. */
  function onTrackMouseDown(ev: MouseEvent): void {
    if (ev.target === regionHandleA || ev.target === regionHandleB || !loopTrack) return;
    ev.preventDefault();
    const rect = loopTrack.getBoundingClientRect();
    const t = timelineTime(ev.clientX, rect.left, rect.width, duration);
    ensureRegion();
    if (!loopRegion) return;
    const edge: "start" | "end" = Math.abs(t - loopRegion.start) <= Math.abs(t - loopRegion.end) ? "start" : "end";
    setRegionEdge(edge, t);
    beginRegionDrag(edge);
  }

  // ── sentence navigation + video loop (M2.2) ───────────────────────────────
  let videoLooping = false;
  let loopCue = -1;
  let activeSection = -1; // the section under the focused line (for the 🔊)
  let sectionLooping = false; // the 🔄 commentary loop is running
  let lastSummaryText: string | null = null; // re-render summary words only on change

  /** Select a sentence (highlight + voice target) without seeking the video. */
  function selectCue(cueIndex: number): void {
    if (cues.length === 0) return;
    selectedCue = Math.max(0, Math.min(cueIndex, cues.length - 1));
    highlightCue(selectedCue);
  }

  function updateSectionLoopBtn(): void {
    sectionLoopBtn.classList.toggle(CLS.btnActive, sectionLooping);
  }

  function playCurrentSectionVoice(): void {
    if (activeSection < 0) return;
    if (sectionLooping) {
      // 🔊 is "play once" — a fresh single play cancels any running loop.
      sectionLooping = false;
      updateSectionLoopBtn();
    }
    pauseVideoForVoice();
    const summary = sections[activeSection]?.summary ?? "";
    if (sectionPlayer) sectionPlayer.playSection(activeSection, summary);
    else if (summary) opts.speak?.(summary);
  }

  /** Loop the active section's commentary clip on repeat (A/B on one utterance). */
  function toggleSectionLoop(): void {
    sectionLooping = !sectionLooping;
    updateSectionLoopBtn();
    if (!sectionLooping) {
      sectionPlayer?.stop();
      return;
    }
    if (activeSection < 0) {
      sectionLooping = false;
      updateSectionLoopBtn();
      return;
    }
    pauseVideoForVoice();
    const summary = sections[activeSection]?.summary ?? "";
    if (sectionPlayer) sectionPlayer.playSection(activeSection, summary, { loop: true });
    else if (summary) opts.speak?.(summary); // Web Speech can't loop — speaks once
  }

  function cueForToken(tokenIndex: number): number {
    for (let c = 0; c < ranges.length; c++) {
      const r = ranges[c]!;
      if (tokenIndex >= r.startToken && tokenIndex < r.endToken) return c;
    }
    return -1;
  }

  function seekToCue(cueIndex: number): void {
    if (cues.length === 0) return;
    const i = Math.max(0, Math.min(cueIndex, cues.length - 1));
    // Move the video there. When paused, also make it the active line immediately
    // (no async-seek flicker); when playing, hand the highlight to the clock so it
    // keeps following from the new position.
    selectedCue = playing ? null : i;
    seek(times[i]!.start);
    if (videoLooping) loopCue = i; // navigating re-pins the loop to the new line
  }

  /**
   * Play ONE sentence in the video: seek to its start, play, and stop at its end
   * (clicking a word). The clock owns the highlight while it plays; the just-
   * played line stays highlighted when it stops. Distinct from the ▶ button,
   * which plays the whole video through.
   */
  function playCueInVideo(cueIndex: number): void {
    if (cues.length === 0) return;
    const i = Math.max(0, Math.min(cueIndex, cues.length - 1));
    if (serenaSource && voicePlayer) {
      // Serena mode: park the video on the line's first frame and play the TTS
      // take instead. Seek first, then pause LAST — YouTube's seekTo can resume a
      // paused player, so pausing after the seek guarantees only Serena is heard.
      stopVoice(); // halt any chain/shadowing first
      selectedCue = i; // keep the line highlighted while Serena speaks
      seek(times[i]!.start);
      setPlaying(false); // pause AFTER the seek (also clears the one-shot)
      voicePlayer.playCue(i, { slow });
      return;
    }
    stopVoice(); // the video owns the speakers — no Serena chain/shadowing overlap
    playOneCue = i;
    playOneArmed = false; // arm only once the (async) seek lands inside the cue
    setPlaying(true);
    selectedCue = i; // hold the highlight on the clicked line during the async (YouTube)
    // seek, so a stale clock can't flash + scroll back to the previous sentence.
    seek(times[i]!.start);
  }

  /** Play whatever sentence is highlighted now (Space): one-shot, honoring 🎙️. */
  function playCurrentSentence(): void {
    playCueInVideo(currentCue());
  }

  function toggleSerenaSource(): void {
    serenaSource = !serenaSource;
    serenaBtn?.classList.toggle(CLS.btnActive, serenaSource);
    opts.onSerenaToggle?.(serenaSource);
  }

  function updateVideoLoopBtn(): void {
    videoLoopBtn.classList.toggle(CLS.btnActive, videoLooping);
  }

  function toggleVideoLoop(): void {
    videoLooping = !videoLooping;
    playOneCue = -1; // loop and one-shot sentence-play are mutually exclusive
    playOneArmed = false;
    if (videoLooping) {
      loopCue = currentCue(); // the selected (or playing) line
      seek(times[loopCue]!.start); // 🔂 deliberately moves the video to that line
      setPlaying(true);
    }
    updateVideoLoopBtn();
  }

  // ── practice bar (M2.1 + M3: auto-following the active sentence) ───────────
  // One wavesurfer instance, created up front when the reading has voice notes,
  // shown by default and reloaded to whatever sentence is active (followCue).
  let practiceBar: PracticeBar | null = null;
  let practiceVisible = canPractice;

  function updateLoopBtn(): void {
    pLoop.classList.toggle(CLS.btnActive, !!practiceBar?.isLooping());
  }

  if (canPractice) {
    practicePanel.style.display = "block";
    practiceBtn?.classList.add(CLS.btnActive);
    void practiceFactory({ container: waveHost, vault: vault!, binding: voiceNotes!, initialCue: currentCue() })
      .then((bar) => {
        if (destroyed) {
          bar?.destroy();
          return;
        }
        practiceBar = bar;
      })
      .catch(() => {
        practiceBar = null;
      });
  }

  /** Reload the bar to the active cue (called when the highlight moves). */
  function followCue(cueIndex: number): void {
    if (!practiceBar || !practiceVisible || cueIndex < 0) return;
    practiceBar.setCue(cueIndex);
    updateLoopBtn(); // a reload clears any loop selection
  }

  function togglePracticeBar(): void {
    practiceVisible = !practiceVisible;
    practicePanel.style.display = practiceVisible ? "block" : "none";
    practiceBtn?.classList.toggle(CLS.btnActive, practiceVisible);
    if (practiceVisible) followCue(currentCue());
  }

  function practiceToggleLoop(): void {
    pauseVideoForVoice(); // bar audio owns the speakers while looping
    practiceBar?.toggleLoop();
    updateLoopBtn();
  }

  function practiceNudge(dir: -1 | 1): void {
    practiceBar?.nudge(dir);
  }

  function updateShadowBtn(): void {
    shadowBtn?.classList.toggle(CLS.btnActive, shadowActive(shadow));
  }

  function updateVoiceFromBtn(): void {
    voiceFromBtn?.classList.toggle(CLS.btnActive, chaining);
  }

  // Apply a shadowing event and map the resulting state to effects.
  function dispatchShadow(ev: ShadowEvent): void {
    const prev = shadow;
    shadow = shadowReducer(shadow, ev, cues.length);
    if (shadow.phase === "playing" && (prev.phase !== "playing" || prev.cue !== shadow.cue)) {
      voiceHighlight = true;
      highlightCue(shadow.cue);
      voicePlayer?.playCue(shadow.cue, { slow, onEnded: () => dispatchShadow({ type: "audioEnded" }) });
    } else if (shadow.phase === "idle" || shadow.phase === "done") {
      voicePlayer?.stop();
      voiceHighlight = false;
      if (shadow.phase === "done") shadow = SHADOW_IDLE;
    }
    updateShadowBtn();
  }

  // Voice playback owns the audio; pause the video first so they don't overlap.
  function pauseVideoForVoice(): void {
    if (playing) setPlaying(false);
  }

  function playCurrentCueVoice(): void {
    if (!voicePlayer) return;
    if (shadowActive(shadow)) dispatchShadow({ type: "exit" });
    pauseVideoForVoice();
    // A single cue plays the already-highlighted (clock) cue, so hand the
    // highlight back to the clock — also clears a leftover playFrom suppression
    // and the ⏩ play-through lamp (playCue halts any running chain).
    voiceHighlight = false;
    chaining = false;
    updateVoiceFromBtn();
    voicePlayer.playCue(currentCue(), { slow });
  }

  function playFromCurrentVoice(): void {
    if (!voicePlayer) return;
    if (shadowActive(shadow)) dispatchShadow({ type: "exit" });
    pauseVideoForVoice();
    voiceHighlight = true;
    chaining = true;
    updateVoiceFromBtn();
    voicePlayer.playFrom(currentCue(), {
      slow,
      onAdvance: (i) => highlightCue(i),
      onDone: () => {
        voiceHighlight = false;
        chaining = false;
        updateVoiceFromBtn();
      },
    });
  }

  function stopVoice(): void {
    voicePlayer?.stop();
    voiceHighlight = false;
    chaining = false;
    updateVoiceFromBtn();
    if (shadowActive(shadow)) {
      shadow = SHADOW_IDLE;
      updateShadowBtn();
    }
  }

  function toggleShadowing(): void {
    if (shadowActive(shadow)) {
      dispatchShadow({ type: "exit" });
    } else {
      pauseVideoForVoice();
      chaining = false; // shadowing claims the audio; the ⏩ chain (if any) is over
      updateVoiceFromBtn();
      dispatchShadow({ type: "start", cue: currentCue() });
    }
  }

  function frame(now: number): void {
    // Advance the local clock only when there's no real player driving time.
    if (playing && !player) {
      if (lastFrameMs != null) {
        localTime += (now - lastFrameMs) / 1000;
        if (localTime >= duration) {
          localTime = duration;
          setPlaying(false);
        }
      }
      lastFrameMs = now;
    }
    const t = currentTime();
    // A/B region loop (🆎) takes precedence: seek back to A when the clock passes B.
    if (regionLooping && loopRegion && shouldLoopBack(t, loopRegion)) {
      seek(loopRegion.start);
    } else if (videoLooping && loopCue >= 0 && loopCue < times.length && shouldLoopBack(t, times[loopCue]!)) {
      // Video A/B loop: when the clock passes the pinned sentence's end, seek back.
      seek(times[loopCue]!.start);
    } else if (playing && playOneCue >= 0 && playOneCue < times.length) {
      // One-shot sentence play (clicked a word): wait for the seek to land inside
      // the cue, then stop at its end so playback doesn't run on into the next.
      const bounds = times[playOneCue]!;
      if (!playOneArmed) {
        if (t >= bounds.start - 0.1 && t < bounds.end) {
          playOneArmed = true;
          selectedCue = null; // seek landed → hand the highlight back to the clock
        }
        paint(t);
      } else if (shouldLoopBack(t, bounds)) {
        const stopped = playOneCue;
        setPlaying(false); // stop at the sentence end (clears playOne*)
        selectedCue = stopped; // keep the just-played line highlighted
        paint(currentTime());
      } else {
        paint(t);
      }
    } else {
      paint(t);
    }
    raf = schedule(frame);
  }
  raf = schedule(frame);

  return {
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("mousemove", onRegionMove); // in case a drag is mid-flight
      document.removeEventListener("mouseup", onRegionUp);
      player?.destroy();
      voicePlayer?.stop();
      practiceBar?.destroy();
      for (const node of tokenEls) node?.classList.remove(CLS.cueActive);
      panel.remove();
    },
    togglePlay() {
      setPlaying(!playing);
    },
    isPlaying() {
      return playing;
    },
    playCurrentSentence,
    toggleSerenaSource,
    isSerenaSource() {
      return serenaSource;
    },
    setTranslationVisible(on: boolean) {
      showTr = on;
      trEl.style.display = on ? "block" : "none";
      trBtn.classList.toggle(CLS.btnActive, on);
      paint(currentTime());
    },
    playCurrentCueVoice,
    playFromCurrentVoice,
    stopVoice,
    toggleShadowing,
    isShadowing() {
      return shadowActive(shadow);
    },
    isVoiceDriving() {
      return voiceHighlight;
    },
    shadowAdvance() {
      dispatchShadow({ type: "advance" });
    },
    togglePracticeBar,
    isPracticeBarOpen() {
      return practiceVisible;
    },
    practiceToggleLoop,
    practiceNudge,
    practiceCloseBar() {
      if (practiceVisible) togglePracticeBar();
    },
    seekToCue,
    playCueInVideo,
    selectCue,
    cueForToken,
    nextCue() {
      playCueInVideo(currentCue() + 1);
    },
    prevCue() {
      playCueInVideo(currentCue() - 1);
    },
    toggleVideoLoop,
    isVideoLooping() {
      return videoLooping;
    },
    toggleLoopStrip,
    isLoopStripOpen() {
      return loopStripOpen;
    },
  };
}
