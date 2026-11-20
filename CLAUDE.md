# Vichith Clipper — AI Assistant & Developer Guide

`Vichith Clipper` is the open-source AI video clipper repository of Vichith AI. It turns stream captures (YouTube, Twitch, Kick) and long VODs into 9:16 vertical Shorts with animated captions and gaming split layouts.

## Repository Layout
- `apps/web`: Next.js 15 (React 19, Tailwind CSS) 3-pane horizontal workspace and API routes.
- `worker`: Python 3.10+ engine (`yt-dlp`, `faster-whisper`, OpenCV Haar cascade, FFmpeg).
- `mcp`: Model Context Protocol server exposing stdio/SSE tools for AI agents.

## Common Development Commands

### Web App (`apps/web`)
```bash
# Install dependencies from root
npm install

# Run web dev server (port 3000)
npm run dev

# Type-check web app
cd apps/web && npx tsc --noEmit

# Build production web bundle
npm run build
```

### Python Worker (`worker`)
```bash
# Setup venv
cd worker
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt

# Run worker locally (FastAPI port 8000)
python worker.py

# Run worker unit tests
pytest tests/
```

### Model Context Protocol (`mcp`)
```bash
# Build MCP server
npm run build:mcp

# Test run MCP server via stdio
node mcp/dist/index.js
```

## MCP Integration for Claude Code / Cursor
Add to your Claude Code / Desktop configuration (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "vichith-clipper": {
      "command": "node",
      "args": ["<ABSOLUTE_PATH>/vichith-clipper/mcp/dist/index.js"],
      "env": {
        "CLIPPER_API_URL": "http://localhost:3000",
        "CLIPPER_WORKER_URL": "http://127.0.0.1:8000"
      }
    }
  }
}
```

## Key Rules & Architectural Guidelines
1. **No GSAP**: Animations must use CSS or Framer Motion / WebCodecs.
2. **Two-Phase Ingestion**: Ingesting streams via `yt-dlp` must download audio first, transcribe/rank, and only fetch the exact clip time range in high-res.
3. **Dual Deployment**:
   - `CLIPPER_MODE=cloud`: Serverless API routes enqueue jobs to Supabase and wake EC2 background workers; heavy rendering never executes inside Vercel serverless functions.
   - `CLIPPER_MODE=local`: Local disk storage and direct execution via FastAPI worker.
4. **Vichith Compose Compatibility**: Exporting clips generates a valid 5-track bundle (`V1/V2/T1/A1/A2`) accepted by `https://www.vichith.in/api/compose/import-clip`.
