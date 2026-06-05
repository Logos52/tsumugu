/**
 * Transcript ingestion (PRD §5, §11 Phase 7) — text-first, NO audio STT.
 *
 * Parse a subtitle / caption paste (SRT, VTT, a YouTube transcript paste, or
 * plain text) into deduped, tag-stripped cues, then hand the cue text to
 * `buildSkeleton` so the same offline prep loop (segment → find unknowns →
 * empty glossary slots) applies. The cue timestamps are kept separately (a
 * `.cues.json` sidecar) so the reader can sync without polluting the tokens.
 *
 * The cues' texts are joined by "\n" (one cue per line). The pack segmenter
 * tiles that whitespace as `isWord:false` tokens, so the reader keeps the line
 * structure of the transcript.
 */
import { buildSkeleton } from "./skeleton.js";
import type {
  LanguagePack,
  WordStore,
  PreparedContent,
  KnownPolicy,
} from "@tsumugu/engine";

export type TranscriptFormat = "srt" | "vtt" | "youtube" | "plain" | "auto";

export interface Cue {
  text: string;
  start?: string;
  end?: string;
}

export interface TranscriptParse {
  cues: Cue[];
  text: string;
}

/** A timecode token: SRT `00:00:01,000`, VTT `00:00:01.000`, or YouTube `M:SS`/`H:MM:SS`. */
const TIMECODE = String.raw`\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?`;
const VTT_ARROW = new RegExp(`^(${TIMECODE})\\s*-->\\s*(${TIMECODE})`);
const YT_LEADING = new RegExp(`^(${TIMECODE})(?:\\s+(.*))?$`);

/**
 * Strip HTML / VTT inline tags and inline timestamp tags, then collapse all
 * runs of whitespace (incl. newlines from multi-line cues) to single spaces.
 */
function cleanText(s: string): string {
  return s
    .replace(/<[^>]*>/g, "") // <c>, <i>, <00:00:01.000>, </c>, …
    .replace(/\s+/g, " ")
    .trim();
}

function detectFormat(raw: string): Exclude<TranscriptFormat, "auto"> {
  const trimmed = raw.trimStart();
  if (/^WEBVTT/.test(trimmed)) return "vtt";
  if (VTT_ARROW.test(trimmed) || new RegExp(`^\\d+\\s*\\r?\\n\\s*${TIMECODE}\\s*-->`).test(trimmed)) {
    return "srt";
  }
  // A `-->` cue arrow anywhere → treat as VTT-style timing.
  if (/-->/.test(raw)) return "vtt";
  // Any line that is (or starts with) a bare timecode → YouTube-style paste.
  const lines = raw.split(/\r?\n/);
  if (lines.some((l) => YT_LEADING.test(l.trim()) && /\d:\d{2}/.test(l.trim()))) return "youtube";
  return "plain";
}

function parseVtt(raw: string): Cue[] {
  const cues: Cue[] = [];
  // Cues are separated by blank lines. Drop the WEBVTT header + NOTE/STYLE/REGION blocks.
  const blocks = raw.replace(/^﻿/, "").split(/\r?\n\r?\n/);
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((l) => l.replace(/\r$/, ""));
    if (lines.length === 0) continue;
    if (/^WEBVTT/.test(lines[0]!.trim())) continue;
    if (/^(NOTE|STYLE|REGION)\b/.test(lines[0]!.trim())) continue;

    let i = 0;
    // Optional cue identifier line (no arrow) precedes the timing line.
    if (i < lines.length && !VTT_ARROW.test(lines[i]!.trim())) i++;
    const timing = lines[i]?.trim();
    if (!timing) continue;
    const m = VTT_ARROW.exec(timing);
    if (!m) continue; // not a cue
    const start = m[1]!;
    const end = m[2]!;
    const text = cleanText(lines.slice(i + 1).join(" "));
    if (text) cues.push({ text, start, end });
  }
  return cues;
}

function parseSrt(raw: string): Cue[] {
  const cues: Cue[] = [];
  const blocks = raw.replace(/^﻿/, "").split(/\r?\n\r?\n/);
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((l) => l.replace(/\r$/, "")).filter((l, idx) => l.trim() !== "" || idx > 0);
    if (lines.length === 0) continue;
    let i = 0;
    // Optional numeric index line.
    if (/^\d+$/.test(lines[i]!.trim())) i++;
    const timing = lines[i]?.trim();
    if (!timing) continue;
    const m = VTT_ARROW.exec(timing);
    if (!m) continue;
    const start = m[1]!;
    const end = m[2]!;
    const text = cleanText(lines.slice(i + 1).join(" "));
    if (text) cues.push({ text, start, end });
  }
  return cues;
}

function parseYoutube(raw: string): Cue[] {
  const cues: Cue[] = [];
  const lines = raw.split(/\r?\n/).map((l) => l.replace(/\r$/, ""));
  let pendingStart: string | undefined;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = YT_LEADING.exec(line);
    const isTimecodeLeading = m !== null && /\d:\d{2}/.test(m[1]!);
    if (isTimecodeLeading) {
      const start = m![1]!;
      const rest = (m![2] ?? "").trim();
      if (rest) {
        // Timestamp prefixes the caption on one line.
        const text = cleanText(rest);
        if (text) cues.push({ text, start });
        pendingStart = undefined;
      } else {
        // Timestamp on its own line; the next text line belongs to it.
        pendingStart = start;
      }
    } else {
      const text = cleanText(line);
      if (!text) continue;
      const cue: Cue = { text };
      if (pendingStart !== undefined) cue.start = pendingStart;
      cues.push(cue);
      pendingStart = undefined;
    }
  }
  return cues;
}

function parsePlain(raw: string): Cue[] {
  return raw
    .split(/\r?\n/)
    .map((l) => cleanText(l))
    .filter((t) => t.length > 0)
    .map((text) => ({ text }));
}

/** Drop empty cues and any cue whose text repeats the previous cue's (auto-caption churn). */
function dedup(cues: Cue[]): Cue[] {
  const out: Cue[] = [];
  let prev: string | undefined;
  for (const cue of cues) {
    if (!cue.text) continue;
    if (cue.text === prev) continue;
    out.push(cue);
    prev = cue.text;
  }
  return out;
}

/**
 * Parse a raw transcript paste into deduped, tag-stripped cues + a line-broken
 * `text` (one cue per line) ready for `buildSkeleton`.
 */
export function parseTranscript(raw: string, format: TranscriptFormat = "auto"): TranscriptParse {
  const fmt = format === "auto" ? detectFormat(raw) : format;
  let cues: Cue[];
  switch (fmt) {
    case "vtt":
      cues = parseVtt(raw);
      break;
    case "srt":
      cues = parseSrt(raw);
      break;
    case "youtube":
      cues = parseYoutube(raw);
      break;
    case "plain":
      cues = parsePlain(raw);
      break;
  }
  cues = dedup(cues);
  const text = cues.map((c) => c.text).join("\n");
  return { cues, text };
}

/**
 * Extract an 11-char YouTube video id from a watch / youtu.be / embed / shorts
 * / live URL, or accept a bare id. Returns undefined for anything else (e.g. a
 * Netflix source), so the cues sidecar simply carries no videoId.
 */
export function parseYouTubeId(input: string | undefined): string | undefined {
  if (!input) return undefined;
  const s = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s; // already a bare id
  const v = /[?&]v=([A-Za-z0-9_-]{11})/.exec(s);
  if (v) return v[1];
  const path = /(?:youtu\.be\/|\/embed\/|\/shorts\/|\/live\/|\/v\/)([A-Za-z0-9_-]{11})/.exec(s);
  if (path) return path[1];
  return undefined;
}

export interface TranscriptSkeletonOptions {
  lang: string;
  pack: LanguagePack;
  store: WordStore;
  raw: string;
  format?: TranscriptFormat;
  title?: string;
  source?: string;
  ciTarget?: number;
  policy?: KnownPolicy;
}

export interface TranscriptSkeletonResult {
  content: PreparedContent;
  unknownWords: string[];
  cues: Cue[];
}

/**
 * Parse a transcript, then build the offline prep skeleton from its cue text.
 * The returned `content.tokens` include the "\n" cue separators as
 * `isWord:false` tokens, so the reader preserves line breaks; `cues` carries
 * the timestamps for a sidecar.
 */
export async function buildTranscriptSkeleton(
  opts: TranscriptSkeletonOptions,
): Promise<TranscriptSkeletonResult> {
  const parsed = parseTranscript(opts.raw, opts.format ?? "auto");
  const { content, unknownWords } = await buildSkeleton({
    lang: opts.lang,
    pack: opts.pack,
    store: opts.store,
    text: parsed.text,
    source: opts.source ?? "transcript",
    ...(opts.title !== undefined ? { title: opts.title } : {}),
    ...(opts.ciTarget !== undefined ? { ciTarget: opts.ciTarget } : {}),
    ...(opts.policy !== undefined ? { policy: opts.policy } : {}),
  });
  return { content, unknownWords, cues: parsed.cues };
}
