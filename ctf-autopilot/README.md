# CTF Compass

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Ubuntu 24.04](https://img.shields.io/badge/Ubuntu-24.04%20LTS-E95420?logo=ubuntu)](https://ubuntu.com/)
[![Docker](https://img.shields.io/badge/Docker-Required-2496ED?logo=docker)](https://www.docker.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Version](https://img.shields.io/badge/Version-1.2.0-blue)](https://github.com/huynhtrungpc01/ctf-compass)

A production-grade, security-first, local-only CTF challenge analyzer and writeup generator. This tool ingests challenge descriptions and attached files, runs deterministic offline analysis in an isolated Docker sandbox, extracts evidence and candidate flags, and generates professional writeups.

**Repository:** [github.com/huynhtrungpc01/ctf-compass](https://github.com/huynhtrungpc01/ctf-compass)

---

## ✨ Key Features

### Frontend (React + TypeScript)
- **Modern Dashboard**: Real-time job statistics with grid/list views
- **Full Autopilot**: One-click "Solve Challenge" button with AI-powered analysis
- **Netcat Terminal**: Interactive `nc host:port` connections for PWN challenges
- **AI Solve Scripts**: Auto-generate pwntools scripts using MegaLLM AI
- **Job Management**: Create, run, stop, and delete analysis jobs
- **Remote Connection**: Configure netcat host:port during job creation
- **Live Updates**: WebSocket-based progress tracking with animations
- **Backend URL Configuration**: Connect to Docker backend via Settings page
- **Demo Mode**: Full UI functionality with mock data when backend unavailable
- **Notification Center**: Real-time alerts with mark-as-read functionality
- **Backend Status**: Visual indicator (Demo Mode / Connected)
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
curl -fsSL https://raw.githubusercontent.com/huynhtrungpc01/ctf-compass/main/ctf-autopilot/infra/scripts/deploy.sh | bash
```

**Default password: `admin`**

### Ubuntu 24.04 Full Installation

```bash
curl -fsSL https://raw.githubusercontent.com/huynhtrungpc01/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash
```

### Installation Options

```bash
# Clean install (remove old installation first)
curl -fsSL https://raw.githubusercontent.com/huynhtrungpc01/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash -s -- --clean

# Force install (skip confirmation prompts)
curl -fsSL https://raw.githubusercontent.com/huynhtrungpc01/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash -s -- --force
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
3. **Configure Backend URL:** Go to Configuration → Enter `http://YOUR_SERVER_IP:8000` → Click Connect
4. **Configure API Key (Optional):** Enter MegaLLM API key for AI features
5. **Start analyzing!** Click "Solve Challenge" on any job

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

# Force deep cleanup and update (rebuild all containers)
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh --clean

# Update via Web UI
# Go to Configuration page → Click "Check Updates" → Click "Update Now"
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
curl -fsSL https://raw.githubusercontent.com/huynhtrungpc01/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash -s -- --clean-only

# Uninstall and purge backups
curl -fsSL https://raw.githubusercontent.com/huynhtrungpc01/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash -s -- --clean-only --purge
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
1. Login to the Web UI at `http://YOUR_SERVER_IP:3000`
2. Go to **Configuration** page (⚙️ icon)
3. **Set Backend URL**: Enter your Docker backend URL (e.g., `http://YOUR_SERVER_IP:8000`)
4. Click **Connect** to verify connection
5. **Set MegaLLM API Key** (optional): Enter your API key for AI features
6. Click **Save Changes**

### Backend URL Setup

The frontend connects directly to your Docker backend. You must configure the Backend URL:

1. **Via Web UI** (Recommended):
   - Go to Configuration page
   - Enter Backend URL: `http://YOUR_SERVER_IP:8000`
   - Click Connect to save

2. **URL Format**:
   - Local: `http://localhost:8000` or `http://127.0.0.1:8000`
   - Remote: `http://192.168.1.100:8000`
   - With HTTPS: `https://ctf.example.com:8000`

### Default Credentials

| Credential | Default Value |
|------------|---------------|
| `ADMIN_PASSWORD` | `admin` |
| `POSTGRES_PASSWORD` | `ctfautopilot` |
| `POSTGRES_USER` | `ctfautopilot` |

### Environment Variables

All configuration is done via environment variables in the `.env` file located at `/opt/ctf-compass/ctf-autopilot/.env`.

#### Required Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ADMIN_PASSWORD` | `admin` | Admin login password for the web UI |
| `POSTGRES_PASSWORD` | `ctfautopilot` | PostgreSQL database password |

#### AI Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MEGALLM_API_KEY` | *(empty)* | API key from [ai.megallm.io](https://ai.megallm.io). AI features disabled if not set |
| `MEGALLM_API_URL` | `https://ai.megallm.io/v1/chat/completions` | MegaLLM API endpoint URL |
| `MEGALLM_MODEL` | `llama3.3-70b-instruct` | AI model to use (llama3.3-70b, gemini-2.5-pro, etc.) |

#### Database Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_HOST` | `postgres` | PostgreSQL hostname (Docker service name) |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_USER` | `ctfautopilot` | PostgreSQL username |
| `POSTGRES_DB` | `ctfautopilot` | PostgreSQL database name |

#### Redis Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `redis` | Redis hostname (Docker service name) |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | *(empty)* | Redis password (optional) |

#### CORS Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ORIGINS` | `*` | Allowed origins for CORS. Formats: `*` (all), `http://a.com,http://b.com` (CSV), or JSON array |

**Examples:**
```bash
# Allow all origins (default, easiest for local deployment)
CORS_ORIGINS=*

# Specific origins (recommended for production)
CORS_ORIGINS=http://192.168.1.100:3000,http://localhost:3000

# JSON array format
CORS_ORIGINS=["http://192.168.1.100:3000","http://localhost:3000"]
```

#### Sandbox Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SANDBOX_TIMEOUT_SECONDS` | `60` | Maximum execution time per command |
| `SANDBOX_MEMORY_LIMIT` | `512m` | Memory limit for sandbox containers |
| `SANDBOX_CPU_LIMIT` | `1.0` | CPU limit for sandbox containers |
| `SANDBOX_IMAGE` | `ctf-autopilot-sandbox:latest` | Docker image for sandbox |

#### Upload Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_UPLOAD_SIZE_MB` | `200` | Maximum file upload size in MB |
| `ALLOWED_EXTENSIONS` | `.txt,.py,.c,.cpp,...` | Comma-separated list of allowed file extensions |

#### Rate Limiting

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_UPLOADS` | `10` | Max uploads per minute per session |
| `RATE_LIMIT_API` | `100` | Max API requests per minute per session |

#### Security & Session

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | *(auto-generated)* | JWT signing key. Auto-generated if not set |
| `SESSION_TIMEOUT_SECONDS` | `3600` | Session timeout (1 hour default) |
| `ENABLE_TLS` | `false` | Enable HTTPS with SSL certificates |

#### Paths

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_DIR` | `/data` | Base directory for persistent data |

#### Development

| Variable | Default | Description |
|----------|---------|-------------|
| `ENVIRONMENT` | `production` | Environment mode (`production` or `development`) |
| `DEBUG` | `false` | Enable debug mode (verbose logging) |

### Example .env File

```bash
# /opt/ctf-compass/ctf-autopilot/.env

# ===== REQUIRED =====
ADMIN_PASSWORD=your_secure_password
POSTGRES_PASSWORD=your_db_password

# ===== AI (Optional) =====
MEGALLM_API_KEY=your_megallm_api_key
MEGALLM_MODEL=llama3.3-70b-instruct

# ===== CORS =====
# For local deployment, use * or your specific IPs
CORS_ORIGINS=http://192.168.1.100:3000,http://localhost:3000

# ===== Security =====
SECRET_KEY=your_random_secret_key_here
SESSION_TIMEOUT_SECONDS=3600

# ===== Sandbox =====
SANDBOX_TIMEOUT_SECONDS=60
SANDBOX_MEMORY_LIMIT=512m
MAX_UPLOAD_SIZE_MB=200

# ===== Rate Limiting =====
RATE_LIMIT_UPLOADS=10
RATE_LIMIT_API=100
```

---

## 🛠️ Development

```bash
# Start development environment (PostgreSQL + Redis only)
docker compose -f ctf-autopilot/infra/docker-compose.dev.yml up -d

# Run API server
cd ctf-autopilot/apps/api && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run frontend with Vite (hot reload)
npm run dev

# Run backend tests
cd ctf-autopilot/apps/api && pytest

# Run linting
cd ctf-autopilot/apps/api && ruff check .
```

### Frontend Operation Modes

The frontend supports multiple connection modes:

| Mode | Description | When Active |
|------|-------------|-------------|
| **Connected** | Full backend available | Backend URL configured and reachable |
| **Demo Mode** | Mock data, UI testing | No backend configured or unreachable |

Configure Backend URL in Settings → Configuration to switch from Demo Mode to Connected Mode.

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

**GitHub:** [github.com/huynhtrungpc01/ctf-compass](https://github.com/huynhtrungpc01/ctf-compass)
