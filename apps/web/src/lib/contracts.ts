import { z } from 'zod';
import type { SignalSummary } from './signal';
import type { SmoothedFace } from './layout';
import type { ClipCandidate } from './candidates';

const word = z.object({
    text: z.string().min(1).max(1000),
    start_secs: z.number().finite().nonnegative(),
    end_secs: z.number().finite().nonnegative(),
    confidence: z.number().finite().min(0).max(1).optional(),
}).refine((value: { start_secs: number; end_secs: number }) => value.end_secs >= value.start_secs);

export const clipperCandidateSchema = z.object({
    id: z.string().regex(/^[A-Za-z0-9_.:-]{1,100}$/),
    startSecs: z.number().finite().nonnegative(),
    endSecs: z.number().finite().positive(),
    durationSecs: z.number().finite().positive().optional(),
    score: z.number().finite().min(0).max(1).optional(),
    reasons: z.array(z.string().max(200)).max(12).optional(),
    features: z.record(z.string(), z.number().finite()).optional(),
}).refine((value: { startSecs: number; endSecs: number }) => value.endSecs - value.startSecs >= 15 && value.endSecs - value.startSecs <= 60);

export const clipperSignalSchema = z.object({
    sampleCount: z.number().int().nonnegative(),
    durationSecs: z.number().finite().positive().max(10800),
    rms: z.number().finite().nonnegative(), rmsDbfs: z.number(), peak: z.number().finite().nonnegative(), peakDbfs: z.number(), crestFactor: z.number().finite().nonnegative(),
    windows: z.array(z.object({
        startSecs: z.number().finite().nonnegative(), endSecs: z.number().finite().positive(),
        rms: z.number().finite().nonnegative(), rmsDbfs: z.number(), peak: z.number().finite().nonnegative(), peakDbfs: z.number(), crestFactor: z.number().finite().nonnegative(), crestDb: z.number().finite(),
    })).max(10800),
});

const box = z.object({ left: z.number().min(0).max(1), top: z.number().min(0).max(1), right: z.number().min(0).max(1), bottom: z.number().min(0).max(1) });
export const clipperFaceSchema = z.object({ timeSecs: z.number().finite().nonnegative(), box, confidence: z.number().min(0).max(1).optional() });

export const clipperAnalysisSchema = z.object({
    words: z.array(word).max(150000),
    signal: clipperSignalSchema,
    candidates: z.array(clipperCandidateSchema).min(1).max(5),
    speakerTrack: z.array(clipperFaceSchema).max(36000).default([]),
});

export interface ClipperAnalysisResult {
    words: z.infer<typeof word>[];
    signal: SignalSummary;
    candidates: ClipCandidate[];
    speakerTrack: SmoothedFace[];
}
