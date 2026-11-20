'use client';

import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Play,
    Pause,
    Volume2,
    VolumeX,
    UploadCloud,
    Maximize2,
    RotateCcw,
    ArrowUpRight,
    Download,
    Check,
    CheckCircle2,
    Eye,
    EyeOff,
    Sparkles, // Wait, remember design rule: NO Sparkle icons! Use Zap or Flame!
    Zap,
    Flame,
    Film,
    Sliders,
    Loader2
} from 'lucide-react';
import { GlyphWorking } from '@/components/vichith/glyphs';
import { formatVodDuration } from './config';
import type { VodAsset } from './ClipperHeader';

export interface ProducedClip {
    index: number;
    projectId: string;
    assetId: string | null;
    url: string | null;
    startSecs: number;
    endSecs: number;
    composePath: string;
}

interface UploadState {
    phase: string;
    stage?: string;
    progress?: number;
    loadedBytes?: number;
    totalBytes?: number;
    message?: string;
}

interface ClipperStageProps {
    selectedAsset: VodAsset | null;
    durationSecs: number | null;
    phase: string;
    note: string;
    error: string | null;
    clips: ProducedClip[];
    selectedClipIndex: number;
    onSelectClipIndex: (index: number) => void;
    onResetClips: () => void;
    onChooseFile: (file: File) => void;
    uploadState: UploadState;
    framingLayout: 'gaming_split' | 'speaker_reframe';
    captionStyle: 'active_pill' | 'karaoke';
    projectId: string | null;
    isFreeTier?: boolean;
}

export function ClipperStage({
    selectedAsset,
    durationSecs,
    phase,
    note,
    error,
    clips,
    selectedClipIndex,
    onSelectClipIndex,
    onResetClips,
    onChooseFile,
    uploadState,
    framingLayout,
    captionStyle,
    projectId,
    isFreeTier = false,
}: ClipperStageProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [dragging, setDragging] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [showGuides, setShowGuides] = useState(true);
    const [downloadingClipIndex, setDownloadingClipIndex] = useState<number | null>(null);

    // Elapsed timer for active clipping
    const [elapsedSecs, setElapsedSecs] = useState(0);

    useEffect(() => {
        if (phase !== 'clipping') {
            setElapsedSecs(0);
            return;
        }
        const timer = setInterval(() => {
            setElapsedSecs((prev) => prev + 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [phase]);

    // Format timer
    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    // Video playback handlers
    const togglePlay = () => {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) {
            void v.play();
            setIsPlaying(true);
        } else {
            v.pause();
            setIsPlaying(false);
        }
    };

    const toggleMute = () => {
        const v = videoRef.current;
        if (!v) return;
        v.muted = !v.muted;
        setIsMuted(v.muted);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const targetTime = parseFloat(e.target.value);
        if (videoRef.current) {
            videoRef.current.currentTime = targetTime;
            setCurrentTime(targetTime);
        }
    };

    // Download clip handler
    const handleDownload = async (clip: ProducedClip, index: number) => {
        try {
            setDownloadingClipIndex(index);
            let downloadUrl = clip.url;
            if (!downloadUrl && clip.assetId && projectId) {
                downloadUrl = `/api/projects/${projectId}/media/${clip.assetId}`;
            }
            if (!downloadUrl) return;

            const res = await fetch(downloadUrl);
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `vichith-short-${index + 1}.mp4`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
        } catch {
            if (clip.url) {
                window.open(clip.url, '_blank');
            }
        } finally {
            setDownloadingClipIndex(null);
        }
    };

    // Active progress estimation
    let progressPercent = 10;
    if (elapsedSecs < 12) progressPercent = Math.min(15, Math.round((elapsedSecs / 12) * 15));
    else if (elapsedSecs < 30) progressPercent = Math.min(45, 15 + Math.round(((elapsedSecs - 12) / 18) * 30));
    else if (elapsedSecs < 60) progressPercent = Math.min(75, 45 + Math.round(((elapsedSecs - 30) / 30) * 30));
    else progressPercent = Math.min(96, 75 + Math.round(((elapsedSecs - 60) / 30) * 21));

    const milestones = [
        { label: 'Preparing your video…', threshold: 0 },
        { label: 'Listening to speech & pacing…', threshold: 15 },
        { label: 'Framing & styling vertical cuts…', threshold: 45 },
        { label: 'Rendering your shorts…', threshold: 75 },
    ];

    return (
        <main className="relative flex h-full flex-1 flex-col overflow-hidden bg-vichith-black">
            {/* Stage Top Bar */}
            <div className="flex h-11 flex-shrink-0 items-center justify-between border-b border-white/[0.06] px-5 text-xs">
                <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-vichith-silver">
                        {clips.length > 0 ? 'Produced Shorts' : phase === 'clipping' ? 'Rendering' : 'Source Preview'}
                    </span>
                    {selectedAsset && clips.length === 0 && (
                        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] text-vichith-muted">
                            {formatVodDuration(durationSecs)}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* 9:16 Guides Toggle (when video is loaded and not completed) */}
                    {selectedAsset && clips.length === 0 && phase !== 'clipping' && (
                        <button
                            type="button"
                            onClick={() => setShowGuides((prev) => !prev)}
                            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                                showGuides
                                    ? 'bg-vichith-surface text-vichith-mint'
                                    : 'bg-white/[0.06] text-vichith-silver hover:text-vichith-white'
                            }`}
                        >
                            {showGuides ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                            <span>9:16 Frame Guides</span>
                        </button>
                    )}

                    {/* Reset / New Batch Button */}
                    {clips.length > 0 && (
                        <button
                            type="button"
                            onClick={onResetClips}
                            className="flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1 text-xs text-vichith-silver hover:bg-white/[0.14] hover:text-vichith-white transition-colors"
                        >
                            <RotateCcw className="h-3 w-3 text-vichith-mint" />
                            <span>New Batch</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Error Notification */}
            {error && (
                <div className="flex-shrink-0 bg-rose-950/80 border-b border-rose-500/20 px-5 py-2.5 text-xs text-rose-200 flex items-center justify-between">
                    <span>{error}</span>
                </div>
            )}

            {/* Main Stage Content */}
            <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4 sm:p-6">
                {/* ── STATE B: ACTIVE CLIPPING / GENERATION ── */}
                {phase === 'clipping' ? (
                    <div className="flex w-full max-w-md flex-col items-center justify-center text-center">
                        <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
                            <div className="absolute inset-0 rounded-full bg-vichith-mint/10 animate-ping" />
                            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-vichith-graphite border border-vichith-mint/30 shadow-[0_0_30px_rgba(52,211,153,0.2)]">
                                <GlyphWorking className="h-8 w-8 text-vichith-mint" />
                            </div>
                        </div>

                        <h2 className="font-display text-2xl font-bold tracking-tight text-vichith-white">
                            Crafting your vertical Shorts
                        </h2>
                        <p className="mt-2 text-xs text-vichith-silver">
                            Analyzing hooks, speech energy, and framing vertical cuts…
                        </p>

                        {/* Animated Progress Bar */}
                        <div className="mt-6 w-full space-y-2">
                            <div className="flex items-center justify-between font-mono text-[11px] text-vichith-silver">
                                <span>Progress</span>
                                <span className="text-vichith-mint font-semibold">{progressPercent}%</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
                                <motion.div
                                    className="h-full rounded-full bg-vichith-mint shadow-[0_0_12px_rgba(52,211,153,0.5)]"
                                    initial={{ width: '5%' }}
                                    animate={{ width: `${progressPercent}%` }}
                                    transition={{ duration: 0.5, ease: 'easeOut' }}
                                />
                            </div>
                            <div className="flex justify-between font-mono text-[10px] text-vichith-muted pt-1">
                                <span>Elapsed: {formatTime(elapsedSecs)}</span>
                                <span>Optimal viral pacing</span>
                            </div>
                        </div>

                        {/* Staged Milestones */}
                        <div className="mt-8 w-full space-y-2.5 rounded-[16px] bg-vichith-graphite/40 p-4 text-left border border-white/[0.06]">
                            {milestones.map((m, idx) => {
                                const isDone = progressPercent > m.threshold + 20;
                                const isCurrent = progressPercent >= m.threshold && !isDone;
                                return (
                                    <div key={idx} className="flex items-center gap-3 text-xs">
                                        {isDone ? (
                                            <CheckCircle2 className="h-4 w-4 text-vichith-mint flex-shrink-0" />
                                        ) : isCurrent ? (
                                            <div className="h-4 w-4 flex items-center justify-center">
                                                <div className="h-2 w-2 rounded-full bg-vichith-mint animate-pulse" />
                                            </div>
                                        ) : (
                                            <div className="h-4 w-4 flex items-center justify-center">
                                                <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
                                            </div>
                                        )}
                                        <span className={isCurrent ? 'font-medium text-vichith-white' : isDone ? 'text-vichith-silver' : 'text-vichith-muted'}>
                                            {m.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : clips.length > 0 ? (
                    /* ── STATE C: PRODUCED SHORTS REEL DECK ── */
                    <div className="flex h-full w-full flex-col overflow-hidden">
                        <div className="flex items-center justify-between pb-3">
                            <div>
                                <h3 className="font-display text-lg font-semibold text-vichith-white">
                                    Your vertical Shorts
                                </h3>
                                <p className="text-xs text-vichith-silver">
                                    Click a card to inspect transcript or open directly in the Compose timeline.
                                </p>
                            </div>
                            <span className="rounded-full bg-vichith-graphite px-3 py-1 font-mono text-xs text-vichith-mint">
                                {clips.length} Cuts Ready
                            </span>
                        </div>

                        {/* Horizontal Reel Deck */}
                        <div className="flex flex-1 items-center gap-5 overflow-x-auto py-2 px-1">
                            {clips.map((clip, index) => {
                                const isSelected = selectedClipIndex === index;
                                const badgeLabel = index === 0 ? 'Top Hook' : index === 1 ? 'High Energy' : 'Key Moment';
                                const duration = Math.round(clip.endSecs - clip.startSecs);

                                return (
                                    <div
                                        key={`${clip.projectId}-${clip.index}`}
                                        onClick={() => onSelectClipIndex(index)}
                                        className={`group relative flex h-[95%] max-h-[560px] w-[260px] sm:w-[280px] flex-shrink-0 cursor-pointer flex-col justify-between rounded-[20px] bg-vichith-graphite p-3 transition-all ${
                                            isSelected
                                                ? 'ring-2 ring-vichith-mint shadow-[0_0_24px_rgba(52,211,153,0.18)]'
                                                : 'ring-1 ring-white/10 hover:ring-white/20'
                                        }`}
                                    >
                                        {/* 9:16 Video Preview */}
                                        <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[14px] bg-vichith-black">
                                            {clip.url ? (
                                                <video
                                                    src={clip.url}
                                                    playsInline
                                                    loop
                                                    muted
                                                    preload="metadata"
                                                    className="h-full w-full object-cover"
                                                    onMouseEnter={(e) => void e.currentTarget.play()}
                                                    onMouseLeave={(e) => e.currentTarget.pause()}
                                                />
                                            ) : (
                                                <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center">
                                                    <Film className="h-8 w-8 text-vichith-silver/40 mb-2" />
                                                    <span className="font-mono text-xs text-vichith-silver">
                                                        Timeline Saved
                                                    </span>
                                                </div>
                                            )}

                                            {/* Top Hook Badge */}
                                            <div className="absolute top-2.5 left-2.5 flex items-center gap-1 rounded-full bg-vichith-black/80 px-2.5 py-1 text-[10px] font-semibold text-vichith-mint backdrop-blur-md">
                                                {index === 0 ? <Flame className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                                                <span>{badgeLabel}</span>
                                            </div>

                                            {/* Duration Pill */}
                                            <div className="absolute top-2.5 right-2.5 rounded-full bg-vichith-black/80 px-2 py-0.5 font-mono text-[10px] text-vichith-silver backdrop-blur-md">
                                                {duration}s
                                            </div>

                                            {/* Simulated Captions Preview Overlay */}
                                            <div className="pointer-events-none absolute bottom-4 inset-x-2 flex justify-center">
                                                <span className="rounded bg-vichith-mint/90 px-2 py-0.5 font-display text-[11px] font-bold uppercase text-vichith-black shadow-md">
                                                    Short #{clip.index + 1}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Card Metadata & Actions */}
                                        <div className="pt-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-display text-sm font-semibold text-vichith-white">
                                                    Moment {clip.index + 1}
                                                </h4>
                                                <span className="font-mono text-[10px] text-vichith-muted">
                                                    {clip.startSecs.toFixed(1)}s – {clip.endSecs.toFixed(1)}s
                                                </span>
                                            </div>

                                            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                                                <Link
                                                    href={clip.composePath}
                                                    className="v-key flex h-9 items-center justify-center gap-1.5 rounded-[10px] px-3 font-display text-xs font-semibold text-vichith-black transition-colors"
                                                >
                                                    <span>Open in Compose</span>
                                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                                </Link>
                                                <button
                                                    type="button"
                                                    title="Download Short MP4"
                                                    disabled={downloadingClipIndex === index}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        void handleDownload(clip, index);
                                                    }}
                                                    className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/[0.08] text-vichith-silver hover:bg-white/[0.14] hover:text-vichith-white transition-colors disabled:opacity-50"
                                                >
                                                    {downloadingClipIndex === index ? (
                                                        <Loader2 className="h-4 w-4 animate-spin text-vichith-mint" />
                                                    ) : (
                                                        <Download className="h-4 w-4" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : selectedAsset ? (
                    /* ── STATE A: 16:9 SOURCE PLAYER WITH 9:16 GUIDES ── */
                    <div className="flex h-full w-full max-w-4xl flex-col items-center justify-center">
                        <div className="relative aspect-video w-full max-h-[calc(100vh-230px)] overflow-hidden rounded-[18px] bg-vichith-graphite shadow-2xl">
                            {selectedAsset.url ? (
                                <video
                                    ref={videoRef}
                                    src={selectedAsset.url}
                                    playsInline
                                    muted={isMuted}
                                    onTimeUpdate={() => {
                                        if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                                    }}
                                    onEnded={() => setIsPlaying(false)}
                                    className="h-full w-full object-contain bg-black cursor-pointer"
                                    onClick={togglePlay}
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs text-vichith-silver">
                                    No direct video preview available
                                </div>
                            )}

                            {/* ── 9:16 Frame Guide Overlay ── */}
                            {showGuides && (
                                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                    {/* Shaded Letterbox Outside 9:16 safe area */}
                                    <div className="relative h-full aspect-[9/16] border border-vichith-mint/50 shadow-[0_0_20px_rgba(52,211,153,0.15)]">
                                        {framingLayout === 'gaming_split' ? (
                                            /* Gaming Split: Top Facecam + Bottom Gameplay */
                                            <div className="flex h-full w-full flex-col">
                                                {/* Facecam Box: Top 30% */}
                                                <div className="relative h-[30%] w-full border-b border-dashed border-vichith-mint/70 bg-vichith-mint/10 p-2">
                                                    <span className="rounded bg-vichith-black/80 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-vichith-mint">
                                                        Facecam 9:16
                                                    </span>
                                                </div>
                                                {/* Gameplay Box: Bottom 70% */}
                                                <div className="relative flex-1 p-2 bg-white/5">
                                                    <span className="rounded bg-vichith-black/80 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-vichith-silver">
                                                        Gameplay 9:16
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            /* Dynamic Speaker: Auto-tracking 9:16 Center */
                                            <div className="relative h-full w-full bg-vichith-mint/5 p-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="rounded bg-vichith-black/80 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-vichith-mint">
                                                        Dynamic Speaker 9:16
                                                    </span>
                                                    <span className="font-mono text-[8px] text-vichith-silver">Safe Area</span>
                                                </div>
                                                {/* Corner guides */}
                                                <div className="absolute top-1 left-1 h-3 w-3 border-t-2 border-l-2 border-vichith-mint" />
                                                <div className="absolute top-1 right-1 h-3 w-3 border-t-2 border-r-2 border-vichith-mint" />
                                                <div className="absolute bottom-1 left-1 h-3 w-3 border-b-2 border-l-2 border-vichith-mint" />
                                                <div className="absolute bottom-1 right-1 h-3 w-3 border-b-2 border-r-2 border-vichith-mint" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Center Play Button Overlay on Pause */}
                            {!isPlaying && (
                                <button
                                    type="button"
                                    onClick={togglePlay}
                                    className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-vichith-black/70 text-vichith-white backdrop-blur-sm transition-transform hover:scale-105"
                                >
                                    <Play className="ml-1 h-6 w-6 text-vichith-mint" fill="currentColor" />
                                </button>
                            )}

                            {/* Bottom Scrubber & Controls Bar */}
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-vichith-black/90 to-transparent p-3 pt-6 flex flex-col gap-2">
                                {/* Scrubber slider */}
                                <input
                                    type="range"
                                    min={0}
                                    max={durationSecs ?? 100}
                                    step={0.1}
                                    value={currentTime}
                                    onChange={handleSeek}
                                    className="h-1 w-full appearance-none rounded-full bg-white/20 accent-vichith-mint cursor-pointer"
                                />

                                <div className="flex items-center justify-between text-xs text-vichith-silver">
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={togglePlay}
                                            className="text-vichith-white hover:text-vichith-mint transition-colors"
                                        >
                                            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={toggleMute}
                                            className="text-vichith-white hover:text-vichith-mint transition-colors"
                                        >
                                            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                                        </button>
                                        <span className="font-mono text-[11px]">
                                            {formatTime(currentTime)} / {formatVodDuration(durationSecs)}
                                        </span>
                                    </div>
                                    <span className="font-mono text-[10px] text-vichith-muted">
                                        Layout: {framingLayout === 'gaming_split' ? 'Gaming Split' : 'Dynamic Speaker'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ── EMPTY STATE: DRAG & DROP UPLOAD ZONE ── */
                    <div className="w-full max-w-xl">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) onChooseFile(f);
                                e.target.value = '';
                            }}
                        />

                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setDragging(true);
                            }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setDragging(false);
                                const f = e.dataTransfer.files[0];
                                if (f) onChooseFile(f);
                            }}
                            className={`group flex min-h-[340px] w-full flex-col items-center justify-center rounded-[22px] border-2 border-dashed p-8 text-center transition-all ${
                                dragging
                                    ? 'border-vichith-mint bg-vichith-surface/80'
                                    : 'border-white/10 bg-vichith-graphite/30 hover:border-white/20 hover:bg-vichith-graphite/60'
                            }`}
                        >
                            {uploadState.phase === 'uploading' ? (
                                <div className="flex w-full max-w-sm flex-col items-center py-4">
                                    <GlyphWorking className="h-8 w-8 text-vichith-mint mb-4" />
                                    <span className="font-display text-xl font-bold text-vichith-white">
                                        {uploadState.stage === 'transferring'
                                            ? `Uploading · ${uploadState.progress ?? 0}%`
                                            : uploadState.stage === 'confirming'
                                            ? 'Confirming upload…'
                                            : 'Preparing upload…'}
                                    </span>

                                    <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
                                        <div
                                            className="h-full rounded-full bg-vichith-mint transition-all duration-150 shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                                            style={{
                                                width: `${uploadState.stage === 'confirming' ? 100 : (uploadState.progress ?? 0)}%`,
                                            }}
                                        />
                                    </div>

                                    {typeof uploadState.totalBytes === 'number' && uploadState.totalBytes > 0 && (
                                        <span className="mt-2.5 font-mono text-xs text-vichith-silver">
                                            {((uploadState.loadedBytes ?? 0) / (1024 * 1024)).toFixed(1)} MB /{' '}
                                            {(uploadState.totalBytes / (1024 * 1024)).toFixed(1)} MB
                                        </span>
                                    )}
                                    <span className="mt-1 font-mono text-[10px] text-vichith-muted">
                                        Direct to cloud storage
                                    </span>
                                </div>
                            ) : (
                                <>
                                    <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06] text-vichith-mint transition-transform group-hover:scale-105">
                                        <UploadCloud className="h-7 w-7" />
                                    </div>
                                    <h3 className="font-display text-2xl font-bold text-vichith-white">
                                        Drop your stream or VOD here
                                    </h3>
                                    <p className="mt-2 text-xs text-vichith-silver max-w-sm">
                                        Select long gameplay, twitch stream captures, or podcast recordings to generate word-timed 9:16 Shorts.
                                    </p>
                                    <div className="mt-5 rounded-full bg-white/[0.06] px-4 py-1.5 text-xs font-semibold text-vichith-white group-hover:bg-white/[0.12] transition-colors">
                                        Browse Computer
                                    </div>
                                    <span className="mt-4 font-mono text-[10px] text-vichith-muted">
                                        {isFreeTier
                                            ? 'MP4, WebM, MOV, MKV · Up to 30 mins · Max 250 MB (Free tier)'
                                            : 'MP4, WebM, MOV, MKV · Up to 3 hours · Max 500 MB'}
                                    </span>
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
}
