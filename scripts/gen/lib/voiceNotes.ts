/**
 * `gen voice-notes` orchestration — pure, unit-tested logic only.
 *
 * Everything here is side-effect-free and deterministic: cue selection, slow-take
 * selection, the incremental render plan, worker/ffmpeg argument construction, and
 * manifest build/merge/validate. The CLI (`scripts/gen/cli.ts`) wraps these with
 * the actual IO — spawning the Python worker and `ffmpeg`, reading/writing files.
 *
 * The voice-notes manifest (`<slug>.voice-notes.json`, schema
 * `tsumugu/voice-notes@1`) is a separate sidecar beside the `.cues.json`; audio
 * paths are relative to the manifest's OWN directory (e.g. `audio/<slug>/cue-0000.mp3`).
 */

/** The only field of a transcript cue this helper needs. */
export interface VoiceCue {
  text: string;
}

/** One manifest entry: the audio for a cue (+ an optional slow take). */
export interface VoiceNote {
  cueIndex: number;
  /** mp3 path relative to the manifest's directory. */
  audio: string;
  /** Optional instruct-rendered slow take, same relative-path convention. */
  audioSlow?: string;
}

/** The `tsumugu/voice-notes@1` sidecar. */
export interface VoiceNotesManifest {
  schema: typeof VOICE_NOTES_SCHEMA;
  lang: string;
  slug: string;
  engine: string;
  voice: string;
  generatedAt?: string;
  notes: VoiceNote[];
}

export const VOICE_NOTES_SCHEMA = "tsumugu/voice-notes@1" as const;
export const DEFAULT_MODEL = "mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-bf16";
export const DEFAULT_VOICE = "Serena";
export const DEFAULT_LANGUAGE = "Chinese";
/** PRD Decision Log phrasing for the instruct-driven slow take (tunable at build time). */
export const DEFAULT_SLOW_INSTRUCT = "語速放慢、咬字清晰";
/** mp3 encode settings: 96 kbps mono is plenty for speech and `[sound:]`-safe. */
export const MP3_BITRATE = "96k";

// ── slug + file naming ───────────────────────────────────────────────────────

/** Strip the cues-sidecar suffixes from a basename to get the reading slug. */
export function deriveSlug(cuesFileName: string): string {
  const base = cuesFileName.replace(/.*[/\\]/, "");
  return base
    .replace(/\.prepared\.cues\.json$/i, "")
    .replace(/\.cues\.json$/i, "")
    .replace(/\.json$/i, "");
}

/** `cue-0073.mp3` / `cue-0073.slow.mp3` (4-digit zero-pad, matching validation output). */
export function cueFileName(index: number, slow: boolean, ext = "mp3"): string {
  return `cue-${String(index).padStart(4, "0")}${slow ? ".slow" : ""}.${ext}`;
}

/** Audio path for a cue, relative to the manifest dir (e.g. `audio/<slug>/cue-0073.mp3`). */
export function audioRelPath(audioRelDir: string, index: number, slow: boolean, ext = "mp3"): string {
  const dir = audioRelDir.replace(/\/+$/, "");
  return `${dir}/${cueFileName(index, slow, ext)}`;
}

// ── cue selection ────────────────────────────────────────────────────────────

export interface CueSelection {
  /** First N cues (with non-empty text). */
  limit?: number;
  /** Explicit cue indices. */
  cues?: number[];
}

/**
 * The cue indices to act on: explicit `--cues` wins; else `--limit` takes the
 * first N; else all. Empty-text cues are always skipped (nothing to synthesize),
 * and out-of-range indices are dropped.
 */
export function selectCues(cues: readonly VoiceCue[], sel: CueSelection): number[] {
  const hasText = (i: number): boolean => !!cues[i] && cues[i]!.text.trim().length > 0;
  if (sel.cues && sel.cues.length > 0) {
    return sel.cues.filter((i) => i >= 0 && i < cues.length && hasText(i));
  }
  const all: number[] = [];
  for (let i = 0; i < cues.length; i++) if (hasText(i)) all.push(i);
  return sel.limit !== undefined ? all.slice(0, Math.max(0, sel.limit)) : all;
}

// ── slow-take selection ──────────────────────────────────────────────────────

export type SlowSpec =
  | { kind: "none" }
  | { kind: "all" }
  | { kind: "over"; n: number }
  | { kind: "cues"; set: Set<number> };

/** Parse `--slow all | over:30 | cues:73,647` (absent/empty → none). */
export function parseSlowSpec(raw: string | undefined): SlowSpec {
  if (!raw) return { kind: "none" };
  const v = raw.trim();
  if (v === "all") return { kind: "all" };
  const over = /^over:(\d+)$/.exec(v);
  if (over) return { kind: "over", n: Number(over[1]) };
  const cuesM = /^cues:(.+)$/.exec(v);
  if (cuesM) {
    const set = new Set(
      cuesM[1]!
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n)),
    );
    return { kind: "cues", set };
  }
  throw new Error(`invalid --slow "${raw}" (use: all | over:N | cues:a,b)`);
}

/** Of the selected cues, the subset that should ALSO get a slow take. */
export function slowSelection(
  cues: readonly VoiceCue[],
  selected: readonly number[],
  spec: SlowSpec,
): Set<number> {
  if (spec.kind === "none") return new Set();
  const out = new Set<number>();
  for (const i of selected) {
    const text = cues[i]?.text.trim() ?? "";
    if (!text) continue;
    if (spec.kind === "all") out.add(i);
    else if (spec.kind === "over" && [...text].length >= spec.n) out.add(i);
    else if (spec.kind === "cues" && spec.set.has(i)) out.add(i);
  }
  return out;
}

// ── render plan (incremental) ────────────────────────────────────────────────

/** Per-cue plan: target audio paths + whether each take needs (re)rendering. */
export interface CuePlan {
  index: number;
  text: string;
  /** mp3 path relative to the manifest dir. */
  audio: string;
  /** slow mp3 relative path, present iff a slow take is wanted for this cue. */
  audioSlow?: string;
  /** False when `audio` already exists and `--force` is off. */
  renderNatural: boolean;
  /** False when no slow take, or the slow mp3 already exists and `--force` is off. */
  renderSlow: boolean;
}

export interface PlanWorkOpts {
  cues: readonly VoiceCue[];
  selected: readonly number[];
  slowSet: Set<number>;
  /** Audio output dir relative to the manifest dir (e.g. `audio/<slug>`). */
  audioRelDir: string;
  /** Relative audio paths already on disk (skip these unless force). */
  existing: ReadonlySet<string>;
  force: boolean;
}

/** Build the per-cue render plan, honoring incremental skip. Pure. */
export function planWork(opts: PlanWorkOpts): CuePlan[] {
  const { cues, selected, slowSet, audioRelDir, existing, force } = opts;
  const plans: CuePlan[] = [];
  for (const index of selected) {
    const text = cues[index]?.text.trim() ?? "";
    if (!text) continue;
    const audio = audioRelPath(audioRelDir, index, false);
    const wantSlow = slowSet.has(index);
    const audioSlow = wantSlow ? audioRelPath(audioRelDir, index, true) : undefined;
    const plan: CuePlan = {
      index,
      text,
      audio,
      renderNatural: force || !existing.has(audio),
      renderSlow: wantSlow && (force || !existing.has(audioSlow!)),
    };
    if (audioSlow) plan.audioSlow = audioSlow;
    plans.push(plan);
  }
  return plans;
}

// ── worker job + ffmpeg args ─────────────────────────────────────────────────

export interface WorkerItem {
  index: number;
  text: string;
  /** null → natural take; string → instruct-driven (slow) take. */
  instruct: string | null;
  /** Absolute wav path the worker writes. */
  outWav: string;
}

export interface WorkerJob {
  model: string;
  voice: string;
  language: string;
  items: WorkerItem[];
}

export interface BuildJobOpts {
  model: string;
  voice: string;
  language: string;
  slowInstruct: string;
  /** Absolute wav directory the worker renders into (mp3 encode happens TS-side). */
  wavDir: string;
}

/**
 * Worker items for everything the plan says to render: one natural item per cue
 * needing it, plus one instruct item per cue needing a slow take. Skipped takes
 * produce no items (incremental).
 */
export function buildWorkerJob(plans: readonly CuePlan[], opts: BuildJobOpts): WorkerJob {
  const sep = opts.wavDir.replace(/\/+$/, "");
  const items: WorkerItem[] = [];
  for (const p of plans) {
    if (p.renderNatural) {
      items.push({ index: p.index, text: p.text, instruct: null, outWav: `${sep}/${cueFileName(p.index, false, "wav")}` });
    }
    if (p.renderSlow) {
      items.push({ index: p.index, text: p.text, instruct: opts.slowInstruct, outWav: `${sep}/${cueFileName(p.index, true, "wav")}` });
    }
  }
  return { model: opts.model, voice: opts.voice, language: opts.language, items };
}

/** ffmpeg args to encode one wav → mono mp3 at {@link MP3_BITRATE}, overwriting. */
export function ffmpegArgs(wavPath: string, mp3Path: string, bitrate = MP3_BITRATE): string[] {
  return ["-loglevel", "error", "-y", "-i", wavPath, "-ac", "1", "-b:a", bitrate, mp3Path];
}

// ── worker report (stdout contract; sentinels match the Python worker) ────────

export const WORKER_REPORT_BEGIN = "<<<VOICE_NOTES_REPORT>>>";
export const WORKER_REPORT_END = "<<<END_VOICE_NOTES_REPORT>>>";

export interface WorkerReportItem {
  index: number;
  outWav: string;
  ok: boolean;
  durationSec?: number;
  genSec?: number;
  sampleRate?: number;
  error?: string;
}

export interface WorkerReport {
  model: string;
  voice: string;
  items: WorkerReportItem[];
}

// ── manifest build / merge / validate ────────────────────────────────────────

export interface BuildManifestOpts {
  existing?: VoiceNotesManifest | null;
  slug: string;
  lang: string;
  engine: string;
  voice: string;
  generatedAt: string;
  /** Notes for the cues rendered/confirmed in THIS run. */
  notes: VoiceNote[];
}

/**
 * Merge this run's notes into any existing manifest, preserving entries for cues
 * NOT touched this run, and keeping notes sorted by `cueIndex`. Top-level
 * provenance (engine/voice/generatedAt) is refreshed to this run's values.
 */
export function buildManifest(opts: BuildManifestOpts): VoiceNotesManifest {
  const byIndex = new Map<number, VoiceNote>();
  for (const n of opts.existing?.notes ?? []) byIndex.set(n.cueIndex, n);
  for (const n of opts.notes) byIndex.set(n.cueIndex, n);
  const notes = [...byIndex.values()].sort((a, b) => a.cueIndex - b.cueIndex);
  return {
    schema: VOICE_NOTES_SCHEMA,
    lang: opts.lang,
    slug: opts.slug,
    engine: opts.engine,
    voice: opts.voice,
    generatedAt: opts.generatedAt,
    notes,
  };
}

/** A note for a cue, including `audioSlow` only when a slow take exists. */
export function makeNote(cueIndex: number, audio: string, audioSlow?: string): VoiceNote {
  return audioSlow ? { cueIndex, audio, audioSlow } : { cueIndex, audio };
}

export interface ValidationResult {
  ok: boolean;
  missing: string[];
}

/**
 * Every audio/audioSlow path referenced by the manifest must exist on disk.
 * `existing` is the set of relative paths known to be present (built by the CLI).
 */
export function validateManifest(
  manifest: VoiceNotesManifest,
  existing: ReadonlySet<string>,
): ValidationResult {
  const missing: string[] = [];
  for (const n of manifest.notes) {
    if (!existing.has(n.audio)) missing.push(n.audio);
    if (n.audioSlow && !existing.has(n.audioSlow)) missing.push(n.audioSlow);
  }
  return { ok: missing.length === 0, missing };
}
