#!/usr/bin/env python3
"""
Transcribe-back QA for per-cue Serena voice-notes.

Whisper-transcribes each mp3, compares to cue text (OpenCC s2t + strip
non-Han), re-rolls bad clips via `pnpm gen voice-notes` (incremental).

  python3 scripts/verify-voice-notes.py <slug> [--threshold 0.6] [--rounds 4]
  python3 scripts/verify-voice-notes.py --all-youtube
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from difflib import SequenceMatcher
from pathlib import Path

import mlx_whisper
import opencc

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "scripts/gen/voice"))
try:
    from thermal_guard import pace_before_cue
except ImportError:
    def pace_before_cue(_index=None):  # type: ignore[misc]
        return
INBOX = REPO / "personal/inbox/zh-Hant"
VOICE_PY = REPO / "personal/research/bakeoff/.venv/bin/python"
WHISPER = "mlx-community/whisper-large-v3-turbo"
S2T = opencc.OpenCC("s2t")


def norm(s: str) -> str:
    return re.sub(r"[^一-鿿]", "", S2T.convert(s))


def hear(path: Path) -> str:
    result = mlx_whisper.transcribe(str(path), path_or_hf_repo=WHISPER, language="zh")
    return result["text"].strip()


def regen(slug: str, cue_indices: list[int]) -> None:
    cues_arg = ",".join(str(i) for i in cue_indices)
    env = {**os.environ, "TSUMUGU_VOICE_PYTHON": str(VOICE_PY)}
    subprocess.run(
        [
            "pnpm",
            "gen",
            "voice-notes",
            "--in",
            f"personal/inbox/zh-Hant/{slug}.prepared.cues.json",
            "--cues",
            cues_arg,
            "--force",
        ],
        cwd=str(REPO),
        check=False,
        env=env,
    )


def audio_path(slug: str, cue_index: int) -> Path:
    return INBOX / "audio" / slug / f"cue-{cue_index:04d}.mp3"


def youtube_slugs() -> list[str]:
    slugs: list[str] = []
    for cues_file in sorted(INBOX.glob("*.prepared.cues.json")):
        slug = cues_file.name.replace(".prepared.cues.json", "")
        try:
            doc = json.loads(cues_file.read_text())
        except (json.JSONDecodeError, OSError):
            continue
        if doc.get("videoId"):
            slugs.append(slug)
    return slugs


def threshold_for(text: str, base: float) -> float:
    """Short cues are harder for whisper — use a slightly lower bar."""
    n = len(norm(text))
    if n <= 5:
        return min(base, 0.45)
    if n <= 8:
        return min(base, 0.52)
    return base


def verify_slug(slug: str, threshold: float, rounds: int) -> int:
    cues_path = INBOX / f"{slug}.prepared.cues.json"
    if not cues_path.exists():
        print(f"✗ {slug}: missing {cues_path.name}")
        return 1

    cues = json.loads(cues_path.read_text())["cues"]
    bad = list(range(len(cues)))
    remaining: list[int] = []

    for rnd in range(rounds):
        flagged: list[tuple[int, float, str]] = []
        for i in bad:
            pace_before_cue(i)
            f = audio_path(slug, i)
            if not f.exists():
                flagged.append((i, 0.0, "(missing)"))
                continue
            heard = hear(f)
            cue_th = threshold_for(cues[i]["text"], threshold)
            ratio = SequenceMatcher(None, norm(cues[i]["text"]), norm(heard)).ratio()
            if ratio < cue_th:
                flagged.append((i, ratio, heard[:40]))
        if not flagged:
            print(f"{slug} round {rnd}: ✓ all {len(cues)} clips match")
            return 0
        print(
            f"{slug} round {rnd}: re-rolling {len(flagged)} clip(s): "
            f"{[i for i, _, _ in flagged]}"
        )
        for i, ratio, snippet in flagged[:5]:
            if snippet and snippet != "(missing)":
                print(f"  cue {i}: ratio={ratio:.2f} heard={snippet!r}")
        for i, _, _ in flagged:
            audio_path(slug, i).unlink(missing_ok=True)
        regen(slug, [i for i, _, _ in flagged])
        bad = [i for i, _, _ in flagged]
        remaining = bad

    print(f"⚠ {slug}: still bad after {rounds} rounds: {remaining}")
    return 1 if remaining else 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("slug", nargs="?", help="reading slug (e.g. steam-controller-review)")
    ap.add_argument("--all-youtube", action="store_true")
    ap.add_argument("--threshold", type=float, default=0.6)
    ap.add_argument("--rounds", type=int, default=4)
    args = ap.parse_args()

    if args.all_youtube:
        slugs = youtube_slugs()
    elif args.slug:
        slugs = [args.slug]
    else:
        ap.print_help()
        return 1

    code = 0
    for slug in slugs:
        code |= verify_slug(slug, args.threshold, args.rounds)
    return code


if __name__ == "__main__":
    sys.exit(main())