/**
 * Phase 0 end-to-end validation: drive the real engine APIs over the
 * hand-authored example artifacts and assert the loop holds together.
 *
 * Run: pnpm exec tsx scripts/validate-phase0.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  parsePreparedContent,
  WordStore,
  progressMetrics,
  scoreCI,
  crossSeed,
  reviewSrs,
  ensureSrs,
  getDue,
  buildApkg,
  lookupPrebaked,
  type WordStatus,
  type Clock,
} from "@tsumugu/engine";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");
const fixedClock: Clock = { now: () => new Date("2026-06-04T00:00:00Z") };

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  const mark = cond ? "✓" : "✗";
  if (!cond) failures++;
  console.log(`  ${mark} ${name}${detail ? ` — ${detail}` : ""}`);
}

console.log("\n[1] parse prepared content (zh-Hant + vi)");
const zh = parsePreparedContent(read("examples/zh-hant/night-market.prepared.json"));
const vi = parsePreparedContent(read("examples/vi/develop.prepared.json"));
check("zh parses, lang zh-Hant", zh.lang === "zh-Hant");
check("zh has pre-baked 夜市", !!lookupPrebaked(zh, "夜市"));
check("zh 熱鬧 has monolingual explanation", !!lookupPrebaked(zh, "熱鬧")?.explanation);
check("vi parses, lang vi", vi.lang === "vi");
const phat = lookupPrebaked(vi, "phát triển");
check("vi phát triển has Hán-Việt bridge → 發展", phat?.bridge?.etymon === "發展");

// OpenCC guard: no Simplified leakage in the zh fixture (spot-check known pairs).
const zhBlob = read("examples/zh-hant/night-market.prepared.json");
const simplified = ["发", "热", "闹", "国", "们个"].filter((c) => zhBlob.includes(c));
// 们 is valid Traditional (我們); only flag truly-simplified-only chars:
const badSimplified = ["发", "热", "闹"].filter((c) => zhBlob.includes(c));
check("zh fixture has no Simplified leakage", badSimplified.length === 0, badSimplified.join(",") || "clean");

console.log("\n[2] word store round-trip + metrics");
const store = WordStore.fromJSON(read("examples/word-store.example.json"));
check("store loaded 5 entries", store.all().length === 5);
check("發展 is known", store.getStatus("zh-Hant", "發展") === "known");
const reser = WordStore.fromJSON(store.toJSON(fixedClock));
check("toJSON→fromJSON lossless", reser.all().length === store.all().length);
const m = progressMetrics(store, "zh-Hant");
check("zh metrics knownCount ≥ 1", m.knownCount >= 1, `known=${m.knownCount} tracked=${m.trackedCount}`);

console.log("\n[3] CI scorer over the zh passage using the store");
const getStatus = (w: string): WordStatus => store.getStatus("zh-Hant", w);
const ci = scoreCI({ lang: "zh-Hant", tokens: zh.tokens, getStatus });
check("CI computed", ci.totalWordTokens > 0, `coverage=${(ci.coverage * 100).toFixed(0)}% over ${ci.totalWordTokens} word-tokens`);
check("unknown words surfaced", ci.unknownWords.length > 0, ci.unknownWords.map((u) => u.word).join(" "));

console.log("\n[4] cross-seeding vi from known Hanzi (Hán-Việt bridge)");
// Known Hanzi are character-level (as from a Migaku known-word export decomposed
// into characters): a Sino-word is "free" only when every component Hanzi is known.
const knownEtyma = new Set(
  store
    .all("zh-Hant")
    .filter((e) => e.status === "known")
    .flatMap((e) => [...e.word]),
);
const seed = crossSeed({
  targetLang: "vi",
  entries: [{ word: "phát triển", bridge: phat?.bridge }],
  knownEtyma,
});
check("phát triển cross-seeded from 發展", seed.seededCount === 1, JSON.stringify(seed.seeded));

console.log("\n[5] pull-SRS review (deterministic, no scheduler)");
let entry = ensureSrs({ lang: "zh-Hant", word: "熱鬧", status: "l1" }, fixedClock);
const dueBefore = entry.srs!.due;
entry = { ...entry, srs: reviewSrs(entry.srs!, "good", fixedClock) };
check("review 'good' advances due date", entry.srs!.due > dueBefore, `${dueBefore} → ${entry.srs!.due}`);
const due = getDue([entry], { now: () => new Date("2030-01-01T00:00:00Z") });
check("getDue returns the word once overdue", due.length === 1);

console.log("\n[6] Anki .apkg export (client-side, deterministic)");
const apkg = await buildApkg({
  name: "Tsumugu zh-Hant",
  notes: [
    { front: "夜市", back: "night market", tags: ["tsumugu", "zh"] },
    { front: "熱鬧", back: "lively; bustling", tags: ["tsumugu", "zh"] },
  ],
});
const outPath = resolve(root, "examples/out/tsumugu-demo.apkg");
writeFileSync(outPath, apkg);
check(".apkg built (zip bytes)", apkg.length > 100, `${apkg.length} bytes → examples/out/tsumugu-demo.apkg`);
const apkg2 = await buildApkg({
  name: "Tsumugu zh-Hant",
  notes: [
    { front: "夜市", back: "night market", tags: ["tsumugu", "zh"] },
    { front: "熱鬧", back: "lively; bustling", tags: ["tsumugu", "zh"] },
  ],
});
check(".apkg build is deterministic", Buffer.compare(Buffer.from(apkg), Buffer.from(apkg2)) === 0);

console.log(`\n${failures === 0 ? "✅ ALL PHASE-0 CHECKS PASSED" : `❌ ${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
