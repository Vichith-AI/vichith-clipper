'use client';

import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Play,
    Pause,
    Volume2,
    VolumeX,
    UploadCloud,
    RotateCcw,
    ArrowUpRight,
    Download,
    CheckCircle2,
    Eye,
    EyeOff,
    Zap,
    Flame,
    Film,
    Globe,
    Cpu,
    ExternalLink,
    Copy,
    Check,
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
    candidateId?: string;
    clipId?: string;
    outputKey?: string | null;
}

interface UploadState {
    phase: string;
    stage?: string;
    progress?: number;
    loadedBytes?: number;
    totalBytes?: number;
    message?: string;
}

interface WorkerInfo {
    state: 'running' | 'pending' | 'stopping' | 'stopped' | 'shutting-down' | 'unknown';
    region: string;
    instanceId: string;
    error?: string | null;
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
    // Real server status & worker state
    serverProgress?: number | null;
    jobStatus?: string;
    workerStatus?: WorkerInfo;
    onWakeWorker?: () => void;
    onExportToCompose?: (clip: ProducedClip) => void;
    streamUrl?: string;
    onStreamUrlChange?: (url: string) => void;
    onImportStream?: (url: string) => void;
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
    serverProgress,
    jobStatus,
    workerStatus,
    onWakeWorker,
    onExportToCompose,
    streamUrl,
    onStreamUrlChange,
    onImportStream,
}: ClipperStageProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [showGuides, setShowGuides] = useState(true);
    const [safeZonePlatform, setSafeZonePlatform] = useState<'reels' | 'shorts' | 'tiktok'>('shorts');
    const [dragging, setDragging] = useState(false);
    const [copiedUrl, setCopiedUrl] = useState(false);

    // Track elapsed time during clipping
    const [elapsedSecs, setElapsedSecs] = useState(0);
    useEffect(() => {
        if (phase !== 'clipping') {
            setElapsedSecs(0);
            return;
        }
        const timer = setInterval(() => setElapsedSecs((prev) => prev + 1), 1000);
        return () => clearInterval(timer);
    }, [phase]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const togglePlay = () => {
        if (!videoRef.current) return;
        if (isPlaying) {
            videoRef.current.pause();
            setIsPlaying(false);
        } else {
            void videoRef.current.play();
            setIsPlaying(true);
        }
    };

    const toggleMute = () => {
        if (!videoRef.current) return;
        videoRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (videoRef.current) {
            videoRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const selectedClip = clips[selectedClipIndex] ?? clips[0] ?? null;

    // REAL progress calculation (Never fake 96%!)
    const isWorkerStopped = workerStatus?.state === 'stopped';
    const realPercent = isWorkerStopped
        ? 0
        : serverProgress != null && serverProgress > 0
        ? Math.min(100, Math.round(serverProgress * 100))
        : 0;

    const milestones = [
        { label: 'Ingesting video & extracting audio…', threshold: 5 },
        { label: 'Whisper speech energy & hook detection…', threshold: 25 },
        { label: 'Auto-tracking facecam & 9:16 layout…', threshold: 55 },
        { label: 'Rendering vertical Shorts with kinetic captions…', threshold: 80 },
    ];

    const copyComposeShareLink = () => {
        const base = process.env.NEXT_PUBLIC_VICHITH_URL || 'https://www.vichith.in';
        const url = `${base}/compose`;
        void navigator.clipboard.writeText(url);
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
    };

    return (
        <main className="relative flex h-full flex-1 flex-col overflow-hidden bg-[#060707] select-none">
            {/* Stage Top Bar */}
            <div className="flex h-11 flex-shrink-0 items-center justify-between border-b border-white/[0.08] px-5 text-xs bg-[#0A0C0E]">
                <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-vichith-silver">
                        {clips.length > 0 ? 'Produced Shorts' : phase === 'clipping' ? 'Pipeline Processing' : 'Source Monitor'}
                    </span>
                    {selectedAsset && clips.length === 0 && (
                        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] text-vichith-muted">
                            {formatVodDuration(durationSecs)}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Safe-zone Platform Selector when viewing clips */}
                    {clips.length > 0 && (
                        <div className="flex items-center rounded-full bg-white/[0.04] border border-white/[0.08] p-0.5 text-[10px]">
                            <button
                                type="button"
                                onClick={() => setSafeZonePlatform('shorts')}
                                className={`rounded-full px-2 py-0.5 transition-colors ${
                                    safeZonePlatform === 'shorts' ? 'bg-white/[0.12] text-vichith-white font-semibold' : 'text-vichith-silver'
                                }`}
                            >
                                YT Shorts
                            </button>
                            <button
                                type="button"
                                onClick={() => setSafeZonePlatform('reels')}
                                className={`rounded-full px-2 py-0.5 transition-colors ${
                                    safeZonePlatform === 'reels' ? 'bg-white/[0.12] text-vichith-white font-semibold' : 'text-vichith-silver'
                                }`}
                            >
                                Reels
                            </button>
                            <button
                                type="button"
                                onClick={() => setSafeZonePlatform('tiktok')}
                                className={`rounded-full px-2 py-0.5 transition-colors ${
                                    safeZonePlatform === 'tiktok' ? 'bg-white/[0.12] text-vichith-white font-semibold' : 'text-vichith-silver'
                                }`}
                            >
                                TikTok
                            </button>
                        </div>
                    )}

                    {/* 9:16 Guides Toggle */}
                    <button
                        type="button"
                        onClick={() => setShowGuides((prev) => !prev)}
                        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                            showGuides
                                ? 'bg-vichith-mint/10 border border-vichith-mint/20 text-vichith-mint'
                                : 'bg-white/[0.06] text-vichith-silver hover:text-vichith-white'
                        }`}
                    >
                        {showGuides ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        <span>Safe Zones</span>
                    </button>

                    {/* Reset Batch Button */}
                    {clips.length > 0 && (
                        <button
                            type="button"
                            onClick={onResetClips}
                            className="flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] px-3 py-1 text-xs text-vichith-silver hover:bg-white/[0.12] hover:text-vichith-white transition-colors"
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
                {/* ── STATE A: ACTIVE CLIPPING / WORKER QUEUE ── */}
                {phase === 'clipping' ? (
                    <div className="flex w-full max-w-lg flex-col items-center justify-center text-center">
                        {/* Dynamic Worker State Alert if stopped */}
                        {workerStatus?.state === 'stopped' && (
                            <div className="mb-6 w-full rounded-2xl bg-amber-950/40 border border-amber-500/30 p-4 text-left shadow-lg">
                                <div className="flex items-start gap-3">
                                    <div className="h-2 w-2 rounded-full bg-amber-400 animate-ping mt-1.5 shrink-0" />
                                    <div className="space-y-1.5 text-xs text-amber-200">
                                        <div className="font-semibold text-amber-100 flex items-center justify-between">
                                            <span>EC2 Worker is currently Stopped</span>
                                            <span className="font-mono text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded">
                                                {workerStatus.instanceId}
                                            </span>
                                        </div>
                                        <p className="text-[11px] leading-relaxed text-amber-200/80">
                                            The <code className="text-amber-100">c7i.2xlarge</code> instance in <code className="text-amber-100">ap-south-2</code> powers down when idle to stop cloud charges ($0/hr). Click below to start the instance.
                                        </p>
                                        <div className="pt-2 flex items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={onWakeWorker}
                                                className="flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-300 transition-colors shadow-sm"
                                            >
                                                <Zap className="h-3.5 w-3.5 fill-current" />
                                                <span>Wake Worker Instance</span>
                                            </button>
                                            <a
                                                href="https://ap-south-2.console.aws.amazon.com/ec2/home?region=ap-south-2#Instances:"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 text-[11px] text-amber-300 hover:underline"
                                            >
                                                <span>AWS Console</span>
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {workerStatus?.state === 'pending' && (
                            <div className="mb-6 w-full rounded-2xl bg-vichith-mint/10 border border-vichith-mint/30 p-3.5 text-left text-xs text-vichith-mint flex items-center gap-3">
                                <GlyphWorking className="h-5 w-5 shrink-0" />
                                <div>
                                    <span className="font-semibold block">EC2 Worker Booting Up…</span>
                                    <span className="text-[11px] text-vichith-silver">
                                        Instance is starting in <code className="text-vichith-white">ap-south-2</code>. Job will begin processing automatically in ~30s.
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Working Spinner with Vichith Logo */}
                        <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
                            <div className="absolute inset-0 rounded-full bg-vichith-mint/15 animate-ping" />
                            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-black border border-vichith-mint/30 shadow-[0_0_30px_rgba(52,211,153,0.25)] p-2.5 overflow-hidden">
                                <img src="/logo_square.png" alt="Vichith" className="h-full w-full object-contain" />
                            </div>
                        </div>

                        <h2 className="font-display text-2xl font-bold tracking-tight text-vichith-white">
                            {isWorkerStopped
                                ? 'EC2 Worker Stopped · Click to Wake'
                                : jobStatus === 'processing'
                                ? 'Crafting your vertical Shorts'
                                : workerStatus?.state === 'pending'
                                ? 'Starting Worker Instance…'
                                : 'Connecting to Compute Pipeline…'}
                        </h2>
                        <p className="mt-2 text-xs text-vichith-silver max-w-sm">
                            {isWorkerStopped
                                ? 'The c7i.2xlarge compute worker powers down when idle ($0/hr). Wake it up below to process your stream.'
                                : note || 'Analyzing audio crests, Whisper timestamps, and framing 9:16 cuts…'}
                        </p>

                        {/* Real Progress Bar */}
                        <div className="mt-6 w-full space-y-2">
                            <div className="flex items-center justify-between font-mono text-[11px] text-vichith-silver">
                                <span>Status: <strong className="text-vichith-white uppercase">{jobStatus || 'queued'}</strong></span>
                                <span className="text-vichith-mint font-semibold font-mono">
                                    {realPercent > 0 ? `${realPercent}%` : 'Waiting for worker'}
                                </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
                                <motion.div
                                    className="h-full rounded-full bg-vichith-mint shadow-[0_0_12px_rgba(52,211,153,0.5)]"
                                    initial={{ width: '0%' }}
                                    animate={{ width: `${Math.max(3, realPercent)}%` }}
                                    transition={{ duration: 0.5, ease: 'easeOut' }}
                                />
                            </div>
                            <div className="flex justify-between font-mono text-[10px] text-vichith-muted pt-1">
                                <span>Elapsed: {formatTime(elapsedSecs)}</span>
                                <span>Worker: {workerStatus?.state || 'checking…'}</span>
                            </div>
                        </div>

                        {/* Real Milestones */}
                        <div className="mt-8 w-full space-y-2.5 rounded-[16px] bg-[#0A0C0E] p-4 text-left border border-white/[0.08]">
                            {milestones.map((m, idx) => {
                                const isDone = realPercent >= m.threshold + 20;
                                const isCurrent = realPercent >= m.threshold && !isDone;
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
                    /* ── STATE B: COMPLETED CLIPS GALLERY & 9:16 PLAYER ── */
                    <div className="flex h-full w-full flex-col lg:flex-row items-center justify-center gap-6 overflow-hidden">
                        {/* 9:16 Vertical Video Preview Monitor */}
                        <div className="relative aspect-[9/16] h-[90%] max-h-[640px] rounded-[24px] overflow-hidden bg-black border border-white/[0.12] shadow-2xl flex flex-col items-center justify-center group">
                            {selectedClip?.url ? (
                                <video
                                    ref={videoRef}
                                    src={selectedClip.url}
                                    playsInline
                                    loop
                                    onTimeUpdate={() => {
                                        if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                                    }}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center text-center p-6 space-y-3">
                                    <img src="/logo_square.png" alt="Vichith" className="h-12 w-12 rounded-xl object-contain shadow-md" />
                                    <span className="font-display font-bold text-vichith-white text-base">
                                        Short #{selectedClipIndex + 1}
                                    </span>
                                    <span className="font-mono text-xs text-vichith-silver">
                                        {selectedClip ? `${(selectedClip.endSecs - selectedClip.startSecs).toFixed(1)}s cut` : ''}
                                    </span>
                                    <span className="text-[11px] text-vichith-muted max-w-[200px]">
                                        5-track vertical composite ready for editing.
                                    </span>
                                </div>
                            )}

                            {/* Safe-Zone Overlays */}
                            {showGuides && (
                                <div className="absolute inset-0 pointer-events-none border border-dashed border-white/20">
                                    {/* Top Safe Area (Profile, Search) */}
                                    <div className="absolute top-0 inset-x-0 h-[12%] bg-red-500/10 border-b border-dashed border-red-500/30 flex items-center justify-center">
                                        <span className="font-mono text-[9px] uppercase tracking-wider text-red-300 bg-black/60 px-1.5 py-0.5 rounded">
                                            Top UI Safe Zone
                                        </span>
                                    </div>

                                    {/* Bottom Safe Area (Captions, Audio pill, CTA) */}
                                    <div className="absolute bottom-0 inset-x-0 h-[22%] bg-red-500/10 border-t border-dashed border-red-500/30 flex items-center justify-center">
                                        <span className="font-mono text-[9px] uppercase tracking-wider text-red-300 bg-black/60 px-1.5 py-0.5 rounded">
                                            Bottom UI &amp; Caption Safe Zone
                                        </span>
                                    </div>

                                    {/* Right Side Buttons Safe Area (Like, Comment, Share) */}
                                    <div className="absolute right-0 top-[25%] bottom-[25%] w-[18%] bg-blue-500/10 border-l border-dashed border-blue-500/30 flex items-center justify-center">
                                        <span className="font-mono text-[8px] uppercase tracking-widest text-blue-300 -rotate-90">
                                            Action Rail
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Play / Pause Overlay */}
                            {selectedClip?.url && !isPlaying && (
                                <button
                                    type="button"
                                    onClick={togglePlay}
                                    className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-black/70 text-vichith-white backdrop-blur-md transition-transform hover:scale-110 shadow-lg"
                                >
                                    <Play className="ml-1 h-6 w-6 text-vichith-mint fill-current" />
                                </button>
                            )}

                            {/* Floating Action Pill over Player */}
                            <div className="absolute bottom-4 inset-x-4 flex items-center justify-between pointer-events-auto">
                                <button
                                    type="button"
                                    onClick={() => onExportToCompose?.(selectedClip)}
                                    className="flex items-center gap-1.5 rounded-full bg-vichith-mint px-3.5 py-2 text-xs font-semibold text-black hover:bg-vichith-emerald transition-all shadow-[0_0_20px_rgba(52,211,153,0.4)]"
                                >
                                    <span>Open in Compose</span>
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                </button>

                                {selectedClip?.url && (
                                    <a
                                        href={selectedClip.url}
                                        download={`short-${selectedClipIndex + 1}.mp4`}
                                        className="flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-vichith-white hover:bg-white hover:text-black transition-colors backdrop-blur-sm"
                                        title="Download Short"
                                    >
                                        <Download className="h-4 w-4" />
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Clip Thumbnails Carousel / Selector */}
                        <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto max-w-full lg:max-h-[640px] p-2">
                            {clips.map((clip, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => onSelectClipIndex(idx)}
                                    className={`relative flex items-center gap-3 rounded-2xl p-3 text-left transition-all border ${
                                        selectedClipIndex === idx
                                            ? 'bg-white/[0.08] border-vichith-mint shadow-[0_0_20px_rgba(52,211,153,0.2)]'
                                            : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]'
                                    }`}
                                >
                                    <div className="flex h-12 w-9 shrink-0 items-center justify-center rounded-lg bg-black border border-white/10 font-mono text-xs font-bold text-vichith-mint">
                                        #{idx + 1}
                                    </div>
                                    <div className="min-w-[130px] space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-xs text-vichith-white">Short #{idx + 1}</span>
                                            <span className="font-mono text-[10px] text-vichith-mint">
                                                {(clip.endSecs - clip.startSecs).toFixed(1)}s
                                            </span>
                                        </div>
                                        <div className="font-mono text-[10px] text-vichith-silver">
                                            {clip.startSecs.toFixed(1)}s – {clip.endSecs.toFixed(1)}s
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : selectedAsset ? (
                    /* ── STATE C: SOURCE LOADED (PRE-RENDER) ── */
                    <div className="flex h-full w-full items-center justify-center">
                        <div className="relative aspect-video max-h-[580px] w-full max-w-4xl rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl">
                            {selectedAsset.url ? (
                                <video
                                    ref={videoRef}
                                    src={selectedAsset.url}
                                    playsInline
                                    onTimeUpdate={() => {
                                        if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                                    }}
                                    className="h-full w-full object-contain"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center text-vichith-silver">
                                    Source video loaded ({selectedAsset.id})
                                </div>
                            )}

                            {/* 9:16 Simulated Framing Box */}
                            {showGuides && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="relative aspect-[9/16] h-full border-2 border-vichith-mint/80 bg-vichith-mint/[0.03] shadow-[0_0_30px_rgba(52,211,153,0.15)]">
                                        <div className="absolute top-2 left-2 rounded bg-black/80 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-vichith-mint">
                                            {framingLayout === 'gaming_split' ? '9:16 Gaming Split' : '9:16 Speaker Follow'}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Scrubber & Controls */}
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-4 flex flex-col gap-2">
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
                                        <button type="button" onClick={togglePlay} className="text-vichith-white hover:text-vichith-mint">
                                            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
                                        </button>
                                        <button type="button" onClick={toggleMute} className="text-vichith-white hover:text-vichith-mint">
                                            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                                        </button>
                                        <span className="font-mono text-[11px]">
                                            {formatTime(currentTime)} / {formatVodDuration(durationSecs)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ── STATE D: EMPTY DROPZONE + STREAM URL PROMPT ── */
                    <div className="w-full max-w-xl space-y-6">
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

                        {/* Drag & Drop Card */}
                        <div
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
                            className={`group flex min-h-[300px] w-full flex-col items-center justify-center rounded-[24px] border-2 border-dashed p-8 text-center transition-all ${
                                dragging
                                    ? 'border-vichith-mint bg-vichith-mint/[0.05]'
                                    : 'border-white/10 bg-[#0A0C0E] hover:border-white/20 hover:bg-white/[0.02]'
                            }`}
                        >
                            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-black/60 border border-white/10 p-2.5 shadow-xl transition-transform group-hover:scale-105">
                                <img src="/logo_square.png" alt="Vichith" className="h-full w-full object-contain" />
                            </div>
                            <h3 className="font-display text-2xl font-bold text-vichith-white">
                                Drop your stream capture or VOD
                            </h3>
                            <p className="mt-2 text-xs text-vichith-silver max-w-sm">
                                Supports long gameplay sessions, podcasts, and stream recordings for automated 9:16 vertical conversion.
                            </p>

                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="mt-5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] px-5 py-2 text-xs font-semibold text-vichith-white transition-colors"
                            >
                                Browse Local Computer
                            </button>
                        </div>

                        {/* Stream URL Quick Ingestion Box */}
                        <div className="rounded-[20px] bg-[#0A0C0E] border border-white/[0.08] p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-[10px] uppercase tracking-wider text-vichith-silver flex items-center gap-1.5">
                                    <Globe className="h-3 w-3 text-vichith-mint" />
                                    <span>Or paste live stream / VOD link</span>
                                </span>
                                <div className="flex items-center gap-1 font-mono text-[9px] text-vichith-muted">
                                    <span>YouTube</span> · <span>Twitch</span> · <span>Kick</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="flex-1 flex items-center rounded-full bg-black/60 border border-white/[0.12] px-3.5 py-2 text-xs focus-within:border-vichith-mint transition-all">
                                    <input
                                        type="url"
                                        placeholder="https://www.youtube.com/watch?v=... or twitch.tv/..."
                                        value={streamUrl || ''}
                                        onChange={(e) => onStreamUrlChange?.(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && streamUrl && onImportStream?.(streamUrl)}
                                        className="w-full bg-transparent text-xs text-vichith-white placeholder:text-vichith-muted outline-none"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => streamUrl && onImportStream?.(streamUrl)}
                                    disabled={!streamUrl}
                                    className="rounded-full bg-vichith-mint hover:bg-vichith-emerald disabled:opacity-40 px-4 py-2 text-xs font-semibold text-black transition-colors shadow-sm"
                                >
                                    Fetch &amp; Clip
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
