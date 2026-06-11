#!/usr/bin/env bash
# Generate Serena voice-notes for all YouTube readings, then transcribe-back verify.
set -euo pipefail
cd "$(dirname "$0")/.."
export TSUMUGU_VOICE_PYTHON="${TSUMUGU_VOICE_PYTHON:-personal/research/bakeoff/.venv/bin/python}"
VERIFY_PY="$TSUMUGU_VOICE_PYTHON"

SLUGS=(
  life-as-open-world-rpg
  steam-controller-review
  ios27-epic-update
  2025-top-ten-gadgets
  iphone-18-lineup-preview
  ai-replaced-my-thinking
)

for slug in "${SLUGS[@]}"; do
  cues="personal/inbox/zh-Hant/${slug}.prepared.cues.json"
  manifest="personal/inbox/zh-Hant/${slug}.voice-notes.json"
  if [[ -f "$manifest" ]]; then
    count=$(python3 -c "import json; print(len(json.load(open('$manifest'))['notes']))")
    echo "== $slug: voice-notes already present ($count notes) — skipping gen"
  else
    echo "== $slug: generating Serena voice-notes =="
    pnpm gen voice-notes --in "$cues" --voice Serena
  fi
  echo "== $slug: transcribe-back verify =="
  "$VERIFY_PY" scripts/verify-voice-notes.py "$slug" --threshold 0.6 --rounds 4
done

echo "== All YouTube voice batches done =="