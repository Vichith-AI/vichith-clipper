/**
 * apps/web/src/lib/streamIngest.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Validation and platform metadata parsing for YouTube, Twitch, and Kick stream URLs.
 */

export interface StreamInfo {
    valid: boolean;
    platform: 'youtube' | 'twitch' | 'kick' | 'direct' | 'unknown';
    url: string;
    normalizedUrl?: string;
    videoId?: string;
}

const YOUTUBE_RE = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|live\/|shorts\/)|youtu\.be\/)([\w-]{11})/;
const TWITCH_RE = /(?:https?:\/\/)?(?:www\.)?twitch\.tv\/(?:videos\/(\d+)|([a-zA-Z0-9_]+))/;
const KICK_RE = /(?:https?:\/\/)?(?:www\.)?kick\.com\/(?:video\/([\w-]+)|([a-zA-Z0-9_]+))/;
const DIRECT_VIDEO_RE = /\.(mp4|webm|mov|mkv)(\?.*)?$/i;

export function parseStreamUrl(input: string): StreamInfo {
    if (!input || typeof input !== 'string') {
        return { valid: false, platform: 'unknown', url: '' };
    }

    const trimmed = input.trim();

    const ytMatch = trimmed.match(YOUTUBE_RE);
    if (ytMatch) {
        return {
            valid: true,
            platform: 'youtube',
            url: trimmed,
            videoId: ytMatch[1],
            normalizedUrl: `https://www.youtube.com/watch?v=${ytMatch[1]}`,
        };
    }

    const twitchMatch = trimmed.match(TWITCH_RE);
    if (twitchMatch) {
        return {
            valid: true,
            platform: 'twitch',
            url: trimmed,
            videoId: twitchMatch[1] || twitchMatch[2],
            normalizedUrl: trimmed,
        };
    }

    const kickMatch = trimmed.match(KICK_RE);
    if (kickMatch) {
        return {
            valid: true,
            platform: 'kick',
            url: trimmed,
            videoId: kickMatch[1] || kickMatch[2],
            normalizedUrl: trimmed,
        };
    }

    if (DIRECT_VIDEO_RE.test(trimmed)) {
        return {
            valid: true,
            platform: 'direct',
            url: trimmed,
            normalizedUrl: trimmed,
        };
    }

    return {
        valid: false,
        platform: 'unknown',
        url: trimmed,
    };
}
