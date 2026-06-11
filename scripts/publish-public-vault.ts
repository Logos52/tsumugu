#!/usr/bin/env tsx
/**
 * Copy publishable readings from personal/inbox → apps/web/public/vault/
 * for GitHub Pages (static vault). Run before `pnpm --filter @tsumugu/web build`.
 */
import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const PERSONAL = join(ROOT, "personal/inbox/zh-Hant");
const OUT = join(ROOT, "apps/web/public/vault/inbox/zh-Hant");

const YOUTUBE_SLUGS = ["why-friendship-differs"];
const GSM_DIALOGUE_RE = /^gsm2-lesson-\d{2}-dialogue$/;

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function copyFile(src: string, dest: string): Promise<void> {
  await mkdir(join(dest, ".."), { recursive: true });
  await cp(src, dest);
}

async function copyTree(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true });
  await cp(src, dest, { recursive: true });
}

function kindForSlug(slug: string): VaultEntry["kind"] {
  if (YOUTUBE_SLUGS.includes(slug)) return "youtube";
  if (GSM_DIALOGUE_RE.test(slug)) return "gsm-dialogue";
  if (/^gsm2-lesson-\d{2}-rewrite$/.test(slug)) return "gsm-rewrite";
  return "other";
}

interface VaultEntry {
  path: string;
  lang?: string;
  title?: string;
  kind: "youtube" | "gsm-dialogue" | "gsm-rewrite" | "other";
}

async function main(): Promise<void> {
  const catalogPath = join(ROOT, "apps/web/public/vault/__readings.json");
  if (!(await exists(PERSONAL))) {
    if (await exists(catalogPath)) {
      console.log("No personal/inbox — keeping existing apps/web/public/vault/");
      return;
    }
    console.error(`Missing ${PERSONAL} — run from a machine with personal/inbox.`);
    process.exit(1);
  }

  const entries: VaultEntry[] = [];
  const files = await readdir(PERSONAL);
  const slugs = new Set<string>();

  for (const f of files) {
    const m = /^(.+)\.prepared\.json$/.exec(f);
    if (!m) continue;
    const slug = m[1]!;
    if (!YOUTUBE_SLUGS.includes(slug) && !GSM_DIALOGUE_RE.test(slug)) continue;
    slugs.add(slug);
  }

  await mkdir(OUT, { recursive: true });

  for (const slug of [...slugs].sort()) {
    const prepared = join(PERSONAL, `${slug}.prepared.json`);
    if (!(await exists(prepared))) continue;

    const sidecars = [
      `${slug}.prepared.json`,
      `${slug}.prepared.cues.json`,
      `${slug}.voice-notes.json`,
      `${slug}.voice-notes.native.json`,
      `${slug}.section-audio.json`,
      `${slug}.word-audio.json`,
    ];

    for (const name of sidecars) {
      const src = join(PERSONAL, name);
      if (await exists(src)) await copyFile(src, join(OUT, name));
    }

    const audioDir = join(PERSONAL, "audio", slug);
    if (await exists(audioDir)) {
      await copyTree(audioDir, join(OUT, "audio", slug));
    }

    const raw = await readFile(prepared, "utf8");
    const j = JSON.parse(raw) as { lang?: string; title?: string };
    entries.push({
      path: `inbox/zh-Hant/${slug}.prepared.json`,
      lang: j.lang,
      title: j.title ?? slug,
      kind: kindForSlug(slug),
    });
    console.log(`  ✓ ${slug}`);
  }

  // Minimal word store so the reader boots without manual grant.
  const storeSrc = join(ROOT, "personal/vault/tsumugu/word-store.json");
  const storeDest = join(ROOT, "apps/web/public/vault/vault/tsumugu/word-store.json");
  if (await exists(storeSrc)) {
    await copyFile(storeSrc, storeDest);
    console.log("  ✓ word-store.json");
  } else {
    await mkdir(join(storeDest, ".."), { recursive: true });
    await writeFile(storeDest, JSON.stringify({ schema: "tsumugu/word-store@1", langs: {} }, null, 2));
    console.log("  ✓ empty word-store.json (stub)");
  }

  await mkdir(join(catalogPath, ".."), { recursive: true });
  await writeFile(catalogPath, JSON.stringify(entries, null, 2) + "\n", "utf8");

  console.log(`\nPublished ${entries.length} reading(s) → ${relative(ROOT, OUT)}`);
  console.log(`Catalog: ${relative(ROOT, catalogPath)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});