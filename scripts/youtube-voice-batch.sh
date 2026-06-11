#!/usr/bin/env bash
# Generate Serena voice-notes for all YouTube readings, then transcribe-back verify.
#
# Thermal pacing (see scripts/gen/voice/thermal_guard.py):
#   TSUMUGU_MAX_TEMP_C=82      pause TTS when CPU ≥ this (default 82°C)
#   TSUMUGU_TARGET_TEMP_C=75   resume below this (default 75°C)
#   TSUMUGU_COOLDOWN_SEC=45    sleep while hot (default 45s)
#   TSUMUGU_CUE_PAUSE_SEC=0.8  gap between cues when cool (default 0.8s)
#   TSUMUGU_NO_SENSOR_PAUSE_SEC=2.0  gap when no temp sensor (default 2s)
#   TSUMUGU_THERMAL=0          disable thermal waits
# Optional °C sensor: sudo gem install iStats && istats scan
set -euo pipefail
cd "$(dirname "$0")/.."
export TSUMUGU_VOICE_PYTHON="${TSUMUGU_VOICE_PYTHON:-personal/research/bakeoff/.venv/bin/python}"
VERIFY_PY="$TSUMUGU_VOICE_PYTHON"
# Lower CPU scheduling priority for long MLX runs.
NICE_LEVEL="${TSUMUGU_NICE:-10}"

SLUGS=(
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
    echo "== $slug: generating Serena voice-notes (thermal pacing on) =="
    nice -n "$NICE_LEVEL" pnpm gen voice-notes --in "$cues" --voice Serena
  fi
  echo "== $slug: transcribe-back verify =="
  if ! "$VERIFY_PY" scripts/verify-voice-notes.py "$slug" --threshold 0.6 --rounds 6; then
    echo "WARN: $slug verify reported failures — continuing batch (re-run verify-voice later)"
  fi
done

echo "== All YouTube voice batches done =="