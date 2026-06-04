# Examples — Transcripts (Phase 7)

Original sample transcripts for `pnpm gen transcript` (PRD §5, §11 Phase 7): **text-first** ingestion of captions/subtitles, with AI commentary on the hard (colloquial / slangy / idiomatic / culturally loaded) sections. **No audio STT** — you paste text the platform already provides (YouTube transcript, a `.srt`/`.vtt`, or plain text).

| File | Format | Shows |
|------|--------|-------|
| `night-market.zh-Hant.srt` | SRT | A few original Traditional-Chinese cues with timestamps, a duplicate cue (deduped), and an `<i>` tag (stripped). |

## Supported formats (`--format auto` by default)

- **`srt`** — `<index>` / `HH:MM:SS,mmm --> HH:MM:SS,mmm` / text block(s).
- **`vtt`** — starts with `WEBVTT`; cues are `HH:MM:SS.mmm --> HH:MM:SS.mmm` then text. `NOTE`/`STYLE`/`REGION` blocks and cue settings are dropped; `<c>`/`<i>`/inline-timestamp tags stripped.
- **`youtube`** — a pasted transcript: lines alternating a timestamp (`M:SS` or `H:MM:SS`) and the caption text (timestamp on its own line **or** prefixing the text).
- **`plain`** — no timestamps; split into lines/paragraphs as-is.

All formats: HTML/VTT tags are stripped, whitespace inside a cue is collapsed, empty cues are dropped, and a cue whose text repeats the previous cue's is dropped (auto-captions churn). The cue **timestamps** are written to a `<out>.cues.json` sidecar; the `PreparedContent` keeps line breaks (one cue per line) so the reader renders them.

## Try it

```sh
pnpm gen transcript --lang zh-Hant \
  --in examples/transcripts/night-market.zh-Hant.srt \
  --pack-module examples/packs/zh-hant-example/index.ts
```

This writes `Inbox/zh-Hant/<slug>.prepared.json` + a `.cues.json` sidecar, then prints the content-prep + transcript-commentary prompts and a run-context block. Fill the empty glosses/explanations, write the commentary note, then `pnpm gen verify --in <out>` (OpenCC + CI re-score).

These are **original demo data**, not redistributed media — safe in the public Apache-2.0 repo.
