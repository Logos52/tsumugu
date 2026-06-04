/**
 * `pnpm gen <command>` — the deterministic harness around batch generation.
 * No LLM call lives here; commands segment / score / OpenCC-guard / validate
 * and brief the agent (Claude Code / Grok Build) via the shipped prompts.
 *
 *   pnpm gen prep   --lang zh-Hant --in src.txt [--store ws.json] [--target 0.95]
 *                   [--mode directed --words 夜市,小吃] [--pack-module ./packs/index.ts]
 *   pnpm gen verify --in out.prepared.json [--store ws.json] [--lang zh-Hant] [--fix]
 *   pnpm gen auto   --lang vi --store ws.json [--limit 8]
 */
import { existsSync } from "node:fs";
import {
  WordStore,
  BridgeRegistry,
  parsePreparedContent,
  getDue,
  systemClock,
} from "@tsumugu/engine";
import { demoPack } from "@tsumugu/demo-pack";
import { parseArgs, str, num, list, flag } from "./lib/args.js";
import { readText, readJson, writeJson, writeText, slugify } from "./lib/io.js";
import { buildRegistry, resolvePack } from "./lib/packs.js";
import { buildSkeleton } from "./lib/skeleton.js";
import { verifyContent } from "./lib/verify.js";
import { selectAutonomousTargets } from "./lib/targets.js";
import { loadPrompt, contextBlock } from "./lib/prompt.js";
import { buildWikiPage, buildEncodingPage, wikiInputFromStore } from "./lib/wiki.js";
import {
  knownHanziFromStore,
  cacheBridges,
  type BridgeRecord,
} from "./lib/bridge.js";
import {
  importExternal,
  reconcileAgainstStore,
  applyToStore,
} from "./lib/crossref.js";
import type { LanguagePack, WordStatus, WordStoreDoc } from "@tsumugu/engine";

const LEARNING: WordStatus[] = ["l1", "l2", "l3", "l4"];

/** Pick the words a wiki/bridge command should act on. */
function selectWords(store: WordStore, lang: string, opts: Record<string, string | boolean>): string[] {
  const explicit = list(opts, "words");
  if (explicit.length) return explicit;
  if (flag(opts, "flagged")) return store.flagged(lang).map((e) => e.word);
  if (flag(opts, "srs")) return getDue(store.all(lang), systemClock).map((e) => e.word);
  return store.all(lang).filter((e) => LEARNING.includes(e.status)).map((e) => e.word);
}

async function loadStore(path?: string): Promise<WordStore> {
  if (!path || !existsSync(path)) return new WordStore();
  const doc = await readJson<WordStoreDoc>(path);
  return WordStore.fromDoc(doc);
}

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

async function cmdPrep(opts: Record<string, string | boolean>): Promise<void> {
  const lang = str(opts, "lang") ?? fail("prep needs --lang");
  const inPath = str(opts, "in") ?? fail("prep needs --in <source text file>");
  const text = await readText(inPath);
  const store = await loadStore(str(opts, "store"));
  const reg = await buildRegistry(str(opts, "pack-module"));
  const pack = resolvePack(reg, lang, str(opts, "pack"));
  const mode = (str(opts, "mode") as "directed" | "autonomous") ?? "directed";
  const targetWords = list(opts, "words");
  const ciTarget = num(opts, "target") ?? 0.95;
  const title = str(opts, "title");

  const { content, unknownWords } = await buildSkeleton({
    lang,
    pack,
    store,
    text,
    ciTarget,
    ...(title ? { title } : {}),
  });

  const slug = slugify(title ?? inPath.replace(/.*\//, "").replace(/\.[^.]+$/, ""));
  const outPath = str(opts, "out") ?? `Inbox/${lang}/${slug}.prepared.json`;
  await writeJson(outPath, content);

  const prompt = await loadPrompt("content-prep.md");
  console.log(prompt);
  console.log(
    contextBlock({
      lang,
      mode,
      ciTarget,
      skeletonPath: outPath,
      unknownWords,
      ...(targetWords.length ? { targetWords } : {}),
      ...(str(opts, "agent") ? { agent: str(opts, "agent")! } : {}),
    }),
  );
  console.error(
    `\n✓ skeleton written: ${outPath} (${content.tokens.filter((t) => t.isWord).length} word-tokens, ${unknownWords.length} to resolve)`,
  );
}

async function cmdVerify(opts: Record<string, string | boolean>): Promise<void> {
  const inPath = str(opts, "in") ?? fail("verify needs --in <prepared.json>");
  let content;
  try {
    content = parsePreparedContent(await readText(inPath));
  } catch (e) {
    fail(`invalid prepared content: ${String(e)}`);
  }
  const lang = str(opts, "lang") ?? content.lang;
  const store = await loadStore(str(opts, "store"));
  const reg = await buildRegistry(str(opts, "pack-module"));
  let pack: LanguagePack;
  try {
    pack = resolvePack(reg, lang, str(opts, "pack"));
  } catch {
    console.error(`! no pack for "${lang}"; OpenCC guard skipped (CI + glossary still checked).`);
    pack = demoPack;
  }

  const report = await verifyContent({
    lang,
    pack,
    store,
    content,
    ciTarget: num(opts, "target") ?? content.ciTarget ?? 0.95,
    ...(list(opts, "words").length ? { targetWords: list(opts, "words") } : {}),
  });

  console.log(`CI: ${(report.ciMeasured * 100).toFixed(0)}% (target ${(report.ciTarget * 100).toFixed(0)}%) — ${report.meetsTarget ? "meets" : "below"} target`);
  console.log(`OpenCC: ${report.openccChanged ? `${report.openccChanges.length} Simplified→Traditional change(s)` : "clean"}`);
  for (const c of report.openccChanges) console.log(`   ${c.before} → ${c.after}`);
  console.log(`Missing glossary: ${report.missingGlossary.length ? report.missingGlossary.join("、") : "none"}`);
  if (report.recycle.length) {
    console.log("Recycle:");
    for (const r of report.recycle) console.log(`   ${r.word}: ${r.count}× ${r.ok ? "ok" : "(<3)"}`);
  }

  if (flag(opts, "fix")) {
    await writeJson(inPath, report.normalized);
    console.error(`✓ wrote normalized content + ciMeasured back to ${inPath}`);
  }

  const blocked = report.missingGlossary.length > 0 || (report.openccChanged && !flag(opts, "fix"));
  if (blocked) {
    console.error(
      `\n✗ not ready: ${report.missingGlossary.length ? "fill the missing glosses; " : ""}${report.openccChanged && !flag(opts, "fix") ? "re-run with --fix to apply OpenCC" : ""}`.trim(),
    );
    process.exit(1);
  }
  console.error("\n✓ verified — ready to read (move from Inbox/ on your confirm).");
}

async function cmdAuto(opts: Record<string, string | boolean>): Promise<void> {
  const lang = str(opts, "lang") ?? fail("auto needs --lang");
  const store = await loadStore(str(opts, "store"));
  const limit = num(opts, "limit") ?? 8;
  const targets = selectAutonomousTargets(store, lang, systemClock, limit);
  const ciTarget = num(opts, "target") ?? 0.95;
  const slug = slugify(`auto-${targets.slice(0, 2).join("-") || "next"}`);
  const outPath = str(opts, "out") ?? `Inbox/${lang}/${slug}.prepared.json`;

  const prompt = await loadPrompt("content-prep.md");
  console.log(prompt);
  console.log(
    contextBlock({
      lang,
      mode: "autonomous",
      ciTarget,
      skeletonPath: outPath,
      unknownWords: [],
      targetWords: targets,
      ...(str(opts, "agent") ? { agent: str(opts, "agent")! } : {}),
    }),
  );
  console.error(
    `\n✓ autonomous run briefed: build a passage at CI ${ciTarget} recycling ${targets.length} active/due words → write ${outPath}, then \`pnpm gen verify --in ${outPath}\`.`,
  );
}

async function cmdWiki(opts: Record<string, string | boolean>, encoding: boolean): Promise<void> {
  const lang = str(opts, "lang") ?? fail(`${encoding ? "encoding" : "wiki"} needs --lang`);
  const store = await loadStore(str(opts, "store"));
  const reg = await buildRegistry(str(opts, "pack-module"));
  let pack: LanguagePack | undefined;
  try {
    pack = resolvePack(reg, lang, str(opts, "pack"));
  } catch {
    pack = undefined;
  }
  const words = selectWords(store, lang, opts);
  if (words.length === 0) {
    fail("no words selected — use --words a,b, or --flagged/--srs, or grade some words first.");
  }
  const outDir = str(opts, "out-dir") ?? "wiki/Inbox";
  for (const word of words) {
    const entry = store.get(lang, word) ?? { lang, word, status: "new" as WordStatus };
    const dict = pack ? await pack.dictionaryProvider(word) : undefined;
    const input = wikiInputFromStore(entry, dict);
    const md = encoding
      ? buildEncodingPage({ ...input, ...(entry.flagNote ? { flagNote: entry.flagNote } : {}) })
      : buildWikiPage(input);
    const outPath = `${outDir}/${lang}/${encoding ? "encoding/" : ""}${slugify(word)}.md`;
    await writeText(outPath, md);
  }
  console.log(await loadPrompt(encoding ? "encoding-page.md" : "wiki-page.md"));
  console.error(
    `\n✓ ${words.length} ${encoding ? "encoding" : "wiki"} page skeleton(s) → ${outDir}/${lang}/. Fill the TODO sections, then promote on your confirm.`,
  );
}

async function cmdBridge(opts: Record<string, string | boolean>): Promise<void> {
  const lang = str(opts, "lang") ?? fail("bridge needs --lang");
  const store = await loadStore(str(opts, "store"));
  const bridgeLang = str(opts, "bridge-lang") ?? "zh-Hant";
  const registryPath = str(opts, "registry") ?? `bridge/${lang}-bridge.json`;
  const registry = existsSync(registryPath)
    ? BridgeRegistry.fromJSON(await readText(registryPath))
    : new BridgeRegistry();
  const knownEtyma = knownHanziFromStore(store, bridgeLang);

  const cachePath = str(opts, "cache");
  if (cachePath) {
    const records = await readJson<BridgeRecord[]>(cachePath);
    const res = cacheBridges(registry, lang, records, knownEtyma);
    await writeText(registryPath, registry.toJSON());
    console.log(`cached: +${res.added} new, ${res.updated} updated → ${registryPath}`);
    console.log(
      `cross-seed: ${res.crossSeed.seededCount}/${res.crossSeed.total} ${lang} words unlocked by your known ${bridgeLang} (known Hanzi: ${knownEtyma.size})`,
    );
    for (const s of res.crossSeed.seeded) console.log(`   ${s.word} ← ${s.etymon}`);
    return;
  }

  const words = selectWords(store, lang, opts);
  console.log(await loadPrompt("bridge.md"));
  console.log(
    [
      "",
      "---",
      "## Run context (filled by `pnpm gen bridge`)",
      `- target lang: ${lang}  ·  bridge lang: ${bridgeLang}`,
      `- known Hanzi (${knownEtyma.size}) seed cross-seeding`,
      `- words to bridge (${words.length}): ${words.join("、") || "(none — pass --words)"}`,
      `- write results as JSON \`[{ "word": "...", "info": { ...BridgeInfo } }]\`, then:`,
      `  \`pnpm gen bridge --cache <results.json> --registry ${registryPath} --lang ${lang} --store <ws.json> --bridge-lang ${bridgeLang}\``,
      "",
    ].join("\n"),
  );
}

async function cmdCrossref(opts: Record<string, string | boolean>): Promise<void> {
  const source = str(opts, "source") ?? "migaku";
  const inPath = str(opts, "in") ?? fail("crossref needs --in <export.json>");
  const storePath = str(opts, "store");
  const store = await loadStore(storePath);
  const records = importExternal(source, await readJson<unknown>(inPath));
  const lang = str(opts, "lang") ?? records[0]?.lang ?? fail("specify --lang");
  const report = reconcileAgainstStore(lang, store, records);
  const inLang = records.filter((r) => r.lang === lang).length;

  console.log(`crossref ${source} (${lang}): ${inLang} record(s)`);
  console.log(`  reconciled: ${report.reconciled.length}`);
  console.log(`  conflicts:  ${report.conflicts.length}`);
  for (const c of report.conflicts.slice(0, 20)) {
    console.log(`     ${c.word}: store=${c.storeStatus} ↔ ext=${c.external.map((e) => e.status ?? e.externalStatus).join("/")}`);
  }
  console.log(`  missing from store: ${report.missingFromStore.length}`);

  if (flag(opts, "apply")) {
    const res = applyToStore(store, lang, records, { overwriteConflicts: flag(opts, "overwrite") });
    const out = str(opts, "out") ?? storePath ?? fail("--apply needs --store or --out to write to");
    await writeJson(out, store.toDoc());
    console.error(
      `✓ applied: +${res.imported} imported, ${res.overwritten} overwritten, ${res.skippedConflicts} conflict(s) skipped → ${out}`,
    );
  }
}

function usage(): void {
  console.log(
    [
      "tsumugu gen — batch generation harness (agent-run, no API in core)",
      "",
      "  pnpm gen prep   --lang <id> --in <source.txt> [--store ws.json] [--target 0.95]",
      "                  [--mode directed --words a,b] [--title T] [--out path]",
      "                  [--pack <id>] [--pack-module <path>] [--agent claude|grok]",
      "  pnpm gen verify --in <prepared.json> [--store ws.json] [--lang <id>] [--fix]",
      "                  [--target 0.95] [--words a,b] [--pack-module <path>]",
      "  pnpm gen auto     --lang <id> --store ws.json [--limit 8] [--out path]",
      "  pnpm gen wiki     --lang <id> --store ws.json [--words a,b|--flagged|--srs] [--out-dir wiki/Inbox]",
      "  pnpm gen encoding --lang <id> --store ws.json [--words a,b|--flagged|--srs] [--out-dir wiki/Inbox]",
      "  pnpm gen bridge   --lang vi --store ws.json [--bridge-lang zh-Hant] [--words a,b]",
      "                    | --cache results.json --registry bridge/vi-bridge.json --lang vi --store ws.json",
      "  pnpm gen crossref --source migaku --in export.json --lang <id> [--store ws.json] [--apply] [--overwrite] [--out ws.json]",
      "",
      "The public engine ships only the demo pack; private zh/vi packs plug in via",
      "--pack-module (see PACK-AUTHORING.md).",
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  const { _, opts } = parseArgs(process.argv.slice(2));
  const cmd = _[0];
  switch (cmd) {
    case "prep":
      return cmdPrep(opts);
    case "verify":
      return cmdVerify(opts);
    case "auto":
      return cmdAuto(opts);
    case "wiki":
      return cmdWiki(opts, false);
    case "encoding":
      return cmdWiki(opts, true);
    case "bridge":
      return cmdBridge(opts);
    case "crossref":
      return cmdCrossref(opts);
    case "help":
    case undefined:
      return usage();
    default:
      console.error(`unknown command: ${cmd}\n`);
      usage();
      process.exit(1);
  }
}

main().catch((e) => fail(String(e)));
