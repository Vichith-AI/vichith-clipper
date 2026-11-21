'use client';

import React, { useState, useEffect } from 'react';
import {
    ArrowUpRight,
    ChevronDown,
    Film,
    FolderKanban,
    Plus,
    SlidersHorizontal,
    Eye,
    Layers,
    UploadCloud,
    Globe,
    Cpu,
    RefreshCw,
} from 'lucide-react';
import type { Gta6EntitlementState } from '@/lib/launch/gta6Promo';
import { formatVodDuration } from './config';
import { parseStreamUrl } from '@/lib/streamIngest';

export interface VodAsset {
    id: string;
    url: string | null;
    kind: 'video' | 'audio' | 'image';
    status: string;
    source: string;
    createdAt: string;
    generationMeta?: { clientDurationSecs?: number; duration?: { durationSecs?: number } } | null;
}

interface WorkerBadgeState {
    state: 'running' | 'pending' | 'stopping' | 'stopped' | 'shutting-down' | 'unknown';
    region: string;
    instanceId: string;
    configured: boolean;
    error?: string | null;
}

interface ClipperHeaderProps {
    projects: { id: string; title: string; updatedAt?: string }[];
    projectId: string | null;
    onSelectProject: (id: string) => void;
    onNewProject: () => void;
    assets: VodAsset[];
    selectedAsset: VodAsset | null;
    onSelectAsset: (id: string) => void;
    durationSecs: number | null;
    onUploadClick: () => void;
    streamUrl?: string;
    onStreamUrlChange?: (url: string) => void;
    onImportStream?: (url: string) => void;
    entitlement: Gta6EntitlementState | null;
    mode: 'auto' | 'manual';
    onModeChange: (mode: 'auto' | 'manual') => void;
    activeMobileTab: 'controls' | 'stage' | 'inspector';
    onMobileTabChange: (tab: 'controls' | 'stage' | 'inspector') => void;
    busy: boolean;
}

export function ClipperHeader({
    projects,
    projectId,
    onSelectProject,
    onNewProject,
    assets,
    selectedAsset,
    onSelectAsset,
    durationSecs,
    onUploadClick,
    streamUrl,
    onStreamUrlChange,
    onImportStream,
    entitlement,
    mode,
    onModeChange,
    activeMobileTab,
    onMobileTabChange,
    busy,
}: ClipperHeaderProps) {
    const streamInfo = streamUrl ? parseStreamUrl(streamUrl) : null;
    const [worker, setWorker] = useState<WorkerBadgeState>({
        state: 'unknown',
        region: 'ap-south-2',
        instanceId: 'i-0b493811ffcdff29b',
        configured: true,
    });
    const [wakingWorker, setWakingWorker] = useState(false);

    // Poll worker status periodically
    useEffect(() => {
        let active = true;
        const fetchStatus = async () => {
            try {
                const res = await fetch('/api/worker/status');
                if (!res.ok) return;
                const data = await res.json();
                if (active) {
                    setWorker({
                        state: data.state || 'unknown',
                        region: data.region || 'ap-south-2',
                        instanceId: data.instanceId || 'i-0b493811ffcdff29b',
                        configured: data.configured ?? true,
                        error: data.error,
                    });
                }
            } catch {
                // Non-blocking
            }
        };

        fetchStatus();
        const interval = setInterval(fetchStatus, 30000);
        return () => {
            active = false;
            clearInterval(interval);
        };
    }, []);

    const handleWakeWorker = async () => {
        setWakingWorker(true);
        try {
            const res = await fetch('/api/worker/wake', { method: 'POST' });
            const data = await res.json();
            if (data.ok || data.status?.state) {
                setWorker((prev) => ({
                    ...prev,
                    state: data.status?.state || 'pending',
                }));
            }
        } catch (e) {
            console.error('Failed to wake worker:', e);
        } finally {
            setWakingWorker(false);
        }
    };

    const composeBaseUrl = process.env.NEXT_PUBLIC_VICHITH_URL || 'https://www.vichith.in';
    const composeUrl = projectId && projectId !== 'default'
        ? `${composeBaseUrl}/p/${projectId}/compose`
        : `${composeBaseUrl}/compose`;

    return (
        <header className="relative z-20 flex h-[52px] w-full items-center justify-between border-b border-white/10 bg-[#0A0C0E] px-4 sm:px-6 select-none">
            {/* Left: Project & Media Switcher */}
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                {/* Brand / Logo */}
                <a
                    href="https://www.vichith.in"
                    className="flex items-center gap-2 mr-2 hover:opacity-90 transition-opacity"
                    title="Vichith"
                >
                    <img
                        src="/logo_square.png"
                        alt="Vichith"
                        className="h-7 w-7 rounded-lg object-contain shadow-sm"
                    />
                    <span className="font-display font-bold tracking-tight text-vichith-white text-base">
                        vichith
                    </span>
                </a>

                {/* Project Selector */}
                <div className="flex items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] px-2.5 py-1 text-xs text-vichith-silver transition-colors hover:text-vichith-white">
                    <FolderKanban className="h-3.5 w-3.5 text-vichith-mint flex-shrink-0" />
                    <select
                        aria-label="Active Project"
                        value={projectId ?? ''}
                        disabled={busy}
                        onChange={(e) => onSelectProject(e.target.value)}
                        className="max-w-[120px] sm:max-w-[150px] truncate bg-transparent font-medium text-vichith-white outline-none cursor-pointer text-xs"
                    >
                        {projects.map((project) => (
                            <option key={project.id} value={project.id} className="bg-vichith-graphite text-vichith-white">
                                {project.title}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="h-3 w-3 text-vichith-muted pointer-events-none" />
                </div>

                <button
                    type="button"
                    title="New project"
                    onClick={onNewProject}
                    disabled={busy}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.04] border border-white/[0.08] text-vichith-silver transition-colors hover:bg-white/[0.12] hover:text-vichith-white disabled:opacity-50"
                >
                    <Plus className="h-3.5 w-3.5" />
                </button>

                <div className="hidden sm:block h-4 w-px bg-white/10" />

                {/* VOD Selector Pill */}
                {selectedAsset ? (
                    <div className="flex items-center gap-2 rounded-full bg-white/[0.04] border border-white/[0.08] px-3 py-1 text-xs text-vichith-silver shrink-0">
                        <Film className="h-3.5 w-3.5 text-vichith-mint flex-shrink-0" />
                        {assets.length > 1 ? (
                            <div className="flex items-center gap-1">
                                <select
                                    aria-label="Source Video"
                                    value={selectedAsset.id}
                                    disabled={busy}
                                    onChange={(e) => onSelectAsset(e.target.value)}
                                    className="max-w-[110px] sm:max-w-[140px] truncate bg-transparent font-sans text-[11px] text-vichith-white outline-none cursor-pointer"
                                >
                                    {assets.map((asset) => (
                                        <option key={asset.id} value={asset.id} className="bg-vichith-graphite text-vichith-white">
                                            {asset.source === 'uploaded' ? 'VOD' : asset.source.toUpperCase()} · {asset.id.slice(0, 8)}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="h-3 w-3 text-vichith-muted pointer-events-none" />
                            </div>
                        ) : (
                            <span className="font-sans text-[11px] font-medium text-vichith-white">
                                {selectedAsset.source === 'youtube'
                                    ? 'YouTube'
                                    : selectedAsset.source === 'twitch'
                                    ? 'Twitch'
                                    : selectedAsset.source === 'kick'
                                    ? 'Kick'
                                    : selectedAsset.source === 'uploaded'
                                    ? 'VOD'
                                    : 'Stream'}
                            </span>
                        )}
                        <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 font-mono text-[10px] text-vichith-silver">
                            {formatVodDuration(durationSecs)}
                        </span>
                        <button
                            type="button"
                            onClick={onUploadClick}
                            disabled={busy}
                            className="ml-1 text-[11px] text-vichith-silver hover:text-vichith-mint transition-colors whitespace-nowrap"
                        >
                            Replace
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={onUploadClick}
                        disabled={busy}
                        className="flex items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] px-3 py-1 text-xs text-vichith-silver hover:bg-white/[0.1] hover:text-vichith-white transition-colors"
                    >
                        <UploadCloud className="h-3.5 w-3.5 text-vichith-mint" />
                        <span>Upload Video</span>
                    </button>
                )}
            </div>

            {/* Center: Single, Clean Stream URL Ingestion Bar */}
            <div className="hidden lg:flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-full bg-black/60 border border-white/[0.12] px-3 py-1.5 text-xs focus-within:border-vichith-mint/60 focus-within:ring-1 focus-within:ring-vichith-mint/30 transition-all shadow-inner">
                    {/* Platform Indicator */}
                    {streamInfo?.platform === 'youtube' && (
                        <span className="rounded bg-red-500/20 text-red-400 border border-red-500/30 px-1 py-0.2 font-mono text-[9px] font-bold">
                            YT
                        </span>
                    )}
                    {streamInfo?.platform === 'twitch' && (
                        <span className="rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 px-1 py-0.2 font-mono text-[9px] font-bold">
                            TWITCH
                        </span>
                    )}
                    {streamInfo?.platform === 'kick' && (
                        <span className="rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1 py-0.2 font-mono text-[9px] font-bold">
                            KICK
                        </span>
                    )}
                    {!streamInfo?.valid && (
                        <Globe className="h-3.5 w-3.5 text-vichith-silver shrink-0" />
                    )}

                    <input
                        type="url"
                        placeholder="Paste YouTube, Twitch, or Kick stream URL…"
                        value={streamUrl || ''}
                        disabled={busy}
                        onChange={(e) => onStreamUrlChange?.(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && streamUrl && onImportStream?.(streamUrl)}
                        className="w-64 xl:w-80 bg-transparent text-[11px] text-vichith-white placeholder:text-vichith-muted/70 outline-none"
                    />

                    {streamUrl && (
                        <button
                            type="button"
                            onClick={() => onImportStream?.(streamUrl)}
                            disabled={busy}
                            className="rounded-full px-2.5 py-0.5 bg-vichith-mint text-vichith-black text-[10px] font-semibold hover:bg-vichith-emerald transition-colors shadow-[0_0_12px_rgba(52,211,153,0.3)] disabled:opacity-40"
                        >
                            Clip Stream
                        </button>
                    )}
                </div>
            </div>

            {/* Mobile / Tablet View Switcher (Hidden on XL+) */}
            <div className="flex xl:hidden items-center gap-1 rounded-full bg-white/[0.04] p-0.5 text-xs">
                <button
                    type="button"
                    onClick={() => onMobileTabChange('controls')}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                        activeMobileTab === 'controls' ? 'bg-white/[0.1] text-vichith-white font-medium' : 'text-vichith-silver hover:text-vichith-white'
                    }`}
                >
                    <SlidersHorizontal className="h-3 w-3" />
                    <span>Config</span>
                </button>
                <button
                    type="button"
                    onClick={() => onMobileTabChange('stage')}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                        activeMobileTab === 'stage' ? 'bg-white/[0.1] text-vichith-white font-medium' : 'text-vichith-silver hover:text-vichith-white'
                    }`}
                >
                    <Eye className="h-3 w-3" />
                    <span>Preview</span>
                </button>
                <button
                    type="button"
                    onClick={() => onMobileTabChange('inspector')}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                        activeMobileTab === 'inspector' ? 'bg-white/[0.1] text-vichith-white font-medium' : 'text-vichith-silver hover:text-vichith-white'
                    }`}
                >
                    <Layers className="h-3 w-3" />
                    <span>Inspector</span>
                </button>
            </div>

            {/* Right: EC2 Worker State, Mode & Compose Export */}
            <div className="flex items-center gap-2 sm:gap-3">
                {/* Real-time EC2 Worker Pill */}
                <div
                    title={
                        worker.state === 'running'
                            ? `EC2 worker-cpu (${worker.instanceId}) active in ${worker.region}`
                            : worker.state === 'pending'
                            ? `EC2 worker-cpu is starting up...`
                            : `EC2 worker-cpu is currently stopped (0$/hr). Click to wake.`
                    }
                    className="hidden sm:flex items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] px-2.5 py-1 text-[11px]"
                >
                    <Cpu className="h-3 w-3 text-vichith-silver shrink-0" />
                    {worker.state === 'running' ? (
                        <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="font-mono text-[10px] text-emerald-300 font-medium">Worker Online</span>
                        </div>
                    ) : worker.state === 'pending' ? (
                        <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                            <span className="font-mono text-[10px] text-amber-300 font-medium">Waking EC2…</span>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={handleWakeWorker}
                            disabled={wakingWorker}
                            className="flex items-center gap-1 text-[10px] font-mono text-vichith-silver hover:text-vichith-mint transition-colors"
                        >
                            <span className="h-1.5 w-1.5 rounded-full bg-neutral-500" />
                            <span>Worker Stopped</span>
                            <span className="underline ml-0.5 text-vichith-mint">Wake</span>
                            {wakingWorker && <RefreshCw className="h-2.5 w-2.5 animate-spin ml-0.5" />}
                        </button>
                    )}
                </div>

                {/* Mode Selector */}
                <div className="hidden md:flex items-center rounded-full bg-white/[0.04] border border-white/[0.08] p-0.5 text-xs">
                    <button
                        type="button"
                        onClick={() => onModeChange('auto')}
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors ${
                            mode === 'auto' ? 'bg-white/[0.1] text-vichith-white font-medium' : 'text-vichith-silver hover:text-vichith-white'
                        }`}
                    >
                        <span className="h-1.5 w-1.5 rounded-full bg-vichith-mint" />
                        <span>Auto Shorts</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onModeChange('manual')}
                        className={`rounded-full px-3 py-1 text-xs transition-colors ${
                            mode === 'manual' ? 'bg-white/[0.1] text-vichith-white font-medium' : 'text-vichith-silver hover:text-vichith-white'
                        }`}
                    >
                        Manual Timeline
                    </button>
                </div>

                {/* Credit Status Pill */}
                <div className="flex items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] px-2.5 py-1 text-[11px] text-vichith-silver">
                    <span className="h-1.5 w-1.5 rounded-full bg-vichith-mint" />
                    <span className="font-mono text-vichith-white text-[10px]">
                        {entitlement ? `${entitlement.remaining} free runs` : '3 credits'}
                    </span>
                </div>

                {/* Direct Vichith Compose Link */}
                <a
                    href={composeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] hover:bg-vichith-mint hover:text-vichith-black px-3 py-1 text-xs font-semibold text-vichith-white transition-all shadow-sm"
                >
                    <span>Compose</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
            </div>
        </header>
    );
}
