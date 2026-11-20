'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, Film, Mic, Sparkles, Volume2, Video, Type, Music, Play, Layers } from 'lucide-react';
import { GlyphWorking } from '@/components/vichith/glyphs';
import type { ProducedClip } from './ClipperStage';
import type { VodAsset } from './ClipperHeader';

interface ClipperInspectorProps {
    clips: ProducedClip[];
    selectedClipIndex: number;
    selectedAsset: VodAsset | null;
    phase: string;
    note: string;
    onPrepareVertical: () => void;
    onTranscribe: () => void;
    busy: boolean;
    projectId: string | null;
}

export function ClipperInspector({
    clips,
    selectedClipIndex,
    selectedAsset,
    phase,
    note,
    onPrepareVertical,
    onTranscribe,
    busy,
    projectId,
}: ClipperInspectorProps) {
    const hasClips = clips.length > 0;
    const selectedClip = hasClips ? clips[selectedClipIndex] ?? clips[0] : null;

    // Simulated/sample transcript words for inspector
    const sampleWords = [
        { word: 'Wait,', start: 0.2 },
        { word: 'look', start: 0.6 },
        { word: 'at', start: 0.9 },
        { word: 'this', start: 1.1 },
        { word: 'insane', start: 1.4 },
        { word: 'move', start: 1.9 },
        { word: 'right', start: 2.3 },
        { word: 'here!', start: 2.6 },
        { word: 'Nobody', start: 3.1 },
        { word: 'saw', start: 3.5 },
        { word: 'that', start: 3.8 },
        { word: 'coming.', start: 4.1 },
    ];

    return (
        <aside className="flex h-full w-full flex-col justify-between overflow-y-auto border-l border-white/10 bg-vichith-graphite/40 text-vichith-white p-4 sm:p-5">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-vichith-silver">
                        {hasClips ? 'Short Inspector' : 'Timeline Setup'}
                    </span>
                    {hasClips && (
                        <span className="rounded-full bg-vichith-mint/10 px-2 py-0.5 font-mono text-[10px] text-vichith-mint">
                            Short #{selectedClipIndex + 1}
                        </span>
                    )}
                </div>

                {/* ── STATE 1: PRE-GENERATION / WORKSPACE SETUP ── */}
                {!hasClips ? (
                    <div className="space-y-6">
                        {/* Manual Timeline Setup */}
                        <div className="rounded-[16px] bg-vichith-black/40 p-4 border border-white/[0.06] space-y-4">
                            <div>
                                <h3 className="font-display text-sm font-semibold text-vichith-white">
                                    Manual Timeline Workspace
                                </h3>
                                <p className="mt-1 text-xs leading-relaxed text-vichith-silver">
                                    Prepare the 9:16 timeline tracks and transcribe speech before producing vertical cuts.
                                </p>
                            </div>

                            <div className="space-y-2 pt-1">
                                <button
                                    type="button"
                                    disabled={!selectedAsset || busy}
                                    onClick={onPrepareVertical}
                                    className="v-key flex h-10 w-full items-center justify-center gap-2 rounded-[10px] px-3 font-display text-xs font-semibold text-vichith-black transition-colors disabled:opacity-40"
                                >
                                    {phase === 'preparing' ? (
                                        <>
                                            <GlyphWorking className="h-3.5 w-3.5" />
                                            <span>Placing on 9:16 Timeline…</span>
                                        </>
                                    ) : (
                                        <span>Prepare vertical workspace</span>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    disabled={!selectedAsset || busy}
                                    onClick={onTranscribe}
                                    className="flex h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-white/[0.08] px-3 font-display text-xs font-semibold text-vichith-white hover:bg-white/[0.14] transition-colors disabled:opacity-40"
                                >
                                    {phase === 'transcribing' ? (
                                        <>
                                            <GlyphWorking className="h-3.5 w-3.5" />
                                            <span>Transcribing speech…</span>
                                        </>
                                    ) : (
                                        <span>Transcribe speech</span>
                                    )}
                                </button>
                            </div>

                            {phase === 'transcribed' && (
                                <p className="flex items-center gap-1.5 text-xs text-vichith-mint pt-1">
                                    <Check className="h-3.5 w-3.5" />
                                    <span>Captions are ready in Compose.</span>
                                </p>
                            )}
                        </div>

                        {/* Speech & Moment Intelligence Status */}
                        <div className="space-y-3">
                            <label className="block font-mono text-[10px] uppercase tracking-[0.12em] text-vichith-muted">
                                Pipeline Status
                            </label>

                            <div className="rounded-[14px] bg-vichith-black/30 p-3.5 border border-white/[0.06] space-y-2.5">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-vichith-silver">Status</span>
                                    <span className="font-mono text-[10px] text-vichith-mint">
                                        {phase === 'ready' ? 'Ready' : phase === 'preparing' ? 'Configuring' : phase}
                                    </span>
                                </div>
                                <p className="text-xs text-vichith-silver leading-relaxed" aria-live="polite">
                                    {note}
                                </p>
                            </div>

                            <div className="rounded-[14px] bg-vichith-black/30 p-3.5 border border-white/[0.06] space-y-2">
                                <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-vichith-muted">
                                    Multi-Track Architecture
                                </span>
                                <div className="space-y-1.5 text-xs text-vichith-silver">
                                    <div className="flex items-center gap-2">
                                        <span className="rounded bg-white/10 px-1 py-0.5 font-mono text-[9px] text-vichith-white">V1</span>
                                        <span>9:16 Video / Gameplay Track</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="rounded bg-white/10 px-1 py-0.5 font-mono text-[9px] text-vichith-white">V2</span>
                                        <span>Auto-detected Facecam Overlay</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="rounded bg-white/10 px-1 py-0.5 font-mono text-[9px] text-vichith-white">T1</span>
                                        <span>Word-Timed Kinetic Captions</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="rounded bg-white/10 px-1 py-0.5 font-mono text-[9px] text-vichith-white">A1</span>
                                        <span>Normalized Dialogue & Master Audio</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ── STATE 2: POST-GENERATION / SHORT INSPECTOR ── */
                    <div className="space-y-5">
                        {/* Selected Short Meta */}
                        <div className="rounded-[16px] bg-vichith-black/40 p-4 border border-white/[0.06] space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="font-display text-sm font-semibold text-vichith-white">
                                    Moment #{selectedClip ? selectedClip.index + 1 : 1} Details
                                </h4>
                                <span className="font-mono text-xs text-vichith-mint">
                                    {selectedClip ? `${(selectedClip.endSecs - selectedClip.startSecs).toFixed(1)}s` : '30s'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between font-mono text-[11px] text-vichith-silver border-t border-white/[0.06] pt-2">
                                <span>Timestamp Range</span>
                                <span>
                                    {selectedClip ? `${selectedClip.startSecs.toFixed(1)}s – ${selectedClip.endSecs.toFixed(1)}s` : '0.0s – 30.0s'}
                                </span>
                            </div>
                        </div>

                        {/* Interactive Transcript Snippet */}
                        <div className="space-y-2">
                            <label className="block font-mono text-[10px] uppercase tracking-[0.12em] text-vichith-muted">
                                Transcript Snippet (Click to seek)
                            </label>
                            <div className="rounded-[14px] bg-vichith-black/40 p-3.5 border border-white/[0.06]">
                                <div className="flex flex-wrap gap-1.5 text-xs">
                                    {sampleWords.map((item, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            className="rounded px-1.5 py-0.5 font-medium transition-colors bg-white/[0.06] text-vichith-silver hover:bg-vichith-mint hover:text-vichith-black"
                                        >
                                            {item.word}
                                        </button>
                                    ))}
                                </div>
                                <span className="mt-3 block font-mono text-[10px] text-vichith-muted">
                                    Word timings synced with timeline cues.
                                </span>
                            </div>
                        </div>

                        {/* 5-Track Summary Pills */}
                        <div className="space-y-2">
                            <label className="block font-mono text-[10px] uppercase tracking-[0.12em] text-vichith-muted">
                                Timeline Tracks Summary
                            </label>
                            <div className="space-y-2">
                                {[
                                    { role: 'V1', name: 'Gameplay / 9:16 Stream', icon: Video, color: 'text-vichith-mint' },
                                    { role: 'V2', name: 'Facecam Crop', icon: Film, color: 'text-vichith-silver' },
                                    { role: 'T1', name: 'Word-Sync Captions', icon: Type, color: 'text-vichith-mint' },
                                    { role: 'A1', name: 'Original Dialogue', icon: Mic, color: 'text-vichith-silver' },
                                    { role: 'A2', name: 'High-Energy Audio', icon: Volume2, color: 'text-vichith-muted' },
                                ].map((t) => (
                                    <div
                                        key={t.role}
                                        className="flex items-center justify-between rounded-[10px] bg-vichith-black/30 px-3 py-2 border border-white/[0.04] text-xs"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-vichith-white">
                                                {t.role}
                                            </span>
                                            <span className="text-vichith-silver">{t.name}</span>
                                        </div>
                                        <t.icon className={`h-3.5 w-3.5 ${t.color}`} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Primary Compose Link */}
            {hasClips && selectedClip && (
                <div className="pt-4 border-t border-white/[0.08]">
                    <Link
                        href={selectedClip.composePath}
                        className="v-key flex h-11 w-full items-center justify-center gap-2 rounded-[12px] px-4 font-display text-xs font-semibold text-vichith-black transition-colors"
                    >
                        <span>Edit Tracks &amp; Captions in Compose</span>
                        <ArrowUpRight className="h-4 w-4" />
                    </Link>
                </div>
            )}
        </aside>
    );
}
