#!/usr/bin/env python3
"""
Qwen3-TTS synthesis worker for `pnpm gen voice-notes` (PRD-Voice-Notes M1, Part A).

Pure synthesis, data-free, public. The TypeScript orchestrator
(`scripts/gen/lib/voiceNotes.ts`) owns ALL manifest / incremental / mp3 logic;
this worker only renders the wavs it is told to and reports timings.

Contract
--------
Input: a JSON job spec, via `--job <file>` or stdin:

    {
      "model": "mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-bf16",
      "voice": "Serena",
      "language": "Chinese",
      "items": [
        { "index": 73, "text": "…", "instruct": null,            "outWav": "/abs/cue-0073.wav" },
        { "index": 73, "text": "…", "instruct": "語速放慢、咬字清晰", "outWav": "/abs/cue-0073.slow.wav" }
      ]
    }

A "slow" take is simply an item whose `instruct` is non-null — there is no slow
flag here. Natural and slow renders of the same cue are two separate items.

Output: a JSON report, wrapped in sentinels on stdout so the orchestrator can
extract it cleanly even when model-loading libraries print to stdout:

    <<<VOICE_NOTES_REPORT>>>
    { "model": "…", "voice": "…", "items": [ { "index", "outWav", "ok",
      "durationSec", "genSec", "sampleRate", "error"? } ] }
    <<<END_VOICE_NOTES_REPORT>>>

All diagnostics go to stderr. The model loads once. The model download (~3.5 GB)
is a one-time HF cache fill; thereafter fully offline.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

REPORT_BEGIN = "<<<VOICE_NOTES_REPORT>>>"
REPORT_END = "<<<END_VOICE_NOTES_REPORT>>>"


def log(*args: object) -> None:
    """Diagnostics to stderr — stdout is reserved for the sentinel-wrapped report."""
    print(*args, file=sys.stderr, flush=True)


def read_job(args: argparse.Namespace) -> dict:
    raw = Path(args.job).read_text(encoding="utf-8") if args.job else sys.stdin.read()
    job = json.loads(raw)
    if not isinstance(job, dict) or "items" not in job:
        raise ValueError("job spec must be an object with an 'items' array")
    return job


def main() -> int:
    ap = argparse.ArgumentParser(description="Qwen3-TTS batch synthesis worker (mlx-audio).")
    ap.add_argument("--job", help="Path to a JSON job spec (default: read stdin).")
    args = ap.parse_args()

    job = read_job(args)
    model_id = job.get("model") or "mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-bf16"
    voice = job.get("voice") or "Serena"
    language = job.get("language") or "Chinese"
    items = job["items"]

    # Import heavy deps lazily so a `--help` / arg error never pays the cost, and
    # turn a missing-dependency ImportError into a clear, actionable message
    # (the orchestrator surfaces this stderr line) rather than a bare traceback.
    try:
        import numpy as np
        import soundfile as sf
        from mlx_audio.tts.utils import load_model
    except ImportError as err:
        log(
            f"✗ TTS worker dependency missing: {err}. Install the worker deps into the venv:\n"
            f"    <venv>/bin/pip install -r scripts/gen/voice/requirements.txt\n"
            f"  (see personal/voice/README.md)."
        )
        return 2

    log(f"Loading {model_id} (first run downloads ~3.5 GB; then cached)…")
    model = load_model(model_id)

    results: list[dict] = []
    for it in items:
        index = it.get("index")
        text = (it.get("text") or "").strip()
        out_wav = it["outWav"]
        instruct = it.get("instruct")  # None → natural; str → slow/instructed take
        entry: dict = {"index": index, "outWav": out_wav}
        if not text:
            entry.update(ok=False, error="empty text")
            results.append(entry)
            continue
        try:
            t0 = time.perf_counter()
            chunks = list(
                model.generate_custom_voice(
                    text=text,
                    speaker=voice,
                    language=language,
                    instruct=instruct,
                )
            )
            gen_sec = time.perf_counter() - t0
            audio = np.concatenate([np.asarray(c.audio) for c in chunks])
            sr = getattr(chunks[0], "sample_rate", 24000)
            Path(out_wav).parent.mkdir(parents=True, exist_ok=True)
            sf.write(out_wav, audio, sr)
            dur = len(audio) / sr if sr else 0.0
            entry.update(
                ok=True,
                durationSec=round(dur, 3),
                genSec=round(gen_sec, 3),
                sampleRate=int(sr),
            )
            tag = "slow" if instruct else "nat "
            log(f"  cue {index!s:>4} {tag} {gen_sec:5.1f}s gen → {dur:4.1f}s audio | {text[:28]}")
        except Exception as err:  # noqa: BLE001 — per-item failure must not kill the batch
            entry.update(ok=False, error=f"{type(err).__name__}: {err}")
            log(f"  cue {index!s:>4} FAILED: {err}")
        results.append(entry)

    report = {"model": model_id, "voice": voice, "items": results}
    sys.stdout.write(REPORT_BEGIN + "\n")
    sys.stdout.write(json.dumps(report, ensure_ascii=False))
    sys.stdout.write("\n" + REPORT_END + "\n")
    sys.stdout.flush()
    # Non-zero exit only when EVERY item failed (nothing rendered); partial
    # failures are reported per-item and validated TS-side.
    return 0 if any(r.get("ok") for r in results) or not results else 1


if __name__ == "__main__":
    sys.exit(main())
