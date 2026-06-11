/**
 * HTTP-backed vault: dev bridge (`/@vault/`) or static publish (`/vault/`).
 * Production builds ship readings under `public/vault/` (see `scripts/publish-public-vault.ts`).
 */

import type { VaultIO } from "@tsumugu/engine";

const DEV_BASE = "/@vault/";

const url = (base: string, path: string): string =>
  base + path.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/");

/** Published static vault root (respects Vite `base`, e.g. `/tsumugu/app/vault/`). */
export function staticVaultBase(): string {
  const base = import.meta.env.BASE_URL || "/";
  return base + (base.endsWith("/") ? "" : "/") + "vault/";
}

/** A VaultIO backed by HTTP fetch (dev bridge or static publish). */
export function createHttpVault(base = DEV_BASE): VaultIO {
  return {
    async readText(path: string): Promise<string | null> {
      const r = await fetch(url(base, path));
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`vault read ${path}: ${r.status}`);
      return r.text();
    },
    async readBytes(path: string): Promise<Uint8Array | null> {
      const r = await fetch(url(base, path));
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`vault read ${path}: ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
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

/** Whether the Vite dev-server vault bridge is present. */
export async function devVaultAvailable(base = DEV_BASE): Promise<boolean> {
  try {
    const r = await fetch(base + "__ping");
    return r.headers.get("x-tsumugu-vault") === "1";
  } catch {
    return false;
  }
}

/** Whether a static published vault is present (production GitHub Pages). */
export async function staticVaultAvailable(base = staticVaultBase()): Promise<boolean> {
  try {
    const r = await fetch(url(base, "__readings.json"));
    return r.ok;
  } catch {
    return false;
  }
}

/** A `*.prepared.json` reading discovered in a vault. */
export interface VaultReading {
  path: string;
  lang?: string;
  title?: string;
  kind?: "youtube" | "gsm-dialogue" | "gsm-rewrite" | "other";
}

/** List prepared readings (dev `__readings` or static `__readings.json`). */
export async function listVaultReadings(vaultBase = DEV_BASE): Promise<VaultReading[]> {
  try {
    if (vaultBase === DEV_BASE && (await devVaultAvailable())) {
      const r = await fetch(DEV_BASE + "__readings");
      if (!r.ok) return [];
      return (await r.json()) as VaultReading[];
    }
    const r = await fetch(url(vaultBase === DEV_BASE ? staticVaultBase() : vaultBase, "__readings.json"));
    if (!r.ok) return [];
    return (await r.json()) as VaultReading[];
  } catch {
    return [];
  }
}