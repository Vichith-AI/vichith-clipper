import { NextResponse } from 'next/server';
import { getWorkerStatus } from '@/lib/worker/ec2Bridge';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const status = await getWorkerStatus();
        return NextResponse.json({ ok: true, ...status });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err instanceof Error ? err.message : 'Unknown error querying worker' },
            { status: 500 }
        );
    }
}
