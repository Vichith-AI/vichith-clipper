import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: jobId } = await params;
    const supabase = getSupabase();
    const body = await request.json().catch(() => ({}));

    if (!supabase) {
        return NextResponse.json({ ok: true, id: jobId, mode: 'local' });
    }

    if (body.progress !== undefined && body.analysis === undefined) {
        await supabase
            .from('compute_jobs')
            .update({ progress: body.progress, updated_at: new Date().toISOString() })
            .eq('id', jobId);
        return NextResponse.json({ ok: true, progress: body.progress });
    }

    if (body.status === 'failed') {
        await supabase
            .from('compute_jobs')
            .update({
                status: 'failed',
                error_message: body.error || 'Worker execution failed',
                updated_at: new Date().toISOString(),
            })
            .eq('id', jobId);
        return NextResponse.json({ ok: true, status: 'failed' });
    }

    const { data: job } = await supabase.from('compute_jobs').select('params').eq('id', jobId).maybeSingle();
    const existingParams = (job?.params as Record<string, unknown>) || {};
    const existingWorker = (existingParams.worker as Record<string, unknown>) || {};

    await supabase
        .from('compute_jobs')
        .update({
            status: 'completed',
            progress: 1.0,
            completed_at: new Date().toISOString(),
            params: {
                ...existingParams,
                worker: {
                    ...existingWorker,
                    analysis: body.analysis,
                    outputKeys: body.outputKeys,
                },
            },
        })
        .eq('id', jobId);

    return NextResponse.json({ ok: true, status: 'completed' });
}
