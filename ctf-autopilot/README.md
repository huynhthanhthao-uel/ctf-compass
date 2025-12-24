# CTF Compass

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Ubuntu 24.04](https://img.shields.io/badge/Ubuntu-24.04%20LTS-E95420?logo=ubuntu)](https://ubuntu.com/)
[![Docker](https://img.shields.io/badge/Docker-Required-2496ED?logo=docker)](https://www.docker.com/)

A production-grade, security-first, local-only CTF challenge analyzer and writeup generator. This tool ingests challenge descriptions and attached files, runs deterministic offline analysis in an isolated Docker sandbox, extracts evidence and candidate flags, and generates professional writeups.

**Repository:** [github.com/huynhtrungcipp/ctf-compass](https://github.com/huynhtrungcipp/ctf-compass)

---

## ⚡ Quick Start (Ubuntu 24.04 LTS)

### One-Command Installation

```bash
curl -fsSL https://raw.githubusercontent.com/huynhtrungcipp/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash
```

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/huynhtrungcipp/ctf-compass.git
cd ctf-compass

# Copy environment file and configure
cp .env.example .env
nano .env  # Add your MEGALLM_API_KEY

# Start services
./ctf-autopilot/infra/scripts/prod_up.sh
```

### Access

- **Web UI:** `http://localhost:3000`
- **API:** `http://localhost:8000`

---

## 🔄 System Update

```bash
# Check for updates
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh --check

# Perform update
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh
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
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP/HTTPS
┌─────────────────────▼───────────────────────────────────────┐
│                    Nginx Reverse Proxy                       │
│                    (TLS Termination)                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                    FastAPI Backend                           │
│                    localhost:8000                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │    Auth     │  │    Jobs     │  │   Writeup   │          │
│  │   Service   │  │   Service   │  │  Generator  │          │
│  └─────────────┘  └──────┬──────┘  └─────────────┘          │
└──────────────────────────┼──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Celery Workers                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  Analysis   │  │   Sandbox   │  │  Evidence   │          │
│  │    Tasks    │  │   Runner    │  │  Extractor  │          │
│  └─────────────┘  └──────┬──────┘  └─────────────┘          │
└──────────────────────────┼──────────────────────────────────┘
                           │ Docker API
┌──────────────────────────▼──────────────────────────────────┐
│              Sandbox Container (--network=none)              │
│  Tools: strings, file, binwalk, exiftool, readelf, etc.     │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```
ctf-compass/
├── ctf-autopilot/
│   ├── apps/
│   │   ├── web/                 # Frontend application
│   │   └── api/                 # FastAPI backend
│   ├── sandbox/
│   │   ├── image/               # Sandbox Dockerfile
│   │   └── profiles/            # Seccomp/AppArmor profiles
│   ├── infra/
│   │   ├── docker-compose.yml
│   │   ├── nginx/               # Reverse proxy config
│   │   └── scripts/             # Install, update, and run scripts
│   ├── docs/
│   │   ├── ARCHITECTURE.md
│   │   ├── SECURITY.md
│   │   ├── DEBUG.md
│   │   ├── USAGE.md
│   │   └── RUNBOOK.md
│   ├── .env.example
│   └── README.md
├── src/                         # Lovable frontend source
├── package.json
└── README.md
```

---

## 🔧 Configuration

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `MEGALLM_API_KEY` | API key from [ai.megallm.io](https://ai.megallm.io) |
| `ADMIN_PASSWORD` | Password for admin login |
| `POSTGRES_PASSWORD` | Database password |

### Optional Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | Auto-generated | JWT signing key |
| `MAX_UPLOAD_SIZE_MB` | 200 | Maximum file upload size |
| `SANDBOX_TIMEOUT_SECONDS` | 60 | Per-command timeout |
| `MEGALLM_MODEL` | llama3.3-70b-instruct | Default AI model |

### TLS Configuration

#### Development (Self-Signed)
```bash
./ctf-autopilot/infra/scripts/generate_self_signed_cert.sh
ENABLE_TLS=true ./ctf-autopilot/infra/scripts/prod_up.sh
```

#### Production (Let's Encrypt)
See [docs/RUNBOOK.md](ctf-autopilot/docs/RUNBOOK.md#tls-configuration)

---

## 🛠️ Development

```bash
# Start development environment
./ctf-autopilot/infra/scripts/dev_up.sh

# Run with Lovable
npm run dev

# Run backend tests
cd ctf-autopilot/apps/api && pytest

# Run linting
cd ctf-autopilot/apps/api && ruff check .
```

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](ctf-autopilot/docs/ARCHITECTURE.md) | System design overview |
| [SECURITY.md](ctf-autopilot/docs/SECURITY.md) | Security controls |
| [DEBUG.md](ctf-autopilot/docs/DEBUG.md) | Troubleshooting guide |
| [USAGE.md](ctf-autopilot/docs/USAGE.md) | User guide |
| [RUNBOOK.md](ctf-autopilot/docs/RUNBOOK.md) | Operations guide |

---

## 🚀 Useful Commands

```bash
# View logs
cd /opt/ctf-compass && docker compose logs -f

# Stop services
cd /opt/ctf-compass && docker compose down

# Restart services
cd /opt/ctf-compass && docker compose restart

# Check status
cd /opt/ctf-compass && docker compose ps

# Update system
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh
```

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

**GitHub:** [github.com/huynhtrungcipp/ctf-compass](https://github.com/huynhtrungcipp/ctf-compass)
