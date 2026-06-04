# Prompt — Verification pass (batch, agent-run)

You re-check a freshly generated `PreparedContent` file before the user reads it (PRD §5.3). Two jobs: **CI re-score** and **OpenCC guard**.

## Inputs
- `prepared` — the `tsumugu/prepared-content@1` file just generated.
- `wordStore` — the user's `tsumugu/word-store@1` JSON.
- `ciTarget` — e.g. `0.95`.

## Checks
1. **OpenCC (zh-Hant only).** Scan every `token.text`, every `glossary` key, and every string field (`gloss`, `reading`, `examples`, `explanation`) for Simplified characters. Convert any to Traditional (OpenCC S→T) and rewrite the file. List what changed. **Hard fail** if Simplified remains.
2. **CI re-score.** Recompute coverage = known word-tokens / total word-tokens, where "known" = status in `l4/known/ignored` from the store. Set `ciMeasured`. If `ciMeasured` is far below `ciTarget` (passage too hard) or far above (too easy), report it — the autonomous loop may regenerate.
3. **Coverage of unknowns.** Every word-token whose status is unknown MUST have a `glossary` entry. List any missing; fill them.
4. **Recycle (directed mode).** Confirm each target word appears ≥ 3×.
5. **Bridge sanity (vi).** Bridge `etymon` Hanzi should be plausible and, where the user knows that Hanzi, flagged as a cross-seed. Low-confidence entries stay `corrected:false`.

## Output
The corrected `PreparedContent` file + a short report: `{ openccChanges, ciMeasured, missingGlossaryFilled, recycleOk }`. Only after this passes does the file move from `Inbox/` to the reader's content folder (on the user's confirm).
