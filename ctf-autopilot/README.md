# CTF Compass

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Ubuntu 24.04](https://img.shields.io/badge/Ubuntu-24.04%20LTS-E95420?logo=ubuntu)](https://ubuntu.com/)
[![Docker](https://img.shields.io/badge/Docker-Required-2496ED?logo=docker)](https://www.docker.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688?logo=fastapi)](https://fastapi.tiangolo.com/)

A production-grade, security-first, local-only CTF challenge analyzer and writeup generator. This tool ingests challenge descriptions and attached files, runs deterministic offline analysis in an isolated Docker sandbox, extracts evidence and candidate flags, and generates professional writeups.

**Repository:** [github.com/HaryLya/ctf-compass](https://github.com/HaryLya/ctf-compass)

---

## ✨ Key Features

### Frontend (React + TypeScript)
- **Modern Dashboard**: Real-time job statistics with grid/list views
- **Full Autopilot**: One-click "Solve Challenge" button with AI-powered analysis
- **Netcat Terminal**: Interactive `nc host:port` connections for PWN challenges
- **AI Solve Scripts**: Auto-generate pwntools scripts using Lovable AI
- **Job Management**: Create, run, stop, and delete analysis jobs
- **Remote Connection**: Configure netcat host:port during job creation
- **Live Updates**: WebSocket-based progress tracking with animations
- **Cloud Mode**: Seamless fallback to Lovable Cloud Edge Functions when backend unavailable
- **Demo Mode**: Full UI functionality with mock data
- **Notification Center**: Real-time alerts with mark-as-read functionality
- **Backend Status**: Visual indicator (Demo Mode / Cloud Mode / Connected)
- **Responsive Design**: Works on desktop and mobile devices

### Backend (FastAPI + Celery + Cloud)
- **Hybrid Architecture**: Local backend with Cloud fallback
- **Secure Analysis**: Sandboxed Docker containers with network isolation
- **AI Integration**: Lovable AI (Gemini 2.5) / MegaLLM API for intelligent analysis
- **Real-time WebSocket**: Live job updates pushed to clients
- **RESTful API**: Complete job and configuration management
- **Background Processing**: Celery workers for async job execution

### Cloud Edge Functions
- **`ai-analyze`**: AI-powered CTF challenge analysis with category-specific playbooks
- **`sandbox-terminal`**: Simulated terminal for challenge file exploration + netcat
- **`detect-category`**: Automatic challenge categorization (Crypto, Pwn, Web, Rev, Forensics)
- **`ai-solve-script`**: Generate pwntools solve scripts from netcat interactions

---

## ⚡ Quick Start

### 🚀 One-Line Deploy (Simplest)

```bash
curl -fsSL https://raw.githubusercontent.com/HaryLya/ctf-compass/main/ctf-autopilot/infra/scripts/deploy.sh | bash
```

**Default password: `admin`**

### Ubuntu 24.04 Full Installation

```bash
curl -fsSL https://raw.githubusercontent.com/HaryLya/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash
```

### Installation Options

```bash
# Clean install (remove old installation first)
curl -fsSL https://raw.githubusercontent.com/HaryLya/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash -s -- --clean

# Force install (skip confirmation prompts)
curl -fsSL https://raw.githubusercontent.com/HaryLya/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash -s -- --force
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
2. **Login with password:** `admin`
3. **Configure API Key (Optional):** Go to Configuration page for AI features
4. **Start analyzing!** Click "Solve Challenge" on any job

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

## 🔄 System Update

```bash
# Check for updates
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh --check

# Perform update
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh

# Deep cleanup and update
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

# Force purge (no prompts, removes everything)
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/uninstall.sh --force --purge
```

### Using Install Script (Alternative)

```bash
# Uninstall only (no reinstall)
curl -fsSL https://raw.githubusercontent.com/HaryLya/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash -s -- --clean-only

# Uninstall and purge backups
curl -fsSL https://raw.githubusercontent.com/HaryLya/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash -s -- --clean-only --purge
```

### What Gets Cleaned

| Component | `--clean` | `--purge` |
|-----------|-----------|-----------|
| Docker containers/images/volumes | ✅ | ✅ |
| Installation directory | ✅ | ✅ |
| Log files | ✅ | ✅ |
| Systemd services | ✅ | ✅ |
| Cron jobs | ✅ | ✅ |
| Temp files | ✅ | ✅ |
| Configuration files | ✅ | ✅ |
| **Backups** | ❌ Preserved | ✅ Removed |
| **User data exports** | ❌ Preserved | ✅ Removed |

### Manual Cleanup (If Needed)

```bash
# Stop all services
sudo docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml down -v

# Remove all data and files
sudo rm -rf /opt/ctf-compass /opt/ctf-compass-backups
sudo rm -f /var/log/ctf-compass-*.log

# Remove Docker images
sudo docker rmi $(docker images | grep -E 'ctf[-_]compass|ctf[-_]autopilot' | awk '{print $3}') 2>/dev/null || true

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
│  │  Dashboard  │  │  Job Create │  │   Config    │          │
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
│  Local Backend    │   │    Cloud Mode     │
│  (FastAPI)        │   │  (Edge Functions) │
│  localhost:8000   │   │                   │
│  ┌─────────────┐  │   │  ┌─────────────┐  │
│  │    Auth     │  │   │  │ ai-analyze  │  │
│  │   Service   │  │   │  │   Function  │  │
│  └─────────────┘  │   │  └─────────────┘  │
│  ┌─────────────┐  │   │  ┌─────────────┐  │
│  │    Jobs     │  │   │  │  sandbox-   │  │
│  │   Service   │  │   │  │  terminal   │  │
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
│   │           ├── routers/     # API endpoints (auth, jobs, system, ws, ai)
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
│   │       ├── update.sh
│   │       ├── uninstall.sh
│   │       ├── prod_up.sh
│   │       └── dev_up.sh
│   └── docs/
│       ├── ARCHITECTURE.md
│       ├── SECURITY.md
│       ├── DEBUG.md
│       ├── USAGE.md
│       └── RUNBOOK.md
├── src/                         # React frontend source
│   ├── components/
│   │   ├── jobs/
│   │   │   ├── FullAutopilot.tsx    # One-click solve component
│   │   │   ├── AutopilotPanel.tsx   # Manual autopilot controls
│   │   │   ├── SandboxTerminal.tsx  # Interactive terminal
│   │   │   ├── NetcatPanel.tsx      # Netcat terminal with AI scripts
│   │   │   ├── SolveScriptGenerator.tsx  # AI script generation
│   │   │   └── JobCard.tsx
│   │   ├── layout/              # AppLayout, navigation
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── BackendStatus.tsx    # Demo/Cloud/Connected indicator
│   │   └── NotificationDropdown.tsx
│   ├── hooks/
│   │   ├── use-auth.tsx
│   │   ├── use-jobs.tsx         # Job CRUD with mock fallback
│   │   ├── use-backend-status.ts # Unified mode detection
│   │   └── use-websocket.ts
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── JobCreate.tsx        # Job form with netcat support
│   │   ├── JobDetail.tsx        # Full Autopilot + Netcat tab
│   │   ├── Configuration.tsx
│   │   └── Login.tsx
│   └── lib/
│       ├── api.ts               # API + netcat functions
│       ├── mock-data.ts
│       ├── ctf-tools.ts         # Tool definitions
│       └── types.ts
├── supabase/
│   ├── functions/
│   │   ├── ai-analyze/          # AI analysis edge function
│   │   ├── sandbox-terminal/    # Terminal + netcat simulation
│   │   ├── detect-category/     # Auto category detection
│   │   └── ai-solve-script/     # AI pwntools script generator
│   └── config.toml
├── package.json
└── README.md
```

---

## 🔧 Configuration

### Web UI Configuration (Recommended)

After installation:
1. Login to the Web UI
2. Go to **Configuration** page
3. Enter your **MegaLLM API key** (optional for Cloud Mode)
4. Configure model settings if needed

### Default Credentials

| Credential | Default Value |
|------------|---------------|
| `ADMIN_PASSWORD` | `admin` |
| `POSTGRES_PASSWORD` | `ctfautopilot` |
| `POSTGRES_USER` | `ctfautopilot` |

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MEGALLM_API_KEY` | API key from [ai.megallm.io](https://ai.megallm.io) | No (Cloud Mode fallback) |
| `ADMIN_PASSWORD` | Admin login password | Default: `admin` |

### Optional Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_UPLOAD_SIZE_MB` | 200 | Maximum file upload size |
| `SANDBOX_TIMEOUT_SECONDS` | 60 | Per-command timeout |
| `MEGALLM_MODEL` | llama3.3-70b-instruct | AI model to use |

---

## 🛠️ Development

```bash
# Start development environment
./ctf-autopilot/infra/scripts/dev_up.sh

# Run frontend with Vite (hot reload)
npm run dev

# Run backend tests
cd ctf-autopilot/apps/api && pytest

# Run linting
cd ctf-autopilot/apps/api && ruff check .
```

### Frontend Development

The frontend supports multiple modes:
- **Connected Mode**: Full backend available
- **Cloud Mode**: Backend unavailable, using Edge Functions
- **Demo Mode**: No backend/cloud, using mock data

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design with Cloud Mode |
| [SECURITY.md](docs/SECURITY.md) | Security controls |
| [DEBUG.md](docs/DEBUG.md) | Troubleshooting guide with Cloud debugging |
| [USAGE.md](docs/USAGE.md) | User guide with Full Autopilot |
| [RUNBOOK.md](docs/RUNBOOK.md) | Operations guide |

---

## 🚀 Makefile Commands

CTF Compass includes a Makefile for easy management. Run from `/opt/ctf-compass/ctf-autopilot/`:

```bash
cd /opt/ctf-compass/ctf-autopilot

# Show all available commands
make help

# Service Management
make status      # Show container status
make start       # Start all services
make stop        # Stop all services
make restart     # Restart all services

# Logs
make logs        # View all logs
make logs-api    # View API logs only
make logs-worker # View Worker logs only
make logs-web    # View Web logs only

# Updates & Builds
make update      # Pull latest code and rebuild
make rebuild     # Rebuild all (no cache)
make rebuild-api # Rebuild API only

# Database
make backup      # Create database backup
make restore     # Restore from latest backup
make shell-db    # Open PostgreSQL shell

# Debugging
make health      # Check API health
make shell-api   # Open API container shell

# Cleanup
make clean       # Remove unused Docker resources
```

## 💾 Database Backup

### Manual Backup

```bash
# Create backup
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/backup.sh

# List backups
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/backup.sh --list

# Restore from latest
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/backup.sh --restore

# Restore from specific file
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/backup.sh --restore-file /path/to/backup.sql.gz
```

### Setup Automatic Daily Backup (Cron)

```bash
# Setup cron job (runs daily at 2 AM, keeps 7 days)
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/backup.sh --setup-cron

# View backup logs
tail -f /var/log/ctf-compass-backup.log
```

Backups are stored in `/opt/ctf-compass/backups/` with automatic 7-day rotation.

## 📊 Monitoring (Prometheus + Grafana)

CTF Compass includes a complete monitoring stack with Prometheus, Grafana, and Alertmanager.

### Start Monitoring Stack

```bash
cd /opt/ctf-compass/ctf-autopilot

# Setup (first time)
make monitor-setup

# Start monitoring
make monitor-start

# Show access URLs
make monitor-urls

# Stop monitoring
make monitor-stop
```

### Monitoring URLs

| Service | URL | Description |
|---------|-----|-------------|
| **Grafana** | `http://YOUR_IP:3001` | Dashboards & visualization |
| **Prometheus** | `http://YOUR_IP:9090` | Metrics & queries |
| **Alertmanager** | `http://YOUR_IP:9093` | Alert management |

Grafana credentials: `admin` / (see CREDENTIALS.txt)

### Features

- **System Overview Dashboard**: CPU, Memory, Disk usage
- **Container Metrics**: Per-container resource usage
- **Database Monitoring**: PostgreSQL connections, performance
- **Cache Monitoring**: Redis memory, operations/sec
- **Auto Alerts**: Container down, high resource usage, disk space

## 🔔 Health Check & Alerts

Automatic health monitoring with Telegram/Discord/Slack notifications.

### Setup Alerts

```bash
cd /opt/ctf-compass/ctf-autopilot

# Interactive setup for Telegram/Discord/Slack
make health-setup

# Test notifications
make health-test

# Setup cron job (runs every 5 minutes)
make health-cron

# Manual health check
make health-check
```

### Supported Notification Channels

- **Telegram**: Bot token + Chat ID
- **Discord**: Webhook URL
- **Slack**: Webhook URL

Alerts are sent when:
- ✅ Service goes DOWN
- ✅ Service RECOVERS

### Access URLs

| Service | URL | Description |
|---------|-----|-------------|
| **Web UI** | `http://YOUR_IP:3000` | Main application |
| **API** | `http://YOUR_IP:8000/api/` | Backend REST API |
| **API Health** | `http://YOUR_IP:8000/api/health` | Health check endpoint |
| **API Docs** | `http://YOUR_IP:8000/docs` | Swagger documentation |
| **Grafana** | `http://YOUR_IP:3001` | Monitoring dashboards |
| **Prometheus** | `http://YOUR_IP:9090` | Metrics server |

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

---

## ⚠️ Disclaimer

This tool is intended for:
- ✅ Post-competition CTF writeup generation
- ✅ Offline analysis of challenge files you have permission to analyze
- ✅ Educational and learning purposes

**DO NOT** use this tool to:
- ❌ Attack systems without authorization
- ❌ Analyze files you don't have permission to access
- ❌ Circumvent security controls

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

**GitHub:** [github.com/HaryLya/ctf-compass](https://github.com/HaryLya/ctf-compass)
