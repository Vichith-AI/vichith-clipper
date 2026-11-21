'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { ClipperHeader, type VodAsset } from './ClipperHeader';
import { ClipperControls } from './ClipperControls';
import { ClipperStage, type ProducedClip } from './ClipperStage';
import { ClipperInspector } from './ClipperInspector';
import {
    DEFAULT_CLIPPER_PREFERENCES,
    type ClipperPreferences,
    validateVodFile,
} from './config';
import { parseStreamUrl } from '@/lib/streamIngest';
import { useProjects } from '@/hooks/useProjects';
import { useProjectMediaUpload } from '@/hooks/useProjectMediaUpload';
import { probeMediaDuration } from '@/lib/media/duration';
import { authedFetch } from '@/lib/auth/authedFetch';
import { useRegion } from '@/lib/region/RegionContext';
import { defaultGta6Entitlement, type Gta6EntitlementState } from '@/lib/launch/gta6Promo';

type Phase = 'idle' | 'preparing' | 'transcribing' | 'clipping' | 'ready' | 'error';

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
    const [serverProgress, setServerProgress] = useState<number | null>(null);
    const [jobStatus, setJobStatus] = useState<string>('idle');
    const [workerStatus, setWorkerStatus] = useState<any>(null);
    const [exportingToCompose, setExportingToCompose] = useState(false);
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
        setJobStatus('queued');
        setServerProgress(0);
        setNote(`Enqueuing ${stream.platform.toUpperCase()} stream for processing…`);

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
                    inputUrl: stream.normalizedUrl || urlToImport,
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
            if (body.workerState) {
                setWorkerStatus((prev: any) => ({ ...prev, state: body.workerState }));
            }
            setNote('Job enqueued. Checking compute worker…');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Stream import failed.');
            setPhase('error');
        }
    };

    // Poll Job Status
    useEffect(() => {
        if (!jobId || phase !== 'clipping') return;
        let active = true;

        const poll = async () => {
            try {
                const response = await authedFetch(`/api/jobs/${jobId}`);
                if (!response.ok || !active) return;
                const body = await response.json();

                const status = body.status;
                const progress = body.progress ?? 0;
                setJobStatus(status);
                setServerProgress(progress);
                if (body.workerStatus) {
                    setWorkerStatus(body.workerStatus);
                }

                if (status === 'queued') {
                    if (body.workerStatus?.state === 'stopped') {
                        setNote('Worker is stopped. Wake instance to begin processing.');
                    } else if (body.workerStatus?.state === 'pending') {
                        setNote('Compute worker is waking up (ap-south-2)…');
                    } else {
                        setNote('Job enqueued. Awaiting compute worker pickup…');
                    }
                } else if (status === 'processing') {
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
        setJobStatus('queued');
        setServerProgress(0);
        setError(null);
        setClips([]);
        setSelectedClipIndex(0);
        setNote('Enqueuing video for vertical processing…');

        try {
            const response = await authedFetch('/api/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assetId: selectedAsset.id,
                    inputUrl: selectedAsset.url,
                    sourceUrl: selectedAsset.url,
                    layout: preferences.layout,
                    captionMotion: preferences.captionStyle === 'karaoke' ? 'highlight_wipe' : 'pop_in',
                    targetCount: preferences.targetCount,
                    language,
                    region,
                }),
            });

            const body = await response.json();
            if (!response.ok) throw new Error(body.message ?? 'Failed to create job.');
            setJobId(body.jobId);
            if (body.workerState) {
                setWorkerStatus((prev: any) => ({ ...prev, state: body.workerState }));
            }
            setNote('Job enqueued. Checking compute worker…');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to produce clips.');
            setPhase('error');
        }
    };

    // Wake EC2 Worker
    const handleWakeWorker = async () => {
        try {
            const res = await fetch('/api/worker/wake', { method: 'POST' });
            const data = await res.json();
            if (data.status) {
                setWorkerStatus(data.status);
            }
        } catch (e) {
            console.error('Failed to wake worker:', e);
        }
    };

    // Export to Vichith Compose Handoff
    const handleExportToCompose = async (clip: ProducedClip) => {
        try {
            setExportingToCompose(true);
            const res = await authedFetch('/api/export-to-compose', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clipId: clip.clipId || `clip-${clip.index}`,
                    candidateId: clip.candidateId,
                    projectId: projectId || undefined,
                    assetId: clip.assetId,
                    sourceAssetId: clip.assetId,
                    startSecs: clip.startSecs,
                    endSecs: clip.endSecs,
                    durationSecs: Math.max(1, clip.endSecs - clip.startSecs),
                    layout: preferences.layout,
                    captionMotion: preferences.captionStyle === 'karaoke' ? 'highlight_wipe' : 'pop_in',
                }),
            });
            const data = await res.json();
            if (data.composeUrl) {
                window.open(data.composeUrl, '_blank');
            } else {
                window.open('https://www.vichith.in/compose', '_blank');
            }
        } catch (e) {
            console.error('Failed to export to compose:', e);
            window.open('https://www.vichith.in/compose', '_blank');
        } finally {
            setExportingToCompose(false);
        }
    };

    return (
        <div className="flex h-screen w-full flex-col overflow-hidden bg-[#060707] text-vichith-white font-sans antialiased">
            {/* Header: Project Selector, Stream URL Input, Worker Status & Compose */}
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
                <aside className={`w-[340px] shrink-0 border-r border-white/[0.08] bg-[#0A0C0E] flex flex-col overflow-y-auto custom-scrollbar ${activeMobileTab === 'controls' ? 'flex' : 'hidden xl:flex'}`}>
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
                        serverProgress={serverProgress}
                        jobStatus={jobStatus}
                        workerStatus={workerStatus}
                        onWakeWorker={handleWakeWorker}
                        onExportToCompose={handleExportToCompose}
                        streamUrl={streamUrl}
                        onStreamUrlChange={setStreamUrl}
                        onImportStream={handleImportStream}
                    />
                </main>

                {/* Right Pane: Moments Inspector & Compose Export */}
                <aside className={`w-[360px] shrink-0 border-l border-white/[0.08] bg-[#0A0C0E] flex flex-col overflow-y-auto custom-scrollbar ${activeMobileTab === 'inspector' ? 'flex' : 'hidden xl:flex'}`}>
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
                        onExportToCompose={handleExportToCompose}
                        exporting={exportingToCompose}
                    />
                </aside>
            </div>
        </div>
    );
}
