#!/usr/bin/env python3
"""Local audio analysis worker for mixmash.

The worker intentionally stays deterministic and local. It decodes audio with
ffmpeg, uses numpy for lightweight signal features, and returns one JSON object
for a single known track supplied on stdin.
"""

from __future__ import annotations

import json
import math
import pathlib
import subprocess
import sys
import base64
from typing import Any

import numpy as np


STEMS = ("vocals", "drums", "bass", "other")
SR = 8000
HOP_SECONDS = 0.25


def run(cmd: list[str], timeout: int = 30) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout, check=True)


def probe_duration(path: pathlib.Path) -> float:
    try:
        out = run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            timeout=8,
        ).stdout.decode("utf-8", "ignore")
        value = float(out.strip())
        return value if math.isfinite(value) else 0.0
    except Exception:
        return 0.0


def decode_audio(path: pathlib.Path) -> np.ndarray:
    try:
        raw = run(
            [
                "ffmpeg",
                "-v",
                "error",
                "-i",
                str(path),
                "-ac",
                "1",
                "-ar",
                str(SR),
                "-f",
                "f32le",
                "pipe:1",
            ],
            timeout=45,
        ).stdout
        return np.frombuffer(raw, dtype=np.float32)
    except Exception:
        return np.zeros(0, dtype=np.float32)


def envelope(audio: np.ndarray) -> np.ndarray:
    hop = max(1, int(SR * HOP_SECONDS))
    if audio.size < hop:
        return np.zeros(0, dtype=np.float32)
    usable = audio[: (audio.size // hop) * hop]
    if usable.size == 0:
        return np.zeros(0, dtype=np.float32)
    frames = usable.reshape((-1, hop))
    env = np.sqrt(np.mean(frames * frames, axis=1))
    if env.size >= 5:
        kernel = np.ones(5, dtype=np.float32) / 5
        env = np.convolve(env, kernel, mode="same")
    return env.astype(np.float32)


def normalize(values: np.ndarray) -> np.ndarray:
    if values.size == 0:
        return values
    peak = float(np.max(values))
    if peak <= 1e-9:
        return np.zeros_like(values)
    return values / peak


def active_windows(env: np.ndarray, max_items: int = 10) -> list[dict[str, float]]:
    norm = normalize(env)
    if norm.size == 0:
        return []
    threshold = max(0.18, float(np.median(norm) + np.std(norm) * 0.35))
    active = norm >= threshold
    windows: list[dict[str, float]] = []
    start: int | None = None

    for idx, is_active in enumerate(active):
        if is_active and start is None:
            start = idx
        if start is not None and (not is_active or idx == len(active) - 1):
            end = idx if not is_active else idx + 1
            duration = (end - start) * HOP_SECONDS
            if duration >= 1.0:
                score = float(np.mean(norm[start:end]))
                windows.append(
                    {
                        "start": round(start * HOP_SECONDS, 3),
                        "end": round(end * HOP_SECONDS, 3),
                        "score": round(score, 3),
                    }
                )
            start = None

    windows.sort(key=lambda item: item["score"], reverse=True)
    return sorted(windows[:max_items], key=lambda item: item["start"])


def detect_bpm(drums_env: np.ndarray, provided_bpm: float | None) -> dict[str, Any]:
    if drums_env.size < 32:
        bpm = provided_bpm or 128.0
        return {"provided": provided_bpm, "detected": None, "resolved": bpm, "confidence": 0.25, "source": "metadata"}

    onset = np.maximum(0, np.diff(normalize(drums_env), prepend=drums_env[0]))
    onset = onset - float(np.mean(onset))
    denom = float(np.dot(onset, onset))
    if denom <= 1e-9:
        bpm = provided_bpm or 128.0
        return {"provided": provided_bpm, "detected": None, "resolved": bpm, "confidence": 0.25, "source": "metadata"}

    scores: list[tuple[float, float]] = []
    for bpm in np.linspace(80, 180, 201):
        lag = int(round((60.0 / float(bpm)) / HOP_SECONDS))
        if lag <= 1 or lag >= onset.size:
            continue
        score = float(np.dot(onset[:-lag], onset[lag:]) / denom)
        scores.append((score, float(bpm)))

    if not scores:
        bpm = provided_bpm or 128.0
        return {"provided": provided_bpm, "detected": None, "resolved": bpm, "confidence": 0.25, "source": "metadata"}

    raw_score, detected = max(scores, key=lambda item: item[0])
    variants = [detected, detected / 2, detected * 2]
    variants = [value for value in variants if 70 <= value <= 185]
    if provided_bpm:
        resolved = min(variants or [detected], key=lambda value: abs(value - provided_bpm))
        if abs(resolved - provided_bpm) > 12:
            resolved = provided_bpm
            source = "metadata"
        else:
            source = "detected-adjusted"
    else:
        resolved = detected
        source = "detected"

    confidence = max(0.28, min(0.9, 0.34 + raw_score * 1.8))
    return {
        "provided": provided_bpm,
        "detected": round(detected, 2),
        "resolved": round(float(resolved), 2),
        "confidence": round(confidence, 3),
        "source": source,
    }


def first_strong_onset(env: np.ndarray) -> float:
    norm = normalize(env)
    if norm.size == 0:
        return 0.0
    limit = min(norm.size, int(20 / HOP_SECONDS))
    early = norm[:limit]
    if early.size == 0:
        return 0.0
    threshold = max(0.35, float(np.percentile(early, 78)))
    hits = np.where(early >= threshold)[0]
    return round(float(hits[0] * HOP_SECONDS), 3) if hits.size else 0.0


def markers(duration: float, start: float, step: float, limit: int = 512) -> list[float]:
    if duration <= 0 or step <= 0:
        return []
    values: list[float] = []
    t = max(0.0, start)
    while t <= duration and len(values) < limit:
        values.append(round(t, 3))
        t += step
    return values


def sample_env(env: np.ndarray, time: float) -> float:
    if env.size == 0:
        return 0.0
    idx = max(0, min(env.size - 1, int(time / HOP_SECONDS)))
    return float(normalize(env)[idx])


def section_candidates(duration: float, bpm: float, downbeat: float, stem_envs: dict[str, np.ndarray]) -> list[dict[str, Any]]:
    if duration <= 0 or bpm <= 0:
        return []
    phrase = (60.0 / bpm) * 16
    sections: list[dict[str, Any]] = []
    t = downbeat
    idx = 1
    while t < duration - 4 and len(sections) < 16:
        end = min(duration, t + phrase)
        midpoint = (t + end) / 2
        vocal = sample_env(stem_envs.get("vocals", np.array([])), midpoint)
        drums = sample_env(stem_envs.get("drums", np.array([])), midpoint)
        bass = sample_env(stem_envs.get("bass", np.array([])), midpoint)
        total = max(vocal, drums, bass, sample_env(stem_envs.get("other", np.array([])), midpoint))
        if vocal > 0.48 and total > 0.45:
            label = "hook"
        elif drums > 0.58 and bass > 0.45:
            label = "drop"
        elif drums < 0.25 and vocal < 0.3:
            label = "breakdown"
        elif idx <= 2:
            label = "intro"
        else:
            label = "phrase"
        sections.append(
            {
                "id": f"s{idx}",
                "label": label,
                "start": round(t, 3),
                "end": round(end, 3),
                "score": round((total + vocal * 0.4 + drums * 0.25 + bass * 0.2), 3),
                "vocalEnergy": round(vocal, 3),
                "drumEnergy": round(drums, 3),
                "bassEnergy": round(bass, 3),
            }
        )
        t += phrase
        idx += 1
    return sections


def rough_chroma(audio: np.ndarray) -> dict[str, Any]:
    if audio.size == 0:
        return {"key": None, "scale": None, "confidence": 0.0, "chroma": []}
    clip = audio[: min(audio.size, SR * 45)]
    if clip.size < 2048:
        return {"key": None, "scale": None, "confidence": 0.0, "chroma": []}
    spectrum = np.abs(np.fft.rfft(clip * np.hanning(clip.size)))
    freqs = np.fft.rfftfreq(clip.size, d=1 / SR)
    chroma = np.zeros(12, dtype=np.float64)
    for freq, mag in zip(freqs, spectrum):
        if 55 <= freq <= 1760 and mag > 0:
            midi = 69 + 12 * math.log2(float(freq) / 440.0)
            chroma[int(round(midi)) % 12] += float(mag)
    if np.max(chroma) <= 0:
        return {"key": None, "scale": None, "confidence": 0.0, "chroma": []}
    chroma = chroma / np.max(chroma)
    names = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
    key_idx = int(np.argmax(chroma))
    confidence = float(np.max(chroma) - np.median(chroma))
    return {
        "key": names[key_idx],
        "scale": "unknown",
        "confidence": round(max(0.05, min(0.65, confidence)), 3),
        "chroma": [round(float(value), 3) for value in chroma.tolist()],
    }


def main() -> None:
    if len(sys.argv) > 1:
        payload = json.loads(base64.b64decode(sys.argv[1]).decode("utf-8"))
    else:
        payload = json.load(sys.stdin)
    track = payload["track"]
    library_root = pathlib.Path(payload["libraryRoot"]).expanduser()
    track_path = library_root / track["filename"]
    stem_dir = library_root / "stems" / pathlib.Path(track["filename"]).with_suffix("").name
    provided_bpm = float(track["bpm"]) if track.get("bpm") else None

    stem_paths = {stem: stem_dir / f"{stem}.mp3" for stem in STEMS}
    stem_availability = {stem: stem_paths[stem].exists() for stem in STEMS}
    duration = probe_duration(track_path)
    full_audio = decode_audio(track_path)
    stem_audio = {
        stem: decode_audio(stem_paths[stem]) if stem_availability[stem] else np.zeros(0, dtype=np.float32)
        for stem in STEMS
    }
    stem_envs = {stem: envelope(audio) for stem, audio in stem_audio.items()}

    drums_env = stem_envs["drums"] if stem_envs["drums"].size else envelope(full_audio)
    bpm_info = detect_bpm(drums_env, provided_bpm)
    bpm = float(bpm_info["resolved"])
    beat_period = 60.0 / bpm if bpm > 0 else 0.0
    downbeat_offset = first_strong_onset(drums_env)
    beatgrid = markers(duration, downbeat_offset, beat_period, 512)
    downbeats = markers(duration, downbeat_offset, beat_period * 4, 256)
    phrases = markers(duration, downbeat_offset, beat_period * 16, 128)
    sections = section_candidates(duration, bpm, downbeat_offset, stem_envs)
    hooks = sorted([s for s in sections if s["label"] == "hook"], key=lambda item: item["score"], reverse=True)[:6]
    drops = sorted([s for s in sections if s["label"] == "drop"], key=lambda item: item["score"], reverse=True)[:6]

    stem_energy = {}
    for stem in STEMS:
        env = stem_envs[stem]
        norm = normalize(env)
        stem_energy[stem] = {
            "mean": round(float(np.mean(norm)) if norm.size else 0.0, 3),
            "peak": round(float(np.max(norm)) if norm.size else 0.0, 3),
            "activity": round(float(np.mean(norm > 0.18)) if norm.size else 0.0, 3),
            "windows": active_windows(env),
        }

    warnings: list[str] = []
    if bpm_info["confidence"] < 0.45:
        warnings.append("Low tempo detection confidence; phrase alignment may need ears.")
    if not stem_availability["vocals"] or not stem_availability["drums"]:
        warnings.append("Missing key stems for strong mashup preparation.")
    if not hooks:
        warnings.append("No clear hook section detected.")

    stem_count = sum(1 for value in stem_availability.values() if value)
    confidence = min(
        0.96,
        0.28
        + float(bpm_info["confidence"]) * 0.34
        + min(stem_count, 4) * 0.07
        + (0.08 if hooks else 0)
        + (0.06 if drops else 0),
    )

    stat = track_path.stat() if track_path.exists() else None
    print(
        json.dumps(
            {
                "version": 2,
                "trackId": track["id"],
                "name": track["name"],
                "artist": track["artist"],
                "filename": track["filename"],
                "duration": round(duration, 3),
                "bpm": bpm_info,
                "beatPeriod": round(beat_period, 5),
                "downbeatOffset": downbeat_offset,
                "beatgrid": beatgrid,
                "downbeats": downbeats,
                "phrases": phrases,
                "stemAvailability": stem_availability,
                "stemEnergy": stem_energy,
                "vocalWindows": stem_energy["vocals"]["windows"],
                "bassWindows": stem_energy["bass"]["windows"],
                "drumWindows": stem_energy["drums"]["windows"],
                "sectionCandidates": sections,
                "hookCandidates": hooks,
                "dropCandidates": drops,
                "roughKey": rough_chroma(full_audio),
                "confidence": round(confidence, 3),
                "warnings": warnings,
                "source": "python-numpy-v2",
                "fileMtimeMs": round(stat.st_mtime * 1000, 3) if stat else 0,
                "analyzedAt": int(__import__("time").time() * 1000),
            }
        )
    )


if __name__ == "__main__":
    main()
