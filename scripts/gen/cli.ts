/**
 * `pnpm gen <command>` — the deterministic harness around batch generation.
 * No LLM call lives here; commands segment / score / OpenCC-guard / validate
 * and brief your own coding agent via the shipped prompts.
 *
 *   pnpm gen prep   --lang zh-Hant --in src.txt [--store ws.json] [--target 0.95]
 *                   [--mode directed --words 夜市,小吃] [--pack-module ./packs/index.ts]
 *   pnpm gen verify --in out.prepared.json [--store ws.json] [--lang zh-Hant] [--fix]
 *   pnpm gen auto   --lang vi --store ws.json [--limit 8]
 */
import { existsSync } from "node:fs";
import { mkdir, readdir, rm } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  WordStore,
  BridgeRegistry,
  parsePreparedContent,
  parseEncodingPage,
  getDue,
  isKnown,
  systemClock,
} from "@tsumugu/engine";
import { demoPack } from "@tsumugu/demo-pack";
import { parseArgs, str, num, list, flag } from "./lib/args.js";
import { readText, readJson, writeJson, writeText, slugify, encodingFilename } from "./lib/io.js";
import { lintEncodingTwin } from "./lib/wikiLint.js";
import { buildRegistry, resolvePack } from "./lib/packs.js";
import { buildSkeleton } from "./lib/skeleton.js";
import { buildTranscriptSkeleton, parseYouTubeId, type TranscriptFormat } from "./lib/transcript.js";
import { verifyContent } from "./lib/verify.js";
import { verifyEncodingPage } from "./lib/verifyEncoding.js";
import { selectAutonomousTargets } from "./lib/targets.js";
import { loadPrompt, contextBlock } from "./lib/prompt.js";
import {
  buildWikiPage,
  buildEncodingPage,
  buildEncodingPageJson,
  encodingArtifactPaths,
  wikiInputFromStore,
} from "./lib/wiki.js";
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
import { readSrsDb } from "./lib/srs-db.js";
import { writeBack } from "./lib/srs-writeback.js";
import { resolve as resolvePath, dirname, join, relative, basename } from "node:path";
import {
  deriveSlug,
  selectCues,
  parseSlowSpec,
  slowSelection,
  planWork,
  buildWorkerJob,
  ffmpegArgs,
  buildManifest,
  makeNote,
  validateManifest,
  cueFileName,
  DEFAULT_MODEL,
  DEFAULT_VOICE,
  DEFAULT_LANGUAGE,
  DEFAULT_SLOW_INSTRUCT,
  WORKER_REPORT_BEGIN,
  WORKER_REPORT_END,
  type VoiceCue,
  type VoiceNote,
  type VoiceNotesManifest,
  type WorkerJob,
  type WorkerReport,
  type CueSelection,
} from "./lib/voiceNotes.js";
import {
  selectWords as selectAudioWords,
  planWords,
  buildWordManifest,
  validateWordManifest,
  maxWordDurationSec,
  WORD_AUDIO_DIR,
  type WordSelectMode,
  type WordAudioManifest,
} from "./lib/wordAudio.js";
import {
  selectSections,
  planSections,
  buildSectionManifest,
  validateSectionManifest,
  SECTION_AUDIO_DIR,
  type SectionAudioNote,
  type SectionAudioManifest,
} from "./lib/sectionAudio.js";
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

async function cmdTranscript(opts: Record<string, string | boolean>): Promise<void> {
  const lang = str(opts, "lang") ?? fail("transcript needs --lang");
  const inPath = str(opts, "in") ?? fail("transcript needs --in <transcript file>");
  const raw = await readText(inPath);
  const store = await loadStore(str(opts, "store"));
  const reg = await buildRegistry(str(opts, "pack-module"));
  const pack = resolvePack(reg, lang, str(opts, "pack"));
  const format = (str(opts, "format") as TranscriptFormat | undefined) ?? "auto";
  const ciTarget = num(opts, "target") ?? 0.95;
  const title = str(opts, "title");

  const { content, unknownWords, cues } = await buildTranscriptSkeleton({
    lang,
    pack,
    store,
    raw,
    format,
    source: `transcript:${inPath.replace(/.*\//, "")}`,
    ...(title ? { title } : {}),
    ...(ciTarget !== undefined ? { ciTarget } : {}),
  });

  // A YouTube source (--video <url|id>) records its 11-char id in the sidecar,
  // so the reader can embed the sanctioned IFrame and sync to it (M4).
  const videoId = parseYouTubeId(str(opts, "video"));

  const slug = slugify(title ?? inPath.replace(/.*\//, "").replace(/\.[^.]+$/, ""));
  const outPath = str(opts, "out") ?? `Inbox/${lang}/${slug}.prepared.json`;
  const cuesPath = `${outPath.replace(/\.json$/, "")}.cues.json`;
  await writeJson(outPath, content);
  await writeJson(cuesPath, {
    schema: "tsumugu/transcript-cues@1",
    lang,
    source: content.source,
    ...(videoId ? { videoId } : {}),
    cues,
  });

  const prepPrompt = await loadPrompt("content-prep.md");
  const commentaryPrompt = await loadPrompt("transcript-commentary.md");
  console.log(prepPrompt);
  console.log("\n---\n");
  console.log(commentaryPrompt);
  console.log(
    [
      "",
      "---",
      "## Run context (filled by `pnpm gen transcript`)",
      `- agent: ${str(opts, "agent") ?? "(unspecified)"}`,
      `- lang: ${lang}`,
      `- mode: transcript`,
      `- format: ${format}`,
      `- skeleton file (edit in place; fill empty \`gloss\`/\`explanation\`): \`${outPath}\``,
      `- cues sidecar (timestamps; do not edit): \`${cuesPath}\``,
      `- cues: ${cues.length}`,
      `- videoId: ${videoId ?? "(none — not a YouTube source)"}`,
      `- words needing resolution (${unknownWords.length}): ${unknownWords.join("、") || "(none)"}`,
      "",
      `After filling the skeleton, run \`pnpm gen verify --in ${outPath}\` (OpenCC + CI re-score).`,
      "",
    ].join("\n"),
  );
  console.error(
    `\n✓ transcript skeleton written: ${outPath} (${content.tokens.filter((t) => t.isWord).length} word-tokens, ${cues.length} cues, ${unknownWords.length} to resolve)\n  cues sidecar: ${cuesPath}`,
  );
}

async function cmdVerifyEncodingTwin(opts: Record<string, string | boolean>): Promise<void> {
  const inPath = str(opts, "in") ?? fail("verify-encoding needs --in <encoding-twin.md>");
  const md = await readText(inPath);
  const filename = basename(inPath, ".md");
  const result = lintEncodingTwin(md, { filename });
  for (const err of result.errors) console.error(`✗ ${err}`);
  if (!result.ok) {
    console.error(`\n✗ encoding twin lint failed (${result.errors.length} error(s))`);
    process.exit(1);
  }
  console.error("\n✓ encoding twin lint passed");
}

async function cmdVerifyEncodingJson(opts: Record<string, string | boolean>): Promise<void> {
  const inPath = str(opts, "in") ?? fail("verify --encoding needs --in <encoding.json>");
  const raw = await readJson<unknown>(inPath);
  const doc = parseEncodingPage(raw);
  if (!doc) fail(`invalid encoding-page artifact: ${inPath}`);

  const lang = str(opts, "lang") ?? doc.lang;
  const store = await loadStore(str(opts, "store"));
  const reg = await buildRegistry(str(opts, "pack-module"));
  let pack: LanguagePack;
  try {
    pack = resolvePack(reg, lang, str(opts, "pack"));
  } catch {
    console.error(`! no pack for "${lang}"; OpenCC guard skipped (CI + gates still checked).`);
    pack = demoPack;
  }

  const ciTarget = num(opts, "target") ?? 0.95;
  const report = await verifyEncodingPage({ lang, pack, store, doc, ciTarget });

  console.log(`CI target: ${(report.ciTarget * 100).toFixed(0)}%`);
  for (const s of report.ciScores) {
    console.log(
      `  ${s.label}: ${(s.coverage * 100).toFixed(0)}% — ${s.meetsTarget ? "meets" : "below"} target` +
        (s.unknownWords.length ? ` (unknown: ${s.unknownWords.map((u) => u.word).join("、")})` : ""),
    );
  }
  console.log(
    `OpenCC: ${report.openccChanged ? `${report.openccChanges.length} Simplified→Traditional change(s)` : "clean"}`,
  );
  for (const c of report.openccChanges) console.log(`   ${c.before} → ${c.after}`);
  if (report.knownWordRecycleRatio !== null) {
    console.log(`Known-word recycle ratio: ${(report.knownWordRecycleRatio * 100).toFixed(0)}%`);
  }
  if (report.groundingErrors.length) {
    console.log("Grounding:");
    for (const e of report.groundingErrors) console.log(`   ${e}`);
  }
  if (report.selectionErrors.length) {
    console.log("Selection:");
    for (const e of report.selectionErrors) console.log(`   ${e}`);
  }
  if (report.levelingErrors.length) {
    console.log("Leveling:");
    for (const e of report.levelingErrors) console.log(`   ${e}`);
  }

  if (flag(opts, "fix")) {
    await writeJson(inPath, report.normalized);
    console.error(`✓ wrote normalized encoding-page back to ${inPath}`);
  }

  if (report.blocked && report.openccChanged && !flag(opts, "fix")) {
    console.error("\n✗ not ready: re-run with --fix to apply OpenCC");
    process.exit(1);
  }
  if (report.blocked) {
    for (const r of report.blockReasons) console.error(`✗ ${r}`);
    console.error(`\n✗ encoding verify failed (${report.blockReasons.length} issue(s))`);
    process.exit(1);
  }
  console.error("\n✓ encoding-page verified — ready to read.");
}

async function cmdVerify(opts: Record<string, string | boolean>): Promise<void> {
  if (flag(opts, "encoding")) return cmdVerifyEncodingJson(opts);

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
  const slugOverride = str(opts, "slug");
  const ciTarget = num(opts, "target") ?? 0.95;
  const knownWords = store
    .all(lang)
    .filter((e) => isKnown(e.status))
    .map((e) => e.word);

  const artifactPaths: { md: string; json: string }[] = [];

  for (const word of words) {
    const entry = store.get(lang, word) ?? { lang, word, status: "new" as WordStatus };
    const dict = pack ? await pack.dictionaryProvider(word) : undefined;
    const input = wikiInputFromStore(entry, dict);
    if (encoding) {
      const wikiInput = { ...input, ...(entry.flagNote ? { flagNote: entry.flagNote } : {}) };
      const paths = encodingArtifactPaths(outDir, lang, word, slugOverride);
      const md = buildEncodingPage(wikiInput);
      const json = buildEncodingPageJson(wikiInput);
      await writeText(paths.mdPath, md);
      await writeJson(paths.jsonPath, json);
      artifactPaths.push({ md: paths.mdPath, json: paths.jsonPath });
    } else {
      const md = buildWikiPage(input);
      const outPath = `${outDir}/${lang}/${slugify(word)}.md`;
      await writeText(outPath, md);
    }
  }

  console.log(await loadPrompt(encoding ? "encoding-page.md" : "wiki-page.md"));

  if (encoding) {
    const levelCap =
      words.length === 1
        ? (store.get(lang, words[0]!)?.custom?.level ??
          (pack ? (await pack.dictionaryProvider(words[0]!))?.level : undefined) ??
          "(resolve from pack)")
        : "(per-word — see each skeleton)";
    console.log(
      [
        "",
        "---",
        "## Run context (filled by `pnpm gen encoding`)",
        `- agent: ${str(opts, "agent") ?? "(unspecified)"}`,
        `- lang: ${lang}`,
        `- ciTarget: ${ciTarget}`,
        `- level cap (for 簡明中文 leveling): ${levelCap}`,
        `- known words (${knownWords.length}): ${knownWords.slice(0, 40).join("、") || "(none)"}${knownWords.length > 40 ? "…" : ""}`,
        `- words (${words.length}): ${words.join("、")}`,
        ...artifactPaths.flatMap((p, i) => [
          `- word ${words[i]}:`,
          `  - Markdown twin: \`${p.md}\``,
          `  - encoding-page@1 JSON: \`${p.json}\``,
        ]),
        "",
        "Fill both artifacts, then run `pnpm gen verify --encoding --in <path>.encoding.json`.",
        "",
      ].join("\n"),
    );
    console.error(
      `\n✓ ${words.length} encoding skeleton(s) → ${outDir}/${lang}/encoding/ (.md + .encoding.json). Fill both, then verify.`,
    );
  } else {
    console.error(
      `\n✓ ${words.length} wiki page skeleton(s) → ${outDir}/${lang}/. Fill the TODO sections, then promote on your confirm.`,
    );
  }
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
  const source = str(opts, "source") ?? "srs";
  const inPath = str(opts, "in") ?? fail("crossref needs --in <export.json | srs-core.db>");
  const storePath = str(opts, "store");
  const store = await loadStore(storePath);
  // A .db input (or --source srs-db) reads the real SRS SQLite directly,
  // enriched with each word's mod / 4-tuple / latest origin so the clock-aware
  // reconciler can never silently demote. Otherwise parse the lossy JSON export.
  const isDb = source === "srs-db" || inPath.toLowerCase().endsWith(".db");
  const records = isDb
    ? await readSrsDb(inPath)
    : importExternal(source, await readJson<unknown>(inPath));
  const lang = str(opts, "lang") ?? records[0]?.lang ?? fail("specify --lang");
  // Optional source→canonical language relabel (e.g. the SRS stores Chinese as
  // "zh"; Tsumugu's store/reader use "zh-Hant"): keep only --from-lang rows and
  // re-tag them to --lang. The original code is preserved in externalRefs.
  const fromLang = str(opts, "from-lang");
  const tagged = fromLang
    ? records.filter((r) => r.lang === fromLang).map((r) => ({ ...r, lang }))
    : records;
  const report = reconcileAgainstStore(lang, store, tagged);
  const inLang = tagged.filter((r) => r.lang === lang).length;

  console.log(`crossref ${source} (${lang}): ${inLang} record(s)`);
  console.log(`  reconciled: ${report.reconciled.length}`);
  console.log(`  conflicts:  ${report.conflicts.length}`);
  for (const c of report.conflicts.slice(0, 20)) {
    console.log(`     ${c.word}: store=${c.storeStatus} ↔ ext=${c.external.map((e) => e.status ?? e.externalStatus).join("/")}`);
  }
  console.log(`  missing from store: ${report.missingFromStore.length}`);

  if (flag(opts, "apply")) {
    const policy = flag(opts, "overwrite") ? ("newest-wins" as const) : ("never-demote" as const);
    const res = applyToStore(store, lang, tagged, { policy });
    const out = str(opts, "out") ?? storePath ?? fail("--apply needs --store or --out to write to");
    await writeJson(out, store.toDoc());
    console.error(
      `✓ applied (${policy}): +${res.imported} seeded, ${res.changed} updated, ` +
        `${res.demotionsBlocked} demotion(s) blocked, ${res.kept} kept → ${out}`,
    );
  }
}

async function cmdWriteback(opts: Record<string, string | boolean>): Promise<void> {
  const storePath = str(opts, "store") ?? fail("writeback needs --store <word-store.json>");
  const dbPath = str(opts, "db") ?? fail("writeback needs --db <srs-core.db>");
  const store = await loadStore(storePath);
  const apply = flag(opts, "apply");
  const inPlace = flag(opts, "in-place");
  const outPath = str(opts, "out");
  if (apply && !inPlace && !outPath) {
    fail("--apply writes a COPY: pass --out <copy.db>, or --in-place --yes to overwrite the snapshot (your LIVE SRS store is never touched either way)");
  }
  if (apply && outPath && resolvePath(outPath) === resolvePath(dbPath)) {
    fail("--out must differ from --db (it would overwrite the snapshot); use --in-place --yes to overwrite it deliberately");
  }
  if (apply && inPlace && !flag(opts, "yes")) {
    fail("--in-place overwrites the snapshot DB; re-run with --yes to confirm");
  }
  const lang = str(opts, "lang");
  const result = await writeBack({
    store,
    dbPath,
    ...(lang ? { lang } : {}),
    apply,
    ...(outPath ? { outPath } : {}),
    inPlace,
    nowMs: Date.now(),
  });

  console.log(`writeback: ${result.changes.length} word(s) where Tsumugu is newer than the SRS`);
  for (const c of result.changes.slice(0, 30)) {
    console.log(`  ${c.word}  [${c.partOfSpeech}/${c.language}]  ${c.from} → ${c.to}`);
  }
  if (result.changes.length > 30) console.log(`  … +${result.changes.length - 30} more`);
  console.log(`  skipped: ${JSON.stringify(result.skipped)}`);
  if (result.wrote) {
    const planned = result.changes.length;
    const modified = result.modified ?? planned;
    const warn = modified < planned ? `  (⚠ ${planned - modified} planned row(s) did not match WordList)` : "";
    console.error(
      `\n✓ wrote ${modified}/${planned} change(s) → ${result.wrote}${warn}` +
        (inPlace ? "" : "  (a COPY — re-import into your SRS yourself; your live store is untouched)"),
    );
  } else {
    console.error("\n(dry-run — pass --apply --out <copy.db> to write a modified COPY. Nothing was changed.)");
  }
}

// ── voice notes (PRD-Voice-Notes M1, Part A) ─────────────────────────────────

const VOICE_WORKER = fileURLToPath(new URL("./voice/synthesize_qwen3_mlx.py", import.meta.url));

/** First existing TTS-venv python: env override → bake-off venv → personal/voice venv. */
function resolveVoicePython(): string {
  const candidates = [
    process.env.TSUMUGU_VOICE_PYTHON,
    "personal/research/bakeoff/.venv/bin/python",
    "personal/voice/.venv/bin/python",
  ].filter((p): p is string => !!p);
  for (const c of candidates) if (existsSync(c)) return c;
  return fail(
    `no TTS venv python found — set TSUMUGU_VOICE_PYTHON or create personal/voice/.venv ` +
      `(see personal/voice/README.md). Tried: ${candidates.join(", ")}`,
  );
}

/** Spawn the Python worker, feeding the job over stdin; parse its sentinel-wrapped report. */
function runVoiceWorker(python: string, job: WorkerJob): Promise<WorkerReport> {
  return new Promise((resolveReport, reject) => {
    // stderr is inherited so the user sees per-cue progress live during long runs.
    const child = spawn(python, [VOICE_WORKER], { stdio: ["pipe", "pipe", "inherit"] });
    let out = "";
    child.stdout.on("data", (d: Buffer) => {
      out += d.toString();
    });
    child.on("error", (err) => reject(new Error(`could not start TTS worker (${python}): ${err.message}`)));
    child.on("close", (code) => {
      const begin = out.indexOf(WORKER_REPORT_BEGIN);
      const end = out.indexOf(WORKER_REPORT_END);
      if (begin >= 0 && end > begin) {
        try {
          resolveReport(JSON.parse(out.slice(begin + WORKER_REPORT_BEGIN.length, end).trim()) as WorkerReport);
          return;
        } catch (e) {
          reject(new Error(`TTS worker report parse failed: ${String(e)}`));
          return;
        }
      }
      reject(new Error(`TTS worker produced no report (exit ${code}). See worker output above.`));
    });
    child.stdin.write(JSON.stringify(job));
    child.stdin.end();
  });
}

/** Encode one wav → mp3 with ffmpeg; rejects on a non-zero exit. */
function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((res, rej) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "inherit"] });
    child.on("error", (err) => rej(new Error(`ffmpeg failed to start: ${err.message}`)));
    child.on("close", (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}`))));
  });
}

/** mp3 paths present in the audio dir, keyed by their manifest-relative path. */
async function presentMp3s(audioAbsDir: string, audioRelDir: string): Promise<Set<string>> {
  const present = new Set<string>();
  if (!existsSync(audioAbsDir)) return present;
  for (const f of await readdir(audioAbsDir)) {
    if (f.endsWith(".mp3")) present.add(`${audioRelDir}/${f}`);
  }
  return present;
}

async function cmdVoiceNotes(opts: Record<string, string | boolean>): Promise<void> {
  const inPath = str(opts, "in") ?? fail("voice-notes needs --in <prepared.cues.json>");
  type CuesDoc = { cues?: VoiceCue[]; lang?: string };
  const raw = await readJson<CuesDoc | VoiceCue[]>(inPath);
  const cues: VoiceCue[] = Array.isArray(raw) ? raw : raw.cues ?? [];
  if (cues.length === 0) fail(`no cues in ${inPath}`);
  const lang =
    str(opts, "lang") ??
    (Array.isArray(raw) ? undefined : raw.lang) ??
    fail("voice-notes needs --lang (or a `lang` field in the cues file)");

  const slug = deriveSlug(inPath);
  const model = str(opts, "model") ?? DEFAULT_MODEL;
  const voice = str(opts, "voice") ?? DEFAULT_VOICE;
  const language = str(opts, "language") ?? DEFAULT_LANGUAGE;
  const slowInstruct = str(opts, "slow-instruct") ?? DEFAULT_SLOW_INSTRUCT;
  const force = flag(opts, "force");
  const dryRun = flag(opts, "dry-run");

  // Manifest sits beside the cues file; audio defaults to `audio/<slug>/` beside it.
  const manifestDir = dirname(inPath);
  const manifestPath = join(manifestDir, `${slug}.voice-notes.json`);
  const outArg = str(opts, "out");
  const audioAbsDir = outArg ? resolvePath(outArg) : join(manifestDir, "audio", slug);
  let audioRelDir = relative(manifestDir, audioAbsDir).replace(/\\/g, "/");
  if (!audioRelDir || audioRelDir.startsWith("..")) audioRelDir = audioAbsDir.replace(/\\/g, "/");

  // Selection + plan (pure).
  const cuesArg = list(opts, "cues").map(Number).filter((n) => Number.isInteger(n));
  const sel: CueSelection = {};
  if (cuesArg.length) sel.cues = cuesArg;
  const limit = num(opts, "limit");
  if (limit !== undefined) sel.limit = limit;
  const selected = selectCues(cues, sel);
  if (selected.length === 0) fail("no cues selected (check --cues / --limit; empty-text cues are skipped)");
  const slowSet = slowSelection(cues, selected, parseSlowSpec(str(opts, "slow")));
  const existing = await presentMp3s(audioAbsDir, audioRelDir);
  const plans = planWork({ cues, selected, slowSet, audioRelDir, existing, force });

  const naturalsToRender = plans.filter((p) => p.renderNatural).length;
  const slowToRender = plans.filter((p) => p.renderSlow).length;

  if (dryRun) {
    console.log(`voice-notes plan (dry-run) — ${slug} [${lang}]`);
    console.log(`  cues file   : ${inPath}`);
    console.log(`  manifest    : ${manifestPath}`);
    console.log(`  audio dir   : ${audioAbsDir}  (manifest-relative: ${audioRelDir})`);
    console.log(`  engine/voice: ${model}@mlx-audio / ${voice}`);
    console.log(`  selected    : ${selected.length} cue(s)`);
    console.log(`  slow takes  : ${slowSet.size} (instruct: ${slowInstruct})`);
    console.log(`  to render   : ${naturalsToRender} natural + ${slowToRender} slow`);
    console.log(`  already done: ${selected.length - naturalsToRender} natural mp3(s) present (skipped)`);
    console.error(`\n(dry-run — model not loaded, nothing written)`);
    return;
  }

  // Preflight: ffmpeg + venv python before loading a 3.5 GB model.
  if (spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status !== 0) {
    fail("ffmpeg not found on PATH — install it (e.g. `brew install ffmpeg`). See personal/voice/README.md.");
  }
  const python = resolveVoicePython();

  await mkdir(audioAbsDir, { recursive: true });
  const wavDir = join(audioAbsDir, ".wav-tmp");

  let report: WorkerReport | null = null;
  const job = buildWorkerJob(plans, { model, voice, language, slowInstruct, wavDir });
  if (job.items.length > 0) {
    await mkdir(wavDir, { recursive: true });
    console.error(`Synthesizing ${job.items.length} take(s) via ${python} …`);
    report = await runVoiceWorker(python, job);
    // Encode every successfully-rendered wav → mp3, then drop the wav.
    for (const item of report.items) {
      if (!item.ok) continue;
      // Slow takes are named `cue-NNNN.slow.wav`; match the filename suffix (not
      // the full path, which could itself contain ".slow.").
      const slow = /\.slow\.wav$/i.test(item.outWav);
      const mp3Abs = join(audioAbsDir, cueFileName(item.index, slow));
      await runFfmpeg(ffmpegArgs(item.outWav, mp3Abs));
      await rm(item.outWav, { force: true });
    }
    await rm(wavDir, { recursive: true, force: true });
  } else {
    console.error("Nothing to render — all selected takes already exist (use --force to re-render).");
  }

  // Build manifest notes from what is actually on disk (rendered or pre-existing).
  const notes: VoiceNote[] = [];
  for (const p of plans) {
    const natExists = existsSync(join(audioAbsDir, cueFileName(p.index, false)));
    if (!natExists) continue; // a failed/absent natural take gets no note (flagged below)
    let slowRel: string | undefined;
    if (p.audioSlow && existsSync(join(audioAbsDir, cueFileName(p.index, true)))) slowRel = p.audioSlow;
    notes.push(makeNote(p.index, p.audio, slowRel));
  }

  let existingManifest: VoiceNotesManifest | null = null;
  if (existsSync(manifestPath)) {
    try {
      existingManifest = await readJson<VoiceNotesManifest>(manifestPath);
    } catch {
      existingManifest = null;
    }
  }
  const manifest = buildManifest({
    existing: existingManifest,
    slug,
    lang,
    engine: `${model}@mlx-audio`,
    voice,
    generatedAt: new Date().toISOString(),
    notes,
  });
  await writeJson(manifestPath, manifest);

  // Validate: every referenced file present; durations > 0; surface render failures.
  // Resolve each note's path against the manifest dir so preserved entries from a
  // prior run (possibly under a different --out) are checked where they actually live.
  const present = new Set<string>();
  for (const n of manifest.notes) {
    if (existsSync(join(manifestDir, n.audio))) present.add(n.audio);
    if (n.audioSlow && existsSync(join(manifestDir, n.audioSlow))) present.add(n.audioSlow);
  }
  const validation = validateManifest(manifest, present);
  const rendered = report?.items.filter((i) => i.ok) ?? [];
  const failures = (report?.items ?? []).filter((i) => !i.ok && i.error !== "empty text");
  const zeroDuration = rendered.filter((i) => !(i.durationSec && i.durationSec > 0));

  const totalGen = rendered.reduce((s, i) => s + (i.genSec ?? 0), 0);
  const totalAudio = rendered.reduce((s, i) => s + (i.durationSec ?? 0), 0);
  const rtf = totalAudio > 0 ? totalGen / totalAudio : 0;

  console.error(
    [
      "",
      `✓ voice-notes: ${manifest.notes.length} cue(s) in manifest → ${manifestPath}`,
      `  rendered this run: ${rendered.length} take(s) (${naturalsToRender} natural + ${slowToRender} slow)`,
      rendered.length
        ? `  generation: ${totalGen.toFixed(1)}s for ${totalAudio.toFixed(1)}s audio (RTF ${rtf.toFixed(2)}, avg ${(totalGen / rendered.length).toFixed(1)}s/take)`
        : "  generation: nothing rendered (all skipped)",
      `  audio dir: ${audioAbsDir}`,
    ].join("\n"),
  );

  const problems: string[] = [];
  if (!validation.ok) problems.push(`${validation.missing.length} missing file(s): ${validation.missing.slice(0, 5).join(", ")}${validation.missing.length > 5 ? " …" : ""}`);
  if (failures.length) problems.push(`${failures.length} render failure(s): ${failures.slice(0, 3).map((f) => `cue ${f.index} (${f.error})`).join("; ")}`);
  if (zeroDuration.length) problems.push(`${zeroDuration.length} zero-duration render(s)`);
  if (problems.length) {
    console.error(`\n✗ validation failed: ${problems.join(" · ")}`);
    process.exit(1);
  }
}

async function cmdWordAudio(opts: Record<string, string | boolean>): Promise<void> {
  const inPath = str(opts, "in") ?? fail("word-audio needs --in <prepared.json>");
  let content;
  try {
    content = parsePreparedContent(await readText(inPath));
  } catch (e) {
    return fail(`invalid prepared content: ${String(e)}`);
  }
  const lang = str(opts, "lang") ?? content.lang;
  const slug = deriveSlug(inPath);
  const model = str(opts, "model") ?? DEFAULT_MODEL;
  const voice = str(opts, "voice") ?? DEFAULT_VOICE;
  const language = str(opts, "language") ?? DEFAULT_LANGUAGE;
  const mode = (str(opts, "words") ?? "all") as WordSelectMode;
  if (mode !== "all" && mode !== "glossary") fail("--words must be all|glossary");
  const force = flag(opts, "force");
  const dryRun = flag(opts, "dry-run");

  const manifestDir = dirname(inPath);
  const manifestPath = join(manifestDir, `${slug}.word-audio.json`);
  const outArg = str(opts, "out");
  const audioAbsDir = outArg ? resolvePath(outArg) : join(manifestDir, WORD_AUDIO_DIR);
  let audioRelDir = relative(manifestDir, audioAbsDir).replace(/\\/g, "/");
  if (!audioRelDir || audioRelDir.startsWith("..")) audioRelDir = audioAbsDir.replace(/\\/g, "/");

  let words = selectAudioWords(content, mode);
  const limit = num(opts, "limit");
  if (limit !== undefined) words = words.slice(0, Math.max(0, limit));
  if (words.length === 0) fail("no words selected (empty reading / glossary?)");

  const existing = await presentMp3s(audioAbsDir, audioRelDir);
  const plans = planWords(words, audioRelDir, existing, force);
  const toRender = plans.filter((p) => p.render);

  if (dryRun) {
    console.log(`word-audio plan (dry-run) — ${slug} [${lang}], --words ${mode}`);
    console.log(`  prepared : ${inPath}`);
    console.log(`  manifest : ${manifestPath}`);
    console.log(`  audio dir: ${audioAbsDir}  (manifest-relative: ${audioRelDir})`);
    console.log(`  voice    : ${model}@mlx-audio / ${voice}`);
    console.log(`  words    : ${words.length} selected`);
    console.log(`  to render: ${toRender.length}  (skipping ${words.length - toRender.length} already present)`);
    console.error(`\n(dry-run — model not loaded, nothing written)`);
    return;
  }

  if (spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status !== 0) {
    fail("ffmpeg not found on PATH — install it (e.g. `brew install ffmpeg`). See personal/voice/README.md.");
  }
  const python = resolveVoicePython();
  await mkdir(audioAbsDir, { recursive: true });
  const wavDir = join(audioAbsDir, ".wav-tmp");

  // Render with a duration-sanity retry: a bare single word can make the TTS
  // hallucinate a runaway clip (e.g. 我 → 6 s). Such takes are re-rolled (each
  // generation is independent) up to a few times before giving up on a word.
  const rendered: WorkerReport["items"] = [];
  const skipped: string[] = []; // accepted but still over-long after all retries
  const failedWords: string[] = []; // worker errored on every attempt
  const MAX_ATTEMPTS = 4;
  if (toRender.length > 0) {
    await mkdir(wavDir, { recursive: true });
    let pending = toRender.map((p) => ({
      word: p.word,
      audio: p.audio,
      wav: join(wavDir, basename(p.audio).replace(/\.mp3$/, ".wav")),
    }));
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && pending.length > 0; attempt++) {
      console.error(
        `Synthesizing ${pending.length} word(s) via ${python}${attempt > 1 ? ` (retry ${attempt - 1} — over-long takes)` : ""} …`,
      );
      const rep = await runVoiceWorker(python, {
        model,
        voice,
        language,
        items: pending.map((p, i) => ({ index: i, text: p.word, instruct: null, outWav: p.wav })),
      });
      const byWav = new Map(rep.items.map((it) => [it.outWav, it]));
      const stillBad: typeof pending = [];
      for (const p of pending) {
        const it = byWav.get(p.wav);
        if (!it || !it.ok) {
          stillBad.push(p);
          continue;
        }
        const tooLong = (it.durationSec ?? Infinity) > maxWordDurationSec([...p.word].length);
        if (tooLong && attempt < MAX_ATTEMPTS) {
          await rm(p.wav, { force: true }); // re-roll this word next attempt
          stillBad.push(p);
          continue;
        }
        const mp3Abs = join(audioAbsDir, basename(p.audio));
        await runFfmpeg(ffmpegArgs(p.wav, mp3Abs));
        await rm(p.wav, { force: true });
        rendered.push(it);
        if (tooLong) skipped.push(p.word); // accepted the last take, but it's still long
      }
      pending = stillBad;
    }
    for (const p of pending) failedWords.push(p.word); // worker errored on every attempt
    await rm(wavDir, { recursive: true, force: true });
  } else {
    console.error("Nothing to render — all selected words already exist (use --force to re-render).");
  }

  // Manifest from what is actually on disk (rendered or pre-existing).
  const wordsMap: Record<string, string> = {};
  for (const p of plans) {
    if (existsSync(join(manifestDir, p.audio))) wordsMap[p.word] = p.audio;
  }
  let existingManifest: WordAudioManifest | null = null;
  if (existsSync(manifestPath)) {
    try {
      existingManifest = await readJson<WordAudioManifest>(manifestPath);
    } catch {
      existingManifest = null;
    }
  }
  const manifest = buildWordManifest({
    existing: existingManifest,
    lang,
    voice,
    engine: `${model}@mlx-audio`,
    generatedAt: new Date().toISOString(),
    words: wordsMap,
  });
  await writeJson(manifestPath, manifest);

  const present = new Set<string>();
  for (const p of Object.values(manifest.words)) {
    if (existsSync(join(manifestDir, p))) present.add(p);
  }
  const validation = validateWordManifest(manifest, present);
  const totalGen = rendered.reduce((s, i) => s + (i.genSec ?? 0), 0);
  const totalAudio = rendered.reduce((s, i) => s + (i.durationSec ?? 0), 0);
  const rtf = totalAudio > 0 ? totalGen / totalAudio : 0;

  console.error(
    [
      "",
      `✓ word-audio: ${Object.keys(manifest.words).length} word(s) in manifest → ${manifestPath}`,
      `  rendered this run: ${rendered.length}`,
      rendered.length
        ? `  generation: ${totalGen.toFixed(1)}s for ${totalAudio.toFixed(1)}s audio (RTF ${rtf.toFixed(2)})`
        : "  generation: nothing rendered (all skipped)",
      skipped.length ? `  ⚠ ${skipped.length} word(s) still over-long after ${MAX_ATTEMPTS} attempts: ${skipped.slice(0, 8).join(" ")}` : "",
      `  audio dir: ${audioAbsDir}`,
    ].filter(Boolean).join("\n"),
  );
  const problems: string[] = [];
  if (!validation.ok) problems.push(`${validation.missing.length} missing file(s)`);
  if (failedWords.length) problems.push(`${failedWords.length} render failure(s): ${failedWords.slice(0, 5).join(" ")}`);
  if (problems.length) {
    console.error(`\n✗ validation failed: ${problems.join(" · ")}`);
    process.exit(1);
  }
}

async function cmdSectionAudio(opts: Record<string, string | boolean>): Promise<void> {
  const inPath = str(opts, "in") ?? fail("section-audio needs --in <…cues.json>");
  type CuesDoc = { sections?: { summary?: string }[]; lang?: string };
  const raw = await readJson<CuesDoc>(inPath);
  const sections = raw.sections ?? [];
  if (sections.length === 0) fail(`no sections in ${inPath} (run the transcript commentary fill first)`);
  const lang =
    str(opts, "lang") ??
    raw.lang ??
    fail("section-audio needs --lang (or a `lang` field in the cues file)");
  const slug = deriveSlug(inPath);
  const model = str(opts, "model") ?? DEFAULT_MODEL;
  const voice = str(opts, "voice") ?? DEFAULT_VOICE;
  const language = str(opts, "language") ?? DEFAULT_LANGUAGE;
  const force = flag(opts, "force");
  const dryRun = flag(opts, "dry-run");

  const manifestDir = dirname(inPath);
  const manifestPath = join(manifestDir, `${slug}.section-audio.json`);
  const outArg = str(opts, "out");
  const audioAbsDir = outArg ? resolvePath(outArg) : join(manifestDir, SECTION_AUDIO_DIR);
  let audioRelDir = relative(manifestDir, audioAbsDir).replace(/\\/g, "/");
  if (!audioRelDir || audioRelDir.startsWith("..")) audioRelDir = audioAbsDir.replace(/\\/g, "/");

  let indices = selectSections(sections);
  const limit = num(opts, "limit");
  if (limit !== undefined) indices = indices.slice(0, Math.max(0, limit));
  if (indices.length === 0) fail("no sections with a summary to render");

  const existing = await presentMp3s(audioAbsDir, audioRelDir);
  const plans = planSections(sections, indices, audioRelDir, existing, force);
  const toRender = plans.filter((p) => p.render);

  if (dryRun) {
    console.log(`section-audio plan (dry-run) — ${slug} [${lang}]`);
    console.log(`  manifest : ${manifestPath}`);
    console.log(`  audio dir: ${audioAbsDir}  (manifest-relative: ${audioRelDir})`);
    console.log(`  sections : ${indices.length} with a summary`);
    console.log(`  to render: ${toRender.length}  (skipping ${indices.length - toRender.length} present)`);
    console.error(`\n(dry-run — model not loaded, nothing written)`);
    return;
  }

  if (spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status !== 0) {
    fail("ffmpeg not found on PATH — install it (e.g. `brew install ffmpeg`). See personal/voice/README.md.");
  }
  const python = resolveVoicePython();
  await mkdir(audioAbsDir, { recursive: true });
  const wavDir = join(audioAbsDir, ".wav-tmp");

  let report: WorkerReport | null = null;
  if (toRender.length > 0) {
    await mkdir(wavDir, { recursive: true });
    const items = toRender.map((p) => ({
      index: p.index,
      text: p.text,
      instruct: null,
      outWav: join(wavDir, basename(p.audio).replace(/\.mp3$/, ".wav")),
    }));
    console.error(`Synthesizing ${items.length} section summary clip(s) via ${python} …`);
    report = await runVoiceWorker(python, { model, voice, language, items });
    for (const item of report.items) {
      if (!item.ok) continue;
      const mp3Abs = join(audioAbsDir, basename(item.outWav).replace(/\.wav$/, ".mp3"));
      await runFfmpeg(ffmpegArgs(item.outWav, mp3Abs));
      await rm(item.outWav, { force: true });
    }
    await rm(wavDir, { recursive: true, force: true });
  } else {
    console.error("Nothing to render — all section summaries already exist (use --force).");
  }

  const notes: SectionAudioNote[] = [];
  for (const p of plans) {
    if (existsSync(join(manifestDir, p.audio))) notes.push({ sectionIndex: p.index, audio: p.audio });
  }
  let existingManifest: SectionAudioManifest | null = null;
  if (existsSync(manifestPath)) {
    try {
      existingManifest = await readJson<SectionAudioManifest>(manifestPath);
    } catch {
      existingManifest = null;
    }
  }
  const manifest = buildSectionManifest({
    existing: existingManifest,
    lang,
    voice,
    engine: `${model}@mlx-audio`,
    generatedAt: new Date().toISOString(),
    notes,
  });
  await writeJson(manifestPath, manifest);

  const present = new Set<string>();
  for (const n of manifest.notes) if (existsSync(join(manifestDir, n.audio))) present.add(n.audio);
  const validation = validateSectionManifest(manifest, present);
  const rendered = report?.items.filter((i) => i.ok) ?? [];
  const failures = (report?.items ?? []).filter((i) => !i.ok && i.error !== "empty text");

  console.error(
    `\n✓ section-audio: ${manifest.notes.length} summary clip(s) → ${manifestPath}\n  rendered this run: ${rendered.length}  ·  audio dir: ${audioAbsDir}`,
  );
  const problems: string[] = [];
  if (!validation.ok) problems.push(`${validation.missing.length} missing file(s)`);
  if (failures.length) problems.push(`${failures.length} render failure(s)`);
  if (problems.length) {
    console.error(`\n✗ validation failed: ${problems.join(" · ")}`);
    process.exit(1);
  }
}

function usage(): void {
  console.log(
    [
      "tsumugu gen — batch generation harness (agent-run, no API in core)",
      "",
      "  pnpm gen prep   --lang <id> --in <source.txt> [--store ws.json] [--target 0.95]",
      "                  [--mode directed --words a,b] [--title T] [--out path]",
      "                  [--pack <id>] [--pack-module <path>] [--agent <name>]   (--agent is a free-text provenance tag; it does not change the prompt or behavior)",
      "  pnpm gen transcript --lang <id> --in <transcript> [--video <youtube url|id>] [--store ws.json] [--target 0.95]",
      "                  [--format auto|srt|vtt|youtube|plain] [--title T] [--out path]",
      "                  [--pack <id>] [--pack-module <path>]",
      "  pnpm gen verify --in <prepared.json> [--store ws.json] [--lang <id>] [--fix]",
      "                  [--target 0.95] [--words a,b] [--pack-module <path>]",
      "  pnpm gen verify-encoding --in <encoding-twin.md>   (ARCHITECTURE.md invariants #4/#5 + NFC filename)",
      "  pnpm gen auto     --lang <id> --store ws.json [--limit 8] [--out path]",
      "  pnpm gen wiki     --lang <id> --store ws.json [--words a,b|--flagged|--srs] [--out-dir wiki/Inbox]",
      "  pnpm gen encoding --lang <id> --store ws.json [--words a,b|--flagged|--srs] [--out-dir wiki/Inbox]",
      "  pnpm gen bridge   --lang vi --store ws.json [--bridge-lang zh-Hant] [--words a,b]",
      "                    | --cache results.json --registry bridge/vi-bridge.json --lang vi --store ws.json",
      "  pnpm gen crossref --source srs --in export.json --lang <id> [--store ws.json] [--apply] [--overwrite] [--out ws.json]",
      "  pnpm gen crossref --source srs-db --in srs-core.db --lang zh-Hant --from-lang zh [--apply]   (enriched: reads the real SQLite; relabels the source's 'zh' → 'zh-Hant')",
      "  pnpm gen writeback --store ws.json --db srs-core.db [--lang <id>] [--apply --out copy.db]   (Fork B2: dry-run by default; writes a COPY, never your live SRS)",
      "  pnpm gen voice-notes --in <prepared.cues.json> [--voice Serena] [--model <id>] [--out audio/<slug>/]   (local OSS batch TTS → mp3 per cue + voice-notes.json)",
      "                    [--limit N] [--cues 73,386,647] [--slow all|over:30|cues:73,647] [--slow-instruct \"…\"] [--force] [--dry-run]",
      "  pnpm gen word-audio --in <prepared.json> [--words all|glossary] [--voice Serena] [--model <id>] [--out audio/words/]   (per-word Serena mp3 for hover 🔊)",
      "                    [--limit N] [--force] [--dry-run]",
      "  pnpm gen section-audio --in <…cues.json> [--voice Serena] [--model <id>] [--out audio/sections/]   (Serena mp3 per section summary)",
      "                    [--limit N] [--force] [--dry-run]",
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
    case "transcript":
      return cmdTranscript(opts);
    case "verify":
      return cmdVerify(opts);
    case "verify-encoding":
      return cmdVerifyEncodingTwin(opts);
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
    case "writeback":
      return cmdWriteback(opts);
    case "voice-notes":
      return cmdVoiceNotes(opts);
    case "word-audio":
      return cmdWordAudio(opts);
    case "section-audio":
      return cmdSectionAudio(opts);
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
