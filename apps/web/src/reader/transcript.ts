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
  const transportChildren: (HTMLElement | null)[] = [playBtn, scrubber, timeLabel];
  if (voicePlayer) {
    const vPlay = el("button", { class: CLS.btn, type: "button", text: "🔊", title: "Play this line's voice note" });
    const vFrom = el("button", { class: CLS.btn, type: "button", text: "⏩", title: "Play voice notes from here" });
    const vStop = el("button", { class: CLS.btn, type: "button", text: "⏹", title: "Stop voice" });
    const vSlow = el("button", { class: CLS.btn, type: "button", text: "🐢", title: "Slow voice (slow take, else 0.85×)" });
    if (slow) vSlow.classList.add(CLS.btnActive);
    const vShadow = el("button", { class: CLS.btn, type: "button", text: "跟讀", title: "Shadowing: hear → repeat → Space to advance (Esc exits)" });
    shadowBtn = vShadow;
    vPlay.addEventListener("click", () => playCurrentCueVoice());
    vFrom.addEventListener("click", () => playFromCurrentVoice());
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
  pPlay.addEventListener("click", () => practiceBar?.playPause());
  pLoop.addEventListener("click", () => practiceToggleLoop());
  pSpeed.addEventListener("click", () => {
    const r = practiceBar?.cycleSpeed();
    if (r) pSpeed.textContent = `${r}×`;
  });
  panel.append(practicePanel);
  // "Now talking about…" — the active section's summary (shown when present).
  const sectionEl = el("div", { class: CLS.section });
  if (sections.length === 0) sectionEl.style.display = "none";
  panel.append(sectionEl);
  const trEl = el("div", { class: CLS.translation });
  let showTr = opts.showTranslation ?? false;
  trEl.style.display = showTr ? "block" : "none";
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
    playBtn.textContent = on ? "⏸" : "▶";
    if (player) {
      if (on) player.play();
      else player.pause();
    }
    lastFrameMs = null;
  }

  playBtn.addEventListener("click", () => setPlaying(!playing));
  scrubber.addEventListener("input", () => {
    const t = Number(scrubber.value);
    if (player) player.seekTo(t);
    else localTime = t;
    paint(t);
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
  }

  function paint(t: number): void {
    // While voice playback drives the highlight, the clock yields it (so a
    // paused video/scrubber doesn't snap the highlight back).
    if (!voiceHighlight) highlightCue(cueIndexAtTime(cues, t, times));
    if (document.activeElement !== scrubber) scrubber.value = String(t);
    timeLabel.textContent = `${fmt(t)} / ${fmt(duration)}`;
    if (showTr) trEl.textContent = lastCue >= 0 ? (cues[lastCue]?.tr ?? "— (no translation yet)") : "";
    if (sections.length) {
      const si = cueIndexAtTime(sections, t, sectionTimes);
      sectionEl.textContent = si >= 0 ? sections[si]!.summary : "";
    }
  }

  // ── voice notes (M1) ──────────────────────────────────────────────────────
  // The cue under the current time (the highlighted line), clamped to 0.
  function currentCue(): number {
    const i = cueIndexAtTime(cues, currentTime(), times);
    return i >= 0 ? i : 0;
  }

  // ── practice bar (M2.1) ───────────────────────────────────────────────────
  let practiceBar: PracticeBar | null = null;
  let practiceOpen = false;

  function updateLoopBtn(): void {
    pLoop.classList.toggle(CLS.btnActive, !!practiceBar?.isLooping());
  }

  async function openPracticeBar(): Promise<void> {
    if (practiceOpen || !canPractice) return;
    practiceOpen = true;
    practiceBtn?.classList.add(CLS.btnActive);
    practicePanel.style.display = "block";
    pSpeed.textContent = "1×";
    pLoop.classList.remove(CLS.btnActive);
    clear(waveHost);
    // Voice owns the audio: stop the video + any cue playback so they don't overlap.
    pauseVideoForVoice();
    voicePlayer?.stop();
    const pinnedCue = currentCue();
    try {
      practiceBar = await practiceFactory({ container: waveHost, vault: vault!, binding: voiceNotes!, cueIndex: pinnedCue });
    } catch {
      practiceBar = null;
    }
    if (!practiceBar && practiceOpen) closePracticeBar(); // nothing to drill (no audio)
  }

  function closePracticeBar(): void {
    practiceOpen = false;
    practiceBtn?.classList.remove(CLS.btnActive);
    practicePanel.style.display = "none";
    practiceBar?.destroy();
    practiceBar = null;
    clear(waveHost);
  }

  function togglePracticeBar(): void {
    if (practiceOpen) closePracticeBar();
    else void openPracticeBar();
  }

  function practiceToggleLoop(): void {
    practiceBar?.toggleLoop();
    updateLoopBtn();
  }

  function practiceNudge(dir: -1 | 1): void {
    practiceBar?.nudge(dir);
  }

  function updateShadowBtn(): void {
    shadowBtn?.classList.toggle(CLS.btnActive, shadowActive(shadow));
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
    // highlight back to the clock — also clears a leftover playFrom suppression.
    voiceHighlight = false;
    voicePlayer.playCue(currentCue(), { slow });
  }

  function playFromCurrentVoice(): void {
    if (!voicePlayer) return;
    if (shadowActive(shadow)) dispatchShadow({ type: "exit" });
    pauseVideoForVoice();
    voiceHighlight = true;
    voicePlayer.playFrom(currentCue(), {
      slow,
      onAdvance: (i) => highlightCue(i),
      onDone: () => {
        voiceHighlight = false;
      },
    });
  }

  function stopVoice(): void {
    voicePlayer?.stop();
    voiceHighlight = false;
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
    paint(currentTime());
    raf = schedule(frame);
  }
  raf = schedule(frame);

  return {
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      player?.destroy();
      voicePlayer?.stop();
      closePracticeBar();
      for (const node of tokenEls) node?.classList.remove(CLS.cueActive);
      panel.remove();
    },
    togglePlay() {
      setPlaying(!playing);
    },
    setTranslationVisible(on: boolean) {
      showTr = on;
      trEl.style.display = on ? "block" : "none";
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
      return practiceOpen;
    },
    practiceToggleLoop,
    practiceNudge,
    practiceCloseBar() {
      closePracticeBar();
    },
  };
}
