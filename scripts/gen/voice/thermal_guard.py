"""
Thermal-aware pacing for long MLX/TTS batches (macOS).

Reads CPU temperature when possible, otherwise falls back to gentle inter-cue
pauses so voice generation does not pin the machine at 100%.

Environment (all optional):
  TSUMUGU_THERMAL=0          disable thermal waits (still applies cue pause if set)
  TSUMUGU_MAX_TEMP_C=82      pause when at/above this °C (default 82)
  TSUMUGU_TARGET_TEMP_C=75   resume once below this °C (default 75)
  TSUMUGU_COOLDOWN_SEC=45    sleep while hot (default 45)
  TSUMUGU_CUE_PAUSE_SEC=0.8  pause before every cue (default 0.8; 2.0 if no sensor)

Temperature sources (first match wins):
  1. `istats cpu temp --value-only` (gem install iStats; may need sudo once)
  2. `sudo -n powermetrics` CSV (passwordless sudo only)
  3. `pmset -g therm` performance/thermal warning levels (no °C, but throttling)

Optional install for real °C on Mac:
  sudo gem install iStats && istats scan
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import time
from pathlib import Path


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return float(raw)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() not in ("0", "false", "no", "off")


DISABLED = not _env_bool("TSUMUGU_THERMAL", True)
MAX_TEMP_C = _env_float("TSUMUGU_MAX_TEMP_C", 82.0)
TARGET_TEMP_C = _env_float("TSUMUGU_TARGET_TEMP_C", 75.0)
COOLDOWN_SEC = _env_float("TSUMUGU_COOLDOWN_SEC", 45.0)
CUE_PAUSE_SEC = _env_float("TSUMUGU_CUE_PAUSE_SEC", 0.8)
# When no sensor is available, be more conservative.
NO_SENSOR_PAUSE_SEC = _env_float("TSUMUGU_NO_SENSOR_PAUSE_SEC", 2.0)

_HAS_SENSOR: bool | None = None


def _log(msg: str) -> None:
    print(msg, file=__import__("sys").stderr, flush=True)


def _istats_bin() -> str | None:
    found = shutil.which("istats")
    if found:
        return found
    gem_bins = sorted(Path.home().glob(".gem/ruby/*/bin/istats"))
    return str(gem_bins[-1]) if gem_bins else None


def _read_istats_c() -> float | None:
    istats = _istats_bin()
    if not istats:
        return None
    try:
        proc = subprocess.run(
            [istats, "cpu", "temp", "--value-only"],
            capture_output=True,
            text=True,
            timeout=8,
            check=False,
        )
        if proc.returncode != 0:
            return None
        return float(proc.stdout.strip())
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return None


def _read_powermetrics_c() -> float | None:
    if not shutil.which("sudo"):
        return None
    try:
        proc = subprocess.run(
            [
                "sudo",
                "-n",
                "powermetrics",
                "--samplers",
                "cpu_power,gpu_power",
                "-n",
                "1",
                "-i",
                "200",
                "--format",
                "csv",
            ],
            capture_output=True,
            text=True,
            timeout=8,
            check=False,
        )
        if proc.returncode != 0:
            return None
        # Apple CSV builds vary; look for die/CPU temp columns.
        for line in proc.stdout.splitlines():
            if "die" in line.lower() or "temp" in line.lower():
                nums = re.findall(r"(\d{2,3}(?:\.\d+)?)", line)
                for n in nums:
                    v = float(n)
                    if 30 <= v <= 110:
                        return v
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return None
    return None


def _read_pmset_pressure() -> bool:
    """True when macOS has recorded thermal/performance pressure."""
    try:
        proc = subprocess.run(
            ["pmset", "-g", "therm"],
            capture_output=True,
            text=True,
            timeout=3,
            check=False,
        )
        text = proc.stdout + proc.stderr
        if re.search(r"thermal warning level:\s*[1-9]", text, re.I):
            return True
        if re.search(r"performance warning level:\s*[1-9]", text, re.I):
            return True
        if re.search(r"CPU_Speed_Limit", text):
            return True
    except (OSError, subprocess.TimeoutExpired):
        pass
    return False


def read_temp_c() -> float | None:
    return _read_istats_c() or _read_powermetrics_c()


def has_temp_sensor() -> bool:
    global _HAS_SENSOR
    if _HAS_SENSOR is None:
        _HAS_SENSOR = read_temp_c() is not None
    return _HAS_SENSOR


def pace_before_cue(cue_index: object | None = None) -> None:
    """Call once before synthesizing each cue."""
    if DISABLED:
        return

    label = f"(cue {cue_index})" if cue_index is not None else ""

    if not has_temp_sensor():
        time.sleep(NO_SENSOR_PAUSE_SEC)
        if _read_pmset_pressure():
            _log(f"thermal: macOS reports pressure — cooling {COOLDOWN_SEC:.0f}s {label}")
            time.sleep(COOLDOWN_SEC)
        return

    while True:
        temp = read_temp_c()
        if temp is None:
            time.sleep(NO_SENSOR_PAUSE_SEC)
            return
        if temp < MAX_TEMP_C:
            if CUE_PAUSE_SEC > 0:
                time.sleep(CUE_PAUSE_SEC)
            return
        _log(
            f"thermal: {temp:.0f}°C ≥ {MAX_TEMP_C:.0f}°C — "
            f"cooling {COOLDOWN_SEC:.0f}s {label}"
        )
        time.sleep(COOLDOWN_SEC)
        # Wait until we drop to target, not just one cooldown tick.
        temp = read_temp_c()
        if temp is None or temp <= TARGET_TEMP_C:
            return