# CTF Compass

**AI-powered CTF challenge analyzer with sandboxed execution environment.**

[![GitHub](https://img.shields.io/badge/GitHub-huynhthanhthao--uel%2Fctf--compass-blue?logo=github)](https://github.com/huynhthanhthao-uel/ctf-compass)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Ubuntu 24.04](https://img.shields.io/badge/Ubuntu-24.04%20LTS-E95420?logo=ubuntu)](https://ubuntu.com/)
[![Docker](https://img.shields.io/badge/Docker-Required-2496ED?logo=docker)](https://www.docker.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi)](https://fastapi.tiangolo.com/)

---

## ✨ Features

- **AI-Powered Analysis**: Automated CTF challenge analysis using Lovable AI / MegaLLM API
- **Full Autopilot**: One-click "Solve Challenge" with 4-phase automated solving
- **Netcat Terminal**: Interactive `nc` connections for PWN/remote challenges
- **AI Solve Scripts**: Auto-generate pwntools scripts for netcat challenges
- **Sandboxed Execution**: Secure Docker containers with network isolation
- **Modern Web UI**: React 18 + TypeScript + Tailwind CSS + shadcn/ui
- **Real-time Updates**: WebSocket-based live job status and progress
- **Job Management**: Create, run, stop, and delete analysis jobs
- **Cloud Mode**: Seamless Lovable Cloud Edge Functions when backend unavailable
- **Demo Mode**: Full UI functionality without backend (mock data)
- **Notification System**: Real-time alerts for job completions and system events
- **Professional Writeups**: AI-generated CTF writeups with step-by-step solutions

---

## 🚀 Quick Deploy

### One-Line Deploy (Simplest)

```bash
curl -fsSL https://raw.githubusercontent.com/huynhthanhthao-uel/ctf-compass/main/ctf-autopilot/infra/scripts/deploy.sh | bash
```

**🔑 Default Password: `admin`**

### Full Installation (Ubuntu 24.04)

```bash
curl -fsSL https://raw.githubusercontent.com/huynhthanhthao-uel/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash
```

### Installation Options

```bash
# Clean install (remove old installation first)
curl -fsSL https://raw.githubusercontent.com/huynhthanhthao-uel/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash -s -- --clean

# Complete purge and reinstall
curl -fsSL https://raw.githubusercontent.com/huynhthanhthao-uel/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash -s -- --clean --purge
```

| Option | Description |
|--------|-------------|
| `--clean` | Remove old installation before installing |
| `--clean-only` | Only cleanup, don't install (uninstall) |
| `--purge` | Remove everything including backups |
| `--force` | Skip confirmation prompts |
| `--no-start` | Don't start services after install |

### Post-Installation

1. **Access Web UI:** `http://YOUR_SERVER_IP:3000`
2. **Login with password:** `admin`
3. **Configure API Key (Optional):** Go to Configuration page for AI features
4. **Start analyzing CTF challenges!**

---

## 📋 Requirements

| Requirement | Specification |
|-------------|---------------|
| **OS** | Ubuntu 24.04 LTS (recommended) |
| **Docker** | Engine 24.0+ with Compose v2.20+ |
| **RAM** | 4GB minimum, 8GB recommended |
| **Disk** | 20GB minimum |
| **API Key** | MegaLLM API key from [ai.megallm.io](https://ai.megallm.io) |

---

## 🖥️ Web Interface

### Dashboard
- **Statistics Cards**: Total jobs, running, completed, failed counts
- **Job List**: Grid/list view with search functionality
- **Status Badges**: Real-time job status with Live/Cloud/Demo mode indicator
- **Quick Actions**: Run, stop, delete jobs directly from cards

### Job Management
- **Create**: Upload files, set flag format, add descriptions, configure netcat
- **Remote Connection (nc)**: Enter host:port for PWN/remote challenges
- **Monitor**: Real-time progress with WebSocket updates
- **Stop**: Cancel running analyses instantly
- **Delete**: Remove completed/failed jobs with confirmation

### Netcat Terminal
- **Interactive Connection**: Connect to remote CTF servers
- **Send/Receive**: Real-time message exchange
- **AI Solve Scripts**: Auto-generate pwntools scripts from interactions
- **Flag Detection**: Automatic flag extraction from responses

### Notifications
- **Real-time Alerts**: Job completions, errors, system updates
- **Mark as Read**: Individual or bulk read status
- **Clear History**: Delete old notifications

---

## 🔧 Operations

### Start/Stop Services

```bash
# Start services
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml up -d

# Stop services
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml down

# Restart services
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml restart

# Check status
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml ps
```

### View Logs

```bash
# All services
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml logs -f

# Specific service (shorthand)
docker logs ctf_compass_api --tail 100 -f
docker logs ctf_compass_worker --tail 100 -f
docker logs ctf_compass_web --tail 100 -f
```

### Quick Update

```bash
# Fix git ownership (if needed)
sudo git config --global --add safe.directory /opt/ctf-compass

# Pull and rebuild
cd /opt/ctf-compass && sudo git pull && sudo docker compose -f ctf-autopilot/infra/docker-compose.yml up -d --build
```

### Access URLs

| Service | URL | Description |
|---------|-----|-------------|
| **Web UI** | `http://YOUR_IP:3000` | Main application |
| **API** | `http://YOUR_IP:8000/api/` | REST API |
| **API Health** | `http://YOUR_IP:8000/api/health` | Health check |
| **API Docs** | `http://YOUR_IP:8000/docs` | Swagger docs |
| **Grafana** | `http://YOUR_IP:3001` | Monitoring dashboard |
| **Prometheus** | `http://YOUR_IP:9090` | Metrics server |

### Makefile Commands

```bash
cd /opt/ctf-compass/ctf-autopilot

make help           # Show all commands
make status         # Service status
make logs           # View logs
make update         # Pull & rebuild
make backup         # Database backup
make health-setup   # Configure Telegram/Discord alerts
make monitor-start  # Start Prometheus + Grafana
```

### System Update

```bash
# Check for updates
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh --check

# Perform update
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh

# Deep cleanup and update
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh --clean
```

### Database Backup

```bash
# Manual backup
make backup

# Setup daily auto-backup (2 AM, keeps 7 days)
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/backup.sh --setup-cron

# List backups
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/backup.sh --list
```

### Health Check & Alerts

```bash
# Configure Telegram/Discord/Slack alerts
make health-setup

# Run single health check
make health-check

# Setup cron (every 5 minutes)
make health-cron
```

### Monitoring Stack

```bash
# Start Prometheus + Grafana + Alertmanager
make monitor-start

# Show URLs
make monitor-urls

# Stop
make monitor-stop
```

### Uninstall

```bash
# Interactive uninstall (keeps backups)
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/uninstall.sh

# Force uninstall (no prompts)
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/uninstall.sh --force

# Complete purge (removes backups too)
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/uninstall.sh --purge

# Uninstall via install script
curl -fsSL https://raw.githubusercontent.com/huynhthanhthao-uel/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash -s -- --clean-only --purge
```

---

## 🔐 Security

- **Isolated Sandbox:** All analysis runs in Docker containers with `--network=none`
- **Resource Limits:** CPU, memory, and time limits on all sandboxed operations
- **Session-based Auth:** Secure session management with CSRF protection
- **API Key Protection:** Keys stored securely, never exposed in logs or UI

### Default Credentials

| Credential | Default Value |
|------------|---------------|
| `ADMIN_PASSWORD` | `admin` |
| `POSTGRES_PASSWORD` | `ctfautopilot` |
| `POSTGRES_USER` | `ctfautopilot` |

### Security Checklist

- [ ] Change `ADMIN_PASSWORD` if deploying publicly
- [ ] Enable TLS for public deployments
- [ ] Review firewall rules (UFW)

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Architecture](ctf-autopilot/docs/ARCHITECTURE.md) | System design and component overview |
| [Security](ctf-autopilot/docs/SECURITY.md) | Security controls and best practices |
| [Usage Guide](ctf-autopilot/docs/USAGE.md) | User guide for the web interface |
| [Debug Guide](ctf-autopilot/docs/DEBUG.md) | Troubleshooting common issues |
| [Runbook](ctf-autopilot/docs/RUNBOOK.md) | Operations and maintenance guide |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Frontend (React/Vite)                      │
│                    localhost:3000                            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │Dashboard│ │JobCreate│ │JobDetail│ │ Config  │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP/WebSocket
┌─────────────────────▼───────────────────────────────────────┐
│                    FastAPI Backend                           │
│                    localhost:8000                            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │  Auth   │ │  Jobs   │ │ System  │ │WebSocket│           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                    Celery Workers                            │
│              (Background Job Processing)                     │
└─────────────────────┬───────────────────────────────────────┘
                      │ Docker API
┌─────────────────────▼───────────────────────────────────────┐
│              Sandbox Container (--network=none)              │
│  Tools: strings, file, binwalk, exiftool, readelf, etc.     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| **State** | React Query, React Context, WebSocket |
| **Backend** | Python 3.12, FastAPI, Celery, SQLAlchemy |
| **Database** | PostgreSQL 16, Redis 7 |
| **Infrastructure** | Docker, Docker Compose, Nginx |
| **AI** | Lovable AI (Gemini 2.5), MegaLLM API |
| **Cloud** | Lovable Cloud Edge Functions (ai-analyze, sandbox-terminal, ai-solve-script) |

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Demo Mode" on login | Backend not running - check `docker compose ps` |
| Job stuck in "Queued" | Worker issue - `docker compose restart worker` |
| Stop/Delete not working | Refresh page, check browser console |
| API Key not saving | Check backend connectivity and permissions |
| File upload fails | Check file size limit (200MB) and disk space |
| Notifications not showing | Clear browser cache, check JavaScript console |

For detailed troubleshooting, see [DEBUG.md](ctf-autopilot/docs/DEBUG.md).

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📞 Support

- **GitHub Issues:** [github.com/huynhthanhthao-uel/ctf-compass/issues](https://github.com/huynhthanhthao-uel/ctf-compass/issues)
- **Documentation:** [ctf-autopilot/docs/](ctf-autopilot/docs/)
