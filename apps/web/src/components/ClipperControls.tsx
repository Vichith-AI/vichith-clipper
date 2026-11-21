'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { User, Gamepad2, Volume2, Video, Check, Layers, Cpu, Cloud } from 'lucide-react';
import { GlyphWorking } from '@/components/vichith/glyphs';
import { LanguagePicker } from './LanguagePicker';
import type { ClipperPreferences, ClipperLayout, ClipperCaptionStyle, ClipperTargetCount, ClipperClipLength } from './config';
import { useRegion } from '@/lib/region/RegionContext';
import { creditLabel } from '@/lib/region/creditLabels';

interface ClipperControlsProps {
    preferences: ClipperPreferences;
    onChangePreferences: (updater: (prev: ClipperPreferences) => ClipperPreferences) => void;
    language: string;
    onChangeLanguage: (code: string) => void;
    processingMode: 'cloud' | 'browser';
    onChangeProcessingMode: (mode: 'cloud' | 'browser') => void;
    onProduceClips: () => void;
    phase: string;
    hasSource: boolean;
    busy: boolean;
}

export function ClipperControls({
    preferences,
    onChangePreferences,
    language,
    onChangeLanguage,
    processingMode,
    onChangeProcessingMode,
    onProduceClips,
    phase,
    hasSource,
    busy,
}: ClipperControlsProps) {
    const { region } = useRegion();

    const isGamingDisabled = processingMode === 'browser' && preferences.layout === 'gaming_split';

    return (
        <div className="flex min-h-full w-full flex-col justify-between text-vichith-white p-4 sm:p-5">
            <div className="space-y-6">
                {/* Header title */}
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-vichith-silver">
                        Configuration
                    </span>
                    <span className="font-mono text-[10px] text-vichith-muted">
                        Vichith Studio
                    </span>
                </div>

                {/* 1. Framing Layout */}
                <div className="space-y-2.5">
                    <label className="block font-mono text-[10px] uppercase tracking-[0.12em] text-vichith-muted">
                        Framing Layout
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                        {/* Gaming Split */}
                        <button
                            type="button"
                            onClick={() => onChangePreferences((p) => ({ ...p, layout: 'gaming_split' }))}
                            className={`group relative flex flex-col items-center justify-between rounded-[14px] p-3 text-left transition-all ${
                                preferences.layout === 'gaming_split'
                                    ? 'bg-vichith-surface ring-1 ring-vichith-mint shadow-sm'
                                    : 'bg-vichith-black/40 hover:bg-vichith-surface/70 ring-1 ring-white/[0.06]'
                            }`}
                        >
                            {/* Mini 9:16 Wireframe Preview */}
                            <div className="relative mb-3 flex h-20 w-12 flex-col overflow-hidden rounded-[6px] border border-white/20 bg-vichith-black p-0.5">
                                {/* Top Facecam Box */}
                                <div className="relative flex h-[35%] w-full items-center justify-center rounded-[3px] bg-vichith-surface border-b border-dashed border-vichith-mint/60">
                                    <User className="h-3 w-3 text-vichith-mint" />
                                    <span className="absolute bottom-0.5 right-1 font-mono text-[6px] text-vichith-silver">Cam</span>
                                </div>
                                {/* Bottom Gameplay Box */}
                                <div className="relative flex h-[65%] w-full items-center justify-center bg-vichith-graphite">
                                    <Gamepad2 className="h-3.5 w-3.5 text-vichith-silver/80" />
                                    <span className="absolute bottom-0.5 right-1 font-mono text-[6px] text-vichith-muted">Game</span>
                                </div>
                            </div>
                            <div className="w-full text-center">
                                <span className="block text-[12px] font-semibold text-vichith-white">Gaming Split</span>
                                <span className="mt-0.5 block text-[10px] text-vichith-silver">Facecam + game</span>
                            </div>
                            {preferences.layout === 'gaming_split' && (
                                <motion.span
                                    layoutId="framing-indicator"
                                    className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-vichith-mint"
                                />
                            )}
                        </button>

                        {/* Dynamic Speaker */}
                        <button
                            type="button"
                            onClick={() => onChangePreferences((p) => ({ ...p, layout: 'speaker_reframe' }))}
                            className={`group relative flex flex-col items-center justify-between rounded-[14px] p-3 text-left transition-all ${
                                preferences.layout === 'speaker_reframe'
                                    ? 'bg-vichith-surface ring-1 ring-vichith-mint shadow-sm'
                                    : 'bg-vichith-black/40 hover:bg-vichith-surface/70 ring-1 ring-white/[0.06]'
                            }`}
                        >
                            {/* Mini 9:16 Wireframe Preview */}
                            <div className="relative mb-3 flex h-20 w-12 items-center justify-center overflow-hidden rounded-[6px] border border-white/20 bg-vichith-black p-0.5">
                                {/* Auto-tracking crop box with crosshairs */}
                                <div className="relative flex h-full w-full items-center justify-center rounded-[4px] border border-vichith-mint/40 bg-vichith-mint/5">
                                    <Video className="h-4 w-4 text-vichith-mint" />
                                    <span className="absolute top-0.5 left-0.5 font-mono text-[6px] text-vichith-mint">9:16</span>
                                    <span className="absolute bottom-0.5 right-0.5 font-mono text-[6px] text-vichith-silver">Crop</span>
                                </div>
                            </div>
                            <div className="w-full text-center">
                                <span className="block text-[12px] font-semibold text-vichith-white">Dynamic Speaker</span>
                                <span className="mt-0.5 block text-[10px] text-vichith-silver">Auto 9:16 crop</span>
                            </div>
                            {preferences.layout === 'speaker_reframe' && (
                                <motion.span
                                    layoutId="framing-indicator"
                                    className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-vichith-mint"
                                />
                            )}
                        </button>
                    </div>
                </div>

                <div className="border-t border-white/[0.08]" />

                {/* 2. Caption Style */}
                <div className="space-y-2.5">
                    <label className="block font-mono text-[10px] uppercase tracking-[0.12em] text-vichith-muted">
                        Caption Style
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                        {/* Active-Word Pill */}
                        <button
                            type="button"
                            onClick={() => onChangePreferences((p) => ({ ...p, captionStyle: 'active_pill' }))}
                            className={`group relative flex flex-col justify-between rounded-[14px] p-3 text-left transition-all ${
                                preferences.captionStyle === 'active_pill'
                                    ? 'bg-vichith-surface ring-1 ring-vichith-mint shadow-sm'
                                    : 'bg-vichith-black/40 hover:bg-vichith-surface/70 ring-1 ring-white/[0.06]'
                            }`}
                        >
                            {/* Live Typography Preview */}
                            <div className="flex h-12 w-full items-center justify-center rounded-[8px] bg-vichith-black px-2 py-1">
                                <div className="flex items-center gap-1 font-display text-[9px] font-bold uppercase tracking-wider text-vichith-silver">
                                    <span>FIND</span>
                                    <span className="rounded bg-vichith-mint px-1 py-0.5 text-vichith-black shadow-[0_0_8px_rgba(52,211,153,0.4)]">
                                        HOOK
                                    </span>
                                </div>
                            </div>
                            <div className="mt-2.5">
                                <span className="block text-[12px] font-semibold text-vichith-white">Active-Word Pill</span>
                                <span className="mt-0.5 block text-[10px] text-vichith-silver">Word box highlight</span>
                            </div>
                            {preferences.captionStyle === 'active_pill' && (
                                <motion.span
                                    layoutId="caption-indicator"
                                    className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-vichith-mint"
                                />
                            )}
                        </button>

                        {/* Karaoke */}
                        <button
                            type="button"
                            onClick={() => onChangePreferences((p) => ({ ...p, captionStyle: 'karaoke' }))}
                            className={`group relative flex flex-col justify-between rounded-[14px] p-3 text-left transition-all ${
                                preferences.captionStyle === 'karaoke'
                                    ? 'bg-vichith-surface ring-1 ring-vichith-mint shadow-sm'
                                    : 'bg-vichith-black/40 hover:bg-vichith-surface/70 ring-1 ring-white/[0.06]'
                            }`}
                        >
                            {/* Live Typography Preview */}
                            <div className="flex h-12 w-full items-center justify-center rounded-[8px] bg-vichith-black px-2 py-1">
                                <div className="font-display text-[10px] font-bold uppercase tracking-wide">
                                    <span className="text-vichith-mint">KARAOKE </span>
                                    <span className="text-vichith-muted">FLOW</span>
                                </div>
                            </div>
                            <div className="mt-2.5">
                                <span className="block text-[12px] font-semibold text-vichith-white">Karaoke Wipe</span>
                                <span className="mt-0.5 block text-[10px] text-vichith-silver">Word-by-word line</span>
                            </div>
                            {preferences.captionStyle === 'karaoke' && (
                                <motion.span
                                    layoutId="caption-indicator"
                                    className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-vichith-mint"
                                />
                            )}
                        </button>
                    </div>
                </div>

                <div className="border-t border-white/[0.08]" />

                {/* 3. Clip Settings */}
                <div className="space-y-4">
                    <label className="block font-mono text-[10px] uppercase tracking-[0.12em] text-vichith-muted">
                        Clip Settings
                    </label>

                    {/* Target Count */}
                    <div>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                            <span className="text-[11px] text-vichith-silver">Target Shorts</span>
                            <span className="font-mono text-[10px] text-vichith-muted">{preferences.targetCount} cuts</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 rounded-[10px] bg-vichith-black/50 p-1">
                            {([3, 5] as const).map((count) => (
                                <button
                                    key={count}
                                    type="button"
                                    onClick={() => onChangePreferences((p) => ({ ...p, targetCount: count }))}
                                    className={`rounded-[8px] py-1.5 text-center text-xs font-medium transition-colors ${
                                        preferences.targetCount === count
                                            ? 'bg-vichith-surface text-vichith-white'
                                            : 'text-vichith-silver hover:text-vichith-white'
                                    }`}
                                >
                                    {count} Shorts
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Clip Length */}
                    <div>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                            <span className="text-[11px] text-vichith-silver">Clip Length</span>
                            <span className="font-mono text-[10px] text-vichith-muted">Optimal viral duration</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 rounded-[10px] bg-vichith-black/50 p-1">
                            {([
                                ['auto', 'Auto (15–60s)'],
                                ['snappy', 'Snappy (15–30s)'],
                                ['story', 'Story (30–60s)'],
                            ] as const).map(([lengthKey, label]) => {
                                const currentLength = preferences.clipLength ?? 'auto';
                                return (
                                    <button
                                        key={lengthKey}
                                        type="button"
                                        onClick={() => onChangePreferences((p) => ({ ...p, clipLength: lengthKey as ClipperClipLength }))}
                                        className={`rounded-[7px] py-1 text-center text-[10px] font-medium transition-colors truncate px-1 ${
                                            currentLength === lengthKey
                                                ? 'bg-vichith-surface text-vichith-white'
                                                : 'text-vichith-silver hover:text-vichith-white'
                                        }`}
                                    >
                                        {label.split(' ')[0]}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Language Picker */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-[11px] text-vichith-silver">Spoken Language</span>
                            <span className="font-mono text-[10px] text-vichith-muted">1 cr / min</span>
                        </div>
                        <LanguagePicker value={language} onChange={onChangeLanguage} disabled={busy} />
                    </div>

                    {/* Processing Mode */}
                    <div className="space-y-1.5">
                        <span className="block text-[11px] text-vichith-silver">Processing Mode</span>
                        <div className="grid grid-cols-2 gap-1.5 rounded-[10px] bg-vichith-black/50 p-1">
                            <button
                                type="button"
                                onClick={() => onChangeProcessingMode('cloud')}
                                className={`flex items-center justify-center gap-1.5 rounded-[8px] py-1.5 text-xs font-medium transition-colors ${
                                    processingMode === 'cloud'
                                        ? 'bg-vichith-surface text-vichith-white'
                                        : 'text-vichith-silver hover:text-vichith-white'
                                }`}
                            >
                                <Cloud className="h-3 w-3 text-vichith-mint" />
                                <span>Cloud AI</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => onChangeProcessingMode('browser')}
                                className={`flex items-center justify-center gap-1.5 rounded-[8px] py-1.5 text-xs font-medium transition-colors ${
                                    processingMode === 'browser'
                                        ? 'bg-vichith-surface text-vichith-white'
                                        : 'text-vichith-silver hover:text-vichith-white'
                                }`}
                            >
                                <Cpu className="h-3 w-3 text-vichith-silver" />
                                <span>Local Browser</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pinned Primary Action */}
            <div className="pt-5 pb-2">
                {isGamingDisabled && (
                    <p className="mb-2.5 text-[11px] text-amber-300">
                        Browser mode supports speaker reframe. Switch to Cloud AI for MediaPipe gaming split.
                    </p>
                )}

                <button
                    type="button"
                    disabled={!hasSource || busy || isGamingDisabled}
                    onClick={onProduceClips}
                    className="v-key relative flex h-12 w-full items-center justify-center gap-2 rounded-[14px] px-4 font-display text-[14px] font-semibold tracking-wide text-vichith-black transition-all hover:shadow-[0_0_24px_rgba(52,211,153,0.35)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {phase === 'clipping' ? (
                        <>
                            <GlyphWorking className="h-4 w-4" />
                            <span>Crafting Shorts…</span>
                        </>
                    ) : (
                        <span>Generate {preferences.targetCount} Shorts</span>
                    )}
                </button>

                <p className="mt-2 text-center font-mono text-[10px] text-vichith-muted">
                    {region === 'IN'
                        ? `Reserved for completed runs · ${creditLabel(1)} / min`
                        : 'Reserved for completed runs · Zero credit charge for setup'}
                </p>
            </div>
        </div>
    );
}
