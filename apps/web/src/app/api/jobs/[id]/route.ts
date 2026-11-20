import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: jobId } = await params;
    const supabase = getSupabase();

    if (!supabase) {
        return NextResponse.json({
            id: jobId,
            status: 'processing',
            progress: 0.5,
            message: 'Running in standalone local simulation mode.',
        });
    }

    const { data: job, error } = await supabase
        .from('compute_jobs')
        .select('*')
        .eq('id', jobId)
        .maybeSingle();

    if (error || !job) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    return NextResponse.json({
        id: job.id,
        status: job.status,
        progress: job.progress,
        analysis: (job.params as any)?.worker?.analysis || (job.params as any)?.analysis || null,
        outputKeys: (job.params as any)?.worker?.outputKeys || (job.params as any)?.outputKeys || {},
        errorMessage: job.error_message,
        createdAt: job.created_at,
        completedAt: job.completed_at,
    });
}
