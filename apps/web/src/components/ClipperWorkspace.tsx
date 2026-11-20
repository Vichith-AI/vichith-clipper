'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useProjects } from '@/hooks/useProjects';
import { useProjectMediaUpload } from '@/hooks/useProjectMediaUpload';
import { authedFetch } from '@/lib/auth/authedFetch';
import { probeMediaDuration } from '@/lib/media/duration';
import type { Gta6EntitlementState } from '@/lib/launch/gta6Promo';
import { defaultGta6Entitlement } from '@/lib/launch/gta6Promo';
import { useRegion } from '@/lib/region/RegionContext';
import { trackLaunchEvent } from '@/lib/telemetry/launchTelemetry';
import { parseStreamUrl } from '@/lib/streamIngest';
import {
    CLIPPER_MAX_VOD_SECS,
    DEFAULT_CLIPPER_PREFERENCES,
    validateVodFile,
    type ClipperPreferences,
} from './config';
import { ClipperHeader, type VodAsset } from './ClipperHeader';
import { ClipperControls } from './ClipperControls';
import { ClipperStage, type ProducedClip } from './ClipperStage';
import { ClipperInspector } from './ClipperInspector';

type Phase = 'idle' | 'preparing' | 'ready' | 'transcribing' | 'transcribed' | 'clipping' | 'error';

export function ClipperWorkspace() {
    const searchParams = useSearchParams();
    const { region } = useRegion();
    const { projects, create } = useProjects();
    const [projectId, setProjectId] = useState<string | null>('default');
    const [assets, setAssets] = useState<VodAsset[]>([]);
    const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
    const [streamUrl, setStreamUrl] = useState('');
    const [preferences, setPreferences] = useState<ClipperPreferences>(() => {
        if (typeof window === 'undefined') return DEFAULT_CLIPPER_PREFERENCES;
        try {
            const stored = JSON.parse(localStorage.getItem('vichith:clipper-preferences') ?? 'null') as Partial<ClipperPreferences> | null;
            return {
                layout: stored?.layout === 'speaker_reframe' ? 'speaker_reframe' : 'gaming_split',
                captionStyle: stored?.captionStyle === 'karaoke' ? 'karaoke' : 'active_pill',
                targetCount: stored?.targetCount === 5 ? 5 : 3,
                clipLength: stored?.clipLength ?? 'auto',
            };
        } catch {
            return DEFAULT_CLIPPER_PREFERENCES;
        }
    });

    const [entitlement] = useState<Gta6EntitlementState>(defaultGta6Entitlement());
    const [phase, setPhase] = useState<Phase>('idle');
    const [note, setNote] = useState('Choose a stream capture, paste a URL, or drop a video.');
    const [error, setError] = useState<string | null>(null);
    const [durationSecs, setDurationSecs] = useState<number | null>(null);
    const [language, setLanguage] = useState('auto');
    const [clips, setClips] = useState<ProducedClip[]>([]);
    const [selectedClipIndex, setSelectedClipIndex] = useState(0);
    const [jobId, setJobId] = useState<string | null>(null);
    const [processingMode, setProcessingMode] = useState<'cloud' | 'browser'>('cloud');
    const [mode, setMode] = useState<'auto' | 'manual'>('auto');
    const [activeMobileTab, setActiveMobileTab] = useState<'controls' | 'stage' | 'inspector'>('stage');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const upload = useProjectMediaUpload(projectId);

    const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) ?? null;
    const busy = upload.uploading || phase === 'preparing' || phase === 'transcribing' || phase === 'clipping';

    // Handle Stream URL Ingestion (YouTube / Twitch / Kick)
    const handleImportStream = async (urlToImport: string) => {
        const stream = parseStreamUrl(urlToImport);
        if (!stream.valid) {
            setError('Please enter a valid YouTube, Twitch, or Kick stream URL.');
            setPhase('error');
            return;
        }

        setError(null);
        setPhase('clipping');
        setNote(`Connecting to ${stream.platform.toUpperCase()} stream…`);

        const mockAsset: VodAsset = {
            id: `stream-${stream.videoId || Date.now().toString(36)}`,
            url: stream.normalizedUrl || urlToImport,
            kind: 'video',
            status: 'ready',
            source: stream.platform,
            createdAt: new Date().toISOString(),
        };

        setAssets([mockAsset]);
        setSelectedAssetId(mockAsset.id);

        try {
            const response = await authedFetch('/api/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceUrl: stream.normalizedUrl || urlToImport,
                    layout: preferences.layout,
                    captionMotion: preferences.captionStyle === 'karaoke' ? 'highlight_wipe' : 'pop_in',
                    targetCount: preferences.targetCount,
                    language,
                    region,
                }),
            });

            const body = await response.json();
            if (!response.ok) throw new Error(body.message ?? 'Could not start stream clipping job.');
            setJobId(body.jobId);
            setNote('Analyzing stream audio & speech peaks…');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Stream import failed.');
            setPhase('error');
        }
    };

    // Poll Job Status
    useEffect(() => {
        if (!jobId || phase !== 'clipping') return;
        let active = true;
        const jobStartedAt = Date.now();

        const poll = async () => {
            try {
                const response = await authedFetch(`/api/jobs/${jobId}`);
                if (!response.ok || !active) return;
                const body = await response.json();

                const status = body.status;
                const progress = body.progress ?? 0;

                if (status === 'queued' || (status === 'processing' && progress <= 0)) {
                    const elapsedSecs = (Date.now() - jobStartedAt) / 1000;
                    if (elapsedSecs < 15) {
                        setNote('Ingesting video stream…');
                    } else if (elapsedSecs < 45) {
                        setNote('Transcribing words with sub-frame sync…');
                    } else {
                        setNote('Framing vertical 9:16 cuts…');
                    }
                } else {
                    setNote(`Rendering vertical shorts · ${Math.round(progress * 100)}%`);
                }

                if (status === 'completed') {
                    const outputClips: ProducedClip[] = (body.analysis?.candidates || []).map((cand: any, idx: number) => ({
                        index: idx,
                        candidateId: cand.id,
                        projectId: projectId || 'default',
                        assetId: selectedAssetId,
                        clipId: `clip-${idx}`,
                        outputKey: body.outputKeys?.[cand.id] || null,
                        url: selectedAsset?.url || null,
                        startSecs: cand.startSecs,
                        endSecs: cand.endSecs,
                        composePath: `/api/export-to-compose`,
                    }));

                    if (outputClips.length > 0) {
                        setClips(outputClips);
                        setSelectedClipIndex(0);
                        setPhase('ready');
                        setNote(`${outputClips.length} vertical Shorts are ready!`);
                    } else {
                        setPhase('ready');
                        setNote('Finished processing.');
                    }
                }

                if (status === 'failed') {
                    setError(body.errorMessage ?? 'Clipping failed.');
                    setPhase('error');
                }
            } catch {
                // Poll retry
            }
        };

        const timer = setInterval(() => void poll(), 3000);
        void poll();
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, [jobId, phase, projectId, selectedAsset, selectedAssetId]);

    // Handle Local File Upload
    const handleFiles = async (files: FileList | File[] | null) => {
        if (!files || files.length === 0) return;
        const file = files instanceof FileList ? files.item(0) : files[0];
        if (!file) return;
        const validation = validateVodFile(file, false);
        if (validation) {
            setError(validation);
            setPhase('error');
            return;
        }

        setError(null);
        setPhase('preparing');
        setNote('Reading stream capture…');

        try {
            const dur = await probeMediaDuration(file);
            setDurationSecs(dur);

            const asset = await upload.upload(file);
            const vodAsset: VodAsset = {
                id: asset.id,
                url: asset.url,
                kind: 'video',
                status: 'ready',
                source: 'uploaded',
                createdAt: asset.createdAt,
            };

            setAssets((prev) => [vodAsset, ...prev]);
            setSelectedAssetId(vodAsset.id);
            setPhase('idle');
            setNote('Video loaded. Click "Generate Shorts" to begin.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed.');
            setPhase('error');
        }
    };

    const produceClips = async () => {
        if (!selectedAsset) return;
        setPhase('clipping');
        setError(null);
        setClips([]);
        setSelectedClipIndex(0);
        setNote('Preparing your video…');

        try {
            const response = await authedFetch('/api/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assetId: selectedAsset.id,
                    inputUrl: selectedAsset.url,
                    layout: preferences.layout,
                    captionMotion: preferences.captionStyle === 'karaoke' ? 'highlight_wipe' : 'pop_in',
                    targetCount: preferences.targetCount,
                    language,
                    region,
                }),
            });

            const body = await response.json();
            if (!response.ok) throw new Error(body.message ?? 'Could not start the clipping job.');
            setJobId(body.jobId);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Clipping failed.');
            setPhase('error');
        }
    };

    return (
        <div className="flex h-full w-full flex-col overflow-hidden bg-vichith-black text-vichith-white select-none">
            {/* Top Workspace Header Bar (52px height) */}
            <ClipperHeader
                projects={projects}
                projectId={projectId}
                onSelectProject={setProjectId}
                onNewProject={() => void create('New Clipper Project')}
                assets={assets}
                selectedAsset={selectedAsset}
                onSelectAsset={setSelectedAssetId}
                durationSecs={durationSecs}
                onUploadClick={() => fileInputRef.current?.click()}
                streamUrl={streamUrl}
                onStreamUrlChange={setStreamUrl}
                onImportStream={handleImportStream}
                entitlement={entitlement}
                mode={mode}
                onModeChange={setMode}
                activeMobileTab={activeMobileTab}
                onMobileTabChange={setActiveMobileTab}
                busy={busy}
            />

            {/* Hidden Video File Input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
                className="hidden"
                onChange={(e) => void handleFiles(e.target.files)}
            />

            {/* Main 3-Pane Horizontal Studio Workspace */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Pane: Controls & Presets */}
                <aside className={`w-[340px] shrink-0 border-r border-white/[0.08] bg-[#0A0C0E] flex flex-col overflow-y-auto ${activeMobileTab === 'controls' ? 'flex' : 'hidden xl:flex'}`}>
                    <ClipperControls
                        preferences={preferences}
                        onChangePreferences={setPreferences}
                        language={language}
                        onChangeLanguage={setLanguage}
                        processingMode={processingMode}
                        onChangeProcessingMode={setProcessingMode}
                        onProduceClips={() => void produceClips()}
                        phase={phase}
                        hasSource={Boolean(selectedAsset)}
                        busy={busy}
                    />
                </aside>

                {/* Center Canvas: 9:16 Video Stage & Safe-Zone Guides */}
                <main className={`flex-1 min-w-0 bg-[#060707] flex flex-col overflow-hidden ${activeMobileTab === 'stage' ? 'flex' : 'hidden xl:flex'}`}>
                    <ClipperStage
                        selectedAsset={selectedAsset}
                        durationSecs={durationSecs}
                        phase={phase}
                        note={note}
                        error={error}
                        clips={clips}
                        selectedClipIndex={selectedClipIndex}
                        onSelectClipIndex={setSelectedClipIndex}
                        onResetClips={() => {
                            setClips([]);
                            setSelectedClipIndex(0);
                            setPhase('idle');
                        }}
                        onChooseFile={(file: File) => void handleFiles([file])}
                        uploadState={{
                            phase: upload.uploading ? 'uploading' : phase,
                            stage: upload.uploading ? 'uploading' : phase,
                            progress: upload.progress,
                            message: note,
                        }}
                        framingLayout={preferences.layout}
                        captionStyle={preferences.captionStyle}
                        projectId={projectId}
                    />
                </main>

                {/* Right Pane: Moments Inspector & Compose Export */}
                <aside className={`w-[360px] shrink-0 border-l border-white/[0.08] bg-[#0A0C0E] flex flex-col overflow-y-auto ${activeMobileTab === 'inspector' ? 'flex' : 'hidden xl:flex'}`}>
                    <ClipperInspector
                        clips={clips}
                        selectedClipIndex={selectedClipIndex}
                        selectedAsset={selectedAsset}
                        phase={phase}
                        note={note}
                        onPrepareVertical={() => {}}
                        onTranscribe={() => {}}
                        busy={busy}
                        projectId={projectId}
                    />
                </aside>
            </div>
        </div>
    );
}
