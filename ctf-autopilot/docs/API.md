# API Reference

Base URL: `http://localhost:8000/api`

## Authentication

All endpoints except `/api/auth/login` require authentication via session cookie.

### POST /api/auth/login

Authenticate and create session.

**Request**:
```json
{
  "password": "string"
}
```

**Response** (200):
```json
{
  "message": "Login successful",
  "expires_at": "2024-01-01T12:00:00Z"
}
```

**Response** (401):
```json
{
  "detail": "Invalid password"
}
```

### POST /api/auth/logout

End current session.

**Response** (200):
```json
{
  "message": "Logged out"
}
```

---

## Jobs

### POST /api/jobs

Create a new analysis job.

**Request**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Job title (1-200 chars) |
| `description` | string | Yes | Challenge description (markdown) |
| `flag_format` | string | No | Flag regex (default: `CTF\{[^}]+\}`) |
| `files` | file[] | Yes | Challenge files (zip or individual) |

**Response** (201):
```json
{
  "id": "uuid",
  "title": "Crypto Challenge",
  "status": "pending",
  "created_at": "2024-01-01T10:00:00Z"
}
```

**Response** (400):
```json
{
  "detail": "File type not allowed: .exe"
}
```

**Response** (413):
```json
{
  "detail": "File too large. Maximum size: 200MB"
}
```

### GET /api/jobs

List all jobs.

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status |
| `limit` | int | Max results (default: 50) |
| `offset` | int | Pagination offset |

**Response** (200):
```json
{
  "jobs": [
    {
      "id": "uuid",
      "title": "Crypto Challenge",
      "status": "completed",
      "created_at": "2024-01-01T10:00:00Z",
      "completed_at": "2024-01-01T10:05:00Z"
    }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

### GET /api/jobs/{id}

Get job details.

**Response** (200):
```json
{
  "id": "uuid",
  "title": "Crypto Challenge",
  "description": "Decrypt the message...",
  "flag_format": "CTF\\{[^}]+\\}",
  "status": "completed",
  "created_at": "2024-01-01T10:00:00Z",
  "started_at": "2024-01-01T10:00:05Z",
  "completed_at": "2024-01-01T10:05:00Z",
  "input_files": ["challenge.zip"],
  "commands_executed": 15,
  "flag_candidates": [
    {
      "value": "CTF{fl4g_f0und}",
      "confidence": 0.95,
      "source": "strings output",
      "evidence_id": "cmd_007"
    }
  ],
  "timeline": [
    {
      "timestamp": "2024-01-01T10:00:05Z",
      "event": "Job started"
    },
    {
      "timestamp": "2024-01-01T10:00:10Z",
      "event": "Extracted challenge.zip"
    }
  ]
}
```

### POST /api/jobs/{id}/run

Start job execution (if pending/failed).

**Response** (202):
```json
{
  "message": "Job queued for execution",
  "status": "queued"
}
```

### GET /api/jobs/{id}/commands

Get executed commands and their outputs.

**Response** (200):
```json
{
  "commands": [
    {
      "id": "cmd_001",
      "tool": "file",
      "arguments": ["challenge.bin"],
      "started_at": "2024-01-01T10:00:10Z",
      "completed_at": "2024-01-01T10:00:11Z",
      "exit_code": 0,
      "stdout": "challenge.bin: ELF 64-bit LSB executable...",
      "stderr": "",
      "output_hash": "sha256:abc123..."
    }
  ]
}
```

### GET /api/jobs/{id}/artifacts

List job artifacts.

**Response** (200):
```json
{
  "artifacts": [
    {
      "path": "extracted/flag.txt",
      "size": 42,
      "type": "text/plain",
      "hash": "sha256:def456..."
    }
  ]
}
```

### GET /api/jobs/{id}/download/report

Download generated writeup.

**Response**: `text/markdown` file

### GET /api/jobs/{id}/download/bundle

Download all artifacts as zip.

**Response**: `application/zip` file

---

## Configuration

### GET /api/config

Get current configuration (admin only).

**Response** (200):
```json
{
  "max_upload_size_mb": 200,
  "sandbox_timeout_seconds": 60,
  "allowed_extensions": [".txt", ".py", ".zip"],
  "allowed_tools": ["strings", "file", "binwalk"]
}
```

### PATCH /api/config

Update configuration (admin only).

**Request**:
```json
{
  "max_upload_size_mb": 300,
  "sandbox_timeout_seconds": 120
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "detail": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-01T10:00:00Z"
}
```

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid input |
| 401 | `UNAUTHORIZED` | Not authenticated |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 413 | `FILE_TOO_LARGE` | Upload exceeds limit |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| POST /api/jobs | 10/minute |
| GET /api/* | 100/minute |
| POST /api/auth/login | 5/minute |
