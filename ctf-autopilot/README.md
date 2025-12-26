# CTF Compass

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Ubuntu 24.04](https://img.shields.io/badge/Ubuntu-24.04%20LTS-E95420?logo=ubuntu)](https://ubuntu.com/)
[![Docker](https://img.shields.io/badge/Docker-Required-2496ED?logo=docker)](https://www.docker.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Version](https://img.shields.io/badge/Version-2.0.0-blue)](https://github.com/huynhthanhthao-uel/ctf-compass)

A production-grade, security-first, local-only CTF challenge analyzer and writeup generator. This tool ingests challenge descriptions and attached files, runs deterministic offline analysis in an isolated Docker sandbox, extracts evidence and candidate flags, and generates professional writeups.

**🆕 Version 2.0.0:** No login required - single-user local deployment!

**Repository:** [github.com/huynhthanhthao-uel/ctf-compass](https://github.com/huynhthanhthao-uel/ctf-compass)

---

## ✨ Key Features

### What's New in v2.0.0
- **No Login Required**: Single-user mode - just open the Web UI and start!
- **Setup Wizard**: Configure Backend URL on first visit
- **Built-in CORS Tester**: Debug CORS issues directly in the app
- **Improved CORS Handling**: Robust fallback for container environments

### Frontend (React + TypeScript)
- **Modern Dashboard**: Real-time job statistics with grid/list views
- **Full Autopilot**: One-click "Solve Challenge" button with AI-powered analysis
- **Netcat Terminal**: Interactive `nc host:port` connections for PWN challenges
- **AI Solve Scripts**: Auto-generate pwntools scripts using MegaLLM AI
- **Job Management**: Create, run, stop, and delete analysis jobs
- **Remote Connection**: Configure netcat host:port during job creation
- **Live Updates**: WebSocket-based progress tracking with animations
- **Backend URL Configuration**: Connect to Docker backend via Setup page
- **CORS Tester**: Test preflight requests and inspect headers
- **Demo Mode**: Full UI functionality with mock data when backend unavailable
- **Notification Center**: Real-time alerts with mark-as-read functionality
- **Responsive Design**: Works on desktop and mobile devices

### Backend (FastAPI + Celery + Docker)
- **Local-First Architecture**: All processing done on your local Docker backend
- **Secure Analysis**: Sandboxed Docker containers with network isolation
- **AI Integration**: MegaLLM API for intelligent analysis (Gemini 2.5 / LLaMA 3.3)
- **Real-time WebSocket**: Live job updates pushed to clients
- **RESTful API**: Complete job and configuration management
- **Background Processing**: Celery workers for async job execution
- **Sandbox Terminal**: Interactive shell in isolated Docker containers

---

## ⚡ Quick Start

### 🚀 One-Line Deploy (Simplest)

```bash
curl -fsSL https://raw.githubusercontent.com/huynhthanhthao-uel/ctf-compass/main/ctf-autopilot/infra/scripts/deploy.sh | bash
```

**✨ No login required - just open the Web UI!**

### Ubuntu 24.04 Full Installation

```bash
curl -fsSL https://raw.githubusercontent.com/huynhthanhthao-uel/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash
```

### Installation Options

```bash
# Clean install (remove old installation first)
curl -fsSL https://raw.githubusercontent.com/huynhthanhthao-uel/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash -s -- --clean

# Force install (skip confirmation prompts)
curl -fsSL https://raw.githubusercontent.com/huynhthanhthao-uel/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash -s -- --force
```

| Option | Description |
|--------|-------------|
| `--clean` | Remove old installation before installing |
| `--clean-only` | Only cleanup, don't install (for uninstall) |
| `--purge` | Remove everything including backups |
| `--force` | Skip confirmation prompts |
| `--no-start` | Don't start services after install |

### Post-Installation

1. **Access the Web UI:** `http://YOUR_SERVER_IP:3000`
2. **Set Backend URL:** Enter `http://YOUR_SERVER_IP:8000` → Click Test
3. **Continue to Dashboard:** Start analyzing!
4. **Configure API Key (Optional):** Go to Configuration → Enter MegaLLM API key for AI features

---

## 🚀 Full Autopilot Mode

### How It Works

1. **Create a Job**: Upload challenge files and description
2. **Click "Solve Challenge"**: One-click Full Autopilot activation
3. **Watch AI Analyze**: See real-time progress through 4 phases:
   - 🔍 **Initial Analysis**: File identification and category detection
   - 📊 **Deep Scan**: Category-specific tool execution
   - 🤖 **AI Reasoning**: Pattern recognition and exploit generation
   - 🏁 **Flag Extraction**: Automated flag discovery
4. **Get Results**: Flag candidates, solve scripts, and writeups

### Supported Categories

| Category | Tools Used | Example Challenges |
|----------|------------|-------------------|
| **Crypto** | Python, factordb, hashcat | RSA, AES, XOR |
| **Pwn** | checksec, ROPgadget, gdb | Buffer overflow, ROP |
| **Web** | curl, sqlmap, burp | SQLi, XSS, SSRF |
| **Rev** | strings, objdump, r2 | Crackme, keygen |
| **Forensics** | binwalk, volatility, exiftool | Memory dumps, files |
| **Misc** | Various | Encoding, OSINT |

---

## 🧪 CORS Tester

Built-in tool to diagnose CORS issues:

1. **Access:** `http://YOUR_SERVER_IP:3000/cors-tester`
2. **Features:**
   - Test OPTIONS (preflight) requests
   - Test GET/POST requests
   - View all response headers
   - Copy headers to clipboard
   - Troubleshooting tips

---

## 🔄 System Update

```bash
# Check for updates
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh --check

# Perform update
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh

# Force deep cleanup and update (rebuild all containers)
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh --clean
```

---

## 🗑️ Complete Uninstall

### Using Uninstall Script

```bash
# Interactive uninstall (keeps backups)
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/uninstall.sh

# Force uninstall (no prompts)
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/uninstall.sh --force

# Complete purge (removes backups too)
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/uninstall.sh --purge
```

### Manual Cleanup

```bash
# Stop all services
sudo docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml down -v

# Remove all data and files
sudo rm -rf /opt/ctf-compass /opt/ctf-compass-backups
sudo rm -f /var/log/ctf-compass-*.log

# Clean all Docker resources
sudo docker system prune -af
sudo docker volume prune -f
```

---

## 🔐 Security First

This tool is designed for **offline, local-only analysis**. It does NOT:
- ❌ Connect to remote challenge servers
- ❌ Perform automatic exploitation
- ❌ Execute arbitrary network requests from sandboxes

All analysis runs in isolated Docker containers with:
- ✅ Network disabled (`--network=none`)
- ✅ Read-only filesystems where possible
- ✅ CPU/memory/time limits
- ✅ Non-root user execution
- ✅ Seccomp/AppArmor profiles

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Frontend (React/Vite)                      │
│                    localhost:3000                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Setup     │  │  Dashboard  │  │ CORS Tester │          │
│  │    Page     │  │    Page     │  │    Page     │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │Full Autopilot│ │Backend Status│ │  Job Detail │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP/WebSocket
          ┌───────────┴───────────┐
          │                       │
┌─────────▼─────────┐   ┌─────────▼─────────┐
│  Local Backend    │   │    Demo Mode      │
│  (FastAPI)        │   │  (Mock Data)      │
│  localhost:8000   │   │                   │
│  ┌─────────────┐  │   │  ┌─────────────┐  │
│  │    Jobs     │  │   │  │  Simulated  │  │
│  │   Service   │  │   │  │  Responses  │  │
│  └──────┬──────┘  │   │  └─────────────┘  │
└─────────┼─────────┘   └───────────────────┘
          │
┌─────────▼─────────────────────────────────┐
│              Celery Workers               │
│  ┌─────────────┐  ┌─────────────┐         │
│  │  Analysis   │  │   Sandbox   │         │
│  │    Tasks    │  │   Runner    │         │
│  └─────────────┘  └──────┬──────┘         │
└──────────────────────────┼────────────────┘
                           │ Docker API
┌──────────────────────────▼────────────────┐
│       Sandbox Container (--network=none)  │
│  Tools: strings, binwalk, pwntools, etc.  │
└───────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```
ctf-compass/
├── ctf-autopilot/
│   ├── apps/
│   │   ├── web/                 # Frontend Dockerfile
│   │   └── api/                 # FastAPI backend
│   │       └── app/
│   │           ├── routers/     # API endpoints (jobs, system, ws, ai)
│   │           ├── services/    # Business logic (sandbox, ai_analysis)
│   │           └── models.py    # Database models
│   ├── sandbox/
│   │   ├── image/               # Sandbox Dockerfile with CTF tools
│   │   └── profiles/            # Seccomp/AppArmor profiles
│   ├── infra/
│   │   ├── docker-compose.yml   # Production compose
│   │   ├── docker-compose.dev.yml
│   │   ├── nginx/               # Reverse proxy config
│   │   └── scripts/
│   │       ├── install_ubuntu_24.04.sh
│   │       ├── deploy.sh
│   │       ├── update.sh
│   │       └── uninstall.sh
│   └── docs/
│       ├── ARCHITECTURE.md
│       ├── SECURITY.md
│       ├── DEBUG.md
│       └── USAGE.md
├── src/                         # React frontend source
│   ├── pages/
│   │   ├── Setup.tsx            # Backend URL configuration
│   │   ├── Dashboard.tsx
│   │   ├── CorsTester.tsx       # CORS debugging tool
│   │   ├── JobCreate.tsx
│   │   ├── JobDetail.tsx
│   │   └── Configuration.tsx
│   ├── components/
│   │   ├── jobs/
│   │   │   ├── FullAutopilot.tsx
│   │   │   ├── SandboxTerminal.tsx
│   │   │   ├── NetcatPanel.tsx
│   │   │   └── SolveScriptGenerator.tsx
│   │   └── ui/                  # shadcn/ui components
│   ├── hooks/
│   │   ├── use-jobs.tsx
│   │   ├── use-backend-status.ts
│   │   └── use-websocket.ts
│   └── lib/
│       ├── api.ts
│       ├── backend-url.ts
│       └── types.ts
├── package.json
└── README.md
```

---

## 🔧 Configuration

### Web UI Configuration (Recommended)

After installation:
1. Open the Web UI at `http://YOUR_SERVER_IP:3000`
2. **Set Backend URL**: Enter `http://YOUR_SERVER_IP:8000` → Click Test
3. Click **Continue to Dashboard**
4. Go to **Configuration** page for additional settings
5. **Set MegaLLM API Key** (optional): Enter your API key for AI features

### Environment Variables

All configuration is done via environment variables in the `.env` file located at `/opt/ctf-compass/ctf-autopilot/infra/.env`.

#### CORS Configuration (Important!)

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ORIGINS` | `*` | Allowed origins for CORS |

**Examples:**
```bash
# Allow all origins (default, easiest for local deployment)
CORS_ORIGINS=*

# Specific origins (recommended for production)
CORS_ORIGINS=http://192.168.1.100:3000,http://localhost:3000

# JSON array format
CORS_ORIGINS=["http://192.168.1.100:3000","http://localhost:3000"]
```

#### AI Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MEGALLM_API_KEY` | *(empty)* | API key from [ai.megallm.io](https://ai.megallm.io). AI features disabled if not set |
| `MEGALLM_MODEL` | `llama3.3-70b-instruct` | AI model to use |

#### Database Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_HOST` | `postgres` | PostgreSQL hostname |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_USER` | `ctfautopilot` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `ctfautopilot` | PostgreSQL password |
| `POSTGRES_DB` | `ctfautopilot` | PostgreSQL database name |

#### Sandbox Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_UPLOAD_SIZE_MB` | `200` | Maximum upload size in MB |
| `SANDBOX_TIMEOUT_SECONDS` | `60` | Sandbox timeout per command |
| `SANDBOX_MEMORY_LIMIT` | `512m` | Sandbox memory limit |
| `SANDBOX_CPU_LIMIT` | `1` | Sandbox CPU limit |

---

## 💡 Troubleshooting

### CORS Issues

1. **Use the built-in CORS Tester**: `http://YOUR_SERVER_IP:3000/cors-tester`
2. **Check browser origin**: The tester shows your current origin
3. **Verify CORS_ORIGINS**: Must include your frontend URL
4. **Restart backend**: After changing `.env`

### Check service status
```bash
docker compose ps
docker compose logs api
```

### Test API health
```bash
curl http://localhost:8000/api/health
```

### Full reset
```bash
docker compose down -v --rmi local
docker compose up -d --build
```

---

## 📚 More Documentation

- [QUICK_START.md](QUICK_START.md) - Quick start guide
- [docs/USAGE.md](docs/USAGE.md) - User guide
- [docs/DEBUG.md](docs/DEBUG.md) - Troubleshooting
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - System architecture
- [docs/SECURITY.md](docs/SECURITY.md) - Security documentation
- [docs/RUNBOOK.md](docs/RUNBOOK.md) - Operations guide

---

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

**GitHub:** [github.com/huynhthanhthao-uel/ctf-compass](https://github.com/huynhthanhthao-uel/ctf-compass)
