#!/usr/bin/env bash
# ==============================================================================
# Local Mac Apple Silicon (M1/M2/M3/M4) Voice Cloning + Whisper.cpp + 30fps Pipeline
# ==============================================================================
# Uses your local Mac installation of:
#   1. mlx-audio + mlx-community/Qwen3-TTS-12Hz-0.6B-Base-8bit (Voice Cloning)
#   2. whisper.cpp (whisper-cli -oj -ml 1) for millisecond word timestamps
#   3. 30fps 1080p Visual Engine + FFmpeg -14 LUFS Ducking & Mastering
#   4. DaVinci Resolve Free (.otio) Timeline Export
#
# Usage on your Mac:
#   bash pipeline/mac_local_voice_sync.sh \
#     pipeline/blueprints/ep01_20min_masterclass.json \
#     voices/my_reference_voice.wav \
#     "Exact transcript of what is spoken in your reference voice wav."
# ==============================================================================
set -euo pipefail

BLUEPRINT="${1:-pipeline/blueprints/ep01_20min_masterclass.json}"
REF_AUDIO="${2:-voices/ref_voice.wav}"
REF_TEXT="${3:-Every dollar in your household budget needs a clear mathematical job before you open a single store tab.}"
MODEL="${QWEN_TTS_MODEL:-mlx-community/Qwen3-TTS-12Hz-0.6B-Base-8bit}"

echo "▶ Episode Blueprint : $BLUEPRINT"
echo "▶ MLX Voice Model   : $MODEL"
echo "▶ Reference Voice   : $REF_AUDIO"

if [ -f "$REF_AUDIO" ] && python3 -c "import mlx_audio" >/dev/null 2>&1; then
  echo "✔ Cloning voice on Apple Silicon Metal GPU via mlx-audio + Qwen3-TTS-0.6B-Base-8bit..."
  python3 pipeline/mlx_qwen3_voice_clone.py \
    --blueprint "$BLUEPRINT" \
    --ref-audio "$REF_AUDIO" \
    --ref-text "$REF_TEXT" \
    --model "$MODEL"
else
  echo "ℹ Note: Run this script on your Mac with '--ref-audio <your_voice.wav>' to clone via mlx-audio."
  echo "  Running fallback render..."
  python3 pipeline/longform_30fps_engine.py --blueprint "$BLUEPRINT"
fi
