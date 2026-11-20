export const CLIPPER_MAX_VOD_SECS = 3 * 60 * 60;
export const CLIPPER_MAX_VOD_BYTES = 500 * 1024 * 1024;

export const CLIPPER_FREE_MAX_VOD_SECS = 30 * 60; // 30 minutes
export const CLIPPER_FREE_MAX_VOD_BYTES = 250 * 1024 * 1024; // 250 MB

export type ClipperLayout = 'gaming_split' | 'speaker_reframe';
export type ClipperCaptionStyle = 'active_pill' | 'karaoke';
export type ClipperTargetCount = 3 | 5;
export type ClipperClipLength = 'auto' | 'snappy' | 'story';

export interface ClipperPreferences {
    layout: ClipperLayout;
    captionStyle: ClipperCaptionStyle;
    targetCount: ClipperTargetCount;
    clipLength?: ClipperClipLength;
}

export const DEFAULT_CLIPPER_PREFERENCES: ClipperPreferences = {
    layout: 'gaming_split',
    captionStyle: 'active_pill',
    targetCount: 3,
    clipLength: 'auto',
};

export function captionStylePayload(style: ClipperCaptionStyle) {
    return {
        motion: style === 'karaoke' ? 'highlight_wipe' : 'pop_in',
        fontFamily: 'Inter',
        color: '#FFFFFF',
    };
}

export function verticalWorkspaceOperations(style: ClipperCaptionStyle, layout: ClipperLayout, clipId?: string) {
    return [
        { tool: 'set_aspect_ratio', args: { aspectRatio: '9:16' } },
        ...(clipId && layout === 'speaker_reframe' ? [{ tool: 'reframe_clip', args: { clipId, targetRatio: '9:16' } }] : []),
        { tool: 'apply_caption_template', args: captionStylePayload(style) },
    ];
}

/** Upload validation. Free-tier accounts are capped at 250 MB; Pro/credit accounts at 500 MB. */
export function validateVodFile(file: Pick<File, 'name' | 'size' | 'type'>, isFreeTier: boolean = false): string | null {
    const accepted = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska']);
    if (!accepted.has(file.type)) return 'Upload an MP4, WebM, MOV or MKV stream capture.';
    if (file.size <= 0) return 'That file is empty.';
    const maxBytes = isFreeTier ? CLIPPER_FREE_MAX_VOD_BYTES : CLIPPER_MAX_VOD_BYTES;
    if (file.size > maxBytes) {
        return isFreeTier
            ? 'Free accounts are limited to 250 MB. Top up credits or trim the VOD to upload up to 500 MB.'
            : 'Uploads are limited to 500 MB. Trim the VOD before uploading.';
    }
    return null;
}

export function formatVodDuration(seconds: number | null): string {
    if (seconds === null || !Number.isFinite(seconds)) return 'Duration not measured';
    const total = Math.max(0, Math.round(seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${minutes}:${String(secs).padStart(2, '0')}`;
}
