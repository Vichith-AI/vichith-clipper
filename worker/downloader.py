"""
worker/downloader.py
─────────────────────────────────────────────────────────────────────────────
Audio-First Stream Ingestion for YouTube, Twitch, and Kick via yt-dlp.

Architectural Strategy:
1. PHASE 1: Fetch audio only (`-f bestaudio -x --audio-format mp3`).
   For a 2-hour VOD, this fetches ~15-30MB instead of 4-8GB. Whisper
   transcription and loudness crest analysis run on this audio in seconds.
2. PHASE 2: Fetch only winning sections (`--download-sections "*start-end"`).
   Downloads only the exact 15-60s clip ranges in full 1080p for final
   vertical split rendering, cutting bandwidth, time, and disk usage by >95%.
"""

import os
import re
import subprocess
from typing import Optional, Tuple
from urllib.parse import urlparse

STREAM_URL_PATTERNS = [
    re.compile(r'^(https?://)?(www\.)?(youtube\.com/watch\?v=|youtu\.be/|youtube\.com/live/|youtube\.com/shorts/)[\w-]+'),
    re.compile(r'^(https?://)?(www\.)?(twitch\.tv/videos/\d+|twitch\.tv/[\w-]+)'),
    re.compile(r'^(https?://)?(www\.)?(kick\.com/video/[\w-]+|kick\.com/[\w-]+(\?clip=[\w-]+)?)'),
]


def is_valid_stream_url(url: str) -> bool:
    if not url or not isinstance(url, str):
        return False
    clean = url.strip()
    return any(p.match(clean) for p in STREAM_URL_PATTERNS)


def identify_platform(url: str) -> str:
    clean = url.strip().lower()
    if 'youtube.com' in clean or 'youtu.be' in clean:
        return 'youtube'
    if 'twitch.tv' in clean:
        return 'twitch'
    if 'kick.com' in clean:
        return 'kick'
    return 'generic'


def get_stream_metadata(url: str) -> dict:
    """Extract stream title, duration, and thumbnail without downloading video data."""
    cmd = [
        'yt-dlp',
        '--dump-json',
        '--no-playlist',
        '--skip-download',
        url.strip(),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    import json
    data = json.loads(result.stdout)
    return {
        'id': data.get('id'),
        'title': data.get('title', 'Stream Capture'),
        'duration_secs': data.get('duration', 0),
        'uploader': data.get('uploader') or data.get('channel', 'Unknown Creator'),
        'thumbnail': data.get('thumbnail'),
        'platform': identify_platform(url),
    }


def download_stream_audio(url: str, output_path: str) -> str:
    """Phase 1: Downloads audio-first for peak energy & Whisper speech detection."""
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    # Output template without extension; ffmpeg extracts mp3
    base_name, _ = os.path.splitext(output_path)
    target_mp3 = f"{base_name}.mp3"

    cmd = [
        'yt-dlp',
        '-f', 'bestaudio',
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '192K',
        '--no-playlist',
        '-o', f"{base_name}.%(ext)s",
        url.strip(),
    ]

    subprocess.run(cmd, capture_output=True, text=True, check=True)
    if os.path.exists(target_mp3):
        return target_mp3
    return output_path


def download_stream_section(
    url: str,
    start_secs: float,
    end_secs: float,
    output_path: str,
) -> str:
    """Phase 2: Downloads only the winning slice (15-60s) in 1080p for 9:16 rendering."""
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    section_arg = f"*{int(start_secs)}-{int(end_secs)}"

    cmd = [
        'yt-dlp',
        '-f', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
        '--download-sections', section_arg,
        '--force-keyframes-at-cuts',
        '--no-playlist',
        '--merge-output-format', 'mp4',
        '-o', output_path,
        url.strip(),
    ]

    subprocess.run(cmd, capture_output=True, text=True, check=True)
    return output_path
