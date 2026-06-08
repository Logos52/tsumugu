# Build status

Snapshot of what's implemented and validated. Intent lives in [`PRD.md`](./PRD.md); this tracks *reality*. Verified by `pnpm test` (536 public tests; 731 incl. the private packs), five typecheck passes, `pnpm validate:phase0` (14 e2e checks), and `pnpm --filter @tsumugu/web build`.

## PRD §2 success-criteria coverage (audited)

| # | Criterion | Status | Where |
|---|-----------|--------|-------|
| 1 | Read + live status + pre-baked hover + grade (buttons/hotkeys) + next-unknown nav + zh tone coloring | ✅ done | `apps/web/src/reader`, `apps/web/src/packs` (browser packs: tone coloring + OpenCC + zh-TW/vi-VN TTS), `engine/*` |
| 2 | Offline dict, custom/override entries, ≥95% coverage | ✅ engine done · ⚠️ ≥95% needs a real private pack | `engine/content/hover` (custom>prebaked>dict), `store.setCustom` |
| 3 | Compounding cross-language word store, in the vault | ✅ done | `engine/store`, `web/host/fsVault` |
| 4 | Flag-for-clarification → next batch | ✅ done (word-level) | `store.flag`, `reader` `f` key, CLI `--flagged` |
| 5 | Content prep w/ pre-resolved unknowns, CI ~95%, OpenCC-guarded | ✅ done | `scripts/gen` (`prep`/`verify`), real OpenCC via example pack |
| 6 | Directed + autonomous modes | ✅ done | `gen prep --mode directed` / `gen auto` |
| 7 | Wiki + encoding pages + bridge entries | ✅ generators done · ⚠️ Quartz site is a starter; pages are agent-filled skeletons | `scripts/gen/lib/wiki`, `wiki/` |
| 8 | Pull SRS (no scheduler) + click word → encoding page | ✅ done | `engine/srs`, `web/review`, `web/encoding` (hash router) |
| 9 | Anki `.apkg` export (client-side) | ✅ done | `engine/anki` (deterministic; structural validation only) |
| 10 | Hán-Việt bridge + cross-seeding | ✅ engine+harness done · ⚠️ seed = your private SRS export | `engine/bridge`, `gen bridge` |
| 11 | External-vocab cross-reference (SRS→Anki) | ✅ SRS done; adapter interface for the rest | `engine/crossref`, `gen crossref` |
| 12 | Public engine clones + runs a demo, data-free | ✅ done | `demo-pack`, `examples/` |

**8 done, 4 with caveats that are open-core-by-design (the ≥95% dict, the published Quartz site, and the SRS seed all live in your private layer / Repo 2, not this public repo). 0 hard gaps.**

## Open-core hygiene (audited)

No secrets/keys, no network calls in the engine or reader runtime, no licensed dictionary dumps. All deps are permissively licensed: the **engine** deps (`ts-fsrs`, `sql.js`, `fflate`, `opencc-js`) are **Apache-2.0**; the **reader** adds `wavesurfer.js` (**BSD-3-Clause**, the M2.1 practice bar — reader/host layer only, lazy-loaded, engine untouched). `.gitignore` blocks `/packs/private/`, `/personal/`, `/data/`, `/vocab/`, and secrets. Engine is DOM-/fs-/network-free (only the `systemClock` adapter touches `new Date`).

## What's NOT here (by design or deferred)

- **Private zh/vi packs** — **built** (in the gitignored `packs/private/`, never committed): zh-Hant = jieba-wasm seg + 122k CC-CEDICT + **official TOCFL leveling** (14.8k words, freq fallback) + pinyin→Zhuyin + OpenCC; vi = longest-match tokenizer + 39k kaikki dict + IPA + tones + Hán-Việt bridge hook. Build the data with `pnpm exec tsx packs/private/fetch-data.ts`; plug in via `--pack-module packs/private/index.ts`. **Browser-side packs** (`apps/web/src/packs`) give the reader real tone coloring / OpenCC / TTS with public algorithms + optional vault-loaded dictionary. The public repo ships only the data-free demo pack + the `examples/packs/zh-hant-example` (real OpenCC, tiny original sample).
- **Published Quartz wiki (Repo 2)** — now live at **https://logos52.github.io/tsumugu-wiki/** (repo [`Logos52/tsumugu-wiki`](https://github.com/Logos52/tsumugu-wiki), Quartz v4 → GitHub Pages, auto-deploys on push). The `wiki/` folder here is the seed content; the live repo is the source of truth.
- **Phase 6 (Chromium extension)** — **descoped** (see `DESIGN-HISTORY.md`): it conflicts with the pre-baked design and duplicates the web app + clip→prep→read pipeline.
- **Phase 7 (transcript ingestion)** — **done**: `pnpm gen transcript` parses SRT/VTT/YouTube/plain (dedup, tag-strip, timestamp sidecar) → reader content with line breaks; `prompts/transcript-commentary.md` for AI commentary on hard sections.
- **Phase 8 (voice)** — **M1 done (2026-06-06)**: local open-source batch TTS landed end-to-end (see the "Voice notes (Phase 8 M1)" section below). `PRD-Voice-Notes.md` (v2) dropped the Supergrok-UI path (v1 archived in `personal/archive/`); M0 bake-off chose **Qwen3-TTS 1.7B CustomVoice via mlx-audio, voice Serena** (full engine survey in `personal/research/zh-tts-options.md`). M1 shipped the `gen voice-notes` helper + reader playback, shadowing mode, and Anki-with-audio; **M2.1** added the segment-loop practice bar (see the sections below). BreezyVoice = TW/zhuyin fallback; GPT-SoVITS = accent fine-tune track (M3).
- **The agent fill step** — generation prompts brief Claude Code / Grok Build; the actual gloss/explanation/etymology writing is that agent's job (no API in the core).

## Reading layer + two-way SRS sync (in progress — 2026-06-05)

Building the reading layer (zhuyin ruby above, colored unknown-underline, hover, click-to-grade) across reader + Netflix + YouTube, plus safe two-way SRS sync. Design + PRD in the private reading-overlay notes. Shipped & green (381 public + 195 private tests, typecheck):

- **M0 — s2twp guard.** `apps/web/src/packs/zhHant.ts` + `packs/private/zh-hant/index.ts` now use OpenCC `cn→twp` (Taiwan-idiom), not plain `tw` (fixes 軟件→軟體 / 信息→資訊). Asserted in `zhHant.test.ts`.
- **M1 (reader seam) — zhuyin ruby.** `settings.phonetics` (default off) renders each word as per-char `<ruby><span>字</span><rt>ㄗ</rt></ruby>` aligned to the prebaked reading (`reader.ts paintWordContent`), graceful fallback when unaligned; reader container gets `data-visual="phonetic"`. Neutral-tone dot kept LEADING (matches `tones.ts` + Taiwan MoE), locked by `packs/private/zh-hant/pinyin.test.ts` (147 rows).
- **M1 CSS — phonetic visual.** `styles.css` scopes the ruby styling + per-status colored underline ramp (`#fe4670` pink / `#ff9345` orange, no fill) + filled-blue selected box under `[data-visual="phonetic"]`; the default fill model is untouched. A `zhuyin` toolbar toggle flips it. *(integrated)*
- **M3 — provenance sync core.** Store bumped to `tsumugu/word-store@2` with a per-word provenance envelope (`statusUpdatedAt`/`statusSource`/`statusOrigin`/`externalRefs`); `@1` files still load. `setStatus` stamps a real status-change clock (distinct from `lastSeen`). New engine `resolveStatusUpdate` (clock-aware, `never-demote` default) replaces `applyToStore`'s binary `--overwrite` — **fixes the confirmed demote-on-reimport data-loss bug** (regression test in `crossref/resolve.test.ts` + `phase35.test.ts`).
- **M4 — YouTube synced-reader.** `apps/web/src/reader/sync.ts` (pure: `parseTimecode`, `cueIndexAtTime`, `alignCuesToTokens`) + `transcript.ts` (player/scrubber panel + rAF cue-highlight) + `youtube.ts` (sanctioned IFrame Player wrapper; falls back to a local scrubber offline). `AppState.transcript` binds cues to content; the reader mounts the panel only when a transcript is present (plain reading + tests unaffected). Highlights the playing cue in Tsumugu's OWN text — no code runs on youtube.com. Demo sample "中文 — 夜市 (synced ▶)". Tests: `sync.test.ts` (10) + `transcript.test.ts` (2). **393 public tests green.**

- **M3b — enriched SRS importer (direct SQLite).** `scripts/gen/lib/srs-db.ts` (`parseSrsDb`/`readSrsDb`) reads the real SRS export `.db` via sql.js — skips soft-deleted rows, joins the latest `wordHistory` origin, and emits `ExternalVocabRecord[]` with the 4-tuple + `mod` + origin in `raw.*` (exactly what the M3 resolver consumes). CLI: `gen crossref --source srs-db --in *.db` (also auto-detected by `.db`), plus a `--from-lang` relabel (the SRS export stores Chinese as **`zh`**; Tsumugu uses `zh-Hant` — relabel re-tags rows while `externalRefs[].language` preserves the original code). `sql.js` added to root devDeps (engine untouched; reader stays in `scripts/`). Test `srs-db.test.ts` (2, in-memory fixture). **Real-DB acceptance:** seeds 2108 zh words with provenance; **re-apply = "0 demotion(s) blocked", idempotent**. The direct path is richer than the lossy `converted.json` (2109 incl. 497 unknowns vs 1611 known-only).

- **M4b — caption ingest glue.** `gen transcript --video <youtube url|id>` extracts the 11-char id (`parseYouTubeId`) into the `.cues.json` sidecar. The web app's **"Open reading…"** loads a `gen transcript` `.prepared.json` (+ its `.cues.json`) from disk and binds them via `setContent`/`setTranscript` (`classifyReadingDocs`/`readReadingFiles`), so a real ingested video reads synced (IFrame when a videoId is present, scrubber otherwise — Netflix readings ride the scrubber path). Full chain: yt-dlp → `gen transcript --video` → read synced. Tests: `parseYouTubeId` (2) + `classifyReadingDocs` (4).

- **M3c — SRS write-back (Fork B2, fenced).** `scripts/gen/lib/srs-writeback.ts` + `gen writeback --store ws.json --db srs-core.db`. Pushes Tsumugu grades back toward the SRS export, addressed by the persisted `externalRefs` 4-tuple. Safety is the design: **dry-run by default** (reports the diff, writes nothing); **never-clobber** (pushes only where Tsumugu's `statusUpdatedAt` is strictly newer than the SRS export's `mod`); **copy-only** (`--apply --out copy.db` writes a MODIFIED COPY — `--in-place` needs `--yes`; the live OPFS store is never touched). Updates `WordList` (knownStatus + fresh mod + `isPendingEnqueue=1`) so the SRS syncer uploads it; `wordHistory` left alone (opaque `day`). Real-DB acceptance: a simulated grade pushes 1 change to a copy, skips 2108 unchanged, **original DB byte-identical (md5 unchanged)**. Test `srs-writeback.test.ts` (3).

- **Reader UX + local-dev ergonomics (2026-06-05).** Synced-reader polish on the branch: the hover popup got a real width (was collapsing to a sliver); with a `videoId` the player sits in a sticky **left column beside the scrolling transcript**; a **"deep dive ↗"** in the popup opens the word's encoding page (etymology/examples/mnemonics). Local-dev convenience (dev-only Vite plugin, production client-side build untouched): a **`/@vault/` bridge** auto-loads the real word store on page-load (no File System Access click) and **persists grades to disk**; a **readings picker** discovers `*.prepared.json` under `personal/` and **auto-restores the last-opened reading**; the **zhuyin/tones/guess-first toggles persist** across reloads.

- **Agent fill step — proven end-to-end.** Filled the `why-friendship-differs` transcript skeleton (Mandarin Corner, `2idX7w0gs4k`) via a 17-agent parallel fill workflow: 660 glossary entries → full `PrebakedEntry` (gloss, zhuyin reading, pos, level, leveled Traditional explanation, source examples); `gen verify --fix` → **"✓ verified — ready to read"** (OpenCC-clean; CI 80% is the transcript's difficulty, not a gate). Findings: `gen verify --fix` OpenCC-normalizes tokens too (a source `了解`→`瞭解` then reads as unknown unless the store is s2twp-normalized); `s2twp` over-localizes a few terms (e.g. `連接詞→連線詞`).

The reading layer + two-way sync arc is **complete** (the brief's three surfaces + bidirectional SRS sync), now with a usable local reading experience on top. **519 public + 195 private tests green.**

## Voice notes — Phase 8 M1 (done — 2026-06-06)

Per-sentence local TTS for listen + read + shadowing, per `PRD-Voice-Notes.md` + `personal/voice/M1-BRIEF.md`. Engine stays DOM-/fs-/network-free and gained **no new deps** (wavesurfer arrives in M2.1, not M1); generated audio + venv live under gitignored `personal/`. Shipped & green:

- **Part A — `gen voice-notes` helper.** Public, data-free Python worker `scripts/gen/voice/synthesize_qwen3_mlx.py` (mlx-audio Qwen3 CustomVoice; slow takes via the model's `instruct` kwarg, default `語速放慢、咬字清晰`) + pure orchestration `scripts/gen/lib/voiceNotes.ts` (cue selection, `--slow all|over:N|cues:`, incremental skip, manifest build/**merge** preserving untouched cues, validation) wired as a `pnpm gen voice-notes` subcommand. wav → **mono 96 kbps mp3** via ffmpeg (intermediate wav deleted); writes/merges `<slug>.voice-notes.json` (`tsumugu/voice-notes@1`, with `engine`/`voice`/`generatedAt`). Incremental + idempotent (`--force` re-renders); `--dry-run` plans without loading the model; clear preflight errors for a missing venv/ffmpeg. Reuses `personal/research/bakeoff/.venv` (resolve order: `$TSUMUGU_VOICE_PYTHON` → bake-off venv → `personal/voice/.venv`; setup in `personal/voice/README.md`). Tests: `voiceNotes.test.ts` (19).
- **Real run (acceptance).** `why-friendship-differs` (Mandarin Corner, 1,010 cues): **1,010 natural takes, RTF 0.81, avg 1.8s/take, ≈30.5 min** on the M3/18GB — consistent with the 0.77 validation projection. Manifest + 1,010 mp3s in `personal/inbox/zh-Hant/` (gitignored); a re-run skips all 1,010 (idempotent). Ear-checked: voice **Serena** judged natural for study, polyphone 得=ㄉㄟˇ correct on cue 73. Generation-side slow takes were trialed (`--slow over:30`) then **dropped** after QA — see the Decision Log; slow is now reader-side (next bullet).
- **Reader voice module (thin, inert without a manifest).** Binary reads added to the host: optional `VaultIO.readBytes` (engine port) implemented by httpVault/fsVault/MemoryVault, and the dev `/@vault/` bridge now serves `.mp3/.wav/.m4a/.ogg` as binary (verified: mp3 → `audio/mpeg`, byte-exact, valid duration). `voice/manifest.ts` parses/validates the sidecar and resolves audio against its directory; discovery binds it to `AppState.voiceNotes` on the dev-vault load path. `voice/player.ts` plays cues through one `HTMLAudioElement` (lazy blobs, LRU 10), **slow = pitch-corrected `playbackRate 0.85×`** (uniform on every cue; generation-side slow takes dropped — see Decision Log; the `audioSlow` path stays in the schema if a good slow take is ever produced), missing file → Web Speech fallback, `playFrom` chains cues with a 350 ms gap. Transport gains 🔊 / ⏩ / ⏹ / 🐢 / 跟讀 (only when a manifest is present); **shadowing mode** (pure state machine in `voice/shadowing.ts`) plays → highlight holds → **Space** advances, **Esc** exits (Space claimed only while shadowing). Settings `voiceNotesEnabled` (default on) + `voiceSlow` (default off) persist; shadowing is per-session. Tests: `manifest` (8), `player` selectPlayback matrix (4), `shadowing` (9).
- **Anki with audio (B4).** Engine exporter gained `deck.media` (numbered media map + archive entries; determinism preserved; the empty/absent case is **byte-identical** to media-free exports) + web sentence-deck builder (`voice/ankiDeck.ts`: front = cue text, back = `tr` + `[sound:cue-NNNN.mp3]`, audio bytes read via the vault; unreadable cues skipped) + an "Export Anki 🔊" toolbar action. Tests: exporter media (3) + `ankiDeck` (2).
- **Builder-decided knobs (QA-tuned):** mp3 96 kbps mono; player LRU 10; chained/​shadowing gap 350 ms; **slow = reader-side `playbackRate 0.85×`** (generation-side instruct dropped — it overcorrected 1.4–2× and unpredictably); voice **Serena** confirmed by ear-check. The `--slow` CLI flag + `instruct` worker path remain available (off by default) for a future better slow take. **Not built (out of M1):** wavesurfer/segment-loop (M2.1), read+explain, tr/commentary voices, multi-voice, cloning, any cloud/API path, loop-region persistence, Vietnamese.
- **Not yet verified:** a real-Anki import of the audio deck (structural tests only, mirroring the existing exporter caveat); the in-browser click-through demo (load `why-friendship-differs`, play cues 73/386/647, toggle slow, shadow 0–8) is a manual step — the dev-bridge audio path, the transport/shadowing DOM wiring, and the player's blob-IO/fallback are verified headlessly (happy-dom). **57 new tests (406 → 463 public).**

## Voice notes — Phase 8 M2.1 (done — 2026-06-07)

Audacity-style **segment-loop practice bar** (PRD §8 + Decision Log): open a waveform under a voiced cue,
drag-select a slice, loop it (L) and slow it, to drill shadowing in-context. Engine untouched; reader-only.

- **wavesurfer.js v7 + regions plugin** (BSD-3-Clause), added to `apps/web` only and **dynamically imported**
  inside `voice/practiceBar.ts` — it code-splits into lazy `wavesurfer.esm` (40 kB) + `regions.esm` (16 kB)
  chunks, so the main bundle is unchanged (~591 kB) and no other module pulls it. Engine gains no dep.
- **`voice/practiceBar.ts`** mounts the waveform for one cue's blob (`vault.readBytes` + object URL),
  `enableDragSelection` for a single region, loop via the regions `region-out` seek-back (~30 ms media-element
  seam, per PRD; gapless `AudioBufferSourceNode` is the documented upgrade), speed via `setPlaybackRate(rate, true)`.
  Pure math in **`voice/practiceBarLogic.ts`** (`loopBounds`, `nudgeEdge` clamped, `nearestEdge`, `cycleSpeed`).
- **Reader UX:** a 🌊 transport button (only with a voice manifest) opens the bar **pinned to the current cue**;
  controls ▶ / 🔁 / speed (1× / 0.85× / 0.75×). Hotkeys are **scoped to when the bar is open**: `L` toggles
  loop (Audacity-style), `[` / `]` nudge the nearest edge, `Esc` closes — so `l` stays next-word when the bar
  is closed (collision resolved). Per-session (no region persistence yet — PRD open question).
- **Tests (+16):** `practiceBarLogic` (10), practice-bar wiring via an injected fake factory in
  `transcript.voice.test.ts` (5), and the L-collision integration in `reader.practice.test.ts` (2, wavesurfer
  mocked). The real waveform render + loop seam is a **manual** check (wavesurfer needs Web Audio/canvas).
- **Not built (out of M2.1):** loop-region persistence, gapless `AudioBufferSourceNode`, other M2 items
  (read+explain, tr/commentary voices, multi-voice).

## Voice notes — Phase 8 M2.2 (done — 2026-06-07)

Reader ergonomics from real use: easier sentence navigation + a video A/B loop. No new deps; reuses the
panel's per-frame poll + `seek` (works for the YouTube IFrame and the offline scrubber alike).

- **Click-to-select (decoupled from the video):** every token carries `data-ti`; a click maps to its cue
  (`cueForToken`) and **selects** it (`selectCue` → highlight + the target for 🔊 / 🌊 / 跟讀 + the practice
  bar follows) **without seeking the video** — the ▶ play button stays the normal line-by-line video
  play-through. The selection drives the highlight (precedence: voice > selection > clock) and is cleared when
  the video plays or is scrubbed. Hover/grading untouched.
- **Cue-step keys:** **↑ / ↓** (and `,` / `.`) select the previous/next sentence (no video move).
- **Video "loop this sentence":** a 🔂 transport toggle seeks the video to the selected line and loops its
  `[start, end]` via `frame()` + pure `shouldLoopBack(t, bounds)` — a deliberate video action (distinct from
  click-select). Complements the practice bar (which loops the TTS audio).
- **Tests (+7):** `shouldLoopBack` (2, `sync.test.ts`); `cueForToken` / `seekToCue` / `prev`·`nextCue` /
  🔂-toggle (3, `transcript.voice.test.ts`); click-to-activate + `,`·`.` integration (2, `reader.practice.test.ts`).
  The real video seek-back loop is a **manual** check (rAF + live player time).
- **Not built (out of M2.2):** freeform A/B markers (arbitrary in/out points), full per-line clickable blocks,
  loop persistence.

## Voice notes — Phase 8 M3-lite: per-word audio (done — 2026-06-07)

The hover 🔊 now plays a word in the **Serena** voice instead of Web Speech, via a batch helper that renders
one mp3 per word — same architecture as voice notes (engine untouched, no new deps, assets under `personal/`).

- **`gen word-audio --in <prepared.json> [--words all|glossary]`:** pure `scripts/gen/lib/wordAudio.ts`
  (word selection, **stable hash-named paths via the engine's `sha1Hex`** so identical words dedup across runs
  and readings, incremental plan, manifest build/merge/validate) + `cmdWordAudio` reusing the voice-notes IO
  (`resolveVoicePython` / `runVoiceWorker` / `runFfmpeg`). Writes `<slug>.word-audio.json`
  (`tsumugu/word-audio@1`, word → `audio/words/<hash>.mp3`). `--dry-run`, incremental, validates. Default
  `--words all` (every unique word); `glossary` limits to studied unknowns. `deriveSlug` now also strips
  `.prepared.json` so the sidecar name matches the reader's discovery.
- **Reader:** `voice/wordAudio.ts` (parse/bind/`selectWordSrc` + a small LRU player) — discovered beside the
  reading into `AppState.wordAudio`; the hover popup 🔊 (`reader.ts`) plays the word's clip via
  `vault.readBytes`, **falling back to Web Speech** per word (and entirely when no manifest is present). Inert
  otherwise; cue voice / shadowing / practice bar / navigation untouched.
- **Polyphone caveat (documented):** a word rendered out of context can mispronounce polyphones (得/行/了).
  The zhuyin ruby + the in-context **cue** voice note stay authoritative; BreezyVoice inline-zhuyin word
  renders are the PRD's future exact fix.
- **Real run:** `why-friendship-differs --words all` rendered **1,356 unique words** (Serena), **RTF 0.83,
  ~20 min, 21 MB** hash-named under `audio/words/` (gitignored); re-run is idempotent (0 to render).
  **Tests (+17):** `wordAudio` lib (6), `voice/wordAudio`
  parse/bind/player (8), reader popup 🔊 integration (3); `deriveSlug` `.prepared.json` case.
- **Runaway-clip fix (2026-06-07):** a bare single word can make Qwen3-TTS hallucinate a ~6 s clip (我/所以/
  電腦…). Lowering temperature didn't reliably help, so `cmdWordAudio` now re-rolls any take longer than
  `maxWordDurationSec(chars) = 2.0 + 0.7·chars` up to 4× (each generation is independent), then accepts-with-
  warning or skips→Web-Speech; the worker gained an optional `temperature` knob. Re-rendered **32** hallucinated
  clips in `why-friendship-differs` → **0 over-cap**. Test: `maxWordDurationSec` (+1).
- **Not built (out of M3-lite):** BreezyVoice zhuyin-exact renders, Vietnamese word audio, hover auto-play,
  word audio in Anki.

## Voice notes — auto-following practice bar (2026-06-07)

UX revision from real use: the practice bar is now **always visible and follows the active sentence** instead
of being a manual, pinned 🌊 popup. One wavesurfer instance is created up front; `setCue()` reloads its
waveform (cheap `ws.load`, per-cue URL cache) whenever the active cue changes — click a line / `,`·`.` /
playback all move it. 🌊 now toggles the bar's visibility. Loop moved to the **🔁 button** (+ drag-select) so
the Audacity-`L` no longer collides with `l` = next-word; `[` / `]` still nudge the loop edges. The ▶ / 🔁
pause the video first so audio doesn't overlap. Tests updated (`practiceBar.setCue`, auto-show, follow-on-seek,
`l` stays next-word).

## Section summaries in the target language + summary audio (2026-06-07)

The "now talking about…" section summaries were filled in English; the commentary prompt actually wants
monolingual target-language text. Fixed for immersion: summaries now read in **繁體中文**, with English on the
**譯** toggle, and each playable in **Serena**.

- **Content:** the 18 `sections[]` in `why-friendship-differs.prepared.cues.json` rewritten — `summary` →
  leveled Traditional Chinese (OpenCC-checked; the only s2twp hits were its own over-localizations
  攀岩→攀巖 / 對象→物件, kept as authored), English preserved as `tr`. `TranscriptSection.tr?` added (`sync.ts`).
- **Reader:** the section line shows the Chinese `summary` + a 🔊; when **譯** is on it also shows the English
  `tr` (`.tsg-section-tr`). The 🔊 plays the active section's summary via a `voice/sectionAudio.ts` player
  (blob+LRU, Web-Speech fallback), discovered into `AppState.sectionAudio` (`main.ts`).
- **Generation:** `gen section-audio --in <…cues.json>` (`scripts/gen/lib/sectionAudio.ts` + the shared
  worker) → `<slug>.section-audio.json` (`tsumugu/section-audio@1`, sectionIndex → mp3). Real run: **18
  summary clips** (Serena), under gitignored `audio/sections/`.
- **Tests (+16):** `sectionAudio` lib (5), `voice/sectionAudio` parse/bind/player (7), section UI + 譯 + 🔊
  (4). No new deps; engine untouched.

## Voice notes — audio + looping as a central surface (2026-06-07)

A UX pass from real study use, making "play it / loop it" reachable everywhere in the reader. No new deps;
engine untouched.

- **Click a sentence → play just that one sentence in the video, then stop** (`reader.ts onTextClick` →
  `playCueInVideo`). It seeks to the cue's start, plays, and stops at the cue's end (reusing `shouldLoopBack`
  for the boundary) so playback never runs on into the next line; the just-played line stays highlighted. The
  stop is armed only once the (async YouTube) seek lands inside the cue, so a stale pre-seek clock can't trip it
  early. The **▶ button alone plays the whole video through** — manual play / scrub / 🔂 all clear the one-shot.
  `↑`/`↓` and `,`/`.` still *select* a line without moving the video (preview), via `selectCue`.
- **⏩ is now a play-through toggle** — one press plays every line consecutively in **Serena**'s voice
  (highlight follows), a second press stops, and the button lights while it runs (mirrors the video's
  play/pause). Interrupting with 🔊 (single cue) or 跟讀 (shadowing) clears the lamp honestly.
- **譯 in the transport** — the English-translation reveal (off by default) is now a button right in the reader
  transport, synced to the same `showTranslation` setting as the toolbar 譯 checkbox + the `t` hotkey.
- **Commentary 🔄 loop** — the "now talking about…" line gains a loop toggle beside its 🔊 that repeats the
  active section's clip on a continuous A/B loop (`sectionAudio` player gained `{ loop }` + `stop()`); 🔊 plays
  it once and cancels the loop. (Whole-clip loop; sub-region A/B on commentary, like the 🌊 practice bar does
  for sentences, remains a possible follow-up.)
- **Tests (+5):** ⏩ play/stop toggle + lamp, the 譯 transport button, the section 🔄 loop wiring
  (`transcript.voice` / `transcript.section`), `sectionAudio` loop+`stop()`, and `playCueInVideo` (seek-to-start
  + play); the click-integration test in `reader.practice.test.ts` already covers click → one-shot highlight.

## Voice notes — study-flow controls (2026-06-07)

A second UX pass from live study, tightening the keyboard/mouse loop and the audio sources.

- **Quiet hover by default.** `settings.hoverMode` now defaults to **`shift`**: moving the mouse
  no longer pops a card on every word; the card opens on **Shift-hover** or keyboard word-nav (`←`/`→`). Plain
  focus (e.g. a click, which plays the sentence) stays quiet in shift mode. The toolbar dropdown still offers
  `unknown` / `all` / `⇧shift`.
- **🎙️ audio-source toggle (`v`).** A transport toggle (persisted `settings.serenaOnClick`) flips what clicking
  a sentence / Space / ↑↓ plays: the **video clip** (default) or **Serena's voice** for that line with the video
  **parked, paused** on its first frame. Seek-then-pause-last so YouTube's `seekTo` can't resume the video over
  Serena (only one source ever plays).
- **↑/↓ + `,`/`.` auto-play the sentence** they move to (in the selected source); **Space plays the sentence you
  are hovering / focused on** (and pauses instead while something is playing, so it still works mid-watch). The
  click handler and these share one `playCueInVideo` primitive (one-shot: seek → play → stop at the cue end).
- **Transport wraps** (`flex-wrap`) so the grown button row no longer overflows the video pane into the text.
- **Draggable pane splitter.** A `.tsg-splitter` between the video and text panes in the split layout resizes
  both (CSS `--tsg-split` / `--tsg-split-r`, clamped 20–80% by the pure `clampSplitFraction`); hidden in the
  stacked mobile layout.
- **Tests (+10):** Serena source play/park + toggle persist, playCurrentSentence/nextCue play-on-move, the
  shift-hover gate, `clampSplitFraction`, `playCueInVideo` (seek+play). DOM splitter drag + YT seek-resume are
  layout/runtime-dependent → manual-verified.

## Voice notes — hoverable section summary (2026-06-07)

The Chinese section summary ("now talking about…") is now **hoverable + gradable just like the body text**.
`transcript.ts` renders the summary through an injected `renderSummary` callback; the reader supplies
`renderSummaryInto`, which segments the string with the pack's segmenter and renders each word via the SAME
`renderWord` (status color, Shift-hover card, click-to-grade, zhuyin/tone when prebaked). Graded summary words
recolor in place (a shared `recolorSpan` now covers both body + summary spans); a seq guard drops a stale async
segmentation when the section changes; segmentation failure falls back to plain text. Engine untouched (the
segmenter is the already-loaded client-side pack). **Tests (+1):** `renderSummary` wiring on section change
(`transcript.section.test.ts`); the per-word hover/grade path is the body renderer, already covered.

## Voice notes — A/B video loop strip (2026-06-07)

A 🆎 transport toggle opens a collapsible **A/B loop strip** for the video — the study tool behind the
"drag-to-select waveform" ask. A true amplitude waveform of YouTube audio is impossible (the sanctioned IFrame
embed exposes no audio samples), so the strip is a **timeline** driven only by the player clock:

- A track spanning the transcript duration with a **sentence tick per cue**; drag the A / B handles (or click the
  track to grab the nearer edge) to set the loop. Handles **snap to cue boundaries** (`snapToBoundary`), so even
  a long video is select-by-sentence with no zoom needed (zoom deferred per decision).
- A 🔁 loops the video between A and B (highest precedence in the frame loop; mutually exclusive with the 🔂
  sentence-loop and the click one-shot). A red playhead tracks the current position while open.
- Pure, tested timeline math in `sync.ts` (`timelineTime`, `snapToBoundary`); the drag itself is layout-driven
  (`getBoundingClientRect`) → manual-verified, mirroring the splitter.
- **Tests (+4):** `timelineTime`, `snapToBoundary` (`sync.test.ts`); 🆎 opens the strip + ticks + default region
  (`transcript.voice.test.ts`). No new deps; engine untouched.

## Run it

`pnpm test` · `pnpm typecheck` · `pnpm validate:phase0` · `pnpm --filter @tsumugu/web dev` (reader) · `pnpm gen help` (batch CLI).
