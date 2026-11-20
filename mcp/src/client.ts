/**
 * mcp/src/client.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * HTTP client for communicating with Vichith Clipper APIs and Compose import.
 */

export interface ClipJobParams {
    url?: string;
    filePath?: string;
    layout?: 'gaming_split' | 'speaker_reframe';
    captionMotion?: 'highlight_wipe' | 'pop_in';
    templateId?: string;
    targetCount?: number;
    language?: string;
}

export interface ComposeBundleInput {
    title?: string;
    layout?: 'gaming_split' | 'speaker_reframe';
    sourceAssetId?: string;
    durationSecs?: number;
    startSecs?: number;
    endSecs?: number;
    words?: Array<{ text: string; start_secs: number; end_secs: number }>;
    facecamBox?: { left: number; top: number; right: number; bottom: number };
}

export class ClipperClient {
    private baseUrl: string;
    private composeUrl: string;

    constructor() {
        this.baseUrl = process.env.CLIPPER_API_URL || 'https://clipper.vichith.in';
        this.composeUrl = process.env.VICHITH_URL || 'https://www.vichith.in';
    }

    async listTemplates(): Promise<any> {
        try {
            const res = await fetch(`${this.composeUrl}/api/public/clipper-templates`);
            if (res.ok) {
                return await res.json();
            }
        } catch {
            // Fallback default templates
        }

        return {
            templates: [
                { id: 'clean', name: 'Clean', description: 'Neutral, modern sans-serif subtitles' },
                { id: 'minimal', name: 'Minimal', description: 'Quiet lower third' },
                { id: 'launch', name: 'Launch', description: 'Cinematic brand captions' },
            ],
            layouts: [
                { id: 'gaming_split', name: 'Gaming Split (Top Facecam / Bottom 72% Gameplay)' },
                { id: 'speaker_reframe', name: 'Speaker Reframe (Auto-tracked Face Center)' },
            ],
        };
    }

    async submitClipJob(params: ClipJobParams): Promise<any> {
        const res = await fetch(`${this.baseUrl}/api/jobs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Failed to submit clip job: ${err}`);
        }

        return await res.json();
    }

    async getJobStatus(jobId: string): Promise<any> {
        const res = await fetch(`${this.baseUrl}/api/jobs/${jobId}`);
        if (!res.ok) {
            throw new Error(`Failed to fetch job status: ${res.statusText}`);
        }
        return await res.json();
    }

    async exportToCompose(bundle: ComposeBundleInput): Promise<any> {
        const res = await fetch(`${this.composeUrl}/api/compose/import-clip`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bundle),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Failed to export clip to Compose: ${err}`);
        }

        return await res.json();
    }
}
