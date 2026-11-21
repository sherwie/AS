#!/usr/bin/env bash
# ==============================================================================
# Local Mac Apple Silicon (M1/M2/M3/M4) Voice & Whisper Sync Helper
# ==============================================================================
# Runs your Episode Blueprints locally on macOS using:
#   1. Kokoro-82M (Metal GPU via mlx-audio) OR Piper TTS OR Cloud TTS
#   2. whisper.cpp (whisper-cli -oj) already installed on your Mac
#   3. Remotion 1080p Render + FFmpeg -14 LUFS Mastering
#   4. Native DaVinci Resolve Free (.otio) Timeline Export
# ==============================================================================
set -euo pipefail

BLUEPRINT="${1:-pipeline/blueprints/ep01_christmas_400_plan.json}"
echo "▶ Running Automated Production Pipeline for: $BLUEPRINT"

# Detect local Mac whisper.cpp binary if installed
if command -v whisper-cli >/dev/null 2>&1; then
  echo "✔ Found local whisper-cli (whisper.cpp) on Mac"
elif command -v whisper >/dev/null 2>&1; then
  echo "✔ Found local whisper on Mac"
fi

# Detect local Mac TTS engines (Kokoro MLX / Piper / Edge-TTS)
if python3 -c "import mlx_audio" >/dev/null 2>&1; then
  echo "✔ Found Apple Silicon Metal GPU TTS: Kokoro-82M (mlx-audio)"
elif command -v piper >/dev/null 2>&1; then
  echo "✔ Found Local Piper TTS"
else
  echo "✔ Using Neural Edge-TTS with native WordBoundary sync"
fi

python3 pipeline/produce_episode.py --blueprint "$BLUEPRINT"
echo ""
echo "🎬 Ready for DaVinci Resolve Free:"
echo "   1. Open DaVinci Resolve → File → Import → Timeline..."
echo "   2. Select the generated .otio file in public/renders/"
echo "   3. Check 'Automatically import source clips into media pool'"
