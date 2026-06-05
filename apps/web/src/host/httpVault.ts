/**
 * Dev-server vault (local convenience). Reads/writes the word store over the
 * `/@vault/` HTTP bridge the Vite dev plugin serves from a real folder, so the
 * app auto-loads on page-load (no File System Access click) and grades persist.
 * Only available under `pnpm dev`; the production build falls back to the File
 * System Access vault (`pickVaultFolder`).
 */

import type { VaultIO } from "@tsumugu/engine";

const BASE = "/@vault/";

const url = (base: string, path: string): string =>
  base + path.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/");

/** A VaultIO backed by the dev server's `/@vault/` bridge. */
export function createHttpVault(base = BASE): VaultIO {
  return {
    async readText(path: string): Promise<string | null> {
      const r = await fetch(url(base, path));
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`vault read ${path}: ${r.status}`);
      return r.text();
    },
    async writeText(path: string, data: string): Promise<void> {
      const r = await fetch(url(base, path), {
        method: "PUT",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: data,
      });
      if (!r.ok) throw new Error(`vault write ${path}: ${r.status}`);
    },
  };
}

/** Whether the dev-server vault bridge is present (true only under `vite dev`). */
export async function devVaultAvailable(base = BASE): Promise<boolean> {
  try {
    const r = await fetch(base + "__ping");
    return r.headers.get("x-tsumugu-vault") === "1";
  } catch {
    return false;
  }
}

/** A `*.prepared.json` reading discovered in the dev vault. */
export interface VaultReading {
  path: string;
  lang?: string;
  title?: string;
}

/** List the prepared readings under the dev vault (empty if unavailable). */
export async function listVaultReadings(base = BASE): Promise<VaultReading[]> {
  try {
    const r = await fetch(base + "__readings");
    if (!r.ok) return [];
    return (await r.json()) as VaultReading[];
  } catch {
    return [];
  }
}
