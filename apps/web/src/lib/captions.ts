import type { CaptionStyle, CaptionWord, TimelineCaptionCue } from './captions/types';

export type ClipperCaptionMotion = 'highlight_wipe' | 'pop_in';
export interface ClipperCaptionOptions {
    maxWordsPerLine?: number;
    maxLinesPerCue?: number;
    maxGapSecs?: number;
    motion?: ClipperCaptionMotion;
    locale?: string;
}

export interface CaptionGrapheme { text: string; index: number }

/** User-perceived characters, not UTF-16 code units. Provider timings stay untouched. */
export function graphemes(text: string, locale?: string): CaptionGrapheme[] {
    const Segmenter = Intl.Segmenter;
    if (typeof Segmenter === 'function') {
        return Array.from(new Segmenter(locale, { granularity: 'grapheme' }).segment(text), (part) => ({ text: part.segment, index: part.index }));
    }
    const result: CaptionGrapheme[] = [];
    const re = /([\p{Regional_Indicator}]{2}|[^\r\n]\p{Mark}*(?:\u200d[^\r\n]\p{Mark}*)*)/gu;
    for (const match of text.matchAll(re)) result.push({ text: match[0], index: match.index ?? 0 });
    return result;
}

export function graphemeLength(text: string, locale?: string): number {
    return graphemes(text, locale).length;
}

function validWord(word: CaptionWord): boolean {
    return typeof word.text === 'string' && word.text.trim().length > 0
        && Number.isFinite(word.start_secs) && Number.isFinite(word.end_secs)
        && word.start_secs >= 0 && word.end_secs >= word.start_secs;
}

/** Break after supplied words only. No timing is invented or redistributed. */
export function groupClipperCaptions(words: readonly CaptionWord[], options: ClipperCaptionOptions = {}): TimelineCaptionCue[] {
    const maxWords = Math.min(4, Math.max(1, Math.floor(options.maxWordsPerLine ?? 4)));
    const maxLines = Math.min(2, Math.max(1, Math.floor(options.maxLinesPerCue ?? 2)));
    const maxGap = options.maxGapSecs ?? 0.9;
    if (!(maxGap >= 0) || !Number.isFinite(maxGap)) throw new RangeError('maxGapSecs must be non-negative.');
    const sorted = words.filter(validWord).map((w) => ({ ...w })).sort((a, b) => a.start_secs - b.start_secs);
    const cues: TimelineCaptionCue[] = [];
    let cueWords: CaptionWord[] = [];
    let lineWords = 0;
    let lines = 1;

    const flush = () => {
        if (cueWords.length === 0) return;
        cueWords.forEach((word, i) => { word.break_after = i === cueWords.length - 1 ? 'cue' : word.break_after === 'line' ? 'line' : 'none'; });
        const startSecs = cueWords[0]!.start_secs;
        const endSecs = cueWords[cueWords.length - 1]!.end_secs;
        cues.push({
            id: `clipper-caption-${cues.length}`,
            startSecs,
            durationSecs: Math.max(0.001, endSecs - startSecs),
            text: cueWords.map((w) => w.text).join(' '),
            words: cueWords,
        });
        cueWords = [];
        lineWords = 0;
        lines = 1;
    };

    for (const input of sorted) {
        const word = { ...input };
        const previous = cueWords[cueWords.length - 1];
        const gap = previous ? word.start_secs - previous.end_secs : 0;
        const sentenceEnd = previous ? /[.!?…]["')\]]?$/.test(previous.text) : false;
        if (previous && (gap > maxGap || sentenceEnd || (lines >= maxLines && lineWords >= maxWords))) flush();
        if (cueWords.length > 0 && lineWords >= maxWords) {
            cueWords[cueWords.length - 1]!.break_after = 'line';
            lines += 1;
            lineWords = 0;
        }
        cueWords.push(word);
        lineWords += 1;
    }
    flush();
    return cues;
}

/** Exact style vocabulary supported for caption styling. */
export function clipperCaptionStyle(motion: ClipperCaptionMotion): {
    displayMode: 'Karaoke' | 'ActiveWord';
    wordsPerLine: number;
    style: Partial<CaptionStyle>;
} {
    return motion === 'highlight_wipe'
        ? { displayMode: 'Karaoke', wordsPerLine: 4, style: { wordHighlight: true, highlightStyle: 'pill', background: 'pill' } }
        : { displayMode: 'ActiveWord', wordsPerLine: 4, style: { wordHighlight: true, highlightStyle: 'scale', background: 'pill', density: 'balanced' } };
}

/** Per-word pop-in or wipe keys. */
export function applyCaptionMotion(cues: readonly TimelineCaptionCue[], motion: ClipperCaptionMotion): TimelineCaptionCue[] {
    return cues.map((cue) => ({
        ...cue,
        style: { ...cue.style, ...clipperCaptionStyle(motion).style },
        words: cue.words.map((word: CaptionWord) => ({
            ...word,
            motion: motion === 'pop_in' ? 'pop' : 'wipe',
        })),
    }));
}
