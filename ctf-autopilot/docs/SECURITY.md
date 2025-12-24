# Security

## Security Controls

### 1. Secrets Management

| Control | Implementation |
|---------|----------------|
| No secrets in code | All secrets via environment variables |
| `.env` protection | `.gitignore` prevents commit |
| Secret logging prevention | Secrets filtered from logs |
| API key isolation | MegaLLM key only accessible in backend |

### 2. File Upload Hardening

| Control | Implementation |
|---------|----------------|
| Size limit | Configurable (default 200MB) |
| Extension allowlist | Only safe extensions accepted |
| MIME type validation | Verified against extension |
| Zip-slip prevention | Path traversal checks on extraction |
| Filename sanitization | Special characters removed |
| Secure storage | Files stored with 0600 permissions |

### 3. Sandbox Isolation

| Control | Implementation |
|---------|----------------|
| Network isolation | `--network=none` |
| Filesystem | Read-only where possible |
| Resource limits | CPU, memory, time limits |
| User isolation | Non-root user (uid 1000) |
| Capability dropping | No extra capabilities |
| Seccomp profile | Restrictive syscall filter |
| Tool allowlist | Only approved tools can execute |

### 4. Web Security

| Header | Value |
|--------|-------|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` (with TLS) |

### 5. Authentication

| Feature | Implementation |
|---------|----------------|
| Password hashing | Argon2id |
| Session management | HttpOnly, Secure cookies |
| CSRF protection | Double-submit cookie pattern |
| Rate limiting | Per-IP and per-session limits |
| Session timeout | Configurable (default 1 hour) |

### 6. Input Validation

All inputs are validated using Pydantic models:

```python
class JobCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., max_length=10000)
    flag_format: str = Field(default=r"CTF\{[^}]+\}", max_length=500)
    
    @field_validator('flag_format')
    def validate_regex(cls, v):
        try:
            re.compile(v)
        except re.error:
            raise ValueError('Invalid regex pattern')
        return v
```

### 7. Output Sanitization

- All markdown rendered with sanitized HTML
- Tool outputs escaped before display
- Error messages sanitized (no stack traces in production)

## Security Checklist

### Before Deployment

- [ ] Change default `ADMIN_PASSWORD`
- [ ] Set strong `POSTGRES_PASSWORD`
- [ ] Configure `SECRET_KEY` for production
- [ ] Enable TLS
- [ ] Review firewall rules
- [ ] Enable rate limiting
- [ ] Test file upload restrictions
- [ ] Verify sandbox isolation

### Regular Maintenance

- [ ] Rotate secrets quarterly
- [ ] Update container images monthly
- [ ] Review access logs weekly
- [ ] Test backup/restore procedures
- [ ] Security scan dependencies

## Reporting Security Issues

If you discover a security vulnerability, please:

1. **Do not** open a public issue
2. Email security@example.com with details
3. Allow 90 days for a fix before public disclosure

## Security Headers Implementation

```python
# apps/api/app/middleware/security.py
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            "font-src 'self';"
        )
        return response
```
