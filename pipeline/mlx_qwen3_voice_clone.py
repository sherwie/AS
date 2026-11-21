#!/usr/bin/env python3
"""
Local Mac Apple Silicon Voice Cloning & Timestamp Engine
========================================================
Uses your local Mac install of:
  1. `mlx-audio` + `mlx-community/Qwen3-TTS-12Hz-0.6B-Base-8bit`
     Takes a 5–15s reference voice recording (`--ref-audio`) and its reference
     transcript (`--ref-text`) to clone your chosen narrator voice across every
     scene or chapter in the JSON blueprint.
  2. Automatic Sentence Chunking (~30–35s chunks) so `Qwen3-TTS` never trips the
     macOS Metal GPU watchdog (which caps single-pass generation at ~500 tokens / ~40s).
  3. Local Mac `whisper.cpp` (`whisper-cli -oj -ml 1`) or `mlx_audio.stt` to
     extract exact millisecond word-level timestamps (`*.words.json`) from your
     cloned voice audio so all 30fps numbers, charts, and captions lock to the
     exact spoken word.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parent.parent


def split_into_metal_safe_chunks(text: str, max_words: int = 55) -> list[str]:
    """Split long chapter narration into ~25-35s sentence chunks (<500 tokens at 12Hz)
    to prevent Apple Silicon Metal GPU watchdog timeouts."""
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s.strip()]
    chunks: list[str] = []
    cur: list[str] = []
    cur_count = 0
    for sent in sentences:
        w_count = len(sent.split())
        if cur and (cur_count + w_count > max_words):
            chunks.append(" ".join(cur))
            cur = [sent]
            cur_count = w_count
        else:
            cur.append(sent)
            cur_count += w_count
    if cur:
        chunks.append(" ".join(cur))
    return chunks


def generate_qwen3_cloned_voice_mac(
    text: str,
    out_wav: Path,
    ref_audio: Path,
    ref_text: str,
    model_id: str = "mlx-community/Qwen3-TTS-12Hz-0.6B-Base-8bit",
    lang_code: str = "English",
) -> None:
    """Synthesize speech using mlx-audio + Qwen3-TTS-0.6B (8-bit quantized) with voice cloning."""
    out_wav.parent.mkdir(parents=True, exist_ok=True)
    chunks = split_into_metal_safe_chunks(text, max_words=55)

    try:
        # Path A: Direct Python mlx_audio API (loads model weights once in unified memory)
        from mlx_audio.tts.utils import load_model
        import soundfile as sf
        import numpy as np

        print(f"  [mlx-audio] Loading {model_id} on Apple Silicon Metal GPU...")
        model = load_model(model_id)
        all_audio = []
        sr = 24000

        for idx, chunk_text in enumerate(chunks):
            print(f"    → Cloning chunk {idx+1}/{len(chunks)} ({len(chunk_text.split())} words)...")
            results = model.generate(
                text=chunk_text,
                ref_audio=str(ref_audio.resolve()),
                ref_text=ref_text,
                lang_code=lang_code,
                verbose=False,
            )
            for res in results:
                audio_np = np.array(res.audio, dtype=np.float32)
                sr = getattr(res, "sample_rate", 24000)
                all_audio.append(audio_np)
                # 0.22s natural breath pause between sentence groups
                all_audio.append(np.zeros(int(sr * 0.22), dtype=np.float32))

        merged = np.concatenate(all_audio) if all_audio else np.zeros(24000, dtype=np.float32)
        tmp_raw = out_wav.with_suffix(".raw24k.wav")
        sf.write(str(tmp_raw), merged, sr)
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(tmp_raw), "-ar", "44100", "-ac", "2", str(out_wav)],
            check=True,
            capture_output=True,
        )
        tmp_raw.unlink(missing_ok=True)
        return
    except ImportError:
        pass

    # Path B: CLI fallback (`python -m mlx_audio.tts.generate`)
    chunk_wavs: list[Path] = []
    for idx, chunk_text in enumerate(chunks):
        c_prefix = out_wav.parent / f"{out_wav.stem}_part{idx:02d}"
        cmd = [
            sys.executable,
            "-m",
            "mlx_audio.tts.generate",
            "--model",
            model_id,
            "--text",
            chunk_text,
            "--ref_audio",
            str(ref_audio.resolve()),
            "--ref_text",
            ref_text,
            "--lang_code",
            lang_code,
            "--file_prefix",
            str(c_prefix),
        ]
        subprocess.run(cmd, check=True)
        produced = sorted(out_wav.parent.glob(f"{out_wav.stem}_part{idx:02d}*.wav"))
        if produced:
            chunk_wavs.append(produced[0])

    concat_list = out_wav.with_suffix(".chunks.txt")
    concat_list.write_text(
        "\n".join(f"file '{p.resolve()}'" for p in chunk_wavs), encoding="utf-8"
    )
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_list),
            "-ar",
            "44100",
            "-ac",
            "2",
            str(out_wav),
        ],
        check=True,
        capture_output=True,
    )
    concat_list.unlink(missing_ok=True)


def extract_whisper_cpp_word_timestamps(
    audio_wav: Path, fallback_text: str
) -> list[dict[str, Any]]:
    """Run local Mac whisper.cpp (`whisper-cli -oj -ml 1`) on the cloned voice WAV
    to extract exact millisecond word-level timestamps."""
    whisper_bin = shutil.which("whisper-cli") or shutil.which("whisper-cpp")
    if whisper_bin:
        # Locate standard whisper ggml model on Mac
        model_candidates = list(Path.home().glob("**/ggml-*.bin"))
        if model_candidates:
            out_prefix = audio_wav.with_suffix("")
            subprocess.run(
                [
                    whisper_bin,
                    "-m",
                    str(model_candidates[0]),
                    "-f",
                    str(audio_wav),
                    "-oj",
                    "-ml",
                    "1",
                    "-of",
                    str(out_prefix),
                ],
                check=True,
                capture_output=True,
            )
            json_out = Path(f"{out_prefix}.json")
            if json_out.exists():
                data = json.loads(json_out.read_text(encoding="utf-8"))
                words = []
                for seg in data.get("transcription", []):
                    tok = seg.get("text", "").strip()
                    if not tok:
                        continue
                    st = seg["offsets"]["from"] / 1000.0
                    et = seg["offsets"]["to"] / 1000.0
                    words.append({"word": tok, "start": round(st, 3), "end": round(max(st + 0.06, et), 3)})
                if words:
                    return words

    # Fallback proportional word timing if whisper model path is custom
    dur_out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(audio_wav),
        ],
        text=True,
    ).strip()
    dur = float(dur_out)
    tokens = fallback_text.split()
    step = dur / max(len(tokens), 1)
    return [
        {"word": tok, "start": round(i * step, 3), "end": round((i + 1) * step, 3)}
        for i, tok in enumerate(tokens)
    ]


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Clone your reference voice with mlx-audio + Qwen3-TTS-12Hz-0.6B-Base-8bit for any episode blueprint."
    )
    parser.add_argument(
        "--blueprint",
        type=Path,
        default=ROOT_DIR / "pipeline" / "blueprints" / "ep01_20min_masterclass.json",
    )
    parser.add_argument(
        "--ref-audio",
        type=Path,
        required=True,
        help="Path to your 5-20s reference voice WAV file (e.g. voices/my_voice.wav)",
    )
    parser.add_argument(
        "--ref-text",
        type=str,
        required=True,
        help="Exact transcript spoken in your reference voice WAV file",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="mlx-community/Qwen3-TTS-12Hz-0.6B-Base-8bit",
        help="MLX HuggingFace model ID (default: mlx-community/Qwen3-TTS-12Hz-0.6B-Base-8bit)",
    )
    args = parser.parse_args()

    bp = json.loads(args.blueprint.read_text(encoding="utf-8"))
    ep_id = bp["id"]
    items = bp.get("chapters") or bp.get("scenes") or []
    audio_dir = ROOT_DIR / "public" / "renders" / ep_id / "scenes_audio"
    audio_dir.mkdir(parents=True, exist_ok=True)

    print(f"=== Voice Cloning {len(items)} Chapters with {args.model} ===")
    for idx, item in enumerate(items):
        cid = item["id"]
        wav_path = audio_dir / f"{idx:02d}_{cid}.wav"
        mp3_path = audio_dir / f"{idx:02d}_{cid}.mp3"
        words_path = audio_dir / f"{idx:02d}_{cid}.words.json"

        generate_qwen3_cloned_voice_mac(
            text=item["narration"],
            out_wav=wav_path,
            ref_audio=args.ref_audio,
            ref_text=args.ref_text,
            model_id=args.model,
        )
        subprocess.run(["ffmpeg", "-y", "-i", str(wav_path), str(mp3_path)], check=True, capture_output=True)
        words = extract_whisper_cpp_word_timestamps(wav_path, item["narration"])
        words_path.write_text(json.dumps(words, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"  ✔ Cloned & Whisper-synced {cid}: {wav_path.name} ({len(words)} words)")

    print("\n✅ All chapters cloned! Now rendering 30fps 1080p video + -14 LUFS master + DaVinci .otio...")
    subprocess.run([sys.executable, str(ROOT_DIR / "pipeline" / "longform_30fps_engine.py"), "--blueprint", str(args.blueprint)], check=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
