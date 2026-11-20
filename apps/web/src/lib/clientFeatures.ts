import type { CaptionWord } from './captions/types';
import { analyzeMonoPcm, type SignalSummary, type StreamingSignalOptions } from './signal';
import { findClipCandidates, type CandidateOptions, type ClipCandidate } from './candidates';

export interface AnalyzeClipperFeaturesInput {
    pcmChunks: Iterable<ArrayLike<number>>;
    words: readonly CaptionWord[];
    signal?: StreamingSignalOptions;
    candidates?: CandidateOptions;
}
export interface ClipperFeatureResult {
    signal: SignalSummary;
    candidates: ClipCandidate[];
    /** Explicitly local: there is no hidden transcription, LLM or render request. */
    provenance: 'local_pcm_and_supplied_transcript';
}

/** Real client helper over caller-provided decoded PCM and actual transcript words. */
export function produceCandidatesFromAnalysis(input: AnalyzeClipperFeaturesInput): ClipperFeatureResult {
    const signal = analyzeMonoPcm(input.pcmChunks, input.signal);
    return {
        signal,
        candidates: findClipCandidates(input.words, signal, { durationSecs: signal.durationSecs, ...input.candidates }),
        provenance: 'local_pcm_and_supplied_transcript',
    };
}
