# Security

## Security Controls

### 1. Secrets Management

| Control | Implementation |
|---------|----------------|
| No secrets in code | All secrets via environment variables or UI settings |
| `.env` protection | `.gitignore` prevents commit |
| Secret logging prevention | Secrets filtered from logs |
| API key via UI | Set via Settings page, synced to backend |
| Masked display | API keys shown as `sk-mega-...xxxx` |

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

---

## API Key Security

### Recommended Flow

1. **Enter via UI Settings page** (not .env file directly)
2. Key is sent to backend via HTTPS
3. Backend stores in runtime memory AND persists to .env
4. Key is never exposed in logs or responses (only masked prefix)

### Fallback for Offline/Dev Mode

- If backend is unavailable, key stored in browser localStorage
- Will sync to backend when connection is restored

---

## Security Checklist

### Before Deployment

- [ ] Change default `ADMIN_PASSWORD`
- [ ] Set strong `POSTGRES_PASSWORD`
- [ ] Configure `SECRET_KEY` for production
- [ ] Set MegaLLM API key via Settings page
- [ ] Enable TLS (recommended for production)
- [ ] Review firewall rules (ports 3000, 8000)
- [ ] Enable rate limiting
- [ ] Test file upload restrictions
- [ ] Verify sandbox isolation

### Regular Maintenance

- [ ] Rotate secrets quarterly
- [ ] Update container images monthly (`update.sh`)
- [ ] Review access logs weekly
- [ ] Test backup/restore procedures
- [ ] Security scan dependencies

---

## Network Security

### Firewall Rules (UFW)

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow Web UI
sudo ufw allow 3000/tcp

# Allow API (optional, if needed externally)
sudo ufw allow 8000/tcp

# Enable firewall
sudo ufw enable
```

### HTTPS (Production)

For production, use a reverse proxy with TLS:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
    }
    
    location /api {
        proxy_pass http://localhost:8000;
    }
}
```

---

## Incident Response

### If You Suspect a Breach

1. **Isolate**: Disconnect from network if possible
2. **Preserve**: Keep logs and container states
3. **Rotate**: Change all passwords and API keys
4. **Review**: Check access logs for suspicious activity
5. **Report**: Open GitHub issue (without sensitive details)

### Log Locations

- Install log: `/var/log/ctf-compass-install.log`
- API logs: `docker compose logs api`
- Worker logs: `docker compose logs worker`

---

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do not** open a public issue
2. Contact maintainers privately
3. Allow 90 days for a fix before public disclosure

---

## Compliance Notes

- **Data Locality**: All data stays on your server
- **No Telemetry**: No usage data sent to external services
- **API Key Privacy**: Only sent to MegaLLM API for AI features
- **User Uploads**: Stored locally, you control retention
