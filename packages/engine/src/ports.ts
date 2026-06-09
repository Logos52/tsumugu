/**
 * IO / platform ports — the engine never touches the DOM, network, or
 * filesystem directly. Hosts provide implementations:
 *   - web app  → File System Access API + Web Speech API
 *   - node CLI → fs/promises
 *   - tests    → in-memory
 *
 * This keeps the engine pure, portable (web app + scripts), and
 * enforces "local-file writes only on explicit confirm" at the host boundary
 * (PRD §6, §8).
 */

import type { TtsVoiceSpec } from "./pack.js";

/**
 * Abstract text persistence over a user-granted folder (the vault).
 * Paths are relative to the granted root, using "/" separators.
 */
export interface VaultIO {
  /** Read a UTF-8 text file, or null if it does not exist. */
  readText(path: string): Promise<string | null>;
  /**
   * Write a UTF-8 text file (creating parent dirs as needed). The host is
   * responsible for gating this behind the user's explicit confirm.
   */
  writeText(path: string, data: string): Promise<void>;
  /**
   * Read a binary file (e.g. a voice-note mp3/wav), or null if it does not
   * exist. Optional: hosts that only serve text omit it; consumers fall back.
   */
  readBytes?(path: string): Promise<Uint8Array | null>;
  /** List child entry names of a directory (non-recursive). */
  list?(dir: string): Promise<string[]>;
  /** Whether a path exists. */
  exists?(path: string): Promise<boolean>;
}

/** Read/write binary, for things like .apkg export. */
export interface BinaryIO {
  writeBytes(path: string, data: Uint8Array): Promise<void>;
  readBytes?(path: string): Promise<Uint8Array | null>;
}

/** Text-to-speech port (web app implements via Web Speech API). */
export interface AudioPort {
  speak(text: string, voice?: TtsVoiceSpec): void;
  stop?(): void;
}

/**
 * Clock port so scheduling/SRS is deterministic and testable. Defaults to
 * the system clock in hosts; tests inject a fixed clock.
 */
export interface Clock {
  now(): Date;
}

/** A real system clock. */
export const systemClock: Clock = {
  now: () => new Date(),
};
