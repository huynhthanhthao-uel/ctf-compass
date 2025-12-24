# Architecture

## Overview

CTF Autopilot Analyzer is a monorepo containing a Next.js frontend, FastAPI backend, and isolated Docker sandbox for secure file analysis.

## System Components

### Frontend (apps/web)

- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: React Query for server state
- **Features**:
  - Job creation wizard with file upload
  - Real-time job status updates via polling
  - Evidence viewer with syntax highlighting
  - Markdown writeup renderer with sanitization

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

## Data Flow

```
1. User uploads challenge files
   │
   ▼
2. Backend validates and stores files
   │
   ▼
3. Job queued in Celery
   │
   ▼
4. Worker selects playbook based on file types
   │
   ▼
5. Sandbox container executes tools
   │
   ▼
6. Output captured and stored
   │
   ▼
7. Evidence extractor finds flag candidates
   │
   ▼
8. MegaLLM generates writeup from evidence
   │
   ▼
9. Report available for download
```

## Storage Layout

```
/data/
├── runs/
│   └── <job_id>/
│       ├── input/           # Uploaded files
│       ├── extracted/       # Extracted archives
│       ├── output/          # Tool outputs
│       ├── logs/            # Execution logs
│       ├── evidence.json    # Extracted evidence
│       ├── flags.json       # Flag candidates
│       └── report.md        # Generated writeup
```

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
│ - Size limits                                                │
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

## Scalability Considerations

- **Horizontal Scaling**: Multiple Celery workers can process jobs in parallel
- **Queue Priority**: Urgent jobs can use priority queues
- **Storage**: Artifacts can be moved to object storage for large deployments
- **Caching**: Redis caches frequently accessed job metadata
