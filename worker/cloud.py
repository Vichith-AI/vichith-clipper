"""Supabase/R2 orchestration for the CPU clipper. Imports stay out of pure tests."""
from __future__ import annotations

import json
import math
import os
from pathlib import Path
import socket
import tempfile
import time
from typing import Any

import worker

WORKER_ID = os.environ.get("WORKER_ID", f"cpu-worker-{socket.gethostname()}-{os.getpid()}")


def clients() -> tuple[Any, Any]:
    from supabase import create_client
    import boto3
    from botocore.config import Config
    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    endpoint_url = os.environ.get("AWS_S3_ENDPOINT") or os.environ.get("R2_ENDPOINT_URL")
    region_name = os.environ.get("AWS_REGION") or os.environ.get("R2_REGION", "auto")
    access_key_id = os.environ.get("AWS_ACCESS_KEY_ID") or os.environ.get("R2_ACCESS_KEY_ID")
    secret_access_key = os.environ.get("AWS_SECRET_ACCESS_KEY") or os.environ.get("R2_SECRET_ACCESS_KEY")
    client_kwargs: dict[str, Any] = {
        "config": Config(signature_version="s3v4"),
        "region_name": region_name,
    }
    if endpoint_url:
        client_kwargs["endpoint_url"] = endpoint_url
    if access_key_id:
        client_kwargs["aws_access_key_id"] = access_key_id
    if secret_access_key:
        client_kwargs["aws_secret_access_key"] = secret_access_key
    s3 = boto3.client("s3", **client_kwargs)
    return supabase, s3


def download(url: str, destination: Path) -> None:
    import requests
    with requests.get(url, stream=True, timeout=(10, 120)) as response:
        response.raise_for_status()
        with destination.open("wb") as output:
            for block in response.iter_content(1024 * 1024):
                output.write(block)


def representative_face(track: list[dict[str, Any]], start: float, end: float) -> dict[str, float] | None:
    points = [point for point in track if start <= point["timeSecs"] <= end]
    if not points:
        return None
    box = points[len(points) // 2]["box"]
    width, height = box["right"] - box["left"], box["bottom"] - box["top"]
    return {"left": max(0, box["left"] - width * 0.4), "top": max(0, box["top"] - height * 0.5), "right": min(1, box["right"] + width * 0.4), "bottom": min(1, box["bottom"] + height * 1.5)}


def callback(job: dict[str, Any], payload: dict[str, Any], secret: str) -> dict[str, Any]:
    import requests
    worker_params = job["params"]["worker"]
    response = requests.post(worker_params["completionUrl"], json={**payload, "workerId": WORKER_ID, "completionSecret": secret}, headers={"Authorization": f"Bearer {os.environ['CLIPPER_WORKER_SECRET']}"}, timeout=180)
    if response.status_code >= 400:
        raise worker.WorkerError(f"completion callback failed ({response.status_code}): {response.text[:500]}")
    return response.json()


def process_job(job: dict[str, Any], s3: Any) -> dict[str, Any]:
    params = job.get("params") or {}
    worker_params = params.get("worker") or {}
    secret = worker_params.get("completionSecret")
    if not worker_params.get("inputUrl") or not secret:
        raise worker.WorkerError("job is missing its input or one-job completion token")
    with tempfile.TemporaryDirectory(prefix="vichith-vod-") as temporary:
        root = Path(temporary)
        source = root / "source.mp4"
        download(worker_params["inputUrl"], source)
        metadata = worker.probe(source)
        duration = worker.validate_duration(metadata.get("format", {}).get("duration"), name="source duration")
        callback(job, {"progress": 0.05}, secret)
        words: list[dict[str, Any]] = []
        windows: list[dict[str, Any]] = []
        samples = 0
        engine = worker.speech_engine_for(params.get("language"), params.get("region"))
        whisper_model = None
        for batch in worker.iter_audio_chunks(source, root / "audio", duration, batch_chunks=4):
            for chunk in batch:
                samples += 1
            summary = worker.signal_summary((worker.pcm16_mono(chunk["path"]) for chunk in batch), sum(float(chunk["duration"]) for chunk in batch))
            windows.extend({**window, "startSecs": window["startSecs"] + float(batch[0]["start"]), "endSecs": window["endSecs"] + float(batch[0]["start"])} for window in summary["windows"])
            if engine.startswith("sarvam"):
                words.extend(worker.transcribe_sarvam_chunks(batch, params.get("language", "auto")))
            else:
                if whisper_model is None:
                    from faster_whisper import WhisperModel
                    whisper_model = WhisperModel("small", device="cpu", compute_type="int8")
                words.extend(worker.transcribe_global_chunks(batch, params.get("language", "auto"), whisper_model))
            for chunk in batch:
                Path(chunk["path"]).unlink(missing_ok=True)
            callback(job, {"progress": min(0.65, 0.05 + samples / max(1, int(duration / 25)) * 0.6)}, secret)
        signal = worker.signal_summary([], duration)
        signal["sampleCount"] = sum(round((window["endSecs"] - window["startSecs"]) * worker.SAMPLE_RATE) for window in windows)
        signal["windows"] = windows
        if windows:
            signal["rms"] = (sum(window["rms"] ** 2 for window in windows) / len(windows)) ** 0.5
            signal["rmsDbfs"] = 20 * math.log10(signal["rms"]) if signal["rms"] else -200
            signal["peak"] = max(window["peak"] for window in windows)
            signal["peakDbfs"] = 20 * math.log10(signal["peak"]) if signal["peak"] else -200
            signal["crestFactor"] = signal["peak"] / signal["rms"] if signal["rms"] else 0
        candidates = worker.find_candidates(words, windows, duration, int(params.get("targetCount", 3)))
        if not candidates:
            raise worker.WorkerError("No 15–60 second moment could be selected from the real audio and transcript")
        speaker_track = worker.detect_speaker_track(source, 0, duration)
        facecam_source = None
        if worker_params.get("facecamUrl"):
            facecam_source = root / "facecam.mp4"
            download(worker_params["facecamUrl"], facecam_source)
        output_keys: dict[str, str] = {}
        for index, candidate in enumerate(candidates):
            start, end = candidate["startSecs"], candidate["endSecs"]
            captions = [{"start": max(0, word["start_secs"] - start), "end": min(end - start, word["end_secs"] - start), "text": word["text"]} for word in words if word["start_secs"] >= start and word["end_secs"] <= end]
            detections = [{"time": max(0, point["timeSecs"] - start), "box": point["box"]} for point in speaker_track if start <= point["timeSecs"] <= end]
            facecam_box = representative_face(speaker_track, start, end)
            if facecam_box is None and params.get("layout") == "gaming_split" and not facecam_source:
                facecam_box = {"left": 0.02, "top": 0.55, "right": 0.32, "bottom": 0.95}
            output = root / f"clip-{index}.mp4"
            rendered = worker.render({"input": str(source), "output": str(output), "start": start, "end": end, "layout": params.get("layout", "speaker_reframe"), "facecam_input": str(facecam_source) if facecam_source else None, "facecam_box": facecam_box, "detections": detections, "captions": captions})
            key = f"{worker_params['outputPrefix']}/clipper-{candidate['id']}.mp4"
            bucket = os.environ.get("AWS_S3_BUCKET") or os.environ.get("R2_BUCKET_NAME") or os.environ.get("R2_BUCKET", "vichith-assets")
            s3.upload_file(str(output), bucket, key, ExtraArgs={"ContentType": "video/mp4"})
            head = s3.head_object(Bucket=bucket, Key=key)
            if head.get("ContentLength", 0) <= 0 or head.get("ContentType") != "video/mp4":
                raise worker.WorkerError("R2 output metadata does not match the rendered MP4")
            output_keys[candidate["id"]] = key
            callback(job, {"progress": 0.7 + (index + 1) / len(candidates) * 0.25}, secret)
        analysis = {"words": words, "signal": signal, "candidates": candidates, "speakerTrack": speaker_track}
        result = callback(job, {"analysis": analysis, "outputKeys": output_keys}, secret)
        return result


def run_queue(once: bool = False) -> int:
    supabase, s3 = clients()
    idle_timeout_secs = float(os.environ.get("IDLE_TIMEOUT_SECS", "900"))
    poll_interval_secs = float(os.environ.get("POLL_INTERVAL_SECS", "3"))
    last_active_at = time.monotonic()
    active_jobs = 0

    print(f"[worker-cpu] Started worker {WORKER_ID}. Idle shutdown timeout: {idle_timeout_secs}s ({idle_timeout_secs / 60:.1f}m).")

    while True:
        response = supabase.rpc("claim_compute_job", {"p_worker_id": WORKER_ID, "p_job_types": ["clip_vod"]}).execute()
        jobs = response.data or []
        if not jobs:
            if once:
                return 0
            idle_duration = time.monotonic() - last_active_at
            if active_jobs == 0 and idle_duration >= idle_timeout_secs:
                print(f"[worker-cpu] Idle {int(idle_duration)}s >= {int(idle_timeout_secs)}s with 0 active jobs. Executing auto-shutdown.")
                os.system("sudo /sbin/shutdown -h now")
                return 0
            time.sleep(poll_interval_secs)
            continue

        job = jobs[0]
        active_jobs = 1
        last_active_at = time.monotonic()
        try:
            print(json.dumps(process_job(job, s3)))
        except Exception as error:
            try:
                callback(job, {"status": "failed", "error": str(error)}, job.get("params", {}).get("worker", {}).get("completionSecret", ""))
            except Exception as callback_error:
                supabase.table("compute_jobs").update({"status": "failed", "error_message": f"{error}; callback: {callback_error}"}).eq("id", job["id"]).execute()
        finally:
            active_jobs = 0
            last_active_at = time.monotonic()

        if once:
            return 0


if __name__ == "__main__":
    import sys
    sys.exit(run_queue())
