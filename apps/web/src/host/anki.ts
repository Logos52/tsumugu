/**
 * Anki export host: builds an `.apkg` via the engine and downloads it in the
 * browser. The engine stays IO-free — it returns bytes; the host owns the
 * sql.js wasm asset URL and the file-save side effect.
 */

import { buildApkg, type AnkiDeck } from "@tsumugu/engine";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";

/**
 * Save `bytes` to disk as `filename` via a temporary object-URL anchor.
 * Client-side only: no network, no backend.
 */
export function downloadBytes(
  bytes: Uint8Array,
  filename: string,
  mime: string,
): void {
  // Copy into a fresh ArrayBuffer-backed view: TS's lib DOM types reject a
  // `Uint8Array<ArrayBufferLike>` (which may be SharedArrayBuffer-backed) as a
  // `BlobPart`, so a plain `ArrayBuffer` view satisfies the constructor.
  const part = new Uint8Array(bytes);
  const blob = new Blob([part.buffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Build an `.apkg` for `deck` and trigger a browser download. The engine
 * resolves the bundled sql.js wasm through the Vite-emitted asset URL.
 */
export async function exportAndDownloadApkg(
  deck: AnkiDeck,
  filename = "tsumugu.apkg",
): Promise<void> {
  const bytes = await buildApkg(deck, { locateFile: () => sqlWasmUrl });
  downloadBytes(bytes, filename, "application/octet-stream");
}
