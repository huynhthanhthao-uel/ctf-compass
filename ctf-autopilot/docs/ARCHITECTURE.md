# CTF Compass - Architecture

## Overview

CTF Compass is a hybrid architecture containing a React/Vite frontend, FastAPI backend, Lovable Cloud Edge Functions, and isolated Docker sandbox for secure CTF challenge analysis.

**GitHub:** [github.com/huynhthanhthao-uel/ctf-compass](https://github.com/huynhthanhthao-uel/ctf-compass)

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
│ • Job Detail      │               │ • AI Analysis Service     │
│ • Full Autopilot  │               │ • System Service          │
│ • Configuration   │               │ • WebSocket Handler       │
│ • Notifications   │               │                           │
└────────┬──────────┘               └─────────────┬─────────────┘
         │                                        │
         │ Cloud Mode (Fallback)    ┌─────────────┴─────────────┐
         │                          │                           │
┌────────▼────────────────┐   ┌─────▼─────────┐       ┌─────────▼─────────┐
│   Lovable Cloud         │   │  PostgreSQL   │       │      Redis        │
│   Edge Functions        │   │   Database    │       │   Message Broker  │
│                         │   │   Port: 5432  │       │   Port: 6379      │
│ • ai-analyze            │   └───────────────┘       └─────────┬─────────┘
│ • sandbox-terminal      │                                     │
│ • detect-category       │                           ┌─────────▼─────────┐
└─────────────────────────┘                           │   Celery Worker   │
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

## Operation Modes

### 1. Connected Mode (Full Backend)
- Backend API available at localhost:8000
- Real database persistence
- Celery workers for background jobs
- Docker sandbox for real tool execution
- WebSocket for real-time updates

### 2. Cloud Mode (Edge Functions)
- Backend unavailable or unreachable
- Frontend falls back to Lovable Cloud
- Edge Functions handle AI analysis
- Simulated terminal execution
- No local storage (session-only)

### 3. Demo Mode (Mock Data)
- No backend or cloud available
- Uses mock data from `mock-data.ts`
- Simulated job progress
- Full UI functionality for testing

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
- Full Autopilot with one-click "Solve Challenge"
- Real-time progress tracking with animations
- Automatic mode detection (Connected/Cloud/Demo)
- Job management: run, stop, delete with confirmation
- Configuration page for API key and model settings
- System update management from UI
- Connection status indicator with auto-retry
- Notification center with mark-as-read

**Pages:**
| Route | Component | Description |
|-------|-----------|-------------|
| `/login` | Login.tsx | Authentication |
| `/dashboard` | Dashboard.tsx | Job list, stats, management |
| `/jobs/new` | JobCreate.tsx | Create new analysis |
| `/jobs/:id` | JobDetail.tsx | Job details, Full Autopilot |
| `/config` | Configuration.tsx | Settings management |

**Key Components:**
| Component | Description |
|-----------|-------------|
| `AppLayout` | Main layout with navigation |
| `FullAutopilot` | One-click solve with progress tracking |
| `AutopilotPanel` | Manual autopilot controls |
| `SandboxTerminal` | Interactive terminal interface |
| `SolveScriptGenerator` | AI-powered script generation |
| `JobCard` | Job display with actions |
| `BackendStatus` | Demo/Cloud/Connected indicator |
| `NotificationDropdown` | Alert center |

**Hooks:**
| Hook | Description |
|------|-------------|
| `useJobs` | Job CRUD with mode fallback |
| `useJobDetail` | Single job details |
| `useAuth` | Authentication state |
| `useJobWebSocket` | Real-time updates |

### Lovable Cloud Edge Functions

**Location:** `supabase/functions/`

Edge Functions provide backend functionality when local backend is unavailable.

| Function | Endpoint | Description |
|----------|----------|-------------|
| `ai-analyze` | `/functions/v1/ai-analyze` | AI-powered challenge analysis |
| `sandbox-terminal` | `/functions/v1/sandbox-terminal` | Simulated terminal + netcat commands |
| `detect-category` | `/functions/v1/detect-category` | Auto category detection |
| `ai-solve-script` | `/functions/v1/ai-solve-script` | Generate pwntools solve scripts |

#### ai-analyze Function

Provides AI-powered CTF analysis with:
- Category-specific playbooks (Crypto, Pwn, Web, Rev, Forensics)
- Command history context
- Pre-built solve scripts for common challenges
- Structured JSON output with tool calling

**Request:**
```json
{
  "job_id": "job-001",
  "files": [{"name": "challenge.py", "content": "..."}],
  "command_history": [{"tool": "file", "output": "..."}],
  "current_category": "crypto"
}
```

**Response:**
```json
{
  "summary": "RSA challenge with small public exponent",
  "detected_category": "crypto",
  "suggested_commands": [
    {"tool": "python3", "args": ["solve.py"], "reason": "Run solve script"}
  ],
  "flag_candidates": ["CTF{example_flag}"],
  "solve_script": "#!/usr/bin/env python3\n..."
}
```

#### sandbox-terminal Function

Simulates terminal execution for Cloud Mode:
- Progressive command output based on job context
- Supports common CTF tools (ls, cat, strings, file, python3)
- Job state tracking for realistic progression
- Python script execution simulation
- **Netcat support**: `nc` and `nc_interact` commands for remote challenges
- PWN/Crypto/Quiz challenge simulations

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
| `ai` | `/api/ai` | AI analysis endpoints |
| `history` | `/api/history` | Analysis history |
| `ws` | `/ws` | WebSocket connections |

**Services:**
| Service | Description |
|---------|-------------|
| `AuthService` | Password verification, session management |
| `JobService` | Job lifecycle management |
| `SandboxService` | Docker container orchestration |
| `AIAnalysisService` | AI-powered analysis coordination |
| `EvidenceService` | Flag extraction and scoring |
| `WriteupService` | Report generation via AI |
| `FileService` | File upload and validation |
| `HistoryService` | Analysis history tracking |

### Celery Workers

**Location:** `ctf-autopilot/apps/api/app/tasks.py`

- **Broker:** Redis
- **Result Backend:** Redis
- **Concurrency:** 2 workers per instance

**Tasks:**
- `analyze_job` - Main analysis pipeline
- `run_sandbox_command` - Execute single command
- `generate_writeup` - Create report
- `run_solve_script` - Execute AI-generated scripts

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

**Installed Tools:**
| Category | Tools |
|----------|-------|
| Binary Analysis | strings, file, binwalk, readelf, objdump, nm, checksec |
| Reverse Engineering | radare2, retdec, gdb, ltrace, strace |
| Crypto/Pwn | pwntools, pycryptodome, z3-solver, ROPgadget |
| Network | tshark, tcpdump |
| Forensics | volatility3, exiftool, foremost, binwalk |
| Image/Stego | steghide, zsteg, pngcheck |
| Archive | unzip, 7z, tar, gzip, bzip2 |

---

## Data Flow

### Full Autopilot Flow

```
1. User clicks "Solve Challenge" button
   │
   ▼
2. FullAutopilot component initializes
   │
   ├─► Check backend availability
   │   │
   │   ├─► If Connected: Use local API
   │   │
   │   └─► If Cloud Mode: Use Edge Functions
   │
   ▼
3. Phase 1: Initial Analysis
   │
   ├─► List files (ls command)
   ├─► Identify file types (file command)
   ├─► Extract strings (strings command)
   │
   ▼
4. Phase 2: Deep Scan
   │
   ├─► Category-specific tools
   │   • Crypto: Check for keys, ciphertexts
   │   • Pwn: checksec, readelf
   │   • Rev: objdump, strings patterns
   │   • Web: grep for endpoints, SQL
   │   • Forensics: binwalk, exiftool
   │
   ▼
5. Phase 3: AI Reasoning
   │
   ├─► Send context to ai-analyze
   ├─► Receive analysis with:
   │   • Challenge summary
   │   • Suggested commands
   │   • Solve strategy
   │   • Generated solve script
   │
   ▼
6. Phase 4: Flag Extraction
   │
   ├─► Execute solve script
   ├─► Parse output for flag patterns
   ├─► Validate against flag format
   │
   ▼
7. Complete
   │
   ├─► Display found flags
   ├─► Update job status to "done"
   └─► Show success animation
```

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

### Cloud Mode Flow

```
1. Frontend detects backend unavailable
   │
   ▼
2. BackendStatus shows "Cloud Mode"
   │
   ▼
3. User clicks "Solve Challenge"
   │
   ▼
4. FullAutopilot uses Edge Functions:
   │
   ├─► sandbox-terminal for command execution
   │   • Simulated tool outputs
   │   • Progressive discovery
   │
   ├─► ai-analyze for AI reasoning
   │   • Lovable AI gateway
   │   • Category playbooks
   │
   ▼
5. Results displayed in real-time
   │
   ▼
6. Job marked complete (local state only)
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
│   │   ├── jobs/
│   │   │   ├── FullAutopilot.tsx   # One-click solve
│   │   │   ├── AutopilotPanel.tsx
│   │   │   ├── SandboxTerminal.tsx
│   │   │   └── SolveScriptGenerator.tsx
│   │   ├── layout/                 # AppLayout
│   │   ├── ui/                     # shadcn/ui
│   │   ├── BackendStatus.tsx
│   │   └── NotificationDropdown.tsx
│   ├── hooks/
│   │   ├── use-jobs.tsx           # Job CRUD + fallback
│   │   ├── use-auth.tsx
│   │   └── use-websocket.ts
│   ├── pages/                      # Page components
│   └── lib/                        # Utilities
├── supabase/
│   ├── functions/
│   │   ├── ai-analyze/            # AI analysis function
│   │   ├── sandbox-terminal/      # Terminal simulation
│   │   └── detect-category/       # Category detection
│   └── config.toml
├── data/
│   └── runs/
│       └── <job_id>/
│           ├── input/              # Uploaded files
│           ├── extracted/          # Extracted archives
│           ├── output/             # Tool outputs
│           ├── logs/               # Execution logs
│           └── writeup.md          # Generated report
└── .env                            # Environment config
```

---

## API Reference

See [API.md](API.md) for complete API documentation.

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/auth/login` | POST | User login |
| `/api/jobs` | GET/POST | List/create jobs |
| `/api/jobs/{id}` | GET | Job details |
| `/api/jobs/{id}/run` | POST | Start analysis |
| `/api/ai/analyze` | POST | AI analysis |
| `/ws/jobs/{id}` | WS | Real-time updates |

---

## Security Model

See [SECURITY.md](SECURITY.md) for complete security documentation.

### Key Controls

1. **Network Isolation**: Sandbox containers have no network access
2. **File Validation**: Size, extension, and MIME type checks
3. **Resource Limits**: CPU, memory, and time limits per job
4. **Non-root Execution**: All sandbox commands run as non-root
5. **Session Security**: HttpOnly cookies, secure sessions

---

## Getting Help

- **User Guide**: [USAGE.md](USAGE.md)
- **Debug Guide**: [DEBUG.md](DEBUG.md)
- **Runbook**: [RUNBOOK.md](RUNBOOK.md)
- **GitHub**: [github.com/huynhtrungcipp/ctf-compass](https://github.com/huynhtrungcipp/ctf-compass)
