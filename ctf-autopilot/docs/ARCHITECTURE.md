# Architecture

## Overview

CTF Compass is a monorepo containing a React/Vite frontend, FastAPI backend, and isolated Docker sandbox for secure file analysis.

**GitHub:** [github.com/huynhtrungcipp/ctf-compass](https://github.com/huynhtrungcipp/ctf-compass)

---

## System Components

### Frontend (React + Vite)

- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: React Query for server state
- **Features**:
  - Job creation wizard with drag-and-drop file upload
  - Real-time job status updates via polling
  - Settings page for API key and model configuration
  - System update management from UI
  - Evidence viewer with syntax highlighting
  - Markdown writeup renderer

### Backend (apps/api)

- **Framework**: FastAPI with Python 3.12
- **Validation**: Pydantic v2
- **Background Jobs**: Celery with Redis broker
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Authentication**: Session-based with Argon2 password hashing

#### Core Services

1. **AuthService**: Handles login, session management, CSRF protection
2. **JobService**: Manages job lifecycle (create, run, status, artifacts)
3. **SandboxService**: Orchestrates Docker container execution
4. **EvidenceService**: Extracts and scores flag candidates
5. **WriteupService**: Generates reports via MegaLLM API
6. **SystemService**: Handles updates, API key management, model config

#### API Endpoints

| Prefix | Description |
|--------|-------------|
| `/api/health` | Health check |
| `/api/auth/*` | Authentication (login, logout, session) |
| `/api/jobs/*` | Job management |
| `/api/config` | System configuration |
| `/api/system/*` | Updates, API key, models |

### Sandbox (sandbox/)

- **Base Image**: Ubuntu 24.04 with analysis tools
- **Isolation**:
  - Network disabled (`--network=none`)
  - Read-only root filesystem
  - Non-root user execution
  - Resource limits (CPU, memory, time)
  - Seccomp/AppArmor profiles

#### Allowed Tools

| Tool | Purpose |
|------|---------|
| `strings` | Extract printable strings |
| `file` | Identify file types |
| `exiftool` | Metadata extraction |
| `binwalk` | Firmware/binary analysis |
| `pdfinfo` | PDF metadata |
| `pdftotext` | PDF text extraction |
| `tshark` | Network capture analysis |
| `readelf` | ELF binary analysis |
| `objdump` | Disassembly |
| `xxd` | Hex dump |
| `base64` | Encoding/decoding |
| `unzip` | Archive extraction |

---

## Data Flow

```
1. User uploads challenge files via Web UI
   │
   ▼
2. Frontend calls POST /api/jobs with files
   │
   ▼
3. Backend validates files and stores them
   │
   ▼
4. Job queued in Celery (Redis broker)
   │
   ▼
5. Worker selects playbook based on file types
   │
   ▼
6. Sandbox container executes tools
   │
   ▼
7. Output captured and stored
   │
   ▼
8. Evidence extractor finds flag candidates
   │
   ▼
9. MegaLLM generates writeup from evidence
   │
   ▼
10. Report available in UI and for download
```

---

## Configuration Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Web UI Settings Page                                         │
│ - API Key input                                              │
│ - Model selection                                            │
│ - Update button                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ API Endpoints                                                │
│ POST /api/system/api-key    → Save to runtime + .env        │
│ POST /api/system/models     → Save model preferences         │
│ POST /api/system/update     → Stream update progress         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend Services                                             │
│ - Runtime config (in-memory)                                 │
│ - .env file (persistent)                                     │
│ - update.sh script execution                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Storage Layout

```
/opt/ctf-compass/
├── ctf-autopilot/
│   ├── apps/
│   │   ├── api/              # Backend source
│   │   └── web/              # Frontend Dockerfile
│   ├── docs/                 # Documentation
│   ├── infra/
│   │   ├── docker-compose.yml
│   │   ├── nginx/
│   │   └── scripts/          # Install, update scripts
│   └── sandbox/
│       └── image/            # Sandbox Dockerfile
├── data/
│   └── runs/
│       └── <job_id>/
│           ├── input/        # Uploaded files
│           ├── extracted/    # Extracted archives
│           ├── output/       # Tool outputs
│           ├── logs/         # Execution logs
│           ├── evidence.json # Extracted evidence
│           ├── flags.json    # Flag candidates
│           └── report.md     # Generated writeup
├── .env                      # Configuration
└── CREDENTIALS.txt           # Default credentials
```

---

## Security Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│ UNTRUSTED: User uploads, challenge files                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ VALIDATION LAYER                                             │
│ - File type validation                                       │
│ - Size limits (200MB default)                               │
│ - Path sanitization                                          │
│ - Zip-slip prevention                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ SANDBOX (Isolated Docker Container)                          │
│ - No network access                                          │
│ - Resource limits                                            │
│ - Allowlisted tools only                                     │
│ - Non-root execution                                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ TRUSTED: Backend services, database, MegaLLM API             │
└─────────────────────────────────────────────────────────────┘
```

---

## Scalability Considerations

- **Horizontal Scaling**: Multiple Celery workers can process jobs in parallel
- **Queue Priority**: Urgent jobs can use priority queues
- **Storage**: Artifacts can be moved to object storage for large deployments
- **Caching**: Redis caches frequently accessed job metadata

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Python 3.12, FastAPI, SQLAlchemy, Pydantic |
| Database | PostgreSQL 16 |
| Cache/Queue | Redis 7 |
| Task Queue | Celery |
| Container | Docker, Docker Compose |
| Reverse Proxy | Nginx |
| AI Integration | MegaLLM API |
