import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { wakeWorker, getWorkerStatus } from '@/lib/worker/ec2Bridge';

export const dynamic = 'force-dynamic';

function getSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const mode = process.env.CLIPPER_MODE || 'cloud';
        const jobId = `clipper-${crypto.randomUUID()}`;

        if (mode === 'local') {
            const workerUrl = process.env.LOCAL_WORKER_URL || 'http://localhost:8000';
            try {
                const res = await fetch(`${workerUrl}/process`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...body, jobId }),
                });
                if (res.ok) {
                    const data = await res.json();
                    return NextResponse.json({ ok: true, jobId, ...data });
                }
            } catch {
                // If local worker not reachable, return queued job state
            }

            return NextResponse.json({
                ok: true,
                jobId,
                status: 'queued',
                mode: 'local',
            });
        }

        // Cloud mode: Supabase + EC2 worker-cpu
        const supabase = getSupabase();
        if (supabase) {
            const userId = '00000000-0000-0000-0000-000000000000';
            const { error: insertError } = await supabase.from('compute_jobs').insert({
                id: jobId,
                user_id: userId,
                job_type: 'clip_vod',
                status: 'queued',
                progress: 0,
                params: {
                    layout: body.layout || 'gaming_split',
                    captionMotion: body.captionMotion || 'highlight_wipe',
                    sourceUrl: body.sourceUrl,
                    assetId: body.assetId,
                    language: body.language || 'auto',
                    targetCount: body.targetCount || 3,
                    worker: {
                        inputUrl: body.inputUrl || body.sourceUrl,
                        sourceUrl: body.sourceUrl,
                        completionUrl: `${request.nextUrl.origin}/api/jobs/${jobId}/complete`,
                        completionSecret: crypto.randomUUID(),
                    },
                },
            });

            if (insertError) {
                console.error('[clipper] Failed to insert job into Supabase:', insertError);
            }
        }

        // Trigger worker wake-on-demand if stopped
        let workerState = 'unknown';
        try {
            const status = await getWorkerStatus();
            workerState = status.state;
            if (status.state === 'stopped') {
                const wakeResult = await wakeWorker();
                if (wakeResult.ok) {
                    workerState = 'pending';
                }
            }
        } catch (wakeErr) {
            console.warn('[clipper] Worker wake check warning:', wakeErr);
        }

        return NextResponse.json({
            ok: true,
            jobId,
            status: 'queued',
            mode: 'cloud',
            workerState,
        });
    } catch (error) {
        return NextResponse.json(
            { ok: false, error: 'job_creation_failed', message: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
