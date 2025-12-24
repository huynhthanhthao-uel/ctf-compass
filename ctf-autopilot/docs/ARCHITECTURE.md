# CTF Compass - Architecture

## Overview

CTF Compass is a monorepo containing a React/Vite frontend, FastAPI backend, and isolated Docker sandbox for secure CTF challenge analysis.

**GitHub:** [github.com/huynhtrungcipp/ctf-compass](https://github.com/huynhtrungcipp/ctf-compass)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Browser                              │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTPS/WSS
┌─────────────────────────────▼───────────────────────────────────┐
│                    Nginx Reverse Proxy                           │
│                    (TLS Termination)                             │
│                    Port: 80/443                                  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          │                                       │
┌─────────▼─────────┐               ┌─────────────▼─────────────┐
│   Web Frontend    │               │      Backend API          │
│   (React/Vite)    │               │      (FastAPI)            │
│   Port: 3000      │               │      Port: 8000           │
│                   │               │                           │
│ • Dashboard       │    REST/WS    │ • Auth Service            │
│ • Job Create      │◄─────────────►│ • Job Service             │
│ • Job Detail      │               │ • System Service          │
│ • Configuration   │               │ • WebSocket Handler       │
│ • Notifications   │               │                           │
└───────────────────┘               └─────────────┬─────────────┘
                                                  │
                                    ┌─────────────┴─────────────┐
                                    │                           │
                          ┌─────────▼─────────┐       ┌─────────▼─────────┐
                          │    PostgreSQL     │       │      Redis        │
                          │    Database       │       │   Message Broker  │
                          │    Port: 5432     │       │   Port: 6379      │
                          └───────────────────┘       └─────────┬─────────┘
                                                                │
                                                      ┌─────────▼─────────┐
                                                      │   Celery Worker   │
                                                      │ (Background Jobs) │
                                                      └─────────┬─────────┘
                                                                │ Docker API
                                                      ┌─────────▼─────────┐
                                                      │  Sandbox Container │
                                                      │  --network=none   │
                                                      │  Analysis Tools   │
                                                      └───────────────────┘
```

---

## System Components

### Frontend (React + Vite)

**Location:** `src/`

- **Framework:** React 18 with Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **State Management:** React Query for server state, Context for auth
- **Real-time:** WebSocket for live job updates

**Key Features:**
- Job creation wizard with drag-and-drop file upload
- Real-time job status updates via WebSocket
- Job management: run, stop, delete with confirmation
- Configuration page for API key and model settings
- System update management from UI
- Connection status indicator (Live/Demo Mode)
- Notification center with mark-as-read
- Auto-retry backend connection
- Demo mode with mock data fallback

**Pages:**
| Route | Component | Description |
|-------|-----------|-------------|
| `/login` | Login.tsx | Authentication |
| `/dashboard` | Dashboard.tsx | Job list, stats, management |
| `/jobs/new` | JobCreate.tsx | Create new analysis |
| `/jobs/:id` | JobDetail.tsx | Job details and results |
| `/config` | Configuration.tsx | Settings management |

**Key Components:**
| Component | Description |
|-----------|-------------|
| `AppLayout` | Main layout with navigation |
| `JobCard` | Job display with actions |
| `BackendStatus` | Demo/Connected indicator |
| `NotificationDropdown` | Alert center |

**Hooks:**
| Hook | Description |
|------|-------------|
| `useJobs` | Job CRUD with mock fallback |
| `useJobDetail` | Single job details |
| `useAuth` | Authentication state |
| `useJobWebSocket` | Real-time updates |

### Backend API (FastAPI)

**Location:** `ctf-autopilot/apps/api/`

- **Framework:** FastAPI with Python 3.12
- **Validation:** Pydantic v2
- **ORM:** SQLAlchemy with async support
- **Background Jobs:** Celery with Redis broker
- **Authentication:** Session-based with HttpOnly cookies

**Routers:**
| Router | Prefix | Description |
|--------|--------|-------------|
| `health` | `/api/health` | Health check endpoint |
| `auth` | `/api/auth` | Login, logout, session |
| `jobs` | `/api/jobs` | Job CRUD and execution |
| `config` | `/api/config` | System configuration |
| `system` | `/api/system` | Updates, API key, models |
| `ws` | `/ws` | WebSocket connections |

**Services:**
| Service | Description |
|---------|-------------|
| `AuthService` | Password verification, session management |
| `JobService` | Job lifecycle management |
| `SandboxService` | Docker container orchestration |
| `EvidenceService` | Flag extraction and scoring |
| `WriteupService` | Report generation via MegaLLM |
| `FileService` | File upload and validation |

### Celery Workers

**Location:** `ctf-autopilot/apps/api/app/tasks.py`

- **Broker:** Redis
- **Result Backend:** Redis
- **Concurrency:** 2 workers per instance

**Tasks:**
- `analyze_job` - Main analysis pipeline
- `run_sandbox_command` - Execute single command
- `generate_writeup` - Create report

### Sandbox Container

**Location:** `ctf-autopilot/sandbox/image/`

- **Base Image:** Ubuntu 24.04
- **User:** Non-root (uid 1000)
- **Network:** Disabled (`--network=none`)
- **Filesystem:** Read-only where possible

**Security Controls:**
| Control | Implementation |
|---------|----------------|
| Network | `--network=none` |
| User | Non-root (uid 1000) |
| Resources | CPU, memory, time limits |
| Capabilities | All dropped |
| Seccomp | Restrictive profile |
| AppArmor | Custom profile |

**Allowed Tools:**
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

### Job Creation Flow

```
1. User uploads files via Web UI
   │
   ▼
2. Frontend sends POST /api/jobs with multipart form
   │
   ▼
3. Backend validates files:
   • Size limits (200MB default)
   • Extension allowlist
   • MIME type verification
   • Path sanitization
   │
   ▼
4. Files stored in job directory
   │
   ▼
5. Job record created in PostgreSQL
   │
   ▼
6. Task queued in Celery (Redis)
   │
   ▼
7. WebSocket notification sent to clients
```

### Job Execution Flow

```
1. Celery worker picks up task
   │
   ▼
2. Worker selects playbook based on file types
   │
   ▼
3. For each command in playbook:
   │
   ├─► Create sandbox container
   │   • Mount input files read-only
   │   • Set resource limits
   │   • Disable network
   │
   ├─► Execute command
   │   • Capture stdout/stderr
   │   • Enforce timeout
   │
   ├─► Store output
   │   • Save to job directory
   │   • Update database
   │
   └─► Send WebSocket progress update
   │
   ▼
4. Evidence extractor analyzes outputs
   │
   ▼
5. Flag candidates scored and ranked
   │
   ▼
6. MegaLLM generates writeup
   │
   ▼
7. Job marked complete
   │
   ▼
8. Final WebSocket notification
```

### Job Stop/Delete Flow

```
┌─────────────────────────────────────────────────────────────┐
│ User clicks Stop/Delete button                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Frontend (use-jobs.tsx)                                       │
│ • Clear any pending mock intervals                           │
│ • Clear WebSocket update cache for job                       │
│ • Update local state immediately                             │
│ • (Delete only) Remove from mock data array                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ If Backend Connected:                                         │
│ • Send API request (DELETE/PATCH)                            │
│ • Wait for confirmation                                      │
│ • Update database                                            │
└─────────────────────────────────────────────────────────────┘
```

### Configuration Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Web UI Settings Page                                         │
│ • API Key input                                              │
│ • Model selection                                            │
│ • Update button                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ API Endpoints                                                │
│ POST /api/system/api-key    → Save to runtime + .env        │
│ POST /api/system/models     → Save model preferences         │
│ POST /api/system/update     → Stream update progress         │
│ GET  /api/system/update     → Check for updates              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend Services                                             │
│ • Runtime config (in-memory)                                 │
│ • .env file (persistent)                                     │
│ • update.sh script execution                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Frontend Demo Mode

When backend is unavailable, frontend operates in Demo Mode:

```
┌─────────────────────────────────────────────────────────────┐
│ isBackendAvailable() check                                    │
│ • Fetch /api/health                                          │
│ • Verify response is JSON (not HTML fallback)                │
│ • Check status field                                         │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          │                                       │
┌─────────▼─────────┐               ┌─────────────▼─────────────┐
│  Backend Connected │               │      Demo Mode            │
│  useApi = true    │               │      useApi = false       │
│                   │               │                           │
│  • Real API calls │               │  • Mock data              │
│  • Real WebSocket │               │  • Simulated progress     │
│  • Real jobs      │               │  • Local state only       │
└───────────────────┘               └───────────────────────────┘
```

---

## Storage Layout

```
/opt/ctf-compass/
├── ctf-autopilot/
│   ├── apps/
│   │   ├── api/                    # Backend source
│   │   │   └── app/
│   │   │       ├── routers/        # API endpoints
│   │   │       ├── services/       # Business logic
│   │   │       ├── models.py       # Database models
│   │   │       ├── schemas.py      # Pydantic schemas
│   │   │       ├── tasks.py        # Celery tasks
│   │   │       └── websocket.py    # WebSocket manager
│   │   └── web/                    # Frontend Dockerfile
│   ├── docs/                       # Documentation
│   ├── infra/
│   │   ├── docker-compose.yml      # Production compose
│   │   ├── docker-compose.dev.yml  # Development compose
│   │   ├── nginx/                  # Reverse proxy config
│   │   └── scripts/
│   │       ├── install_ubuntu_24.04.sh
│   │       ├── update.sh
│   │       ├── uninstall.sh
│   │       ├── prod_up.sh
│   │       └── dev_up.sh
│   └── sandbox/
│       ├── image/                  # Sandbox Dockerfile
│       └── profiles/               # Seccomp/AppArmor
├── src/                            # React frontend source
│   ├── components/
│   │   ├── jobs/                   # JobCard, JobForm, etc.
│   │   ├── layout/                 # AppLayout
│   │   ├── ui/                     # shadcn/ui
│   │   ├── BackendStatus.tsx
│   │   └── NotificationDropdown.tsx
│   ├── hooks/
│   │   ├── use-jobs.tsx           # Job CRUD + mock
│   │   ├── use-auth.tsx
│   │   └── use-websocket.ts
│   ├── pages/                      # Page components
│   └── lib/                        # Utilities
├── data/
│   └── runs/
│       └── <job_id>/
│           ├── input/              # Uploaded files
│           ├── extracted/          # Extracted archives
│           ├── output/             # Tool outputs
│           ├── logs/               # Execution logs
│           ├── evidence.json       # Extracted evidence
│           ├── flags.json          # Flag candidates
│           └── report.md           # Generated writeup
├── .env                            # Configuration
└── CREDENTIALS.txt                 # Generated credentials
```

---

## Docker Containers

| Container | Image | Purpose | Network |
|-----------|-------|---------|---------|
| `ctf_compass_web` | Custom (Vite) | Frontend | frontend |
| `ctf_compass_api` | Custom (FastAPI) | Backend API | frontend, backend |
| `ctf_compass_worker` | Custom (Celery) | Job processing | backend |
| `ctf_compass_postgres` | postgres:16-alpine | Database | backend |
| `ctf_compass_redis` | redis:7-alpine | Message broker | backend |
| `ctf_compass_nginx` | nginx:alpine | Reverse proxy | frontend |

### Networks

| Network | Type | Purpose |
|---------|------|---------|
| `ctf_compass_frontend` | bridge | Web and API access |
| `ctf_compass_backend` | bridge (internal) | Database and cache |

### Volumes

| Volume | Purpose | Persistent |
|--------|---------|------------|
| `ctf_compass_postgres_data` | Database storage | Yes |
| `ctf_compass_redis_data` | Cache and queues | Yes |
| `ctf_compass_app_data` | Job files | Yes |

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui |
| **State** | React Query, React Context, useState/useCallback |
| **Backend** | Python 3.12, FastAPI, SQLAlchemy, Pydantic v2 |
| **Database** | PostgreSQL 16 |
| **Cache/Queue** | Redis 7 |
| **Task Queue** | Celery |
| **Container** | Docker, Docker Compose |
| **Reverse Proxy** | Nginx |
| **AI Integration** | MegaLLM API |

---

## Scalability Considerations

### Horizontal Scaling

- **Workers:** Add more Celery workers for parallel job processing
- **API:** Run multiple API instances behind load balancer
- **Database:** Use PostgreSQL replicas for read scaling

### Performance Optimizations

- **Caching:** Redis caches job metadata and session data
- **Connection Pooling:** SQLAlchemy connection pool
- **Async I/O:** FastAPI with async database operations
- **Lazy Loading:** Frontend uses React Query for data fetching
- **Mock Fallback:** Demo mode reduces backend load

### Future Considerations

- **Object Storage:** Move artifacts to S3-compatible storage
- **Queue Priority:** Implement priority queues for urgent jobs
- **Metrics:** Add Prometheus metrics endpoint
- **Tracing:** Integrate OpenTelemetry for distributed tracing
