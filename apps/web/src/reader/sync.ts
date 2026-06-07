/**
 * Transcript ↔ reader sync (PRD §7; the "reader with a synced player").
 *
 * Pure, DOM-free helpers that map a transcript's timed cues onto the reader's
 * flat token stream, so the reader can highlight the line that is playing —
 * driven by ANY time source (a sanctioned YouTube IFrame, or a local scrubber).
 * No code ever runs on a streaming site; we only consume our own ingested cues.
 */

import type { PreparedToken } from "@tsumugu/engine";

/** One timed cue from a `tsumugu/transcript-cues@1` sidecar. */
export interface TranscriptCue {
  text: string;
  /** "HH:MM:SS,mmm" / "HH:MM:SS.mmm" (also tolerates "MM:SS" / "SS.mmm"). */
  start: string;
  end: string;
  /** Optional pre-baked sentence translation (revealed on demand). */
  tr?: string;
  /** Optional speaker label (e.g. "A"/"B" for a 甲/乙 dialogue) — drives per-speaker voice. */
  speaker?: string;
}

/** A topical section of the transcript — a coarse time range with a summary. */
export interface TranscriptSection {
  start: string;
  end: string;
  title?: string;
  /** A short "what's being talked about here" summary (in the reading's language). */
  summary: string;
  /** Optional translation of the summary (revealed on the `譯` toggle). */
  tr?: string;
}

/** An ingested transcript bound to the current content, with an optional video. */
export interface TranscriptDoc {
  cues: TranscriptCue[];
  /** 11-char YouTube id; when present the panel embeds the sanctioned IFrame. */
  videoId?: string;
  /** Optional topical sections (for the "now talking about…" summary). */
  sections?: TranscriptSection[];
}

/** A cue mapped to a contiguous token range `[startToken, endToken)`. */
export interface CueRange {
  cueIndex: number;
  startToken: number;
  /** Exclusive. */
  endToken: number;
}

/** Strip all whitespace so cue text and token text compare regardless of spacing. */
function densify(s: string): string {
  return s.replace(/\s+/gu, "");
}

/**
 * Parse a subtitle timecode to seconds. Accepts `HH:MM:SS,mmm`, `HH:MM:SS.mmm`,
 * `MM:SS(.mmm)`, or a bare `SS(.mmm)`. A comma decimal (SRT) is normalized to a
 * dot. Unparseable parts contribute 0 rather than `NaN`-poisoning the result.
 */
export function parseTimecode(tc: string): number {
  const parts = tc.trim().replace(",", ".").split(":");
  let seconds = 0;
  for (const part of parts) {
    const n = Number(part);
    seconds = seconds * 60 + (Number.isFinite(n) ? n : 0);
  }
  return seconds;
}

/** Pre-parse start/end to seconds once, in order (cues OR sections). */
export function cueTimes(
  spans: readonly { start: string; end: string }[],
): { start: number; end: number }[] {
  return spans.map((c) => ({ start: parseTimecode(c.start), end: parseTimecode(c.end) }));
}

/**
 * Whether the video/clock has passed the loop region's end and should seek back
 * to its start (the A/B "loop this sentence" check). Pure.
 */
export function shouldLoopBack(t: number, bounds: { start: number; end: number }): boolean {
  return t >= bounds.end;
}

/**
 * Map a pointer x (px) over a timeline element to a time in seconds. Pure; the
 * A/B loop strip uses it. Clamps to [0, duration]. Returns 0 with no layout.
 */
export function timelineTime(clientX: number, left: number, width: number, duration: number): number {
  if (width <= 0) return 0;
  const f = Math.max(0, Math.min(1, (clientX - left) / width));
  return f * Math.max(0, duration);
}

/**
 * Snap a time to the nearest boundary (cue start/end), so the A/B loop locks to
 * sentence edges regardless of how precisely you drag. Pure. `t` unchanged when
 * there are no boundaries.
 */
export function snapToBoundary(t: number, boundaries: readonly number[]): number {
  let best: number | null = null;
  let bestDist = Infinity;
  for (const b of boundaries) {
    const d = Math.abs(t - b);
    if (d < bestDist) {
      best = b;
      bestDist = d;
    }
  }
  return best ?? t;
}

/**
 * Index of the cue active at `seconds` (`start ≤ t < end`), or -1 if none.
 * Scans in order and returns the first match; cues are expected non-overlapping.
 * Pass a precomputed {@link cueTimes} array as `times` to avoid re-parsing on a
 * per-frame poll.
 */
export function cueIndexAtTime(
  spans: readonly { start: string; end: string }[],
  seconds: number,
  times: { start: number; end: number }[] = cueTimes(spans),
): number {
  for (let i = 0; i < times.length; i++) {
    const t = times[i]!;
    if (seconds >= t.start && seconds < t.end) return i;
  }
  return -1;
}

/**
 * Map each cue to the contiguous run of `tokens` whose text makes it up.
 *
 * Transcript cues partition the reading in order, so we walk the token stream
 * with a single cursor and assign tokens to each cue until the cue's
 * whitespace-stripped text is covered. Whitespace/newline tokens contribute no
 * characters and are absorbed into the cue currently consuming. Every cue gets
 * a range (possibly empty); tokens past the last cue are left unassigned.
 */
export function alignCuesToTokens(
  tokens: readonly PreparedToken[],
  cues: readonly TranscriptCue[],
): CueRange[] {
  const ranges: CueRange[] = [];
  const n = tokens.length;
  let cursor = 0;

  for (let ci = 0; ci < cues.length; ci++) {
    const target = densify(cues[ci]!.text);
    const startToken = cursor;
    let acc = 0;
    // Consume tokens until we've covered the cue's character count. Always take
    // at least the leading zero-width (whitespace) tokens so they don't strand.
    while (cursor < n && (acc < target.length || densify(tokens[cursor]!.text).length === 0)) {
      const len = densify(tokens[cursor]!.text).length;
      if (acc >= target.length && len > 0) break; // next cue's first real token
      acc += len;
      cursor++;
    }
    ranges.push({ cueIndex: ci, startToken, endToken: cursor });
  }
  return ranges;
}
