import type { CaptionWord } from './captions/types';
import type { SignalSummary } from './signal';
import { CLIPPER_MAX_DURATION_SECS } from './signal';

export interface ClipCandidate {
    id: string;
    startSecs: number;
    endSecs: number;
    durationSecs: number;
    score: number;
    reasons: string[];
    features: { audio: number; reaction: number; pacing: number; hook: number; llm?: number };
}
export interface LlmMomentScore { startSecs: number; endSecs: number; score: number }
export interface CandidateOptions {
    targetCount?: number;
    durationSecs?: number;
    minDurationSecs?: number;
    maxDurationSecs?: number;
    stepSecs?: number;
    nmsIouThreshold?: number;
    llmScores?: readonly LlmMomentScore[];
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const REACTION = /\b(?:wow|insane|crazy|unbelievable|incredible|amazing|awesome|hilarious|lol|lmao|clutch|finally|wait|what|no way|oh my|best|worst|huge|insanity|wowww+|yesss+)\b|[!?]/giu;
const HOOK = /\b(?:but|because|secret|actually|nobody|everyone|never|always|here(?:'|’)s why|watch|listen|problem|mistake|story|first|last)\b/giu;

type TimeSpan = Pick<ClipCandidate, 'startSecs' | 'endSecs'>;
function intersect(a: TimeSpan, b: TimeSpan): number {
    return Math.max(0, Math.min(a.endSecs, b.endSecs) - Math.max(a.startSecs, b.startSecs));
}
export function temporalIou(a: Pick<ClipCandidate, 'startSecs' | 'endSecs'>, b: Pick<ClipCandidate, 'startSecs' | 'endSecs'>): number {
    const overlap = intersect(a, b);
    const union = (a.endSecs - a.startSecs) + (b.endSecs - b.startSecs) - overlap;
    return union > 0 ? overlap / union : 0;
}

/** Greedy score-ordered NMS over temporal IoU, with deterministic tie breaks. */
export function temporalNms<T extends Pick<ClipCandidate, 'startSecs' | 'endSecs' | 'score'>>(candidates: readonly T[], threshold = 0.35, limit = Number.MAX_SAFE_INTEGER): T[] {
    if (!(threshold >= 0 && threshold <= 1)) throw new RangeError('NMS threshold must be between 0 and 1.');
    const sorted = candidates.map((c, index) => ({ c, index })).sort((a, b) => b.c.score - a.c.score || a.c.startSecs - b.c.startSecs || a.c.endSecs - b.c.endSecs || a.index - b.index);
    const kept: T[] = [];
    for (const { c } of sorted) {
        if (kept.every((other) => temporalIou(c, other) <= threshold)) {
            kept.push(c);
            if (kept.length >= limit) break;
        }
    }
    return kept.sort((a, b) => a.startSecs - b.startSecs || a.endSecs - b.endSecs);
}

function scoreWindow(start: number, end: number, words: readonly CaptionWord[], signal: SignalSummary | null, llm?: number): Omit<ClipCandidate, 'id' | 'startSecs' | 'endSecs' | 'durationSecs'> {
    const own = words.filter((w) => w.end_secs > start && w.start_secs < end);
    const text = own.map((w) => w.text).join(' ');
    const reactionCount = (text.match(REACTION) ?? []).length;
    const reaction = clamp01(reactionCount / 3);
    const wpm = own.length / Math.max(1 / 60, (end - start) / 60);
    const pacing = own.length === 0 ? 0 : clamp01(1 - Math.abs(wpm - 165) / 220);
    const opening = own.filter((w) => w.start_secs < start + Math.min(5, (end - start) / 3)).map((w) => w.text).join(' ');
    const hook = clamp01(((opening.match(HOOK) ?? []).length + (REACTION.test(opening) ? 1 : 0)) / 2);
    REACTION.lastIndex = 0;
    const overlapping = signal?.windows.filter((w) => w.endSecs > start && w.startSecs < end) ?? [];
    // Crest is useful for impacts, while a moderate RMS avoids selecting silence.
    const rms = Math.sqrt(mean(overlapping.map((w) => w.rms * w.rms)));
    const crest = Math.max(0, ...overlapping.map((w) => w.crestDb));
    const audio = overlapping.length ? clamp01(0.55 * clamp01(rms / 0.22) + 0.45 * clamp01((crest - 6) / 10)) : 0;
    const base = 0.38 * reaction + 0.24 * pacing + 0.18 * hook + 0.20 * audio;
    const score = llm === undefined ? base : 0.65 * base + 0.35 * llm;
    const reasons = [reaction >= 0.34 ? 'Reaction language' : null, pacing >= 0.6 ? `Speech pacing ${Math.round(wpm)} wpm` : null, hook >= 0.5 ? 'Opening hook' : null, crest >= 12 ? `Audio crest ${crest.toFixed(1)} dB` : null, llm !== undefined ? 'External model score supplied' : null].filter((v): v is string => Boolean(v));
    return { score: clamp01(score), reasons, features: { audio, reaction, pacing, hook, ...(llm !== undefined ? { llm } : {}) } };
}

/** Works from measured PCM features and supplied transcript/model data; never calls a fake cloud model. */
export function findClipCandidates(words: readonly CaptionWord[], signal: SignalSummary | null, options: CandidateOptions = {}): ClipCandidate[] {
    const durationSecs = options.durationSecs ?? signal?.durationSecs ?? (words.length ? Math.max(...words.map((w) => w.end_secs)) : 0);
    if (!(durationSecs > 0) || !Number.isFinite(durationSecs)) return [];
    if (durationSecs > CLIPPER_MAX_DURATION_SECS + 1e-6) throw new RangeError('Clip selection is limited to 3 hours.');
    const min = options.minDurationSecs ?? 15;
    const max = options.maxDurationSecs ?? 60;
    const step = options.stepSecs ?? 2;
    if (min < 15 || max > 60 || min > max || !(step > 0)) throw new RangeError('Candidate windows must be 15–60 seconds with a positive step.');
    const limit = Math.max(1, Math.floor(options.targetCount ?? 5));
    const availableMax = Math.min(max, durationSecs);
    if (availableMax < min) return [];
    const lengths = [...new Set([min, Math.min(30, availableMax), Math.min(45, availableMax), availableMax].map((v) => Math.round(v * 1000) / 1000))];
    const validLlm = (options.llmScores ?? []).filter((v) => Number.isFinite(v.startSecs) && Number.isFinite(v.endSecs) && Number.isFinite(v.score) && v.score >= 0 && v.score <= 1 && v.endSecs > v.startSecs);
    const all: ClipCandidate[] = [];
    for (let start = 0; start + min <= durationSecs + 1e-6; start += step) {
        for (const length of lengths) {
            const end = Math.min(durationSecs, start + length);
            if (end - start < min) continue;
            const exact = validLlm.find((v) => Math.abs(v.startSecs - start) < 0.01 && Math.abs(v.endSecs - end) < 0.01)?.score;
            const scored = scoreWindow(start, end, words, signal, exact);
            all.push({ id: `moment-${start.toFixed(3)}-${end.toFixed(3)}`, startSecs: start, endSecs: end, durationSecs: end - start, ...scored });
        }
    }
    return temporalNms(all, options.nmsIouThreshold ?? 0.35, limit);
}
