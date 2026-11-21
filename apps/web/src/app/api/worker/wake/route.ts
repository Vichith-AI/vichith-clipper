import { NextResponse } from 'next/server';
import { wakeWorker, getWorkerStatus } from '@/lib/worker/ec2Bridge';

export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        const result = await wakeWorker();
        const currentStatus = await getWorkerStatus(true);
        return NextResponse.json({
            ...result,
            status: currentStatus,
        });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err instanceof Error ? err.message : 'Failed to wake worker' },
            { status: 500 }
        );
    }
}
