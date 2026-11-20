'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, ChevronDown, Film, FolderKanban, Plus, SlidersHorizontal, Eye, Layers, UploadCloud, Globe } from 'lucide-react';
import type { Gta6EntitlementState } from '@/lib/launch/gta6Promo';
import { formatVodDuration } from './config';

export interface VodAsset {
    id: string;
    url: string | null;
    kind: 'video' | 'audio' | 'image';
    status: string;
    source: string;
    createdAt: string;
    generationMeta?: { clientDurationSecs?: number; duration?: { durationSecs?: number } } | null;
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
    const activeProject = projects.find((p) => p.id === projectId);

    return (
        <header className="relative z-20 flex h-[52px] w-full items-center justify-between border-b border-white/10 bg-vichith-black px-4 sm:px-6">
            {/* Left: Project & Media Switcher */}
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                {/* Project Selector */}
                <div className="flex items-center gap-1.5 rounded-full bg-vichith-graphite/80 px-2.5 py-1 text-xs text-vichith-silver transition-colors hover:text-vichith-white">
                    <FolderKanban className="h-3.5 w-3.5 text-vichith-mint flex-shrink-0" />
                    <select
                        aria-label="Active Project"
                        value={projectId ?? ''}
                        disabled={busy}
                        onChange={(e) => onSelectProject(e.target.value)}
                        className="max-w-[120px] sm:max-w-[160px] truncate bg-transparent font-medium text-vichith-white outline-none cursor-pointer text-xs"
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
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-vichith-silver transition-colors hover:bg-white/[0.12] hover:text-vichith-white disabled:opacity-50"
                >
                    <Plus className="h-3.5 w-3.5" />
                </button>

                <div className="hidden sm:block h-4 w-px bg-white/10" />

                {/* VOD Selector Pill */}
                {selectedAsset ? (
                    <div className="flex items-center gap-2 rounded-full bg-vichith-graphite/80 px-3 py-1 text-xs text-vichith-silver">
                        <Film className="h-3.5 w-3.5 text-vichith-mint flex-shrink-0" />
                        {assets.length > 1 ? (
                            <div className="flex items-center gap-1">
                                <select
                                    aria-label="Source Video"
                                    value={selectedAsset.id}
                                    disabled={busy}
                                    onChange={(e) => onSelectAsset(e.target.value)}
                                    className="max-w-[110px] sm:max-w-[140px] truncate bg-transparent font-mono text-[11px] text-vichith-white outline-none cursor-pointer"
                                >
                                    {assets.map((asset) => (
                                        <option key={asset.id} value={asset.id} className="bg-vichith-graphite text-vichith-white">
                                            {asset.source === 'uploaded' ? 'VOD' : 'Gen'} · {asset.id.slice(0, 8)}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="h-3 w-3 text-vichith-muted pointer-events-none" />
                            </div>
                        ) : (
                            <span className="font-mono text-[11px] text-vichith-white">
                                {selectedAsset.id.slice(0, 8)}
                            </span>
                        )}
                        <span className="rounded-full bg-vichith-surface px-1.5 py-0.5 font-mono text-[10px] text-vichith-silver">
                            {formatVodDuration(durationSecs)}
                        </span>
                        <span className="hidden md:inline rounded bg-white/[0.08] px-1 py-0.2 font-mono text-[9px] text-vichith-muted">
                            1080p
                        </span>
                        <button
                            type="button"
                            onClick={onUploadClick}
                            disabled={busy}
                            className="ml-1 text-[11px] text-vichith-silver hover:text-vichith-mint transition-colors"
                        >
                            Replace
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={onUploadClick}
                        disabled={busy}
                        className="flex items-center gap-1.5 rounded-full bg-vichith-graphite px-3 py-1 text-xs text-vichith-silver hover:bg-vichith-surface hover:text-vichith-white transition-colors"
                    >
                        <UploadCloud className="h-3.5 w-3.5 text-vichith-mint" />
                        <span>Upload Video</span>
                    </button>
                )}

                {/* Stream URL Ingestion Input */}
                <div className="hidden xl:flex items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] px-2.5 py-1 text-xs focus-within:border-vichith-mint/50 transition-colors">
                    <Globe className="h-3 w-3 text-vichith-mint shrink-0" />
                    <input
                        type="url"
                        placeholder="Paste YouTube / Twitch / Kick URL..."
                        value={streamUrl || ''}
                        disabled={busy}
                        onChange={(e) => onStreamUrlChange?.(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && onImportStream?.(streamUrl || '')}
                        className="w-48 2xl:w-60 bg-transparent text-[11px] text-vichith-white placeholder:text-vichith-muted outline-none"
                    />
                    {streamUrl && (
                        <button
                            type="button"
                            onClick={() => onImportStream?.(streamUrl)}
                            disabled={busy}
                            className="rounded px-1.5 py-0.5 bg-vichith-mint text-vichith-black text-[10px] font-semibold hover:bg-vichith-emerald transition-colors"
                        >
                            Import
                        </button>
                    )}
                </div>
            </div>

            {/* Mobile / Tablet View Switcher (Hidden on XL+) */}
            <div className="flex xl:hidden items-center gap-1 rounded-full bg-vichith-graphite p-0.5 text-xs">
                <button
                    type="button"
                    onClick={() => onMobileTabChange('controls')}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                        activeMobileTab === 'controls' ? 'bg-vichith-surface text-vichith-white' : 'text-vichith-silver hover:text-vichith-white'
                    }`}
                >
                    <SlidersHorizontal className="h-3 w-3" />
                    <span>Config</span>
                </button>
                <button
                    type="button"
                    onClick={() => onMobileTabChange('stage')}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                        activeMobileTab === 'stage' ? 'bg-vichith-surface text-vichith-white' : 'text-vichith-silver hover:text-vichith-white'
                    }`}
                >
                    <Eye className="h-3 w-3" />
                    <span>Preview</span>
                </button>
                <button
                    type="button"
                    onClick={() => onMobileTabChange('inspector')}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                        activeMobileTab === 'inspector' ? 'bg-vichith-surface text-vichith-white' : 'text-vichith-silver hover:text-vichith-white'
                    }`}
                >
                    <Layers className="h-3 w-3" />
                    <span>Inspector</span>
                </button>
            </div>

            {/* Right: Mode & Credit Status */}
            <div className="flex items-center gap-2 sm:gap-3">
                {/* Mode Selector */}
                <div className="hidden md:flex items-center rounded-full bg-vichith-graphite p-0.5 text-xs">
                    <button
                        type="button"
                        onClick={() => onModeChange('auto')}
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors ${
                            mode === 'auto' ? 'bg-vichith-surface text-vichith-white' : 'text-vichith-silver hover:text-vichith-white'
                        }`}
                    >
                        <span className="h-1.5 w-1.5 rounded-full bg-vichith-mint" />
                        <span>Auto Shorts</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onModeChange('manual')}
                        className={`rounded-full px-3 py-1 text-xs transition-colors ${
                            mode === 'manual' ? 'bg-vichith-surface text-vichith-white' : 'text-vichith-silver hover:text-vichith-white'
                        }`}
                    >
                        Manual Timeline
                    </button>
                </div>

                {/* Credit Status Pill */}
                <div className="flex items-center gap-1.5 rounded-full bg-vichith-graphite/80 px-2.5 py-1 text-[11px] text-vichith-silver">
                    <span className="h-1.5 w-1.5 rounded-full bg-vichith-mint animate-pulse" />
                    <span className="font-mono text-vichith-white">
                        {entitlement ? `${entitlement.remaining} free runs` : '3 credits'}
                    </span>
                </div>

                {/* Compose Link */}
                {projectId && (
                    <Link
                        href={`/p/${projectId}/compose`}
                        className="hidden sm:inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-vichith-silver hover:bg-white/[0.12] hover:text-vichith-white transition-colors"
                    >
                        <span>Compose</span>
                        <ArrowUpRight className="h-3 w-3" />
                    </Link>
                )}

                {/* Stream URL Ingestion Input */}
                <div className="hidden xl:flex items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] px-2.5 py-1 text-xs focus-within:border-vichith-mint/50 transition-colors">
                    <Globe className="h-3 w-3 text-vichith-mint shrink-0" />
                    <input
                        type="url"
                        placeholder="Paste YouTube / Twitch / Kick URL..."
                        value={streamUrl || ''}
                        disabled={busy}
                        onChange={(e) => onStreamUrlChange?.(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && onImportStream?.(streamUrl || '')}
                        className="w-48 2xl:w-60 bg-transparent text-[11px] text-vichith-white placeholder:text-vichith-muted outline-none"
                    />
                    {streamUrl && (
                        <button
                            type="button"
                            onClick={() => onImportStream?.(streamUrl)}
                            disabled={busy}
                            className="rounded px-1.5 py-0.5 bg-vichith-mint text-vichith-black text-[10px] font-semibold hover:bg-vichith-emerald transition-colors"
                        >
                            Import
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}
