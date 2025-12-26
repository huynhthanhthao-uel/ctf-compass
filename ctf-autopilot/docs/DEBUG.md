# Debug & Troubleshooting Guide

Complete debugging guide for CTF Compass v2.0.0. This document covers common issues, CORS debugging, Cloud Mode, and step-by-step troubleshooting procedures.

**GitHub:** [github.com/huynhtrungpc01/ctf-compass](https://github.com/huynhtrungpc01/ctf-compass)

---

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Setup Wizard Troubleshooting](#setup-wizard-troubleshooting)
3. [CORS Debugging](#cors-debugging)
4. [Operation Mode Issues](#operation-mode-issues)
5. [Cloud Mode Debugging](#cloud-mode-debugging)
6. [Common Issues](#common-issues)
7. [Log Analysis](#log-analysis)
8. [Database Debugging](#database-debugging)
9. [Sandbox Debugging](#sandbox-debugging)
10. [API & Frontend Debugging](#api--frontend-debugging)
11. [Recovery Procedures](#recovery-procedures)

---

## Quick Diagnostics

### One-Command Health Check

```bash
# Run full system diagnostic
cd /opt/ctf-compass && \
docker compose -f ctf-autopilot/infra/docker-compose.yml ps && \
echo -e "\n=== API Health ===" && \
curl -sf http://localhost:8000/api/health || echo "API not responding" && \
echo -e "\n=== Database ===" && \
docker compose -f ctf-autopilot/infra/docker-compose.yml exec -T postgres pg_isready && \
echo -e "\n=== Redis ===" && \
docker compose -f ctf-autopilot/infra/docker-compose.yml exec -T redis redis-cli ping && \
echo -e "\n=== Web UI ===" && \
curl -sf http://localhost:3000 > /dev/null && echo "Web UI OK" || echo "Web UI not responding"
```

### System Resource Check

```bash
echo "=== Memory ===" && free -h
echo -e "\n=== Disk ===" && df -h /
echo -e "\n=== CPU ===" && top -bn1 | head -5
echo -e "\n=== Docker Stats ===" && docker stats --no-stream
```

### CORS Quick Check

```bash
# Test CORS preflight from command line
curl -s -D- -o /dev/null -X OPTIONS http://localhost:8000/api/health \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" | grep -i "access-control"
```

Expected output:
```
access-control-allow-origin: *
access-control-allow-methods: GET, POST, PATCH, DELETE, OPTIONS
access-control-max-age: 600
```

---

## Setup Wizard Troubleshooting

### Cannot Connect to Backend

**Symptoms:**
- "Connection error" in Setup Wizard
- Red error badge
- Cannot proceed to Dashboard

**Diagnosis:**

1. **Check Docker containers:**
   ```bash
   docker compose -f ctf-autopilot/infra/docker-compose.yml ps
   ```

2. **Check API is responding:**
   ```bash
   curl -v http://localhost:8000/api/health
   ```

3. **Check CORS configuration:**
   ```bash
   grep CORS_ORIGINS /opt/ctf-compass/.env
   ```

**Solutions:**

| Issue | Solution |
|-------|----------|
| Containers not running | `docker compose up -d` |
| Wrong Backend URL | Use correct IP:port (e.g., `http://192.168.1.100:8000`) |
| CORS not configured | Add frontend URL to `CORS_ORIGINS` in `.env` |
| Firewall blocking | Open port 8000: `sudo ufw allow 8000` |

### Backend URL Not Saved

**Cause:** localStorage might be disabled or full

**Solution:**
```javascript
// In browser console
localStorage.setItem('ctf-compass-backend-url', 'http://your-server:8000');
location.reload();
```

### Stuck in Setup Wizard

**Solution:** Navigate directly to dashboard:
- Go to `/dashboard` in browser
- Or click "Skip to Demo Mode" button

---

## CORS Debugging

### Using Built-in CORS Tester

1. Navigate to `/cors-tester`
2. Enter your backend URL
3. Click each test button:
   - **Preflight (OPTIONS)**: Tests CORS headers
   - **GET Request**: Tests read operations
   - **POST Request**: Tests write operations
   - **Health Check**: Tests API status

### Common CORS Errors

#### "No 'Access-Control-Allow-Origin' header"

**Cause:** Backend not sending CORS headers

**Solution:**
```bash
# Check current CORS config
sudo docker logs ctf_compass_api 2>&1 | grep -i "CORS"

# Update .env file
echo 'CORS_ORIGINS=http://192.168.1.100:3000,http://localhost:3000' >> /opt/ctf-compass/.env

# Restart API
docker compose -f ctf-autopilot/infra/docker-compose.yml restart api
```

#### "CORS policy: Request header field not allowed"

**Cause:** Missing `Access-Control-Allow-Headers`

**Solution:** The API should return:
```
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
```

#### "Preflight response is not successful"

**Cause:** OPTIONS request failing

**Diagnosis:**
```bash
# Test OPTIONS directly
curl -v -X OPTIONS http://localhost:8000/api/health \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET"
```

### CORS Configuration Reference

In `/opt/ctf-compass/.env`:

```bash
# Single origin
CORS_ORIGINS=http://192.168.1.100:3000

# Multiple origins (comma-separated)
CORS_ORIGINS=http://192.168.1.100:3000,http://localhost:3000,http://10.0.0.5:3000

# Allow all (development only, NOT recommended for production)
CORS_ORIGINS=*
```

### Verify CORS in API Logs

```bash
# Check startup CORS config
docker logs ctf_compass_api 2>&1 | grep -E "CORS|startup"

# Should show something like:
# [startup] CORS_ORIGINS env='*' dotenv=None effective=['*']
```

---

## Operation Mode Issues

### Identifying Current Mode

Check the status badge in the header:

| Badge | Mode | Meaning |
|-------|------|---------|
| `Connected` (blue) | Connected | Full backend available |
| `Cloud Mode` (cyan) | Cloud | Using Edge Functions |
| `Demo Mode` (amber) | Demo | Using mock data |

### Switching Between Modes

The frontend automatically detects the best available mode:

1. **Connected Mode**: Checks configured Backend URL health
2. **Cloud Mode**: Falls back if backend unavailable
3. **Demo Mode**: Falls back if both unavailable

To force a mode:
- **Force Connected**: Configure Backend URL in Setup Wizard
- **Force Cloud**: Clear Backend URL, ensure internet connected
- **Force Demo**: Clear Backend URL, disconnect internet

### Mode Not Switching

If stuck in wrong mode:

```javascript
// In browser console
localStorage.removeItem('ctf-compass-backend-url');
localStorage.clear();
location.reload();
```

### Stuck in Demo Mode

**Diagnosis:**
1. Open browser DevTools (F12)
2. Go to Network tab
3. Look for failed requests to `/api/health`
4. Check Console for CORS errors

**Solutions:**
1. Configure Backend URL in Setup Wizard (`/`)
2. Use CORS Tester (`/cors-tester`) to diagnose
3. Check Docker containers are running
4. Verify CORS_ORIGINS includes your frontend URL

---

## Cloud Mode Debugging

### Edge Function Errors

#### 402 Payment Required

**Cause**: Lovable AI rate limit exceeded or credits exhausted

**Solutions**:
1. Wait a few minutes and retry
2. Check Lovable workspace credits
3. Upgrade plan if needed

#### 429 Too Many Requests

**Cause**: Rate limiting

**Solutions**:
1. Wait 60 seconds
2. Reduce request frequency
3. Check for loops in code

#### 404 Not Found

**Cause**: Edge function not deployed

**Solutions**:
1. Check function exists in `supabase/functions/`
2. Redeploy Edge Functions
3. Check function name spelling

### Checking Edge Function Logs

Use browser DevTools:

1. Open Network tab
2. Filter by "functions"
3. Look for `ai-analyze` and `sandbox-terminal` calls
4. Check response status and body

### Testing Edge Functions

```bash
# Test ai-analyze function
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/ai-analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"job_id":"test","files":[{"name":"test.txt","content":"test"}]}'

# Test sandbox-terminal function
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/sandbox-terminal \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"job_id":"test","tool":"ls","args":[]}'
```

### Common Cloud Mode Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "AI analysis failed" | Edge function error | Check logs, retry |
| No response | Network issue | Check connection |
| Wrong output | Context missing | Add more file content |
| Slow response | Large payload | Reduce file sizes |

---

## Common Issues

### Issue 1: Services Won't Start

**Symptoms:**
- `docker compose up` fails
- Containers exit immediately

**Diagnosis:**

```bash
# Check exit codes and reasons
docker compose -f ctf-autopilot/infra/docker-compose.yml ps -a

# Check specific container logs
docker compose -f ctf-autopilot/infra/docker-compose.yml logs api --tail 100
docker compose -f ctf-autopilot/infra/docker-compose.yml logs postgres --tail 100
```

**Common Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Missing .env file | `cp ctf-autopilot/.env.example /opt/ctf-compass/.env` |
| Port already in use | Change ports or stop conflicting service |
| Docker socket permission | `sudo chmod 666 /var/run/docker.sock` |

### Issue 2: API Returns 500 Errors

**Diagnosis:**

```bash
docker compose -f ctf-autopilot/infra/docker-compose.yml logs api --tail 200 | grep -A 10 "Traceback\|Error\|Exception"
```

**Solutions:**

| Cause | Solution |
|-------|----------|
| Database connection failed | Check POSTGRES_* env variables |
| Missing MEGALLM_API_KEY | Set via UI Settings page or use Cloud Mode |
| Redis connection failed | Check Redis container status |

### Issue 3: Jobs Stuck in "Running"

**Diagnosis:**

```bash
# Check worker status
docker compose -f ctf-autopilot/infra/docker-compose.yml logs worker --tail 200

# Check for stuck Celery tasks
docker compose -f ctf-autopilot/infra/docker-compose.yml exec worker celery -A app.tasks inspect active
```

**Solutions:**

```bash
# Restart worker
docker compose -f ctf-autopilot/infra/docker-compose.yml restart worker

# Clear stuck tasks (CAUTION: clears all pending tasks)
docker compose -f ctf-autopilot/infra/docker-compose.yml exec redis redis-cli FLUSHDB
```

### Issue 4: Full Autopilot Not Working

**Symptoms:**
- "Solve Challenge" button doesn't respond
- Progress stuck at 0%
- No analysis output

**Solutions:**

1. **Check mode**: Ensure not in Demo Mode
2. **Check console**: Open DevTools, look for errors
3. **Check network**: Ensure Edge Functions accessible
4. **Retry**: Refresh page and try again

### Issue 5: Flags Not Found

**Symptoms:**
- Autopilot completes but no flags
- Wrong flag format

**Solutions:**

1. **Check flag format**: Ensure regex matches CTF format
2. **Check solve script**: May need manual adjustments
3. **Run manually**: Execute script in real terminal
4. **Add context**: Include more challenge description

---

## Log Analysis

### View Logs by Service

```bash
cd /opt/ctf-compass

# Real-time logs (all services)
docker compose -f ctf-autopilot/infra/docker-compose.yml logs -f

# Real-time logs (specific service)
docker compose -f ctf-autopilot/infra/docker-compose.yml logs -f api
docker compose -f ctf-autopilot/infra/docker-compose.yml logs -f worker

# Last N lines
docker compose -f ctf-autopilot/infra/docker-compose.yml logs --tail 500 api
```

### Search Logs for Errors

```bash
# Find all errors
docker compose -f ctf-autopilot/infra/docker-compose.yml logs api 2>&1 | grep -i "error\|exception\|failed"

# Save logs to file for analysis
docker compose -f ctf-autopilot/infra/docker-compose.yml logs api > /tmp/api-logs.txt 2>&1
```

### Check CORS in Logs

```bash
# Check CORS startup config
docker logs ctf_compass_api 2>&1 | grep -E "CORS|cors|startup"

# Check for CORS-related errors
docker logs ctf_compass_api 2>&1 | grep -i "origin\|preflight"
```

### Browser Console Logs

For frontend issues:
1. Open DevTools (F12)
2. Go to Console tab
3. Look for red errors
4. Filter by "error" or component name
5. Look for "CORS" errors specifically

---

## Database Debugging

### Connect to Database

```bash
# Interactive PostgreSQL shell
docker compose -f ctf-autopilot/infra/docker-compose.yml exec postgres psql -U ctfautopilot -d ctfautopilot

# Run single query
docker compose -f ctf-autopilot/infra/docker-compose.yml exec postgres psql -U ctfautopilot -d ctfautopilot -c "SELECT COUNT(*) FROM jobs;"
```

### Common Queries

```sql
-- Check jobs status
SELECT status, COUNT(*) FROM jobs GROUP BY status;

-- Find stuck jobs
SELECT id, title, status, created_at 
FROM jobs 
WHERE status = 'running' 
AND created_at < NOW() - INTERVAL '1 hour';

-- Database size
SELECT pg_size_pretty(pg_database_size('ctfautopilot'));
```

### Database Backup & Restore

```bash
# Backup
docker compose -f ctf-autopilot/infra/docker-compose.yml exec -T postgres pg_dump -U ctfautopilot ctfautopilot > backup_$(date +%Y%m%d).sql

# Restore
docker compose -f ctf-autopilot/infra/docker-compose.yml exec -T postgres psql -U ctfautopilot ctfautopilot < backup_20240101.sql
```

---

## Sandbox Debugging

### Test Sandbox Manually

```bash
# Run interactive sandbox
docker run --rm -it \
  --network=none \
  --read-only \
  --tmpfs /tmp \
  --user sandbox \
  ctf-compass-sandbox:latest \
  /bin/bash

# Inside sandbox, test tools
strings --version
file --version
binwalk --help
checksec --version
```

### Rebuild Sandbox Image

```bash
cd /opt/ctf-compass
docker build -t ctf-compass-sandbox:latest -f ctf-autopilot/sandbox/image/Dockerfile ctf-autopilot/sandbox/image/
```

### Check Available Tools

```bash
# List installed tools
docker run --rm ctf-compass-sandbox:latest ls /usr/bin | head -50

# Check specific tool
docker run --rm ctf-compass-sandbox:latest which pwntools
```

---

## API & Frontend Debugging

### Check API Connectivity

```bash
# Test API from server
curl -s http://localhost:8000/api/health

# Test with verbose output
curl -v http://localhost:8000/api/health

# Test job creation
curl -X POST http://localhost:8000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"title":"test","description":"test"}'
```

### Check Frontend Build

```bash
# Check web container logs
docker compose -f ctf-autopilot/infra/docker-compose.yml logs web --tail 100

# Verify nginx is serving
curl -I http://localhost:3000
```

### React DevTools

1. Install React DevTools browser extension
2. Open DevTools
3. Go to "Components" or "Profiler" tab
4. Inspect component state and props

---

## Recovery Procedures

### Full Service Restart

```bash
cd /opt/ctf-compass

# Graceful restart
docker compose -f ctf-autopilot/infra/docker-compose.yml restart

# Full restart (if issues persist)
docker compose -f ctf-autopilot/infra/docker-compose.yml down
docker compose -f ctf-autopilot/infra/docker-compose.yml up -d

# Nuclear option (rebuilds everything)
docker compose -f ctf-autopilot/infra/docker-compose.yml down -v
docker compose -f ctf-autopilot/infra/docker-compose.yml up -d --build
```

### System Update (fixes most issues)

```bash
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh
```

### Clean Reinstall

```bash
curl -fsSL https://raw.githubusercontent.com/huynhtrungpc01/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash -s -- --clean
```

### Reset Frontend State

```javascript
// In browser console
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### Reset Backend URL

```javascript
// In browser console
localStorage.removeItem('ctf-compass-backend-url');
location.reload();
// Then reconfigure in Setup Wizard
```

---

## Debug Checklist

When debugging, follow this checklist:

### Setup & Connection
- [ ] Check Setup Wizard can connect to backend
- [ ] Test with CORS Tester (`/cors-tester`)
- [ ] Verify Backend URL is correct

### Infrastructure
- [ ] Check operation mode badge (Connected/Cloud/Demo)
- [ ] Check container status: `docker compose ps -a`
- [ ] Check service logs: `docker compose logs <service> --tail 100`
- [ ] Check disk space: `df -h /`
- [ ] Check memory: `free -h`

### API & Network
- [ ] Check API health: `curl http://localhost:8000/api/health`
- [ ] Check CORS headers: `curl -X OPTIONS ...`
- [ ] Check firewall: `sudo ufw status`

### Database & Cache
- [ ] Check database: `docker compose exec postgres pg_isready`
- [ ] Check Redis: `docker compose exec redis redis-cli ping`

### Configuration
- [ ] Check .env file exists and has CORS_ORIGINS
- [ ] Check file permissions: `ls -la /opt/ctf-compass/data`

### Frontend
- [ ] Check browser console for JS errors
- [ ] Check network tab for failed requests
- [ ] Look for CORS errors in console
- [ ] Try clearing localStorage

---

## Getting Help

- **Setup Issues**: Use Setup Wizard (`/`) and CORS Tester (`/cors-tester`)
- **Install Logs:** `/var/log/ctf-compass-install.log`
- **Update Logs:** `/var/log/ctf-compass-update.log`
- **Usage Guide:** [USAGE.md](./USAGE.md)
- **Runbook:** [RUNBOOK.md](./RUNBOOK.md)
- **GitHub Issues:** [github.com/huynhtrungpc01/ctf-compass/issues](https://github.com/huynhtrungpc01/ctf-compass/issues)
