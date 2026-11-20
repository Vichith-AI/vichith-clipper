/** Bounded, mono-PCM signal measurements for clip selection. No VOD buffering. */

export const CLIPPER_MAX_DURATION_SECS = 10_800;
export const DEFAULT_SIGNAL_WINDOW_SECS = 1;

export interface SignalWindow {
    startSecs: number;
    endSecs: number;
    rms: number;
    rmsDbfs: number;
    peak: number;
    peakDbfs: number;
    crestFactor: number;
    crestDb: number;
}

export interface SignalSummary {
    sampleCount: number;
    durationSecs: number;
    rms: number;
    rmsDbfs: number;
    peak: number;
    peakDbfs: number;
    crestFactor: number;
    windows: SignalWindow[];
}

const dbfs = (amplitude: number) => amplitude > 0 ? 20 * Math.log10(amplitude) : -Infinity;
const finite = (value: number, label: string) => {
    if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite.`);
    return value;
};

export interface StreamingSignalOptions {
    sampleRate?: number;
    windowSecs?: number;
    /** Reject accidentally unbounded uploads before iterating them. */
    maxChunkSamples?: number;
    maxDurationSecs?: number;
}

/** Maintains only one analysis window and running sums, never the source PCM. */
export class StreamingSignalAnalyzer {
    readonly sampleRate: number;
    readonly windowSecs: number;
    readonly maxChunkSamples: number;
    readonly maxDurationSecs: number;
    private windowSamples: number;
    private acceptedSamples = 0;
    private totalSamples = 0;
    private sumSquares = 0;
    private globalSumSquares = 0;
    private peak = 0;
    private globalPeak = 0;
    private readonly windows: SignalWindow[] = [];
    private finished = false;

    constructor(options: StreamingSignalOptions = {}) {
        this.sampleRate = options.sampleRate ?? 16_000;
        this.windowSecs = options.windowSecs ?? DEFAULT_SIGNAL_WINDOW_SECS;
        this.maxChunkSamples = options.maxChunkSamples ?? this.sampleRate * 30;
        this.maxDurationSecs = options.maxDurationSecs ?? CLIPPER_MAX_DURATION_SECS;
        if (!Number.isInteger(this.sampleRate) || this.sampleRate < 1 || this.sampleRate > 384_000) throw new RangeError('sampleRate is outside the supported range.');
        if (!(this.windowSecs > 0) || !Number.isFinite(this.windowSecs)) throw new RangeError('windowSecs must be positive.');
        if (!Number.isInteger(this.maxChunkSamples) || this.maxChunkSamples < 1) throw new RangeError('maxChunkSamples must be a positive integer.');
        if (!(this.maxDurationSecs > 0) || this.maxDurationSecs > CLIPPER_MAX_DURATION_SECS) throw new RangeError('Clip analysis is limited to 3 hours.');
        this.windowSamples = Math.max(1, Math.round(this.sampleRate * this.windowSecs));
        if (Math.ceil(this.maxDurationSecs / this.windowSecs) > 1_000_000) throw new RangeError('The analysis window plan is too large.');
    }

    push(samples: ArrayLike<number>): void {
        if (this.finished) throw new Error('The signal analyzer is already finished.');
        if (samples.length > this.maxChunkSamples) throw new RangeError(`PCM chunks are limited to ${this.maxChunkSamples} samples.`);
        if ((this.totalSamples + samples.length) / this.sampleRate > this.maxDurationSecs + 1e-9) throw new RangeError('Clip analysis is limited to 3 hours.');
        for (let offset = 0; offset < samples.length;) {
            const count = Math.min(this.windowSamples - this.acceptedSamples, samples.length - offset);
            for (let i = 0; i < count; i += 1) {
                const raw = finite(Number(samples[offset + i]), 'PCM sample');
                const sample = Math.max(-1, Math.min(1, raw));
                const square = sample * sample;
                this.sumSquares += square;
                this.globalSumSquares += square;
                this.peak = Math.max(this.peak, Math.abs(sample));
                this.globalPeak = Math.max(this.globalPeak, Math.abs(sample));
            }
            this.acceptedSamples += count;
            this.totalSamples += count;
            offset += count;
            if (this.acceptedSamples === this.windowSamples) this.flushWindow();
        }
    }

    private flushWindow(): void {
        if (this.acceptedSamples === 0) return;
        const rms = Math.sqrt(this.sumSquares / this.acceptedSamples);
        const startSecs = this.windows.length * this.windowSamples / this.sampleRate;
        this.windows.push({
            startSecs,
            endSecs: startSecs + this.acceptedSamples / this.sampleRate,
            rms,
            rmsDbfs: dbfs(rms),
            peak: this.peak,
            peakDbfs: dbfs(this.peak),
            crestFactor: rms > 0 ? this.peak / rms : 0,
            crestDb: rms > 0 && this.peak > 0 ? 20 * Math.log10(this.peak / rms) : 0,
        });
        this.acceptedSamples = 0;
        this.sumSquares = 0;
        this.peak = 0;
    }

    finish(): SignalSummary {
        if (this.finished) throw new Error('The signal analyzer is already finished.');
        this.finished = true;
        this.flushWindow();
        const sampleCount = this.windows.reduce((sum, w) => sum + Math.round((w.endSecs - w.startSecs) * this.sampleRate), 0);
        const rms = sampleCount > 0 ? Math.sqrt(this.globalSumSquares / sampleCount) : 0;
        return {
            sampleCount,
            durationSecs: sampleCount / this.sampleRate,
            rms,
            // This is unweighted RMS dBFS, not a claim of ITU-R BS.1770 LUFS.
            rmsDbfs: dbfs(rms),
            peak: this.globalPeak,
            peakDbfs: dbfs(this.globalPeak),
            crestFactor: rms > 0 ? this.globalPeak / rms : 0,
            windows: this.windows.map((w) => ({ ...w })),
        };
    }
}

export function analyzeMonoPcm(chunks: Iterable<ArrayLike<number>>, options: StreamingSignalOptions = {}): SignalSummary {
    const analyzer = new StreamingSignalAnalyzer(options);
    for (const chunk of chunks) analyzer.push(chunk);
    return analyzer.finish();
}

export function signalAt(windows: readonly SignalWindow[], timeSecs: number): SignalWindow | null {
    if (!Number.isFinite(timeSecs) || windows.length === 0) return null;
    let low = 0;
    let high = windows.length - 1;
    while (low <= high) {
        const mid = (low + high) >> 1;
        const window = windows[mid]!;
        if (timeSecs < window.startSecs) high = mid - 1;
        else if (timeSecs >= window.endSecs) low = mid + 1;
        else return window;
    }
    return null;
}
