#!/usr/bin/env node
/**
 * mcp/src/index.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Standalone Stdio Model Context Protocol (MCP) Server for Vichith Clipper.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { TOOLS, handleToolCall } from './tools.js';

const server = new Server(
    {
        name: 'vichith-clipper',
        version: '1.0.0',
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Register Tool Discovery
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
});

// Register Tool Execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
        const { name, arguments: args } = request.params;
        return await handleToolCall(name, args || {});
    } catch (error) {
        return {
            isError: true,
            content: [
                {
                    type: 'text',
                    text: error instanceof Error ? error.message : String(error),
                },
            ],
        };
    }
});

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[vichith-clipper] MCP Server running on stdio');
}

main().catch((err) => {
    console.error('[vichith-clipper] Fatal error:', err);
    process.exit(1);
});
