# Threat Model

## Assets

| Asset | Sensitivity | Description |
|-------|-------------|-------------|
| MegaLLM API Key | Critical | Could incur costs if leaked |
| Admin Password | Critical | Full system access |
| Database | High | Job metadata, user sessions |
| Uploaded Files | Medium | Challenge files (may contain sensitive data) |
| Generated Reports | Medium | Analysis results |

## Threat Actors

| Actor | Motivation | Capability |
|-------|------------|------------|
| Malicious User | Abuse service, steal resources | Upload crafted files |
| Script Kiddie | Cause disruption | Automated attacks |
| Competitor | Steal analysis results | Social engineering |
| Insider | Data exfiltration | Legitimate access |

## Threats and Mitigations

### T1: Malicious File Upload

**Attack**: User uploads file designed to exploit analysis tools or escape sandbox.

**Mitigations**:
- Sandbox container with network disabled
- Resource limits prevent resource exhaustion
- Tool allowlist prevents arbitrary command execution
- Seccomp profile restricts syscalls

### T2: Zip-Slip Attack

**Attack**: Crafted zip file with path traversal to overwrite system files.

**Mitigations**:
```python
def safe_extract(zip_path: Path, dest: Path):
    with zipfile.ZipFile(zip_path) as zf:
        for member in zf.namelist():
            # Resolve the path and ensure it's within dest
            member_path = (dest / member).resolve()
            if not str(member_path).startswith(str(dest.resolve())):
                raise SecurityError(f"Path traversal detected: {member}")
            zf.extract(member, dest)
```

### T3: Command Injection

**Attack**: Crafted filename or input that escapes shell commands.

**Mitigations**:
- Never use shell=True
- Use subprocess with list arguments
- Sanitize all filenames
- Tool allowlist with exact command matching

### T4: API Key Exposure

**Attack**: API key leaked through logs, error messages, or code.

**Mitigations**:
- Key only in environment variables
- Logging filters remove secrets
- Error messages sanitized
- Frontend never sees key

### T5: Session Hijacking

**Attack**: Steal session cookie to impersonate admin.

**Mitigations**:
- HttpOnly cookies
- Secure flag when TLS enabled
- Session timeout
- CSRF protection

### T6: SSRF via Analysis

**Attack**: Uploaded file contains URLs that trigger server-side requests.

**Mitigations**:
- Sandbox has no network access
- Analysis tools cannot make network requests
- DNS resolution disabled in sandbox

### T7: XSS via Report

**Attack**: Injected script in challenge description or extracted content.

**Mitigations**:
- Markdown sanitized before rendering
- Tool outputs HTML-escaped
- CSP prevents inline scripts

### T8: Resource Exhaustion

**Attack**: Submit many large files or complex analysis jobs.

**Mitigations**:
- Upload size limits
- Rate limiting
- Per-job resource limits
- Job queue with priority

## Attack Surface

```
┌─────────────────────────────────────────────────────────────┐
│ EXTERNAL ATTACK SURFACE                                      │
├─────────────────────────────────────────────────────────────┤
│ • Web interface (port 443/80)                                │
│ • File upload endpoint                                       │
│ • API endpoints                                              │
│ • Login form                                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ INTERNAL ATTACK SURFACE                                      │
├─────────────────────────────────────────────────────────────┤
│ • Docker socket (controlled access)                          │
│ • Database connection                                        │
│ • Redis connection                                           │
│ • MegaLLM API calls                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ SANDBOX ATTACK SURFACE                                       │
├─────────────────────────────────────────────────────────────┤
│ • Uploaded files (untrusted)                                 │
│ • Analysis tool vulnerabilities                              │
│ • Container escape attempts                                  │
└─────────────────────────────────────────────────────────────┘
```

## Risk Matrix

| Threat | Likelihood | Impact | Risk | Status |
|--------|------------|--------|------|--------|
| T1: Malicious Upload | High | High | Critical | Mitigated |
| T2: Zip-Slip | Medium | High | High | Mitigated |
| T3: Command Injection | Medium | Critical | High | Mitigated |
| T4: API Key Exposure | Low | High | Medium | Mitigated |
| T5: Session Hijacking | Low | High | Medium | Mitigated |
| T6: SSRF | Low | Medium | Low | Mitigated |
| T7: XSS | Medium | Medium | Medium | Mitigated |
| T8: Resource Exhaustion | High | Low | Medium | Mitigated |
