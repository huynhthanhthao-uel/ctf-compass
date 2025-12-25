# CTF Compass - Security

## Overview

CTF Compass is designed with security-first principles for analyzing untrusted CTF challenge files in a safe, isolated environment.

**GitHub:** [github.com/HaryLya/ctf-compass](https://github.com/HaryLya/ctf-compass)

---

## Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ UNTRUSTED: User uploads, challenge files                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ VALIDATION LAYER                                             │
│ • File type validation                                       │
│ • Size limits (200MB default)                               │
│ • Path sanitization                                          │
│ • Zip-slip prevention                                        │
│ • MIME type verification                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ SANDBOX (Isolated Docker Container)                          │
│ • No network access (--network=none)                        │
│ • Resource limits (CPU, memory, time)                       │
│ • Allowlisted tools only                                     │
│ • Non-root execution (uid 1000)                             │
│ • Read-only root filesystem                                  │
│ • Seccomp/AppArmor profiles                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ TRUSTED: Backend services, database, MegaLLM API             │
└─────────────────────────────────────────────────────────────┘
```

---

## Security Controls

### 1. Secrets Management

| Control | Implementation |
|---------|----------------|
| No secrets in code | All secrets via environment variables or UI |
| `.env` protection | `.gitignore` prevents commit |
| Secret logging prevention | Secrets filtered from all logs |
| API key via UI | Set via Configuration page, synced to backend |
| Masked display | API keys shown as `sk-mega-...xxxx` |
| Secure storage | Credentials file with 0600 permissions |

### 2. Authentication & Sessions

| Control | Implementation |
|---------|----------------|
| Password hashing | Argon2id with secure parameters |
| Session storage | HttpOnly, Secure cookies |
| CSRF protection | Double-submit cookie pattern |
| Session timeout | Configurable (default 1 hour) |
| Timing-safe comparison | `secrets.compare_digest` |
| Rate limiting | Per-IP and per-session limits |

### 3. File Upload Hardening

| Control | Implementation |
|---------|----------------|
| Size limit | Configurable (default 200MB) |
| Extension allowlist | Only safe extensions accepted |
| MIME type validation | Verified against extension |
| Zip-slip prevention | Path traversal checks on extraction |
| Filename sanitization | Special characters removed |
| Secure storage | Files stored with 0600 permissions |

**Allowed Extensions:**
```
.txt, .pdf, .png, .jpg, .jpeg, .gif, .zip, .tar, .gz, .bz2,
.bin, .exe, .elf, .pcap, .pcapng, .py, .js, .html, .css,
.json, .xml, .md, .c, .cpp, .h, .java, .rb, .go, .rs
```

### 4. Sandbox Isolation

| Control | Implementation |
|---------|----------------|
| Network isolation | `--network=none` |
| Filesystem | Read-only root, writable temp only |
| Resource limits | CPU, memory, time limits |
| User isolation | Non-root user (uid 1000) |
| Capability dropping | All capabilities dropped |
| Seccomp profile | Restrictive syscall filter |
| AppArmor profile | Custom profile applied |
| Tool allowlist | Only approved tools can execute |

**Sandbox Resource Limits:**
| Resource | Default | Configurable |
|----------|---------|--------------|
| CPU | 1 core | `SANDBOX_CPU_LIMIT` |
| Memory | 512MB | `SANDBOX_MEMORY_LIMIT` |
| Timeout | 60s | `SANDBOX_TIMEOUT_SECONDS` |

### 5. Web Security Headers

| Header | Value |
|--------|-------|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` (with TLS) |

### 6. Input Validation

All inputs are validated using Pydantic models:

```python
class JobCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., max_length=10000)
    flag_format: str = Field(default=r"CTF\{[^}]+\}", max_length=500)
    
    @field_validator('flag_format')
    @classmethod
    def validate_regex(cls, v: str) -> str:
        try:
            re.compile(v)
        except re.error as e:
            raise ValueError(f'Invalid regex pattern: {e}')
        return v

class LoginRequest(BaseModel):
    password: str = Field(..., min_length=1)
```

### 7. Output Sanitization

- All markdown rendered with sanitized HTML
- Tool outputs escaped before display
- Error messages sanitized (no stack traces in production)
- Sensitive data (passwords, keys) never logged

---

## API Key Security

### Recommended Flow

1. **Enter via UI Configuration page** (not .env file directly)
2. Key is sent to backend via HTTPS (when TLS enabled)
3. Backend stores in runtime memory AND persists to .env
4. Key is never exposed in logs or responses (only masked prefix)
5. Key is only sent to MegaLLM API for AI operations

### Security Measures

```python
# Masked API key display
def mask_api_key(key: str) -> str:
    if len(key) <= 8:
        return "***"
    return f"{key[:7]}...{key[-4:]}"

# Example: sk-mega-abc123xyz → sk-mega...xyz9
```

### Backend Connection Detection

Frontend detects backend availability by:
1. Checking `/api/health` endpoint
2. Verifying response is JSON (not HTML fallback)
3. Checking `status` field in response

If backend unavailable, frontend shows "Demo Mode" and uses mock data.

---

## Network Security

### Docker Network Isolation

| Network | Access | Purpose |
|---------|--------|---------|
| `ctf_compass_frontend` | External | Web UI and API access |
| `ctf_compass_backend` | Internal only | Database and cache |
| Sandbox | None | Complete isolation |

### Firewall Configuration (UFW)

```bash
# Recommended rules
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp   # HTTP (redirect to HTTPS)
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 3000/tcp # Web UI (if no reverse proxy)
sudo ufw allow 8000/tcp # API (if needed externally)
sudo ufw enable
```

### fail2ban Configuration

The installation script configures fail2ban for SSH protection:

```ini
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 2h
```

---

## TLS Configuration

### Development (Self-Signed)

```bash
./ctf-autopilot/infra/scripts/generate_self_signed_cert.sh
ENABLE_TLS=true ./ctf-autopilot/infra/scripts/prod_up.sh
```

### Production (Let's Encrypt)

```bash
# In .env
ENABLE_TLS=true
TLS_DOMAIN=ctfcompass.example.com
LETSENCRYPT_EMAIL=admin@example.com
```

### Nginx TLS Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # Modern TLS configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    location / {
        proxy_pass http://localhost:3000;
    }
    
    location /api {
        proxy_pass http://localhost:8000;
    }
    
    location /ws {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## Security Checklist

### Pre-Deployment

- [ ] Changed `ADMIN_PASSWORD` from default
- [ ] Set strong `POSTGRES_PASSWORD` (auto-generated is fine)
- [ ] Configured unique `SECRET_KEY`
- [ ] Set MegaLLM API key via Configuration page
- [ ] Enabled TLS for production deployment
- [ ] Configured firewall (UFW)
- [ ] Verified fail2ban is running
- [ ] Tested file upload restrictions
- [ ] Verified sandbox isolation

### Regular Maintenance

- [ ] Rotate passwords quarterly
- [ ] Update system monthly (`update.sh`)
- [ ] Review access logs weekly
- [ ] Test backup/restore procedures monthly
- [ ] Security scan dependencies quarterly
- [ ] Review and update allowed file extensions
- [ ] Check for Docker image updates

---

## Incident Response

### If You Suspect a Breach

1. **Isolate:** Disconnect from network if possible
   ```bash
   sudo ufw deny incoming
   ```

2. **Preserve Evidence:** Keep logs and container states
   ```bash
   docker compose logs > incident_logs.txt
   docker compose ps > container_states.txt
   ```

3. **Rotate Credentials:** Change all passwords and API keys
   ```bash
   # Generate new secrets
   openssl rand -base64 48  # New SECRET_KEY
   openssl rand -base64 32  # New POSTGRES_PASSWORD
   # Update .env and restart
   ```

4. **Review Logs:** Check for suspicious activity
   ```bash
   # Check auth logs
   docker compose logs api 2>&1 | grep -i "login\|auth\|401\|403"
   
   # Check for unusual file access
   docker compose logs worker 2>&1 | grep -i "error\|exception"
   ```

5. **Report:** Open GitHub issue (without sensitive details)

### Log Locations

| Log | Location |
|-----|----------|
| Install | `/var/log/ctf-compass-install.log` |
| Update | `/var/log/ctf-compass-update.log` |
| API | `docker compose logs api` |
| Worker | `docker compose logs worker` |
| Web | `docker compose logs web` |
| Nginx | `docker compose logs nginx` |

---

## Compliance Notes

- **Data Locality:** All data stays on your server
- **No Telemetry:** No usage data sent to external services (except MegaLLM for AI)
- **API Key Privacy:** Only sent to MegaLLM API for AI features
- **User Uploads:** Stored locally, you control retention
- **GDPR:** No personal data collected beyond admin credentials

---

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** open a public GitHub issue
2. Contact maintainers privately via GitHub security advisories
3. Allow 90 days for a fix before public disclosure
4. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

---

## Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker)
