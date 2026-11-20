<div align="center">

# 🎬 Vichith Clipper

**The Open-Source AI Video Clipper**  
*Turn hours of live streams and long VODs into viral 9:16 vertical Shorts, Reels, and TikToks with AI moment selection, facecam tracking, and animated kinetic captions.*

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Next.js](https://img.shields.io/badge/Next.js-15.1-black)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/Python-FastAPI-009688)](https://fastapi.tiangolo.com/)
[![MCP](https://img.shields.io/badge/MCP-Enabled-9B51E0)](https://modelcontextprotocol.io/)
[![Vercel Ready](https://img.shields.io/badge/Vercel-Deployed-black)](https://clipper.vichith.in)

[**Live Demo (Cloud)**](https://clipper.vichith.in) · [**Compose Editor**](https://www.vichith.in) · [**Report Issue**](https://github.com/Vichith-AI/vichith-clipper/issues)

</div>

---

## 🌟 Highlights

- **⚡ Two-Phase Stream URL Ingestion (`YouTube / Twitch / Kick`):**  
  Paste any stream URL. Clipper downloads low-bandwidth audio first (~15MB/hr), runs audio crest analysis and Whisper transcription to pinpoint peak moments, and then uses `yt-dlp --download-sections` to fetch *only* the winning 15–60s segments in 1080p—saving over 95% of bandwidth and compute.
- **🎮 Gaming Split (`V1 + V2`):**  
  Intelligent vertical compositing for gaming streams: gameplay centered in the bottom 72% (`V1`) with automated facecam detection and framing in the top 28% (`V2`), accompanied by background drop-shadows and separation borders.
- **🗣️ Speaker Reframe:**  
  Single-source camera tracking with smooth pan-and-scan easing (`easeOutCubic`) that keeps the active speaker centered in vertical 9:16 format.
- **🔥 Animated Kinetic Captions:**  
  Sub-second aligned captions with word-level highlight wipes, active pill bounces, and support for English and Indian regional languages (Hindi, Tamil, Telugu, Kannada, etc. powered by Sarvam AI and faster-whisper).
- **🚀 Dual Deployment Architecture:**
  - **Hosted Cloud Mode on Vercel (`https://clipper.vichith.in`):** Uses Next.js 15 Edge/Serverless routes, Supabase job queueing, AWS S3 (`ap-south-2`) storage, and dedicated EC2 CPU/GPU workers.
  - **Self-Hosted Local Mode (Docker / Python):** Run everything on your own machine with a single `docker compose up` command or local Python runner. Zero cloud API keys required.
- **🤖 Model Context Protocol (MCP) Code Mode:**  
  Built-in stdio/SSE MCP server enabling Claude Code, Cursor, and Antigravity to autonomously ingest videos, generate clips, and query rendering progress.
- **✨ 1-Click Vichith Compose Export:**  
  Export clips directly to [Vichith Compose](https://www.vichith.in) as native 5-track projects (`V1` gameplay, `V2` facecam, `T1` captions, `A1` dialogue, `A2` background audio) for full timeline control.

---

## 📐 Architecture

```
                       ┌──────────────────────────────────────────────┐
                       │          Client UI / MCP Agent               │
                       │   (Next.js App / Claude Code / Cursor)       │
                       └──────────────────────┬───────────────────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    ▼                                                   ▼
       ┌─────────────────────────┐                         ┌─────────────────────────┐
       │   Hosted Cloud Mode     │                         │   Local Self-Hosted     │
       │ (Vercel + Supabase API) │                         │   (FastAPI Local)       │
       └────────────┬────────────┘                         └────────────┬────────────┘
                    │                                                   │
     ┌──────────────┴──────────────┐                                    │
     ▼                             ▼                                    ▼
┌──────────────┐            ┌──────────────┐                   ┌─────────────────┐
│  Supabase    │            │  AWS S3      │                   │ Local Temp Disk │
│  Job Queue   │            │  (ap-south-2)│                   │   (/tmp/clipper)│
└──────┬───────┘            └──────┬───────┘                   └────────┬────────┘
       │                           │                                    │
       └──────────────┬────────────┘                                    │
                      ▼                                                 ▼
       ┌─────────────────────────────┐                         ┌─────────────────┐
       │      worker-cpu (EC2)       │                         │  Local Worker   │
       │ yt-dlp ──> Faster-Whisper   │                         │  Docker / Py    │
       │   ──> OpenCV Facecam        │                         │  OpenCV / FFmpeg│
       │   ──> FFmpeg Render         │                         └─────────────────┘
       └──────────────┬──────────────┘
                      │
                      ▼
       ┌─────────────────────────────┐
       │     1-Click Export to       │
       │   Vichith 5-Track Compose   │
       └─────────────────────────────┘
```

---

## 🚀 Quick Start (Local Self-Hosted)

### Option A: Docker Compose (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/Vichith-AI/vichith-clipper.git
   cd vichith-clipper
   ```

2. Start the web interface and worker:
   ```bash
   docker compose up -d
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### Option B: Native Node & Python

#### Prerequisites
- Node.js 20+ & npm / pnpm
- Python 3.10+
- FFmpeg installed in your PATH

#### 1. Setup Python Worker
```bash
cd worker
python -m venv .venv

# On Linux/macOS:
source .venv/bin/activate
# On Windows:
.venv\Scripts\activate

pip install -r requirements.txt
python worker.py
```
*Worker starts on http://127.0.0.1:8000.*

#### 2. Setup Next.js Web App
In another terminal:
```bash
cd apps/web
npm install
npm run dev
```
*Web UI starts on http://localhost:3000.*

---

## ☁️ Cloud Deployment (Vercel + AWS + Supabase)

Vichith Clipper is optimized for zero-cold-start, serverless deployment on **Vercel** with heavy media processing offloaded to asynchronous background workers.

### 1. Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example apps/web/.env.local
```

Configure your cloud credentials:
```ini
CLIPPER_MODE=cloud
NEXT_PUBLIC_APP_URL=https://clipper.vichith.in
VICHITH_COMPOSE_URL=https://www.vichith.in

# Supabase (Database & Realtime Status)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AWS S3 Storage (ap-south-2 Hyderabad)
STORAGE_PROVIDER=s3
AWS_REGION=ap-south-2
AWS_S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=your-key-id
AWS_SECRET_ACCESS_KEY=your-secret-key

# EC2 Background Worker
WORKER_CPU_URL=http://your-ec2-worker-ip:8000
WORKER_SHARED_SECRET=your-secure-secret
```

### 2. Deploy Web App to Vercel
Deploy the `apps/web` folder directly to Vercel:
```bash
cd apps/web
npx vercel --prod
```
The included `vercel.json` ensures lightweight serverless execution (15–60s max) that safely dispatches jobs without risking gateway timeouts.

---

## 🤖 Model Context Protocol (MCP) Integration

Vichith Clipper includes an official Model Context Protocol (MCP) server so you can use it inside **Claude Code**, **Cursor**, or **Antigravity**.

### Build MCP Server
```bash
npm run build:mcp
```

### Configure Claude Code / Claude Desktop
Add this entry to your `claude_desktop_config.json` or `.claude/mcp.json`:

```json
{
  "mcpServers": {
    "vichith-clipper": {
      "command": "node",
      "args": ["/path/to/vichith-clipper/mcp/dist/index.js"],
      "env": {
        "CLIPPER_API_URL": "http://localhost:3000",
        "CLIPPER_WORKER_URL": "http://127.0.0.1:8000"
      }
    }
  }
}
```

### Available Tools

| Tool | Description |
|---|---|
| `clip_video` | Ingests a stream URL or uploaded video and generates 9:16 vertical clips. |
| `get_clip_status` | Checks job rendering progress, status, and generated clip URLs. |
| `list_templates` | Lists available framing presets (`gaming_split`, `speaker_reframe`) and caption styles. |
| `open_in_vichith_compose` | Prepares a 5-track project bundle and returns the direct Vichith Compose URL. |

---

## 📁 Repository Structure

```
vichith-clipper/
├── apps/
│   └── web/                   # Next.js 15 3-pane horizontal workspace & API routes
│       ├── src/app/           # App router (/api/jobs, /api/templates, etc.)
│       ├── src/components/    # ClipperControls, ClipperStage, ClipperInspector
│       └── src/lib/           # Candidate scoring, stream ingestion, safe-zones
├── mcp/                       # Model Context Protocol stdio/SSE server
│   ├── src/client.ts          # Clipper worker/API bridge
│   ├── src/tools.ts           # MCP tool registrations
│   └── src/index.ts           # MCP Server entrypoint
├── worker/                    # Python audio/video processing engine
│   ├── downloader.py          # Two-phase yt-dlp stream extractor
│   ├── worker.py              # OpenCV facecam detector & FFmpeg render pipeline
│   └── cloud.py               # S3/R2 presigned upload/download manager
├── docker-compose.yml         # 1-command self-hosted stack
├── LICENSE                    # GNU AGPL-3.0
└── README.md
```

---

## 📄 License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.  
See the [LICENSE](LICENSE) file for details.

---

<div align="center">
Built with ❤️ by <a href="https://www.vichith.in">Vichith AI</a>
</div>
