import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FALLBACK_TEMPLATES = [
    {
        id: 'clean',
        name: 'Clean',
        description: 'Neutral and legible. The safe default for any video.',
        category: 'minimal',
        badge: 'Default',
        sampleText: 'Clear & legible speech',
        style: {
            fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
            fontSize: 56,
            fontWeight: 600,
            color: '#FFFFFF',
        },
    },
    {
        id: 'minimal',
        name: 'Minimal',
        description: 'Quiet and small. Lets the footage carry the frame.',
        category: 'minimal',
        badge: 'Quiet',
        sampleText: 'Subtle lower third',
        style: {
            fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
            fontSize: 42,
            fontWeight: 500,
            color: '#F5F5F0',
        },
    },
    {
        id: 'launch',
        name: 'Launch',
        description: 'Quiet captions for product and launch films: the picture leads.',
        category: 'cinematic',
        badge: 'Launch',
        sampleText: 'Printed with light',
        style: {
            fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
            fontSize: 40,
            fontWeight: 500,
            color: '#F0F0EB',
        },
    },
];

export async function GET() {
    const vichithUrl = process.env.NEXT_PUBLIC_VICHITH_URL || 'https://www.vichith.in';
    try {
        const upstream = await fetch(`${vichithUrl}/api/public/clipper-templates`, {
            cache: 'no-store',
        });
        if (upstream.ok) {
            const data = await upstream.json();
            return NextResponse.json(data);
        }
    } catch {
        // Fallback below
    }

    return NextResponse.json({
        ok: true,
        templates: FALLBACK_TEMPLATES,
        layouts: [
            {
                id: 'gaming_split',
                name: 'Gaming Split (Top Facecam / Bottom 72% Gameplay)',
                aspectRatio: '9:16',
            },
            {
                id: 'speaker_reframe',
                name: 'Speaker Reframe (Auto-tracked Face Center)',
                aspectRatio: '9:16',
            },
        ],
        motions: [
            { id: 'pop_in', name: 'Pop In (Karaoke Punch)' },
            { id: 'highlight_wipe', name: 'Highlight Wipe' },
        ],
    });
}
