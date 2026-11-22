#!/usr/bin/env bash
set -euo pipefail

BLUEPRINT="${1:-pipeline/blueprints/ep01_20min_masterclass.json}"
REF_AUDIO="${2:-$HOME/AS/episodes/001_airline_banks/v2_cinematic/ep01_cold_open_v2_cinematic_r2_1920x1080.mp4}"
REF_TEXT="${3:-auto}"
MODEL="${QWEN_TTS_MODEL:-mlx-community/Qwen3-TTS-12Hz-0.6B-Base-8bit}"

echo "▶ Episode Blueprint : $BLUEPRINT"
echo "▶ MLX Voice Model   : $MODEL"
echo "▶ Reference Voice   : $REF_AUDIO"
echo "▶ Reference Text    : $REF_TEXT"

if [ -f "$REF_AUDIO" ] && python3 -c "import mlx_audio" >/dev/null 2>&1; then
  echo "✔ Cloning voice on Apple Silicon Metal GPU via mlx-audio + Qwen3-TTS-0.6B-Base-8bit..."
  python3 pipeline/mlx_qwen3_voice_clone.py \
    --blueprint "$BLUEPRINT" \
    --ref-audio "$REF_AUDIO" \
    --ref-text "$REF_TEXT" \
    --model "$MODEL"
else
  echo "ℹ Note: Either '$REF_AUDIO' was not found or mlx_audio is not installed in this python3."
  echo "  Running v3_editorial_cinema documentary engine..."
  python3 pipeline/v3_editorial_cinema_engine.py --mode both --blueprint "$BLUEPRINT"
fi
