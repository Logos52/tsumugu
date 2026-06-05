/**
 * AppState — the web app's single source of truth and the locked contract that
 * the reader view, review view, and host adapters all build against.
 *
 * Framework-free and testable: construct with an in-memory store + fake ports
 * in tests, or with the File System Access vault + Web Speech audio in the app.
 */

import {
  WordStore,
  progressMetrics,
  systemClock,
  type LanguagePack,
  type PreparedContent,
  type WordStatus,
  type WordEntry,
  type VaultIO,
  type AudioPort,
  type Clock,
  type ProgressMetrics,
  type ResolvedHover,
  type DictEntry,
  type PrebakedEntry,
} from "@tsumugu/engine";

import type { TranscriptDoc } from "./reader/sync.js";

/** Reader/review display preferences. */
export interface AppSettings {
  /** Explanation language for hover/wiki: target-monolingual default. */
  explanationLang: "target" | "en" | (string & {});
  /** zh tone coloring toggle (separate from status coloring; off by default). */
  toneColoring: boolean;
  /** Zhuyin/bopomofo ruby above each word (Migaku-style); off by default. */
  phonetics: boolean;
  /** Guess-first: hide the gloss until the user asks to reveal. */
  guessFirst: boolean;
  /** Path of the word-store JSON inside the granted vault folder. */
  storePath: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  explanationLang: "target",
  toneColoring: false,
  phonetics: false,
  guessFirst: false,
  storePath: "tsumugu/word-store.json",
};

export type AppMode = "reader" | "review";

/** A mounted view; call `unmount()` to tear it down and detach listeners. */
export interface ViewController {
  unmount(): void;
}

/**
 * View entry points the host wires up. Implementations live in:
 *   reader/reader.ts → `mountReader(root, app): ViewController`
 *   review/review.ts → `mountReview(root, app): ViewController`
 */
export type MountView = (root: HTMLElement, app: AppState) => ViewController;

type EventName = "change" | "modechange" | "status";
type Handler = (payload: unknown) => void;

/** App-wide reactive state + actions. DOM-free (hosts/views render). */
export class AppState {
  store: WordStore;
  pack: LanguagePack;
  content: PreparedContent | null;
  /** Optional timed transcript bound to the current content (synced-reader). */
  transcript: TranscriptDoc | null;
  settings: AppSettings;
  vault: VaultIO | null;
  audio: AudioPort | null;
  clock: Clock;
  mode: AppMode = "reader";

  private readonly listeners = new Map<EventName, Set<Handler>>();

  constructor(opts: {
    pack: LanguagePack;
    store?: WordStore;
    content?: PreparedContent | null;
    transcript?: TranscriptDoc | null;
    settings?: Partial<AppSettings>;
    vault?: VaultIO | null;
    audio?: AudioPort | null;
    clock?: Clock;
  }) {
    this.pack = opts.pack;
    this.store = opts.store ?? new WordStore();
    this.content = opts.content ?? null;
    this.transcript = opts.transcript ?? null;
    this.settings = { ...DEFAULT_SETTINGS, ...opts.settings };
    this.vault = opts.vault ?? null;
    this.audio = opts.audio ?? null;
    this.clock = opts.clock ?? systemClock;
    // Record the initial content's words as seen, matching setContent() so the
    // first-loaded sample is tracked like every subsequently picked one (no
    // startup `known 0/0` while words are on screen). Safe: no listeners are
    // attached yet, so the "change" emit inside recordContentSeen is a no-op.
    this.recordContentSeen();
  }

  /** Active language id (the content's language, else the pack's id). */
  get lang(): string {
    return this.content?.lang ?? this.pack.id;
  }

  // ── reads ────────────────────────────────────────────────────────────────

  getStatus(word: string): WordStatus {
    return this.store.getStatus(this.lang, word);
  }

  getEntry(word: string): WordEntry | undefined {
    return this.store.get(this.lang, word);
  }

  metrics(): ProgressMetrics {
    return progressMetrics(this.store, this.lang);
  }

  // ── mutations (emit "change"; persistence is host-gated) ──────────────────

  /** Set a word's status (grading) and persist. */
  gradeWord(word: string, status: WordStatus): void {
    this.store.setStatus(this.lang, word, status, this.clock);
    this.emit("change");
    void this.saveStore();
  }

  /** Flag a word/line for the next batch generation run. */
  flagWord(word: string, note?: string): void {
    this.store.flag(this.lang, word, note);
    this.emit("change");
    void this.saveStore();
  }

  unflagWord(word: string): void {
    this.store.unflag(this.lang, word);
    this.emit("change");
    void this.saveStore();
  }

  /** Record that the words of the current content were encountered. */
  recordContentSeen(): void {
    if (!this.content) return;
    for (const t of this.content.tokens) {
      if (t.isWord) this.store.recordSeen(this.lang, t.text, this.clock);
    }
    this.emit("change");
  }

  setContent(content: PreparedContent | null): void {
    this.content = content;
    // New content drops any prior transcript binding; callers re-attach via
    // setTranscript() if the new content has one.
    this.transcript = null;
    this.recordContentSeen();
    this.emit("change");
  }

  /** Bind (or clear) a timed transcript for the synced-reader (M4). */
  setTranscript(transcript: TranscriptDoc | null): void {
    this.transcript = transcript;
    this.emit("change");
  }

  setMode(mode: AppMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.emit("modechange", mode);
  }

  updateSettings(patch: Partial<AppSettings>): void {
    this.settings = { ...this.settings, ...patch };
    this.emit("change");
  }

  // ── persistence (writes only with a granted vault; host confirms) ─────────

  setVault(vault: VaultIO | null): void {
    this.vault = vault;
  }

  async loadStore(): Promise<void> {
    if (!this.vault) return;
    await this.store.load(this.vault, this.settings.storePath);
    this.emit("change");
  }

  async saveStore(): Promise<void> {
    if (!this.vault) return;
    await this.store.save(this.vault, this.settings.storePath, this.clock);
  }

  // ── audio ─────────────────────────────────────────────────────────────────

  speak(text: string): void {
    this.audio?.speak(text, this.pack.ttsVoice);
  }

  // ── events ────────────────────────────────────────────────────────────────

  on(evt: EventName, handler: Handler): () => void {
    let set = this.listeners.get(evt);
    if (!set) {
      set = new Set();
      this.listeners.set(evt, set);
    }
    set.add(handler);
    return () => set!.delete(handler);
  }

  emit(evt: EventName, payload?: unknown): void {
    const set = this.listeners.get(evt);
    if (!set) return;
    for (const h of [...set]) h(payload);
  }

  setStatusMessage(msg: string): void {
    this.emit("status", msg);
  }
}

// Re-export the engine hover types the views need, so view modules import them
// from one place.
export type { ResolvedHover, DictEntry, PrebakedEntry };
