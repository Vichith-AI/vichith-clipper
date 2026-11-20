/**
 * mcp/src/tools.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Model Context Protocol (MCP) Tool handlers for Vichith Clipper.
 */

import { z } from 'zod';
import { ClipperClient } from './client.js';

const client = new ClipperClient();

export const TOOLS = [
    {
        name: 'clip_video',
        description:
            'Extracts viral 15–60s 9:16 vertical video clips from a YouTube/Twitch/Kick stream URL or video file with automated facecam/gameplay split-screen and kinetic captions.',
        inputSchema: {
            type: 'object',
            properties: {
                url: {
                    type: 'string',
                    description: 'Public stream URL (YouTube, Twitch VOD, or Kick stream).',
                },
                filePath: {
                    type: 'string',
                    description: 'Local file path to video (in self-hosted local mode).',
                },
                layout: {
                    type: 'string',
                    enum: ['gaming_split', 'speaker_reframe'],
                    description: 'Vertical 9:16 framing: "gaming_split" (top facecam / bottom gameplay) or "speaker_reframe" (auto-tracked center speaker).',
                    default: 'gaming_split',
                },
                templateId: {
                    type: 'string',
                    description: 'Caption template ID (e.g. "clean", "minimal", "launch").',
                    default: 'clean',
                },
                targetCount: {
                    type: 'number',
                    description: 'Number of winning moments to detect (default 3).',
                    default: 3,
                },
            },
        },
    },
    {
        name: 'get_clip_status',
        description: 'Checks the processing status, candidate moments, and preview URLs of a clipping job.',
        inputSchema: {
            type: 'object',
            properties: {
                jobId: {
                    type: 'string',
                    description: 'Unique job ID returned by clip_video.',
                },
            },
            required: ['jobId'],
        },
    },
    {
        name: 'list_templates',
        description: 'Fetches the available caption styles, layouts, and kinetic typography presets.',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'open_in_vichith_compose',
        description:
            'Imports a generated vertical clip into Vichith Compose (https://www.vichith.in) as an editable 5-track project (V1, V2, T1, A1, A2).',
        inputSchema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Title of the clipped short.' },
                layout: { type: 'string', enum: ['gaming_split', 'speaker_reframe'], default: 'gaming_split' },
                sourceAssetId: { type: 'string', description: 'Source asset ID.' },
                durationSecs: { type: 'number', description: 'Duration of the clip in seconds.' },
                startSecs: { type: 'number', description: 'Start time relative to source media.' },
                endSecs: { type: 'number', description: 'End time relative to source media.' },
            },
            required: ['title'],
        },
    },
];

export async function handleToolCall(name: string, args: Record<string, any>) {
    switch (name) {
        case 'clip_video': {
            const res = await client.submitClipJob(args);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Clip job submitted successfully!\nJob ID: ${res.id || res.jobId}\nStatus: ${res.status || 'processing'}\nTrack progress with get_clip_status.`,
                    },
                ],
            };
        }

        case 'get_clip_status': {
            const res = await client.getJobStatus(args.jobId);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(res, null, 2),
                    },
                ],
            };
        }

        case 'list_templates': {
            const res = await client.listTemplates();
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(res, null, 2),
                    },
                ],
            };
        }

        case 'open_in_vichith_compose': {
            const res = await client.exportToCompose(args);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Clip imported to Vichith Compose!\nProject ID: ${res.projectId}\nCompose URL: ${res.composeUrl}`,
                    },
                ],
            };
        }

        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}
