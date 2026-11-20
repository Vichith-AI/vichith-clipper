import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const vichithUrl = process.env.NEXT_PUBLIC_VICHITH_URL || 'https://www.vichith.in';

        // Forward Authorization header if user is signed in
        const authHeader = request.headers.get('Authorization') || request.headers.get('cookie') || '';

        const response = await fetch(`${vichithUrl}/api/compose/import-clip`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(authHeader ? { Authorization: authHeader } : {}),
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                { ok: false, error: 'upstream_failed', message: errorText },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json(
            {
                ok: false,
                error: 'export_error',
                message: error instanceof Error ? error.message : 'Failed to export clip to Compose.',
            },
            { status: 500 }
        );
    }
}
