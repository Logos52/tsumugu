/**
 * Transcript synced-reader panel (M4, PRD §7) — "a reader with a synced player".
 *
 * Mounts a player/scrubber above the reader text and highlights the cue that is
 * playing in Tsumugu's OWN rendered tokens. The time source is the sanctioned
 * YouTube IFrame when the transcript carries a videoId, else a local scrubber —
 * so the sync experience works fully offline with zero ToS surface. Only mounted
 * when content has a bound transcript; plain reading is untouched.
 */

import type { PreparedToken } from "@tsumugu/engine";

import { el } from "../ui/dom.js";
import { CLS } from "../ui/classes.js";
import {
  alignCuesToTokens,
  cueIndexAtTime,
  cueTimes,
  type TranscriptDoc,
} from "./sync.js";
import { createYouTubePlayer, type VideoPlayer } from "./youtube.js";

export interface TranscriptController {
  destroy(): void;
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
}): TranscriptController {
  const { host, tokens, transcript, tokenEls } = opts;
  const cues = transcript.cues;
  const ranges = alignCuesToTokens(tokens, cues);
  const times = cueTimes(cues);
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
  panel.append(playerHost, el("div", { class: CLS.transport }, playBtn, scrubber, timeLabel));
  host.prepend(panel);
  // With a real video, lay the player out beside the text (sticky left column);
  // scrubber-only transcripts keep the thin bar on top.
  if (transcript.videoId) host.classList.add("tsg-reader-split");

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
    highlightCue(cueIndexAtTime(cues, t, times));
    if (document.activeElement !== scrubber) scrubber.value = String(t);
    timeLabel.textContent = `${fmt(t)} / ${fmt(duration)}`;
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
      for (const node of tokenEls) node?.classList.remove(CLS.cueActive);
      host.classList.remove("tsg-reader-split");
      panel.remove();
    },
  };
}
