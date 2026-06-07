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
import {
  createPracticeBar as defaultPracticeBarFactory,
  type PracticeBar,
  type PracticeBarFactory,
} from "../voice/practiceBar.js";
import type { SectionAudioPlayer } from "../voice/sectionAudio.js";

export interface TranscriptController {
  destroy(): void;
  /** Toggle play/pause (Space hotkey). */
  togglePlay(): void;
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
  /** Step the active sentence (`,` / `.`). */
  nextCue(): void;
  prevCue(): void;
  /** Toggle "loop this sentence" on the video/scrubber (🔂). */
  toggleVideoLoop(): void;
  /** Whether the video sentence-loop is engaged. */
  isVideoLooping(): boolean;
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
  /** Vault + manifest for the practice bar to load cue audio (M2.1). */
  vault?: VaultIO | null;
  voiceNotes?: VoiceNotesBinding | null;
  /** Practice-bar factory (injectable for tests; defaults to the real wavesurfer one). */
  createPracticeBar?: PracticeBarFactory;
  /** Optional section-summary audio player (🔊 on the "now talking about…" line). */
  sectionPlayer?: SectionAudioPlayer | null;
  /** Web Speech fallback (for the section 🔊 when no audio clip exists). */
  speak?: (text: string) => void;
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
  let voiceHighlight = false; // when true, voice playback owns the highlight (not the clock)
  let shadow: ShadowState = SHADOW_IDLE;
  let shadowBtn: HTMLButtonElement | null = null;
  let practiceBtn: HTMLButtonElement | null = null;
  // The ⏩ play-through (every line in Serena's voice) doubles as its own stop,
  // like the video's play/pause; `chaining` lights the button while it runs.
  let voiceFromBtn: HTMLButtonElement | null = null;
  let chaining = false;
  // Loop the current sentence on the video/scrubber (works without voice notes).
  const videoLoopBtn = el("button", { class: CLS.btn, type: "button", text: "🔂", title: "Loop this sentence on the video" });
  videoLoopBtn.addEventListener("click", () => toggleVideoLoop());
  // Reveal the English translation (off by default); mirrors the toolbar 譯 + `t`,
  // surfaced right in the reader transport where the eye already is.
  const trBtn = el("button", { class: CLS.btn, type: "button", text: "譯", title: "Show English translation" });
  trBtn.addEventListener("click", () => opts.onToggleTranslation?.());
  const transportChildren: (HTMLElement | null)[] = [playBtn, scrubber, timeLabel, videoLoopBtn, trBtn];
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
    transportChildren.push(vPlay, vFrom, vStop, vSlow, vShadow);
    if (canPractice) {
      const vBar = el("button", { class: CLS.btn, type: "button", text: "🌊", title: "Practice bar: loop a slice of this line (L), nudge edges ([ ]), slow it" });
      practiceBtn = vBar;
      vBar.addEventListener("click", () => togglePracticeBar());
      transportChildren.push(vBar);
    }
  }
  panel.append(playerHost, el("div", { class: CLS.transport }, ...transportChildren));

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
  panel.append(sectionEl);
  const trEl = el("div", { class: CLS.translation });
  let showTr = opts.showTranslation ?? false;
  trEl.style.display = showTr ? "block" : "none";
  trBtn.classList.toggle(CLS.btnActive, showTr);
  panel.append(trEl);
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
      sectionTextEl.textContent = si >= 0 ? sections[si]!.summary : "";
      sectionTrEl.textContent = showTr && si >= 0 ? (sections[si]!.tr ?? "") : "";
    }
  }

  // ── voice notes (M1) ──────────────────────────────────────────────────────
  // The line in focus for voice actions: a manual selection (click / arrows) if
  // set, else the cue under the clock. Clamped to 0.
  function currentCue(): number {
    if (selectedCue !== null) return selectedCue;
    const i = cueIndexAtTime(cues, currentTime(), times);
    return i >= 0 ? i : 0;
  }

  // ── sentence navigation + video loop (M2.2) ───────────────────────────────
  let videoLooping = false;
  let loopCue = -1;
  let activeSection = -1; // the section under the focused line (for the 🔊)
  let sectionLooping = false; // the 🔄 commentary loop is running

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
    stopVoice(); // the video owns the speakers — no Serena chain/shadowing overlap
    playOneCue = i;
    playOneArmed = false; // arm only once the (async) seek lands inside the cue
    seek(times[i]!.start);
    setPlaying(true);
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
    // Video A/B loop: when the clock passes the pinned sentence's end, seek back.
    if (videoLooping && loopCue >= 0 && loopCue < times.length && shouldLoopBack(t, times[loopCue]!)) {
      seek(times[loopCue]!.start);
    } else if (playing && playOneCue >= 0 && playOneCue < times.length) {
      // One-shot sentence play (clicked a word): wait for the seek to land inside
      // the cue, then stop at its end so playback doesn't run on into the next.
      const bounds = times[playOneCue]!;
      if (!playOneArmed) {
        if (t >= bounds.start - 0.1 && t < bounds.end) playOneArmed = true;
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
      player?.destroy();
      voicePlayer?.stop();
      practiceBar?.destroy();
      for (const node of tokenEls) node?.classList.remove(CLS.cueActive);
      panel.remove();
    },
    togglePlay() {
      setPlaying(!playing);
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
      selectCue(currentCue() + 1);
    },
    prevCue() {
      selectCue(currentCue() - 1);
    },
    toggleVideoLoop,
    isVideoLooping() {
      return videoLooping;
    },
  };
}
