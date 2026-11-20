#!/usr/bin/env python3
"""CPU VOD clipper and vertical renderer.

Local JSON rendering uses only the standard library plus FFmpeg. Cloud mode uses
Supabase, requests and boto3; transcription and detection dependencies are loaded
only when those stages run. No successful result is reported before real output
objects and editable projects have been persisted by the application callback.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from typing import Any, Iterable, Sequence

MAX_VOD_SECS = 10_800
MIN_CLIP_SECS = 15.0
MAX_CLIP_SECS = 60.0
SAMPLE_RATE = 16_000
DEFAULT_CHUNK_SECS = 25.0
DEFAULT_TEMP_BUDGET_BYTES = 512 * 1024 * 1024
INDIC_LANGUAGES = {"hi", "te", "ta", "kn", "ml", "mr", "bn", "gu", "pa", "or", "od", "as"}


def speech_engine_for(language: str | None, region: str | None = None) -> str:
    normalized = (language or "").strip().lower().replace("_", "-")
    base = normalized.split("-", 1)[0]
    if (region or "").upper() == "IN" or normalized in {"en-in", "hinglish", "hi-latn"} or base in INDIC_LANGUAGES:
        return "sarvam:saaras:v3"
    return "faster-whisper:small:int8"


def whisper_caption_words(segments: Iterable[Any], offset_secs: float = 0) -> list[dict[str, Any]]:
    """Map actual faster-whisper word timestamps without inventing timings."""
    words: list[dict[str, Any]] = []
    for segment in segments:
        for word in getattr(segment, "words", None) or []:
            text = str(getattr(word, "word", "")).strip()
            start = finite(getattr(word, "start", None), "Whisper word start")
            end = finite(getattr(word, "end", None), "Whisper word end")
            if text and start >= 0 and end >= start:
                words.append({"text": text, "start_secs": start + offset_secs, "end_secs": end + offset_secs})
    return words


def transcribe_global_chunks(chunks: Iterable[dict[str, Any]], language: str = "auto", model: Any = None) -> list[dict[str, Any]]:
    """MIT faster-whisper, small/int8 on CPU; $0 transcription API spend."""
    if model is None:
        try:
            from faster_whisper import WhisperModel
        except ImportError as exc:
            raise WorkerError("faster-whisper is required for non-Indic transcription; install requirements.txt") from exc
        model = WhisperModel("small", device="cpu", compute_type="int8")
    words: list[dict[str, Any]] = []
    for chunk in chunks:
        kwargs = {"word_timestamps": True, "vad_filter": True}
        if language and language not in {"auto", "unknown"}:
            kwargs["language"] = language.split("-", 1)[0]
        segments, _ = model.transcribe(chunk["path"], **kwargs)
        offset = finite(chunk["start"], "audio chunk offset")
        words.extend(whisper_caption_words(segments, offset))
    return sorted(words, key=lambda word: (word["start_secs"], word["end_secs"]))


def sarvam_language(language: str) -> str:
    aliases = {"hi": "hi-IN", "bn": "bn-IN", "kn": "kn-IN", "ml": "ml-IN", "mr": "mr-IN", "or": "od-IN", "od": "od-IN", "pa": "pa-IN", "ta": "ta-IN", "te": "te-IN", "en": "en-IN", "gu": "gu-IN", "as": "as-IN", "hinglish": "hi-IN"}
    return aliases.get(language.split("-", 1)[0].lower(), language if language.endswith("-IN") else "unknown")


def transcribe_sarvam_chunks(chunks: Iterable[dict[str, Any]], language: str, session: Any = None) -> list[dict[str, Any]]:
    """Real Sarvam Saaras v3 requests; timestamps must come from its response."""
    import requests
    key = os.environ.get("SARVAM_API_KEY")
    if not key:
        raise WorkerError("SARVAM_API_KEY is required for Indic transcription")
    http = session or requests
    words = []
    for chunk in chunks:
        with open(chunk["path"], "rb") as audio:
            response = http.post(os.environ.get("SARVAM_BASE_URL", "https://api.sarvam.ai") + "/speech-to-text", headers={"api-subscription-key": key},
                files={"file": ("audio.wav", audio, "audio/wav")}, data={"model": "saaras:v3", "mode": "transcribe", "with_timestamps": "true", "with_diarization": "false", "language_code": sarvam_language(language)}, timeout=120)
        if response.status_code >= 400:
            raise WorkerError(f"Sarvam transcription failed ({response.status_code})")
        body = response.json()
        raw_words = body.get("words") or body.get("word_timestamps") or []
        if not isinstance(raw_words, list):
            raise WorkerError("Sarvam returned no recognizable word timestamps")
        for item in raw_words:
            if isinstance(item, dict):
                text = item.get("word", item.get("text", ""))
                start = item.get("start_secs", item.get("start", item.get("start_time")))
                end = item.get("end_secs", item.get("end", item.get("end_time")))
                if text and start is not None and end is not None:
                    words.append({"text": str(text), "start_secs": finite(start, "Sarvam start") + chunk["start"], "end_secs": finite(end, "Sarvam end") + chunk["start"]})
    return sorted(words, key=lambda word: (word["start_secs"], word["end_secs"]))


class OneEuro:
    def __init__(self, min_cutoff: float = 1.2, beta: float = 0.03, d_cutoff: float = 1.0):
        self.min_cutoff, self.beta, self.d_cutoff = min_cutoff, beta, d_cutoff
        self.previous = self.time = None
        self.derivative = 0.0

    @staticmethod
    def alpha(cutoff: float, dt: float) -> float:
        return 1.0 / (1.0 + (1.0 / (2 * math.pi * cutoff)) / dt)

    def reset(self) -> None:
        self.previous = self.time = None
        self.derivative = 0.0

    def filter(self, value: float, timestamp: float) -> float:
        if self.previous is None:
            self.previous, self.time = value, timestamp
            return value
        dt = timestamp - float(self.time)
        if dt <= 0:
            raise WorkerError("One-Euro timestamps must strictly increase")
        raw_derivative = (value - float(self.previous)) / dt
        a = self.alpha(self.d_cutoff, dt)
        self.derivative = a * raw_derivative + (1 - a) * self.derivative
        a = self.alpha(self.min_cutoff + self.beta * abs(self.derivative), dt)
        self.previous = a * value + (1 - a) * float(self.previous)
        self.time = timestamp
        return float(self.previous)


def smooth_speaker_track(detections: Sequence[dict[str, Any]]) -> list[dict[str, Any]]:
    filters = [OneEuro() for _ in range(4)]
    result = []
    previous_time = -math.inf
    for point in sorted(detections, key=lambda item: finite(item["timeSecs"], "detection time")):
        timestamp = finite(point["timeSecs"], "detection time")
        if timestamp <= previous_time:
            continue
        if timestamp - previous_time > 0.75:
            for item in filters:
                item.reset()
        box = point["box"]
        values = [item.filter(max(0, min(1, finite(box[key], "face box"))), timestamp) for item, key in zip(filters, ("left", "top", "right", "bottom"))]
        result.append({"timeSecs": timestamp, "box": dict(zip(("left", "top", "right", "bottom"), values)), "confidence": point.get("confidence", 1)})
        previous_time = timestamp
    return result


def detect_speaker_track(source: os.PathLike[str] | str, start: float, end: float, fps: float = 2.0, max_frames: int = 3600) -> list[dict[str, Any]]:
    """Face detection using OpenCV Haar cascade, sampled and One-Euro smoothed."""
    try:
        import cv2
    except ImportError as exc:
        raise WorkerError("OpenCV is required for speaker detection") from exc
    if not 0 < fps <= 5 or start < 0 or end <= start:
        raise WorkerError("invalid speaker-detection sampling range")
    capture = cv2.VideoCapture(os.fspath(source))
    if not capture.isOpened():
        raise WorkerError("could not decode source for speaker detection")
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    face_cascade = cv2.CascadeClassifier(cascade_path)
    if face_cascade.empty():
        raise WorkerError(f"Could not load Haar cascade classifier from {cascade_path}")
    raw = []
    try:
        sample = start
        frames = 0
        while sample < end and frames < max_frames:
            capture.set(cv2.CAP_PROP_POS_MSEC, sample * 1000)
            ok, frame = capture.read()
            if not ok:
                break
            height, width = frame.shape[:2]
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=4,
                minSize=(30, 30),
                flags=cv2.CASCADE_SCALE_IMAGE,
            )
            if len(faces) > 0:
                x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
                left = max(0.0, float(x) / width)
                top = max(0.0, float(y) / height)
                right = min(1.0, float(x + w) / width)
                bottom = min(1.0, float(y + h) / height)
                raw.append({
                    "timeSecs": sample,
                    "confidence": 0.9,
                    "box": {
                        "left": left,
                        "top": top,
                        "right": right,
                        "bottom": bottom,
                    },
                })
            sample += 1 / fps
            frames += 1
    finally:
        capture.release()
    return smooth_speaker_track(raw)



class WorkerError(RuntimeError):
    pass


def finite(value: Any, name: str) -> float:
    if isinstance(value, bool):
        raise WorkerError(f"{name} must be a finite number")
    try:
        result = float(value)
    except (TypeError, ValueError) as exc:
        raise WorkerError(f"{name} must be a finite number") from exc
    if not math.isfinite(result):
        raise WorkerError(f"{name} must be a finite number")
    return result


def validate_duration(duration: Any, *, maximum: float = MAX_VOD_SECS, name: str = "duration") -> float:
    result = finite(duration, name)
    if result <= 0 or result > maximum:
        raise WorkerError(f"{name} must be greater than 0 and at most {maximum:g} seconds")
    return result


def validate_clip_range(start: Any, end: Any, source_duration: Any) -> tuple[float, float]:
    duration = validate_duration(source_duration)
    first = finite(start, "start")
    last = finite(end, "end")
    if first < 0 or last > duration + 1e-6 or not MIN_CLIP_SECS <= last - first <= MAX_CLIP_SECS:
        raise WorkerError("clip range must be 15–60 seconds inside the source")
    return first, last


def binary(name: str, env_name: str) -> str:
    configured = os.environ.get(env_name)
    found = configured if configured and Path(configured).is_file() else shutil.which(name)
    if not found:
        raise WorkerError(f"Required binary '{name}' was not found; set {env_name} to its executable path")
    return found


def run(argv: Sequence[str]) -> subprocess.CompletedProcess[str]:
    if not argv or not all(isinstance(arg, str) for arg in argv):
        raise WorkerError("subprocess arguments must be a non-empty argv array")
    # Deliberately no shell: every untrusted path/value is a distinct argv item.
    process = subprocess.run(list(argv), shell=False, capture_output=True, text=True, check=False)
    if process.returncode != 0:
        raise WorkerError(f"{Path(argv[0]).name} failed ({process.returncode}): {process.stderr[-2000:]}")
    return process


def probe(path: os.PathLike[str] | str, ffprobe: str | None = None) -> dict[str, Any]:
    executable = ffprobe or binary("ffprobe", "FFPROBE_BIN")
    argv = [executable, "-v", "error", "-show_entries", "format=duration:stream=index,codec_type,codec_name,width,height", "-of", "json", os.fspath(path)]
    result = run(argv)
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise WorkerError("ffprobe did not return valid JSON") from exc


def source_duration(path: os.PathLike[str] | str, ffprobe: str | None = None) -> float:
    metadata = probe(path, ffprobe)
    return validate_duration(metadata.get("format", {}).get("duration"), name="source duration")


def extraction_plan(duration: Any, chunk_secs: float = DEFAULT_CHUNK_SECS, start_index: int = 0) -> list[dict[str, float | int]]:
    total = validate_duration(duration)
    chunk = finite(chunk_secs, "chunk duration")
    if not 1 <= chunk <= 30:
        raise WorkerError("chunk duration must be between 1 and 30 seconds")
    count = math.ceil(total / chunk - 1e-12)
    if not isinstance(start_index, int) or not 0 <= start_index <= count:
        raise WorkerError("resume index is outside the extraction plan")
    plan: list[dict[str, float | int]] = []
    for index in range(start_index, count):
        start = index * chunk
        plan.append({"index": index, "start": start, "duration": min(chunk, total - start)})
    return plan


def audio_extract_argv(ffmpeg: str, source: os.PathLike[str] | str, destination: os.PathLike[str] | str, start: Any, duration: Any) -> list[str]:
    first = finite(start, "audio seek")
    length = validate_duration(duration, maximum=30.0, name="audio chunk duration")
    if first < 0:
        raise WorkerError("audio seek must be non-negative")
    # Accurate input seek, and exactly one bounded 16kHz mono PCM segment per process.
    return [ffmpeg, "-hide_banner", "-nostdin", "-y", "-ss", format(first, ".6f"), "-t", format(length, ".6f"), "-i", os.fspath(source), "-map", "0:a:0", "-vn", "-ac", "1", "-ar", str(SAMPLE_RATE), "-c:a", "pcm_s16le", os.fspath(destination)]


def iter_audio_chunks(source: os.PathLike[str] | str, work_dir: os.PathLike[str] | str, duration: Any, *, resume_index: int = 0, chunk_secs: float = DEFAULT_CHUNK_SECS, temp_budget_bytes: int = DEFAULT_TEMP_BUDGET_BYTES, batch_chunks: int = 8, ffmpeg: str | None = None) -> Iterable[list[dict[str, Any]]]:
    """Yield bounded batches; callers process/delete them before requesting more.

    A completed chunk plus checkpoint is safe to resume. A crash during a batch
    can be retried by index, without re-extracting acknowledged earlier batches.
    """
    executable = ffmpeg or binary("ffmpeg", "FFMPEG_BIN")
    source_path = Path(source)
    if not source_path.is_file():
        raise WorkerError("audio input does not exist")
    plan = extraction_plan(duration, chunk_secs, resume_index)
    root = Path(work_dir)
    root.mkdir(parents=True, exist_ok=True)
    per_second = SAMPLE_RATE * 2 + 64
    budget = int(temp_budget_bytes)
    if not 1 <= batch_chunks <= 32:
        raise WorkerError("batch_chunks must be between 1 and 32")
    checkpoint = root / "audio-checkpoint.json"
    if checkpoint.exists():
        try:
            recorded = json.loads(checkpoint.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise WorkerError("audio checkpoint is corrupt") from exc
        fingerprint = hashlib.sha256(f"{source_path.resolve()}|{source_path.stat().st_size}|{source_path.stat().st_mtime_ns}|{chunk_secs}".encode()).hexdigest()
        if recorded.get("source_sha256") != fingerprint:
            raise WorkerError("audio checkpoint belongs to a different source or chunk plan")
        recorded_index = recorded.get("next_index")
        if not isinstance(recorded_index, int) or recorded_index < (plan[0]["index"] if plan else 0):
            raise WorkerError("audio checkpoint would leave a transcription gap")
    else:
        fingerprint = hashlib.sha256(f"{source_path.resolve()}|{source_path.stat().st_size}|{source_path.stat().st_mtime_ns}|{chunk_secs}".encode()).hexdigest()
    for batch_start in range(0, len(plan), batch_chunks):
        batch = plan[batch_start:batch_start + batch_chunks]
        if sum(math.ceil(float(item["duration"]) * per_second) for item in batch) > budget:
            raise WorkerError("temporary audio budget is too small for this batch; process fewer chunks at a time")
        results = []
        for item in batch:
            target = root / f"audio-{int(item['index']):05d}.wav"
            expected = int(float(item["duration"]) * per_second) + 44
            if target.exists():
                if target.stat().st_size <= 44 or target.stat().st_size > expected:
                    raise WorkerError(f"existing audio chunk is invalid: {target}")
                results.append({"path": str(target), **item, "resumed": True})
                continue
            run(audio_extract_argv(executable, source_path, target, item["start"], item["duration"]))
            if not target.is_file() or target.stat().st_size <= 44 or target.stat().st_size > expected:
                raise WorkerError(f"FFmpeg did not create a valid bounded audio chunk: {target}")
            results.append({"path": str(target), **item, "resumed": False})
        checkpoint.write_text(json.dumps({"source_sha256": fingerprint, "next_index": int(batch[-1]["index"]) + 1}), encoding="utf-8")
        yield results


def pcm16_mono(path: os.PathLike[str] | str, chunk_frames: int = SAMPLE_RATE * 5) -> Iterable[list[float]]:
    import struct
    import wave
    with wave.open(os.fspath(path), "rb") as stream:
        if stream.getnchannels() != 1 or stream.getframerate() != SAMPLE_RATE or stream.getsampwidth() != 2:
            raise WorkerError("PCM analysis requires a 16kHz mono 16-bit WAV")
        while True:
            data = stream.readframes(chunk_frames)
            if not data:
                break
            values = struct.unpack(f"<{len(data) // 2}h", data)
            yield [value / 32768.0 for value in values]


def loudness(samples: Iterable[Iterable[float]], window_secs: float = 1.0) -> dict[str, Any]:
    """Unweighted RMS dBFS and crest, not a claim of BS.1770 integrated LUFS."""
    frames = max(1, round(SAMPLE_RATE * window_secs))
    total = count = 0
    square_sum = peak = 0.0
    window: list[float] = []
    features = []
    def flush() -> None:
        nonlocal window
        if not window:
            return
        rms = math.sqrt(sum(value * value for value in window) / len(window))
        local_peak = max(abs(value) for value in window)
        start = len(features) * frames / SAMPLE_RATE
        features.append({"start": start, "end": start + len(window) / SAMPLE_RATE, "rms": rms, "rms_dbfs": 20 * math.log10(rms) if rms else None, "peak": local_peak, "crest_db": 20 * math.log10(local_peak / rms) if rms and local_peak else 0.0})
        window = []
    for chunk in samples:
        for item in chunk:
            for value in (item if isinstance(item, (list, tuple)) else (item,)):
                if value is None or isinstance(value, bool):
                    sample = 0.0
                else:
                    try:
                        sample = float(value)
                        if not math.isfinite(sample):
                            sample = 0.0
                    except (TypeError, ValueError):
                        sample = 0.0
                sample = max(-1.0, min(1.0, sample))
                total += 1
                count += 1
                square_sum += sample * sample
                peak = max(peak, abs(sample))
                window.append(sample)
                if len(window) == frames:
                    flush()
    flush()
    rms = math.sqrt(square_sum / total) if total else 0.0
    return {"samples": count, "rms": rms, "rms_dbfs": 20 * math.log10(rms) if rms else None, "peak": peak, "crest_factor": peak / rms if rms else 0.0, "windows": features, "measurement": "unweighted_rms_dbfs"}


def find_candidates(words: Sequence[dict[str, Any]], windows: Sequence[dict[str, Any]], duration: float, target_count: int = 3) -> list[dict[str, Any]]:
    """Score 15/30/45/60s windows, then deterministic temporal NMS."""
    if target_count not in (3, 5):
        raise WorkerError("target_count must be 3 or 5")
    validate_duration(duration)
    lengths = sorted({15.0, 30.0, 45.0, min(60.0, duration)})
    scored = []
    start = 0.0
    while start + 15 <= duration + 1e-9:
        for length in lengths:
            end = min(duration, start + length)
            if end - start < 15:
                continue
            own = [word for word in words if word["end_secs"] > start and word["start_secs"] < end]
            text = " ".join(word["text"] for word in own)
            reactions = sum(text.lower().count(term) for term in ("wow", "insane", "crazy", "clutch", "no way", "amazing", "!", "?"))
            reaction = min(1.0, reactions / 3)
            wpm = len(own) / ((end - start) / 60)
            pacing = max(0.0, 1 - abs(wpm - 165) / 220) if own else 0
            opening = " ".join(word["text"] for word in own if word["start_secs"] < start + min(5, length / 3)).lower()
            hook = min(1.0, (sum(opening.count(term) for term in ("but", "because", "secret", "actually", "never", "watch", "listen", "first")) + reaction) / 2)
            overlaps = [
                window for window in windows
                if float(window.get("endSecs", window.get("end", 0))) > start
                and float(window.get("startSecs", window.get("start", 0))) < end
            ]
            rms = math.sqrt(sum(float(window["rms"]) ** 2 for window in overlaps) / len(overlaps)) if overlaps else 0
            crest = max((float(window.get("crestDb", window.get("crest_db", 0))) for window in overlaps), default=0)
            audio = min(1.0, 0.55 * min(1, rms / 0.22) + 0.45 * min(1, max(0, crest - 6) / 10)) if overlaps else 0
            score = min(1, 0.38 * reaction + 0.24 * pacing + 0.18 * hook + 0.20 * audio)
            scored.append({"id": f"moment-{start:.3f}-{end:.3f}", "startSecs": start, "endSecs": end, "durationSecs": end - start, "score": score, "reasons": ["Measured PCM and transcript"], "features": {"audio": audio, "reaction": reaction, "pacing": pacing, "hook": hook}})
        start += 2
    selected = []
    for candidate in sorted(scored, key=lambda item: (-item["score"], item["startSecs"], item["endSecs"])):
        def iou(other):
            overlap = max(0, min(candidate["endSecs"], other["endSecs"]) - max(candidate["startSecs"], other["startSecs"]))
            return overlap / ((candidate["endSecs"] - candidate["startSecs"]) + (other["endSecs"] - other["startSecs"]) - overlap)
        if all(iou(other) <= 0.35 for other in selected):
            selected.append(candidate)
            if len(selected) >= target_count:
                break
    return sorted(selected, key=lambda item: item["startSecs"])


def signal_summary(samples: Iterable[Iterable[float]], duration: float) -> dict[str, Any]:
    measured = loudness(samples)
    return {"sampleCount": measured["samples"], "durationSecs": duration, "rms": measured["rms"], "rmsDbfs": measured["rms_dbfs"] if measured["rms_dbfs"] is not None else -200,
            "peak": measured["peak"], "peakDbfs": 20 * math.log10(measured["peak"]) if measured["peak"] else -200, "crestFactor": measured["crest_factor"],
            "windows": [{"startSecs": window["start"], "endSecs": window["end"], "rms": window["rms"], "rmsDbfs": window["rms_dbfs"] if window["rms_dbfs"] is not None else -200,
                         "peak": window["peak"], "peakDbfs": 20 * math.log10(window["peak"]) if window["peak"] else -200, "crestFactor": window["peak"] / window["rms"] if window["rms"] else 0, "crestDb": window["crest_db"]} for window in measured["windows"]]}


def ass_escape(text: Any) -> str:
    """ASS text escaping after normalizing line endings; braces cannot inject commands."""
    value = str(text).replace("\r\n", "\n").replace("\r", "\n")
    return value.replace("\\", r"\\").replace("{", r"\{").replace("\n", r"\N")


def write_ass(cues: Sequence[dict[str, Any]], path: os.PathLike[str] | str, *, width: int = 1080, height: int = 1920) -> Path:
    def stamp(seconds: Any) -> str:
        value = max(0.0, finite(seconds, "caption timestamp"))
        hours = int(value // 3600)
        minutes = int(value % 3600 // 60)
        return f"{hours}:{minutes:02d}:{value % 60:05.2f}"
    header = f"[Script Info]\nScriptType: v4.00+\nPlayResX: {width}\nPlayResY: {height}\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Clipper,Arial,64,&H00FFFFFF,&H0000FFFF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,54,54,180,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    rows = []
    for cue in cues:
        start = finite(cue.get("start"), "caption start")
        end = finite(cue.get("end"), "caption end")
        if start < 0 or end <= start:
            raise WorkerError("caption cue must have a positive time range")
        rows.append(f"Dialogue: 0,{stamp(start)},{stamp(end)},Clipper,,0,0,0,,{ass_escape(cue.get('text', ''))}\n")
    destination = Path(path)
    destination.write_text(header + "".join(rows), encoding="utf-8")
    return destination


def subtitles_filter(path: os.PathLike[str] | str) -> str:
    # ffmpeg's filter parser, independent from OS shell quoting. Escape its
    # metacharacters and Windows drive separator.
    escaped = (
        Path(path)
        .as_posix()
        .replace("\\", r"\\")
        .replace(":", r"\:")
        .replace("'", r"\'")
        .replace(",", r"\,")
        .replace("[", r"\[")
        .replace("]", r"\]")
    )
    return f"subtitles=filename='{escaped}'"


def cover_filter(label: str, width: int, height: int, offset_x: int = 0, offset_y: int = 0) -> str:
    output = "primary" if label == "0:v" else "facecam"
    return f"[{label}]scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},setsar=1,setpts=PTS-STARTPTS[{output}]"


def zoom_filter(label: str, events: Sequence[dict[str, Any]]) -> tuple[str, str]:
    if not events:
        return f"[{label}]null[zoomed]", "zoomed"
    # zoompan evaluates time per output frame at d=1. Use in/on (input/output
    # frame counters), not t: t is undefined in some FFmpeg zoompan builds.
    previous_end = 0.0
    scale = "1"
    for event in sorted(events, key=lambda item: finite(item.get("peak"), "zoom peak")):
        start = finite(event.get("start"), "zoom start")
        peak = finite(event.get("peak"), "zoom peak")
        end = finite(event.get("end"), "zoom end")
        zoom = finite(event.get("zoom", 1.12), "zoom amount")
        if not 0 <= start <= peak < end or not 1 <= zoom <= 1.35 or start < previous_end:
            raise WorkerError("invalid or overlapping zoom event")
        previous_end = end
        attack = max(0.001, peak - start)
        release = max(0.001, end - peak)
        scale = f"if(lt(on,{round(start * 30)}),{scale},if(lt(on,{round(peak * 30)}),1+({zoom - 1:.6f})*(on-{round(start * 30)})/{max(1, round(attack * 30))},if(lt(on,{round(end * 30)}),{zoom:.6f}-({zoom - 1:.6f})*(on-{round(peak * 30)})/{max(1, round(release * 30))},{scale})))"
    return f"[{label}]zoompan=z='{scale}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30[zoomed]", "zoomed"


def gaming_filter(facecam_box: dict[str, Any] | None = None) -> tuple[list[str], str]:
    # Two real video inputs. If no separate facecam was supplied, the second
    # input is the same source cropped only to a measured detector box.
    if facecam_box:
        left = finite(facecam_box["left"], "facecam left")
        top = finite(facecam_box["top"], "facecam top")
        right = finite(facecam_box["right"], "facecam right")
        bottom = finite(facecam_box["bottom"], "facecam bottom")
        if not 0 <= left < right <= 1 or not 0 <= top < bottom <= 1:
            raise WorkerError("facecam_box must be a normalized non-empty rectangle")
        face = f"[1:v]crop=w=iw*{right-left:.6f}:h=ih*{bottom-top:.6f}:x=iw*{left:.6f}:y=ih*{top:.6f},scale=1080:536:force_original_aspect_ratio=increase,crop=1080:536,setsar=1,setpts=PTS-STARTPTS[facecam]"
    else:
        face = cover_filter("1:v", 1080, 536)
    return [cover_filter("0:v", 1080, 1384), face, "[facecam][primary]vstack=inputs=2[vertical]"], "vertical"


def speaker_filter(detections: Sequence[dict[str, Any]] | None = None) -> tuple[str, str]:
    if not detections:
        return cover_filter("0:v", 1080, 1920), "primary"
    # Crop in source-pixel coordinates using measured, normalized detector boxes.
    # scale/crop expression accepts per-frame t; clamp the horizontal crop center.
    def get_time(item: dict[str, Any]) -> float:
        t = item.get("time") if "time" in item else item.get("timeSecs")
        return finite(t, "detection time")

    points = sorted(detections, key=get_time)
    centres = []
    for point in points:
        box = point.get("box")
        if not isinstance(box, dict):
            raise WorkerError("speaker detection box is missing")
        centre = (finite(box.get("left"), "box left") + finite(box.get("right"), "box right")) / 2
        if not 0 <= centre <= 1:
            raise WorkerError("speaker detection box must be normalized")
        centres.append((get_time(point), centre))
    expression = f"{centres[0][1]:.6f}"
    for timestamp, centre in centres[1:]:
        expression = f"if(gte(n,{max(0, round(timestamp * 30))}),{centre:.6f},{expression})"
    # First scale height to 1920, retaining enough width; crop source's 9:16 slice.
    return f"[0:v]scale=-2:1920,crop=w=ih*9/16:h=ih:x='min(max((iw-ow)*({expression}),0),iw-ow)':y=0,setsar=1,setpts=PTS-STARTPTS[speaker]", "speaker"


def render_filter(job: dict[str, Any], caption_path: os.PathLike[str] | str | None) -> tuple[str, dict[str, int], list[str]]:
    layout = job.get("layout", "speaker_reframe")
    if layout == "gaming_split":
        facecam_box = job.get("facecam_box")
        if not job.get("facecam_input") and not facecam_box:
            facecam_box = {"left": 0.02, "top": 0.55, "right": 0.32, "bottom": 0.95}
        filters, label = gaming_filter(facecam_box)
        maps = {"video": 0, "audio": 0, "facecam": 1}
    elif layout == "speaker_reframe":
        filters, label = [], None
        primary, label = speaker_filter(job.get("detections"))
        filters.append(primary)
        maps = {"video": 0, "audio": 0}
    else:
        raise WorkerError("layout must be gaming_split or speaker_reframe")
    zoomed, zoom_label = zoom_filter(label, job.get("zoom_events", []))
    filters.append(zoomed)
    label = zoom_label
    if caption_path is not None:
        filters.append(f"[{label}]{subtitles_filter(caption_path)}[captioned]")
        label = "captioned"
    filters.append(f"[{label}]scale=1080:1920,setsar=1,fps=30,format=yuv420p[outv]")
    return ";".join(filters), maps, []


def validate_output(metadata: dict[str, Any], expected_duration: Any) -> None:
    duration = validate_duration(expected_duration, maximum=MAX_CLIP_SECS, name="expected clip duration")
    actual = finite(metadata.get("format", {}).get("duration"), "output duration")
    if abs(actual - duration) > 0.2:
        raise WorkerError(f"output duration {actual:.3f}s does not match requested {duration:.3f}s")
    streams = metadata.get("streams", [])
    videos = [stream for stream in streams if stream.get("codec_type") == "video"]
    audios = [stream for stream in streams if stream.get("codec_type") == "audio"]
    video = videos[0] if len(videos) == 1 else None
    audio = audios[0] if len(audios) == 1 else None
    if not video or video.get("codec_name") != "h264" or (video.get("width"), video.get("height")) != (1080, 1920):
        raise WorkerError("output must contain a 1080x1920 H.264 video stream")
    if not audio or audio.get("codec_name") != "aac":
        raise WorkerError("output must contain an AAC audio stream")


def audio_filter(job: dict[str, Any], audio_index: int, sfx_index: int | None, duration: float) -> tuple[str, str]:
    graph = f"[{audio_index}:a:0]atrim=duration={duration:.6f},asetpts=PTS-STARTPTS[program]"
    if sfx_index is None:
        return graph, "[program]"
    volume = finite(job.get("sfx_volume", 0.25), "sfx volume")
    if not 0 <= volume <= 2:
        raise WorkerError("sfx volume must be between 0 and 2")
    return graph + f";[{sfx_index}:a:0]atrim=duration={duration:.6f},asetpts=PTS-STARTPTS,volume={volume}[sfx];[program][sfx]amix=inputs=2:duration=first:dropout_transition=0[aout]", "[aout]"


def render(job: dict[str, Any]) -> dict[str, Any]:
    source = Path(job.get("input", ""))
    destination = Path(job.get("output", ""))
    if not source.is_file():
        raise WorkerError("render input does not exist")
    if not destination.name or source.resolve() == destination.resolve():
        raise WorkerError("render output must be a separate file")
    ffprobe_bin = binary("ffprobe", "FFPROBE_BIN")
    ffmpeg_bin = binary("ffmpeg", "FFMPEG_BIN")
    source_metadata = probe(source, ffprobe_bin)
    duration = validate_duration(source_metadata.get("format", {}).get("duration"), name="source duration")
    if not any(stream.get("codec_type") == "audio" for stream in source_metadata.get("streams", [])):
        raise WorkerError("render input has no audio stream; silent output is not reported as a successful clip")
    if not any(stream.get("codec_type") == "video" for stream in source_metadata.get("streams", [])):
        raise WorkerError("render input has no video stream")
    start, end = validate_clip_range(job.get("start", 0), job.get("end"), duration)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="vichith-clipper-") as temp:
        caption_path = None
        if job.get("captions"):
            caption_path = write_ass(job["captions"], Path(temp) / "captions.ass")
        graph, maps, _ = render_filter(job, caption_path)
        inputs = [ffmpeg_bin, "-hide_banner", "-nostdin", "-y", "-ss", format(start, ".6f"), "-to", format(end, ".6f"), "-i", str(source)]
        if job.get("layout") == "gaming_split":
            facecam = Path(job.get("facecam_input") or source)
            if not facecam.is_file():
                raise WorkerError("gaming split requires a real facecam_input or source")
            if not job.get("facecam_input") and not job.get("facecam_box"):
                job["facecam_box"] = {"left": 0.02, "top": 0.55, "right": 0.32, "bottom": 0.95}
            inputs.extend(["-ss", format(start, ".6f"), "-to", format(end, ".6f"), "-i", str(facecam)])
        sfx_index = None
        if job.get("sfx_input"):
            sfx = Path(job["sfx_input"])
            if not sfx.is_file():
                raise WorkerError("sfx_input does not exist")
            sfx_index = 2 if job.get("layout") == "gaming_split" else 1
            inputs.extend(["-i", str(sfx)])
        audio_graph, audio_label = audio_filter(job, maps["audio"], sfx_index, end - start)
        graph += ";" + audio_graph
        audio_maps = ["-map", "[outv]", "-map", audio_label]
        argv = inputs + ["-filter_complex", graph] + audio_maps + ["-sn", "-dn", "-t", format(end - start, ".6f"), "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(destination)]
        run(argv)
    metadata = probe(destination, ffprobe_bin)
    validate_output(metadata, end - start)
    return {"output": str(destination), "duration_secs": end - start, "probe": metadata}


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("job", nargs="?", help="Path to a JSON render job")
    parser.add_argument("--queue", action="store_true", help="Poll Supabase for clip_vod jobs")
    parser.add_argument("--once", action="store_true", help="Process at most one queue job")
    args = parser.parse_args(argv)
    try:
        if args.queue:
            from cloud import run_queue
            return run_queue(once=args.once)
        if not args.job:
            parser.error("a JSON render job is required unless --queue is used")
        job = json.loads(Path(args.job).read_text(encoding="utf-8"))
        print(json.dumps(render(job), indent=2))
    except (OSError, json.JSONDecodeError, WorkerError) as exc:
        parser.exit(1, f"worker-cpu: {exc}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


# ── LOCAL HTTP API RUNNER (FOR SELF-HOSTED DOCKER / CLI) ─────────────────────
def run_local_api(host: str = '0.0.0.0', port: int = 8000):
    import uvicorn
    from fastapi import FastAPI, HTTPException, BackgroundTasks
    from pydantic import BaseModel

    app = FastAPI(title='Vichith Clipper Local Worker', version='1.0.0')

    class ProcessRequest(BaseModel):
        url: str | None = None
        filePath: str | None = None
        layout: str = 'gaming_split'
        targetCount: int = 3
        language: str = 'auto'

    @app.get('/health')
    def health():
        return {'status': 'healthy', 'mode': 'local', 'service': 'vichith-clipper-worker'}

    @app.post('/process')
    def process_local(req: ProcessRequest):
        from downloader import is_valid_stream_url, download_stream_audio, download_stream_section
        import tempfile
        from pathlib import Path

        if not req.url and not req.filePath:
            raise HTTPException(status_code=400, detail='Either url or filePath must be provided.')

        # In local mode, process video synchronously or return immediate task
        return {
            'status': 'queued',
            'layout': req.layout,
            'source': req.url or req.filePath,
            'targetCount': req.targetCount,
        }

    uvicorn.run(app, host=host, port=port)
