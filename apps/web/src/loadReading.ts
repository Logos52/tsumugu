/**
 * Open an ingested reading (M4 glue). `gen transcript` writes a
 * `.prepared.json` (the reader content) and a `.cues.json` sidecar (timestamps
 * + an optional `videoId`). This loads one or both — selected from disk — into
 * a reader session: content + an optional synced transcript.
 *
 * The classification is a pure function (testable); the File reading is a thin
 * browser wrapper around it.
 */

import type { PreparedContent } from "@tsumugu/engine";

import type { TranscriptCue, TranscriptDoc } from "./reader/sync.js";

export interface ReadingPayload {
  content?: PreparedContent;
  transcript?: TranscriptDoc;
}

/** Classify already-parsed JSON docs into reader content + a transcript by schema. */
export function classifyReadingDocs(docs: readonly unknown[]): ReadingPayload {
  const out: ReadingPayload = {};
  for (const d of docs) {
    if (!d || typeof d !== "object") continue;
    const o = d as Record<string, unknown>;
    if (o.schema === "tsumugu/prepared-content@1" && Array.isArray(o.tokens)) {
      out.content = d as PreparedContent;
    } else if (o.schema === "tsumugu/transcript-cues@1" && Array.isArray(o.cues)) {
      const cues = o.cues as TranscriptCue[];
      const videoId = typeof o.videoId === "string" ? o.videoId : undefined;
      out.transcript = videoId ? { cues, videoId } : { cues };
    }
  }
  return out;
}

/** Read + parse selected JSON files, then classify them. Skips non-JSON files. */
export async function readReadingFiles(files: readonly File[]): Promise<ReadingPayload> {
  const docs: unknown[] = [];
  for (const file of files) {
    try {
      docs.push(JSON.parse(await file.text()));
    } catch {
      // Not JSON / unreadable — ignore; classification reports what it found.
    }
  }
  return classifyReadingDocs(docs);
}
