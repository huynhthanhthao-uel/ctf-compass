# CTF Autopilot Analyzer

A production-grade, security-first, local-only CTF challenge analyzer and writeup generator. This tool ingests challenge descriptions and attached files, runs deterministic offline analysis in an isolated Docker sandbox, extracts evidence and candidate flags, and generates professional writeups.

## ⚡ Quick Start (Ubuntu 24.04 LTS)

```bash
# One-command install and run
curl -fsSL https://raw.githubusercontent.com/your-org/ctf-autopilot/main/infra/scripts/install_ubuntu_24.04.sh | bash
```

Or manually:

```bash
# Clone the repository
git clone https://github.com/your-org/ctf-autopilot.git
cd ctf-autopilot

# Copy environment file and configure
cp .env.example .env
# Edit .env and add your MEGALLM_API_KEY

# Run with Docker Compose
./infra/scripts/prod_up.sh
```

Access the application at `http://localhost:3000`

## 🔐 Security First

This tool is designed for **offline, local-only analysis**. It does NOT:
- Connect to remote challenge servers
- Perform automatic exploitation
- Execute arbitrary network requests from sandboxes

All analysis runs in isolated Docker containers with:
- Network disabled (`--network=none`)
- Read-only filesystems where possible
- CPU/memory/time limits
- Non-root user execution
- Seccomp/AppArmor profiles

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                    │
│                    localhost:3000                            │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTPS
┌─────────────────────▼───────────────────────────────────────┐
│                    Nginx Reverse Proxy                       │
│                    (TLS Termination)                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                    FastAPI Backend                           │
│                    localhost:8000                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  Auth       │  │  Jobs       │  │  Writeup    │          │
│  │  Service    │  │  Service    │  │  Generator  │          │
│  └─────────────┘  └──────┬──────┘  └─────────────┘          │
└──────────────────────────┼──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Celery Workers                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  Analysis   │  │  Sandbox    │  │  Evidence   │          │
│  │  Tasks      │  │  Runner     │  │  Extractor  │          │
│  └─────────────┘  └──────┬──────┘  └─────────────┘          │
└──────────────────────────┼──────────────────────────────────┘
                           │ Docker API
┌──────────────────────────▼──────────────────────────────────┐
│              Sandbox Container (--network=none)              │
│  Tools: strings, file, binwalk, exiftool, readelf, etc.     │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Repository Structure

```
ctf-autopilot/
├── apps/
│   ├── web/                 # Next.js frontend
│   └── api/                 # FastAPI backend
├── packages/
│   └── shared/              # Shared types/schemas
├── sandbox/
│   ├── image/               # Sandbox Dockerfile
│   ├── profiles/            # Seccomp/AppArmor profiles
│   └── playbooks/           # Analysis playbooks per file type
├── infra/
│   ├── docker-compose.yml
│   ├── nginx/               # Reverse proxy config
│   └── scripts/             # Install and run scripts
├── docs/
│   ├── ARCHITECTURE.md
│   ├── SECURITY.md
│   ├── THREAT_MODEL.md
│   ├── API.md
│   └── RUNBOOK.md
├── .github/
│   └── workflows/
│       └── ci.yml
├── .env.example
├── .gitignore
├── LICENSE
└── README.md
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MEGALLM_API_KEY` | API key for MegaLLM writeup generation | Yes |
| `ADMIN_PASSWORD` | Password for local admin login | Yes |
| `SECRET_KEY` | JWT signing key (auto-generated if not set) | No |
| `MAX_UPLOAD_SIZE_MB` | Maximum upload size (default: 200) | No |
| `SANDBOX_TIMEOUT_SECONDS` | Per-command timeout (default: 60) | No |
| `POSTGRES_PASSWORD` | Database password | Yes |
| `REDIS_PASSWORD` | Redis password | No |

### TLS Configuration

#### Development (Self-Signed)
```bash
./infra/scripts/generate_self_signed_cert.sh
docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d
```

#### Production (Let's Encrypt)
See [docs/RUNBOOK.md](docs/RUNBOOK.md#tls-configuration) for Let's Encrypt setup.

## 🛠️ Development

```bash
# Start development environment
./infra/scripts/dev_up.sh

# Run backend tests
cd apps/api && pytest

# Run frontend tests
cd apps/web && npm test

# Run linting
cd apps/api && ruff check .
cd apps/web && npm run lint
```

## 📖 Documentation

- [Architecture](docs/ARCHITECTURE.md) - System design and component overview
- [Security](docs/SECURITY.md) - Security controls and best practices
- [Threat Model](docs/THREAT_MODEL.md) - Security threat analysis
- [API Reference](docs/API.md) - REST API documentation
- [Runbook](docs/RUNBOOK.md) - Operations and troubleshooting guide

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

## ⚠️ Disclaimer

This tool is intended for:
- Post-competition CTF writeup generation
- Offline analysis of challenge files you have permission to analyze
- Educational and learning purposes

**DO NOT** use this tool to:
- Attack systems without authorization
- Analyze files you don't have permission to access
- Circumvent security controls
