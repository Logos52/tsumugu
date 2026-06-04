/**
 * Pack registry for the CLI. Ships the data-free demo pack; private zh/vi
 * packs plug in via `--pack-module <path>` (a module that default-exports a
 * LanguagePack or LanguagePack[], or names them on `export const packs`).
 */
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { PackRegistry, type LanguagePack } from "@tsumugu/engine";
import { demoPack } from "@tsumugu/demo-pack";

export async function buildRegistry(packModule?: string): Promise<PackRegistry> {
  const reg = new PackRegistry();
  reg.register(demoPack);
  if (packModule) {
    const url = pathToFileURL(resolve(packModule)).href;
    const mod: { default?: unknown; packs?: unknown } = await import(url);
    const candidate = mod.default ?? mod.packs;
    const packs = Array.isArray(candidate) ? candidate : candidate ? [candidate] : [];
    for (const p of packs) reg.register(p as LanguagePack);
  }
  return reg;
}

/** Resolve the pack to use: explicit `--pack`, else the language id. */
export function resolvePack(
  reg: PackRegistry,
  lang: string,
  packId?: string,
): LanguagePack {
  const id = packId ?? lang;
  const pack = reg.get(id);
  if (!pack) {
    throw new Error(
      `No pack registered for "${id}". Registered: ${reg.ids().join(", ")}. ` +
        `Pass --pack-module to load a private pack (see PACK-AUTHORING.md).`,
    );
  }
  return pack;
}
