#!/usr/bin/env python3
"""
v5_cinema_flagship_sample.py — Flagship 48s Viral Documentary Sample
====================================================================
Combines the exact winning DNA of million-view faceless documentary channels
(LEMMiNO, James Jani, Johnny Harris, Vox, MagnatesMedia):
  1. Investigative Mystery Hook with engineered dramatic pauses (beat-by-beat
     synthesis with 0.000s exact WordBoundary karaoke sync).
  2. Shure SM7B Broadcast Studio Vocal Mastering Chain (warm 140Hz body,
     3.2kHz de-harshness, 9.5kHz air, 3.2:1 intimate compressor).
  3. Mix of 3 bespoke photorealistic 35mm cinematic hero shots (animated with
     smooth 30fps Ken Burns push-in + film grain), story-locked live-action
     35mm B-roll cuts, and 2 multi-row sequential Vox paper evidence ledgers.
  4. True 4-layer cinema audio: Studio VO + 2-act evolving documentary score
     with a real 0.8s silence drop before the solution pivot + subtle rain/room
     tone ambience + riser/bass-impact/whoosh/click/chime Foley (-14.0 LUFS).
"""

from __future__ import annotations

import asyncio
import json
import shutil
import subprocess
import sys
import wave
from pathlib import Path
from typing import Any

import edge_tts
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT_DIR = Path(__file__).resolve().parent.parent
ARTIFACTS_DIR = Path("/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p_devbox/283c62c9-7adc-4fd6-88b0-d270921201eb")
V3_CACHE_DIR = ROOT_DIR / "public" / "broll_corpus" / "v3_seamless_1080p"
FONTS_DIR = ROOT_DIR / "pipeline" / "fonts"
SFX_DIR = Path("/home/antigravity/OpenMontage/.agents/skills/hyperframes-media/assets/sfx")
WORK_DIR = ROOT_DIR / "public" / "renders" / "sample-v5-flagship"
FINAL_OUT = ROOT_DIR / "public" / "renders" / "sample-45s-holiday-trap-30fps.mp4"
THUMBS_DIR = ROOT_DIR / "public" / "renders" / "sample-45s-thumbs"

WIDTH = 1920
HEIGHT = 1080
FPS = 30
LETTERBOX_H = 48

# Beat-by-beat investigative mystery script with deliberate LEMMiNO/James Jani dramatic pauses!
SCRIPT_BEATS = [
    ("b1_promise",  "On December first, you promised yourself four hundred euros. No more.", 0.55),
    ("b2_reveal",   "Forty-five days later, your bank app shows nine hundred and twenty.", 0.45),
    ("b3_mystery",  "You didn't buy a luxury watch. You didn't book a flight. So where did five hundred and twenty euros vanish?", 0.40),
    ("b4_traps",    "Look closer at the receipts. Retailers engineer four silent traps that bleed you fifty euros at a time: last-minute guilt upgrades, fake forty percent off decoys, free-shipping cart padding, and unbudgeted hosting.", 0.65),
    ("b5_pivot",    "Here is the quiet three-column rule that shuts every single leak down before you spend a cent.", 0.30),
    ("b6_columns",  "Lock sixty euros into a friction buffer, two hundred and twenty into your core family list, and one hundred and twenty into high-thought gifts.", 0.35),
    ("b7_payoff",   "Same generosity. Five hundred and twenty-eight euros still sitting in your bank on January first.", 0.90),
]

FONT_PATHS = {
    "display": str(FONTS_DIR / "BebasNeue.ttf"),
    "serif": str(FONTS_DIR / "PlayfairDisplay.ttf"),
    "sans": str(FONTS_DIR / "Inter.ttf"),
    "mono": str(FONTS_DIR / "JetBrainsMono.ttf"),
}
_FONT_CACHE: dict[tuple[str, int], ImageFont.FreeTypeFont] = {}


def get_font(kind: str, size: int) -> ImageFont.FreeTypeFont:
    key = (kind, size)
    if key not in _FONT_CACHE:
        _FONT_CACHE[key] = ImageFont.truetype(FONT_PATHS[kind], size)
    return _FONT_CACHE[key]


def probe_duration(path: Path) -> float:
    return float(
        subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            text=True,
        ).strip()
    )


async def synth_one_beat(text: str, out_mp3: Path) -> list[dict[str, Any]]:
    """Strictly use ONE consistent documentary narrator voice across all beats (zero mid-video voice switching)."""
    voice_name = "en-US-AndrewMultilingualNeural"
    for attempt in range(1, 6):
        try:
            comm = edge_tts.Communicate(text, voice=voice_name, rate="-4%", boundary="WordBoundary")
            words: list[dict[str, Any]] = []
            with open(out_mp3, "wb") as f:
                async for chunk in comm.stream():
                    if chunk["type"] == "audio":
                        f.write(chunk["data"])
                    elif chunk["type"] == "WordBoundary":
                        st = chunk["offset"] / 10_000_000.0
                        dur = chunk["duration"] / 10_000_000.0
                        words.append({"word": chunk["text"], "start": st, "end": st + max(0.05, dur)})
            if words and out_mp3.stat().st_size > 5000:
                return words
        except Exception as e:
            print(f"  [retry {attempt}/5] {voice_name}: {e}")
            await asyncio.sleep(0.8 * attempt)
    raise RuntimeError(f"Failed TTS for {voice_name}: {text}")


async def synthesize_all_beats() -> tuple[Path, list[dict[str, Any]], dict[str, tuple[float, float]]]:
    """Synthesize each narrative beat with engineered dramatic silence pauses,
    master the voice through a Shure SM7B broadcast EQ/compressor chain, and
    return exact global word timestamps + exact beat start/end windows."""
    beat_wavs: list[Path] = []
    all_words: list[dict[str, Any]] = []
    beat_windows: dict[str, tuple[float, float]] = {}
    cursor = 0.25  # 0.25s breath before first word

    # Leading 0.25s silence
    lead_sil = WORK_DIR / "sil_lead.wav"
    subprocess.run(["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", "0.25", str(lead_sil)], check=True, capture_output=True)
    beat_wavs.append(lead_sil)

    for bid, text, pause_after in SCRIPT_BEATS:
        mp3_p = WORK_DIR / f"{bid}.mp3"
        wav_p = WORK_DIR / f"{bid}.wav"
        local_words = await synth_one_beat(text, mp3_p)
        subprocess.run(["ffmpeg", "-y", "-i", str(mp3_p), "-ar", "44100", "-ac", "2", str(wav_p)], check=True, capture_output=True)
        b_dur = probe_duration(wav_p)
        beat_start = cursor
        for w in local_words:
            all_words.append({
                "word": w["word"],
                "start": round(beat_start + w["start"], 3),
                "end": round(beat_start + w["end"], 3),
            })
        beat_wavs.append(wav_p)
        cursor += b_dur
        beat_windows[bid] = (round(beat_start, 3), round(cursor, 3))

        if pause_after > 0:
            sil_p = WORK_DIR / f"sil_{bid}.wav"
            subprocess.run(["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", f"{pause_after:.3f}", str(sil_p)], check=True, capture_output=True)
            beat_wavs.append(sil_p)
            cursor += pause_after

    concat_a = WORK_DIR / "vo_concat.txt"
    concat_a.write_text("\n".join(f"file '{p.resolve()}'" for p in beat_wavs), encoding="utf-8")
    raw_vo = WORK_DIR / "vo_raw.wav"
    subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_a), "-c", "copy", str(raw_vo)], check=True, capture_output=True)

    # Shure SM7B Broadcast Studio Vocal Mastering Chain (warmth + de-harsh + intimate compression)
    studio_vo = WORK_DIR / "vo_studio_sm7b.wav"
    subprocess.run(
        [
            "ffmpeg", "-y", "-i", str(raw_vo),
            "-af",
            "highpass=f=75,"
            "equalizer=f=140:t=q:w=1.2:g=3.2,"
            "equalizer=f=3200:t=q:w=1.8:g=-2.2,"
            "equalizer=f=9500:t=q:w=1.0:g=1.8,"
            "acompressor=threshold=-18dB:ratio=3.2:attack=12:release=140:makeup=2",
            "-ar", "44100", "-ac", "2",
            str(studio_vo),
        ],
        check=True,
        capture_output=True,
    )
    (WORK_DIR / "v5_words.json").write_text(json.dumps(all_words, indent=2), encoding="utf-8")
    return studio_vo, all_words, beat_windows


def find_phrase_time(words: list[dict[str, Any]], phrase: str, default_t: float) -> float:
    target = [w.lower().strip(".,:;!?-") for w in phrase.split()]
    cleaned = [w["word"].lower().strip(".,:;!?-") for w in words]
    for i in range(len(cleaned) - len(target) + 1):
        if cleaned[i : i + len(target)] == target:
            return float(words[i]["start"])
    return default_t


def format_ass_time(seconds: float) -> str:
    seconds = max(0.0, seconds)
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def write_karaoke_ass(words: list[dict[str, Any]], out_ass: Path, words_per_line: int = 5) -> Path:
    header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: DocSub,Inter,36,&H00F8F6F0,&H0015CCFA,&H0007090E,&HAA04060A,-1,0,0,0,100,100,0.4,0,1,2.4,2.8,2,140,140,66,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    groups: list[list[dict[str, Any]]] = []
    cur: list[dict[str, Any]] = []
    for w in words:
        cur.append(w)
        if len(cur) >= words_per_line or str(w["word"]).endswith((".", "!", "?", ":")):
            groups.append(cur)
            cur = []
    if cur:
        groups.append(cur)

    events = []
    for g_idx, grp in enumerate(groups):
        next_grp_start = float(groups[g_idx + 1][0]["start"]) if g_idx + 1 < len(groups) else None
        for active_idx, active_w in enumerate(grp):
            st = float(active_w["start"])
            if active_idx + 1 < len(grp):
                et = float(grp[active_idx + 1]["start"])
            else:
                et = float(active_w["end"]) + 0.10
                if next_grp_start is not None:
                    et = min(et, max(st + 0.04, next_grp_start - 0.01))
            if et <= st:
                et = st + 0.05
            parts = []
            for j, tok in enumerate(grp):
                txt = str(tok["word"]).replace("{", "").replace("}", "")
                if j == active_idx:
                    parts.append(r"{\c&H15CCFA&}" + txt + r"{\c&HF8F6F0&}")
                else:
                    parts.append(txt)
            events.append(f"Dialogue: 0,{format_ass_time(st)},{format_ass_time(et)},DocSub,,0,0,0,,{' '.join(parts)}")

    out_ass.write_text(header + "\n".join(events) + "\n", encoding="utf-8")
    return out_ass


def animate_hero_still_mp4(img_path: Path, out_mp4: Path, duration: float, zoom_end: float = 1.09, pan_x: float = 0.0) -> Path:
    """Turn a bespoke photorealistic 16:9 hero still into a buttery-smooth 30fps
    35mm Ken Burns camera push-in clip with cinema letterbox bars & subtle film grain."""
    out_mp4.parent.mkdir(parents=True, exist_ok=True)
    src = Image.open(img_path).convert("RGB")
    # Oversample slightly to 2112x1188 for crisp sub-pixel zoom/pan
    base_w, base_h = 2112, 1188
    src = src.resize((base_w, base_h), Image.LANCZOS)
    total_frames = max(30, int(round(duration * FPS)))

    proc = subprocess.Popen(
        [
            "ffmpeg", "-y",
            "-f", "rawvideo", "-vcodec", "rawvideo",
            "-s", f"{WIDTH}x{HEIGHT}", "-pix_fmt", "rgb24", "-r", str(FPS),
            "-i", "-",
            "-vf", "noise=alls=4:allf=t+u",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p",
            str(out_mp4),
        ],
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    assert proc.stdin is not None
    try:
        for f in range(total_frames):
            p = f / max(1, total_frames - 1)
            # Smooth cinema ease-in-out curve
            z = 1.0 + (zoom_end - 1.0) * p
            cw = int(base_w / z)
            ch = int(base_h / z)
            cx = (base_w - cw) // 2 + int(pan_x * (p - 0.5) * (base_w - cw))
            cx = max(0, min(base_w - cw, cx))
            cy = (base_h - ch) // 2
            frame = src.crop((cx, cy, cx + cw, cy + ch)).resize((WIDTH, HEIGHT), Image.BICUBIC)
            d = ImageDraw.Draw(frame)
            d.rectangle([0, 0, WIDTH, LETTERBOX_H], fill=(0, 0, 0))
            d.rectangle([0, HEIGHT - LETTERBOX_H, WIDTH, HEIGHT], fill=(0, 0, 0))
            proc.stdin.write(frame.tobytes())
    finally:
        proc.stdin.close()
        proc.wait()
    return out_mp4


def generate_v5_cinema_score(total_dur: float, pivot_t: float, out_wav: Path) -> Path:
    """2-act evolving cinema score with a TRUE 0.75-second dramatic silence drop
    right before the solution pivot + subtle dark rain/room tone ambience in Act 1."""
    sr = 44100
    n = int(sr * (total_dur + 1.0))
    t = np.linspace(0, total_dur + 1.0, n, endpoint=False)
    rng = np.random.default_rng(2026)

    # True dramatic silence drop: music ducks to 0.0 for 0.75s right before pivot_t!
    silence_drop = np.where((t >= pivot_t - 0.65) & (t <= pivot_t + 0.15), 0.0, 1.0)
    # Smooth 0.15s ramps around the silence drop
    for i_t in [pivot_t - 0.65, pivot_t + 0.15]:
        mask = np.abs(t - i_t) < 0.12
        silence_drop[mask] = np.minimum(silence_drop[mask], np.abs(t[mask] - i_t) / 0.12)

    act2_env = np.clip((t - (pivot_t + 0.15)) / 1.5, 0.0, 1.0)
    act1_env = (1.0 - act2_env) * np.where(t < pivot_t + 0.15, 1.0, 0.0)

    # Act 1: Moody dark cello + low investigative pulse (D2, A2, F3)
    pad1 = (
        0.42 * np.sin(2 * np.pi * 73.42 * t)
        + 0.22 * np.sin(2 * np.pi * 110.00 * t + 0.4)
        + 0.14 * np.sin(2 * np.pi * 174.61 * t + 1.1)
    ) * (0.82 + 0.18 * np.sin(2 * np.pi * 0.35 * t))

    # Act 2: Warm luminous major documentary resolve (F2, C3, A3, E4)
    pad2 = (
        0.38 * np.sin(2 * np.pi * 87.31 * t)
        + 0.28 * np.sin(2 * np.pi * 130.81 * t + 0.2)
        + 0.18 * np.sin(2 * np.pi * 220.00 * t + 0.7)
        + 0.11 * np.sin(2 * np.pi * 329.63 * t)
    )

    # Felt-piano rhythmic plucks
    plucks = np.zeros(n, dtype=np.float64)
    minor_notes = [293.66, 349.23, 329.63, 261.63]
    major_notes = [349.23, 440.00, 523.25, 659.25]
    cur_t = 0.5
    idx_n = 0
    while cur_t < total_dur - 0.5:
        if not (pivot_t - 0.8 <= cur_t <= pivot_t + 0.1):
            s0 = int(cur_t * sr)
            plen = min(int(1.6 * sr), n - s0)
            if plen > 0:
                pt = np.arange(plen) / sr
                freq = minor_notes[idx_n % 4] if cur_t < pivot_t else major_notes[idx_n % 4]
                env = np.exp(-pt * 3.0) * np.minimum(1.0, pt / 0.015)
                plucks[s0 : s0 + plen] += (0.14 * np.sin(2 * np.pi * freq * pt) + 0.04 * np.sin(2 * np.pi * freq * 2 * pt)) * env
        cur_t += 1.35
        idx_n += 1

    # Subtle filtered rain/room tone ambience during Act 1 (-32 dB presence!)
    white = rng.normal(0, 1, n)
    kernel = np.ones(18) / 18.0
    rain_amb = np.convolve(white, kernel, mode="same") * 0.022 * act1_env

    mix = ((pad1 * act1_env + pad2 * act2_env) * 0.24 + plucks * 0.45) * silence_drop + rain_amb
    mix *= np.clip(t / 1.0, 0.0, 1.0) * np.clip((total_dur - t) / 2.2, 0.0, 1.0)

    left = np.clip(mix * 0.95, -0.95, 0.95)
    right = np.clip(np.roll(mix, 360) * 0.95, -0.95, 0.95)
    pcm = (np.stack([left, right], axis=-1) * 32767.0).astype(np.int16)

    with wave.open(str(out_wav), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm.tobytes())
    return out_wav


def main() -> int:
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    # Reuse our multi-highlight paper renderer & title PNG helper from v4
    sys.path.insert(0, str(ROOT_DIR / "pipeline"))
    from v4_short_sample_master import create_title_png, render_multi_highlight_paper_mp4

    v3_manifest = json.loads((V3_CACHE_DIR / "v3_manifest.json").read_text(encoding="utf-8"))
    id_map = {x["id"]: Path(x["v3_path"]) for x in v3_manifest}

    # Locate our 3 bespoke photorealistic hero images
    hero_phone = sorted(ARTIFACTS_DIR.glob("v5_hero_phone_bank_920*.jpg"))[-1]
    hero_desk = sorted(ARTIFACTS_DIR.glob("v5_hero_receipts_desk*.jpg"))[-1]
    hero_morning = sorted(ARTIFACTS_DIR.glob("v5_hero_calm_january_morning*.jpg"))[-1]

    print("▶ 1. Synthesizing beat-by-beat investigative mystery narration + Shure SM7B broadcast vocal mastering...")
    studio_vo, words, bwin = asyncio.run(synthesize_all_beats())
    total_dur = probe_duration(studio_vo)
    print(f"  ✔ Studio VO ready: {total_dur:.2f}s ({len(words)} exact words)")
    for k, v in bwin.items():
        print(f"    {k:12s}: {v[0]:5.2f}s -> {v[1]:5.2f}s")

    # Exact spoken word cues
    t_920 = find_phrase_time(words, "nine hundred", bwin["b2_reveal"][0] + 1.8)
    t_guilt = find_phrase_time(words, "guilt upgrades", bwin["b4_traps"][0] + 5.5)
    t_decoy = find_phrase_time(words, "forty percent", t_guilt + 2.0)
    t_ship = find_phrase_time(words, "free-shipping", t_decoy + 2.0)
    if t_ship == t_decoy + 2.0:
        t_ship = find_phrase_time(words, "shipping", t_decoy + 2.0)
    t_host = find_phrase_time(words, "unbudgeted", t_ship + 2.0)
    t_pivot = bwin["b5_pivot"][0]
    t_sixty = find_phrase_time(words, "sixty euros", bwin["b6_columns"][0] + 0.5)
    t_220 = find_phrase_time(words, "two hundred", t_sixty + 2.4)
    t_120 = find_phrase_time(words, "one hundred", t_220 + 2.6)
    t_528 = find_phrase_time(words, "twenty-eight", bwin["b7_payoff"][0] + 1.5)
    t_jan = find_phrase_time(words, "january", total_dur - 3.5)

    # 2. Compute exact visual durations matching every beat!
    d_b1 = round(bwin["b2_reveal"][0] - 0.15, 3)                               # Holiday street (€400 promise)
    d_b2 = round(bwin["b3_mystery"][0] - d_b1, 3)                              # Bespoke Phone -€920.00 hero shot!
    d_b3_desk = round((bwin["b4_traps"][0] + 1.2) - (d_b1 + d_b2), 3)          # Bespoke Receipts Desk hero shot!
    d_ev1 = round(t_guilt - (d_b1 + d_b2 + d_b3_desk) - 0.1, 3)                # Paper Evidence #1 (Bank Audit)
    d_guilt = round(t_decoy - (d_b1 + d_b2 + d_b3_desk + d_ev1), 3)            # Gift box
    d_decoy = round(t_ship - (d_b1 + d_b2 + d_b3_desk + d_ev1 + d_guilt), 3)   # Supermarket fake 40% off tags
    d_ship = round(t_host - (d_b1 + d_b2 + d_b3_desk + d_ev1 + d_guilt + d_decoy), 3)  # Express courier box
    d_host = round(t_pivot - (d_b1 + d_b2 + d_b3_desk + d_ev1 + d_guilt + d_decoy + d_ship), 3)  # Macro cash counting
    d_pivot_broll = round(bwin["b6_columns"][0] - t_pivot, 3)                  # Quiet desk / notebook transition
    d_ev2 = round((t_528 + 1.8) - bwin["b6_columns"][0], 3)                    # Paper Evidence #2 (3-Column sequential!)
    d_outro = max(3.5, round(total_dur - (bwin["b6_columns"][0] + d_ev2), 3))  # Bespoke Calm January Morning hero shot!

    print("▶ 2. Rendering 3 bespoke 30fps Ken Burns hero shots + 2 multi-row paper evidence ledgers...")
    hero_phone_mp4 = animate_hero_still_mp4(hero_phone, WORK_DIR / "hero_phone.mp4", d_b2 + 0.4, zoom_end=1.10, pan_x=0.15)
    hero_desk_mp4 = animate_hero_still_mp4(hero_desk, WORK_DIR / "hero_desk.mp4", d_b3_desk + 0.4, zoom_end=1.09, pan_x=-0.10)
    hero_morning_mp4 = animate_hero_still_mp4(hero_morning, WORK_DIR / "hero_morning.mp4", d_outro + 0.5, zoom_end=1.08, pan_x=0.05)

    ev1_mp4 = render_multi_highlight_paper_mp4(
        WORK_DIR / "ev1_bank_audit.mp4",
        duration_sec=max(3.5, d_ev1 + 0.3),
        doc_type="JANUARY 15 BANK STATEMENT AUDIT  •  CASE FILE #01",
        header_title="Where €520 Quietly Vanished",
        date_stamp="DEC 01 – JAN 15",
        rows=[
            ("Written December 1st Promise", "€400.00"),
            ("Last-Minute Guilt Upgrades", "+€130.00"),
            ("Fake 40%-Off Decoy Deals", "+€115.00"),
            ("Free-Shipping Cart Padding", "+€125.00"),
            ("Unbudgeted Hosting & Food", "+€150.00"),
            ("ACTUAL JANUARY CARD BALANCE", "€920.00"),
        ],
        row_highlight_schedule=[
            (0, 0.25, (226, 232, 240)),
            (5, 0.90, (250, 204, 21)),
        ],
        stamp_text="+130% OVERRUN",
        stamp_time=1.45,
        stamp_color=(215, 38, 38),
    )

    ev2_start_t = bwin["b6_columns"][0]
    ev2_mp4 = render_multi_highlight_paper_mp4(
        WORK_DIR / "ev2_three_column.mp4",
        duration_sec=max(6.0, d_ev2 + 0.3),
        doc_type="THE 3-COLUMN CALM PROTOCOL  •  VERIFIED LEDGER",
        header_title="Zero-Leak €400 Allocation Blueprint",
        date_stamp="JANUARY 1ST RESULT",
        rows=[
            ("Column 1: Friction Buffer (15%)", "€60.00"),
            ("Column 2: Core Family List (55%)", "€220.00"),
            ("Column 3: High-Thought Gifts (30%)", "€120.00"),
            ("Actual Engineered Total", "€392.00"),
            ("NET CASH KEPT IN YOUR BANK", "+€528.00"),
        ],
        row_highlight_schedule=[
            (0, max(0.25, t_sixty - ev2_start_t), (250, 204, 21)),
            (1, max(1.80, t_220 - ev2_start_t), (250, 204, 21)),
            (2, max(3.40, t_120 - ev2_start_t), (250, 204, 21)),
            (4, max(5.20, t_528 - ev2_start_t), (16, 185, 129)),
        ],
        stamp_text="ZERO DEBT",
        stamp_time=max(5.55, t_528 - ev2_start_t + 0.45),
        stamp_color=(16, 155, 105),
    )

    timeline = [
        (id_map["46530"],  d_b1),
        (hero_phone_mp4,   d_b2),
        (hero_desk_mp4,    d_b3_desk),
        (ev1_mp4,          d_ev1),
        (id_map["42124"],  d_guilt),
        (id_map["49137"],  d_decoy),
        (id_map["23841"],  d_ship),
        (id_map["18296"],  d_host),
        (id_map["45923"],  d_pivot_broll),
        (ev2_mp4,          d_ev2),
        (hero_morning_mp4, d_outro),
    ]

    seg_paths = []
    for i, (src, d) in enumerate(timeline):
        sp = WORK_DIR / f"seg_{i:02d}.mp4"
        subprocess.run(["ffmpeg", "-y", "-i", str(src), "-t", f"{max(0.5, d):.3f}", "-c", "copy", str(sp)], check=True, capture_output=True)
        seg_paths.append(sp)

    concat_f = WORK_DIR / "concat.txt"
    concat_f.write_text("\n".join(f"file '{p.resolve()}'" for p in seg_paths), encoding="utf-8")
    base_mp4 = WORK_DIR / "v5_base.mp4"
    subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_f), "-t", f"{total_dur:.3f}", "-c", "copy", str(base_mp4)], check=True, capture_output=True)

    # 3. Minimalist kinetic opening & closing titles + zero-overlap karaoke Netflix subtitles
    tp_open = create_title_png(
        WORK_DIR / "tp_open.png",
        "DECEMBER 1ST  •  THE PROMISE",
        ["€400. NO MORE."],
        "Why calm holiday budgets silently double in 45 days",
        (250, 204, 21),
    )
    tp_close = create_title_png(
        WORK_DIR / "tp_close.png",
        "JANUARY 1ST  •  ZERO DEBT",
        ["KEEP THE €528."],
        "Same generosity. Zero 21.9% APR hangover.",
        (16, 185, 129),
    )
    ass_path = write_karaoke_ass(words, WORK_DIR / "v5_karaoke.ass", words_per_line=5)

    outro_start = ev2_start_t + d_ev2 + 0.35
    fc = (
        f"[1:v]format=rgba,fade=t=in:st=0.25:d=0.40:alpha=1,fade=t=out:st=2.75:d=0.40:alpha=1[ov_open];"
        f"[2:v]format=rgba,fade=t=in:st={outro_start:.2f}:d=0.45:alpha=1,fade=t=out:st={total_dur-0.45:.2f}:d=0.40:alpha=1[ov_close];"
        f"[0:v][ov_open]overlay=0:0:enable='between(t,0.20,3.20)'[v1];"
        f"[v1][ov_close]overlay=0:0:enable='between(t,{outro_start:.2f},{total_dur:.2f})'[v2];"
        f"[v2]ass='{ass_path}'[vout]"
    )

    vis_mp4 = WORK_DIR / "v5_visuals.mp4"
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-i", str(base_mp4),
            "-loop", "1", "-t", "3.4", "-i", str(tp_open),
            "-loop", "1", "-t", f"{total_dur:.2f}", "-i", str(tp_close),
            "-filter_complex", fc,
            "-map", "[vout]",
            "-t", f"{total_dur:.3f}",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p",
            str(vis_mp4),
        ],
        check=True,
        capture_output=True,
    )

    # 4. 4-Layer Cinema Sound Design (-14.0 LUFS): Studio VO + 2-Act Score w/ Silence Drop + Foley SFX!
    print("▶ 3. Mixing 4-layer cinema audio (Studio SM7B VO + 2-Act Score w/ Silence Drop + Foley SFX -> -14.0 LUFS)...")
    score_wav = generate_v5_cinema_score(total_dur, t_pivot, WORK_DIR / "v5_score.wav")

    sfx_riser = SFX_DIR / "riser.mp3"
    sfx_impact = SFX_DIR / "impact-bass-1.mp3"
    sfx_whoosh = SFX_DIR / "whoosh-short.mp3"
    sfx_click = SFX_DIR / "click-soft.mp3"
    sfx_chime = SFX_DIR / "chime.mp3"

    d_riser = max(0, int((bwin["b2_reveal"][0] - 1.0) * 1000))
    d_hit920 = int(t_920 * 1000)
    d_ev1_ms = int((d_b1 + d_b2 + d_b3_desk) * 1000)
    d_st1_ms = int((d_b1 + d_b2 + d_b3_desk + 1.45) * 1000)
    d_ev2_ms = int(ev2_start_t * 1000)
    d_chime_ms = int((ev2_start_t + max(5.55, t_528 - ev2_start_t + 0.45)) * 1000)

    aud_fc = (
        "[0:a]asplit=2[vo_main][vo_sc];"
        "[1:a][vo_sc]sidechaincompress=threshold=0.018:ratio=6:attack=35:release=320[mus_duck];"
        f"[2:a]volume=0.16,adelay={d_riser}|{d_riser}[s_riser];"
        f"[3:a]volume=0.28,adelay={d_hit920}|{d_hit920}[s_hit];"
        f"[4:a]volume=0.20,adelay={d_ev1_ms}|{d_ev1_ms}[s_w1];"
        f"[5:a]volume=0.26,adelay={d_st1_ms}|{d_st1_ms}[s_c1];"
        f"[4:a]volume=0.20,adelay={d_ev2_ms}|{d_ev2_ms}[s_w2];"
        f"[6:a]volume=0.16,adelay={d_chime_ms}|{d_chime_ms}[s_chime];"
        "[vo_main][mus_duck][s_riser][s_hit][s_w1][s_c1][s_w2][s_chime]"
        "amix=inputs=8:duration=first:dropout_transition=0:normalize=0,"
        "loudnorm=I=-14.0:TP=-1.5:LRA=11[aout]"
    )

    master_wav = WORK_DIR / "v5_master_14lufs.wav"
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-i", str(studio_vo),
            "-i", str(score_wav),
            "-i", str(sfx_riser),
            "-i", str(sfx_impact),
            "-i", str(sfx_whoosh),
            "-i", str(sfx_click),
            "-i", str(sfx_chime),
            "-filter_complex", aud_fc,
            "-map", "[aout]",
            "-t", f"{total_dur:.3f}",
            str(master_wav),
        ],
        check=True,
        capture_output=True,
    )

    subprocess.run(
        [
            "ffmpeg", "-y",
            "-i", str(vis_mp4),
            "-i", str(master_wav),
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "192k",
            "-shortest", "-movflags", "+faststart",
            str(FINAL_OUT),
        ],
        check=True,
        capture_output=True,
    )

    # Extract 5 hero verification thumbnails
    THUMBS_DIR.mkdir(parents=True, exist_ok=True)
    for t_sec, name in [
        (1.6, "beat1_400_cap.jpg"),
        (bwin["b2_reveal"][0] + 2.0, "beat1_920_spike.jpg"),
        (d_b1 + d_b2 + d_b3_desk + 1.8, "beat2_4_traps.jpg"),
        (t_220 + 0.9, "beat3_3_columns.jpg"),
        (total_dur - 2.0, "beat4_payoff.jpg"),
    ]:
        subprocess.run(
            ["ffmpeg", "-y", "-ss", f"{min(total_dur - 0.4, max(0.5, t_sec)):.2f}", "-i", str(FINAL_OUT), "-frames:v", "1", "-q:v", "2", "-update", "1", str(THUMBS_DIR / name)],
            check=True,
            capture_output=True,
        )

    print(f"✅ Rendered v5_cinema_flagship short sample ({total_dur:.1f}s) -> {FINAL_OUT} ({FINAL_OUT.stat().st_size / (1024*1024):.1f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
