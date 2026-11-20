import type { SignalWindow } from './signal';

export interface ZoomEvent {
    startSecs: number;
    peakSecs: number;
    endSecs: number;
    fromZoom: number;
    toZoom: number;
    crestDb: number;
}

export interface AutoZoomOptions {
    cooldownSecs?: number;
    holdSecs?: number;
    releaseSecs?: number;
    attackSecs?: number;
    minCrestDb?: number;
    zoom?: number;
}

/** Deterministic local maxima only; silence and ordinary speech do not punch in. */
export function planAutoZoom(windows: readonly SignalWindow[], options: AutoZoomOptions = {}): ZoomEvent[] {
    const cooldown = options.cooldownSecs ?? 4;
    const hold = options.holdSecs ?? 0.45;
    const release = options.releaseSecs ?? 0.28;
    const attack = options.attackSecs ?? 0.12;
    const minCrest = options.minCrestDb ?? 12;
    const zoom = Math.min(1.35, Math.max(1.01, options.zoom ?? 1.12));
    if ([cooldown, hold, release, attack, minCrest].some((v) => !Number.isFinite(v) || v < 0)) throw new RangeError('Zoom timings and threshold must be finite and non-negative.');
    const events: ZoomEvent[] = [];
    let nextAllowed = 0;
    for (let i = 0; i < windows.length; i += 1) {
        const w = windows[i]!;
        if (w.startSecs + 1e-9 < nextAllowed || w.crestDb < minCrest || w.rms <= 0) continue;
        const previous = windows[i - 1];
        const next = windows[i + 1];
        if (previous && previous.crestDb > w.crestDb || next && next.crestDb >= w.crestDb) continue;
        const peakSecs = w.startSecs;
        const startSecs = Math.max(0, peakSecs - attack);
        events.push({ startSecs, peakSecs, endSecs: peakSecs + hold + release, fromZoom: 1, toZoom: zoom, crestDb: w.crestDb });
        nextAllowed = peakSecs + Math.max(cooldown, hold + release);
    }
    return events;
}

export interface DetectionBox { left: number; top: number; right: number; bottom: number }
export interface FaceDetection { timeSecs: number; box: DetectionBox; confidence?: number }
export interface SmoothedFace extends FaceDetection { box: DetectionBox }

/** One-Euro filter: low-pass with speed-dependent cutoff, independent axes. */
export class OneEuroFilter {
    private xPrev: number | null = null;
    private dxPrev = 0;
    private tPrev: number | null = null;
    constructor(readonly minCutoff = 1, readonly beta = 0.02, readonly dCutoff = 1) {
        if (!(minCutoff > 0) || !(dCutoff > 0) || beta < 0) throw new RangeError('Invalid One-Euro parameters.');
    }
    private static alpha(cutoff: number, dt: number): number {
        const tau = 1 / (2 * Math.PI * cutoff);
        return 1 / (1 + tau / dt);
    }
    reset(): void { this.xPrev = null; this.dxPrev = 0; this.tPrev = null; }
    filter(value: number, timeSecs: number): number {
        if (!Number.isFinite(value) || !Number.isFinite(timeSecs)) throw new RangeError('One-Euro samples must be finite.');
        if (this.xPrev === null || this.tPrev === null) {
            this.xPrev = value;
            this.tPrev = timeSecs;
            return value;
        }
        const dt = timeSecs - this.tPrev;
        if (!(dt > 0)) throw new RangeError('One-Euro timestamps must strictly increase.');
        const dx = (value - this.xPrev) / dt;
        const dxAlpha = OneEuroFilter.alpha(this.dCutoff, dt);
        const dxHat = dxAlpha * dx + (1 - dxAlpha) * this.dxPrev;
        const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
        const alpha = OneEuroFilter.alpha(cutoff, dt);
        const result = alpha * value + (1 - alpha) * this.xPrev;
        this.xPrev = result;
        this.dxPrev = dxHat;
        this.tPrev = timeSecs;
        return result;
    }
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Consume real detector boxes (e.g. MediaPipe run by the caller); no detector bundled. */
export function smoothSpeakerDetections(detections: readonly FaceDetection[], options: { minCutoff?: number; beta?: number; dCutoff?: number; minConfidence?: number } = {}): SmoothedFace[] {
    const filters = Array.from({ length: 4 }, () => new OneEuroFilter(options.minCutoff ?? 1.2, options.beta ?? 0.03, options.dCutoff ?? 1));
    const sorted = detections.filter((d) => Number.isFinite(d.timeSecs)
        && [d.box.left, d.box.top, d.box.right, d.box.bottom].every(Number.isFinite)
        && d.box.right >= d.box.left && d.box.bottom >= d.box.top
        && (d.confidence ?? 1) >= (options.minConfidence ?? 0.5))
        .map((d) => ({ ...d, box: { ...d.box } }))
        .sort((a, b) => a.timeSecs - b.timeSecs);
    const result: SmoothedFace[] = [];
    let previousTime = -Infinity;
    for (const detection of sorted) {
        if (detection.timeSecs <= previousTime) continue; // one unambiguous target per detector sample
        if (detection.timeSecs - previousTime > 0.75) filters.forEach((f) => f.reset());
        const values = [detection.box.left, detection.box.top, detection.box.right, detection.box.bottom];
        const [left, top, right, bottom] = filters.map((f, i) => f.filter(clamp(values[i]!, 0, 1), detection.timeSecs));
        result.push({ ...detection, box: { left: clamp(left, 0, 1), top: clamp(top, 0, 1), right: clamp(Math.max(left, right), 0, 1), bottom: clamp(Math.max(top, bottom), 0, 1) } });
        previousTime = detection.timeSecs;
    }
    return result;
}

export interface GamingLayout {
    canvas: { width: 1080; height: 1920 };
    facecam: { x: number; y: number; width: number; height: number };
    gameplay: { x: number; y: number; width: number; height: number };
    captionSafeArea: { x: number; y: number; width: number; height: number };
}

/** Explicit two-source layout; a single VOD is not falsely identified as two feeds. */
export function gamingSplitLayout(facecamHeightRatio = 0.28): GamingLayout {
    const ratio = clamp(facecamHeightRatio, 0.2, 0.4);
    const faceHeight = Math.round(1920 * ratio / 2) * 2;
    return {
        canvas: { width: 1080, height: 1920 },
        facecam: { x: 0, y: 0, width: 1080, height: faceHeight },
        gameplay: { x: 0, y: faceHeight, width: 1080, height: 1920 - faceHeight },
        captionSafeArea: { x: 54, y: 1536, width: 972, height: 288 },
    };
}

export function speakerPan(box: DetectionBox, sourceAspect = 16 / 9, targetAspect = 9 / 16): { x: number; y: number; cropWidthFraction: number } {
    const cropWidthFraction = Math.min(1, targetAspect / sourceAspect);
    const centre = clamp((box.left + box.right) / 2, 0, 1);
    const left = clamp(centre - cropWidthFraction / 2, 0, 1 - cropWidthFraction);
    return { x: 0.5 - (left + cropWidthFraction / 2), y: 0, cropWidthFraction };
}
