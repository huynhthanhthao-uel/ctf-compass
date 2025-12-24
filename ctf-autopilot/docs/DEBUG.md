# Debug & Troubleshooting Guide

Complete debugging guide for CTF Compass. This document covers common issues, debugging commands, and step-by-step troubleshooting procedures.

**GitHub:** [github.com/huynhtrungcipp/ctf-compass](https://github.com/huynhtrungcipp/ctf-compass)

---

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Service Status & Health](#service-status--health)
3. [Common Issues](#common-issues)
4. [Log Analysis](#log-analysis)
5. [Database Debugging](#database-debugging)
6. [Sandbox Debugging](#sandbox-debugging)
7. [API & Frontend Debugging](#api--frontend-debugging)
8. [Recovery Procedures](#recovery-procedures)

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

---

## Service Status & Health

### Check All Container Status

```bash
cd /opt/ctf-compass
docker compose -f ctf-autopilot/infra/docker-compose.yml ps -a

# Expected output:
# NAME                    STATUS
# ctf-compass-api-1       Up (healthy)
# ctf-compass-web-1       Up
# ctf-compass-worker-1    Up
# ctf-compass-postgres-1  Up (healthy)
# ctf-compass-redis-1     Up (healthy)
```

### Health Check Endpoints

```bash
# API health check (detailed)
curl -s http://localhost:8000/api/health | jq .

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2024-01-01T00:00:00.000000",
#   "service": "ctf-autopilot-api"
# }
```

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
| Missing .env file | `cp ctf-autopilot/.env.example .env` and configure |
| Invalid POSTGRES_PASSWORD | Set a non-empty password in .env |
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
| Missing MEGALLM_API_KEY | Set via UI Settings page or .env |
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

### Issue 4: API Key Not Working

**Symptoms:**
- Analysis jobs fail with API errors
- "API key not configured" messages

**Solutions:**

1. **Via Web UI (Recommended):**
   - Go to Settings page (⚙️ icon)
   - Enter your MegaLLM API key
   - Click "Test Connection" then "Save"

2. **Via .env file:**
   ```bash
   sudo nano /opt/ctf-compass/.env
   # Add: MEGALLM_API_KEY=your-key-here
   
   # Restart services
   docker compose -f ctf-autopilot/infra/docker-compose.yml restart api worker
   ```

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
```

### Rebuild Sandbox Image

```bash
cd /opt/ctf-compass
docker build -t ctf-compass-sandbox:latest -f ctf-autopilot/sandbox/image/Dockerfile ctf-autopilot/sandbox/image/
```

---

## API & Frontend Debugging

### Check API Connectivity

```bash
# Test API from server
curl -s http://localhost:8000/api/health

# Test with verbose output
curl -v http://localhost:8000/api/health
```

### Check Frontend Build

```bash
# Check web container logs
docker compose -f ctf-autopilot/infra/docker-compose.yml logs web --tail 100

# Verify nginx is serving
curl -I http://localhost:3000
```

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
curl -fsSL https://raw.githubusercontent.com/huynhtrungcipp/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash -s -- --clean
```

---

## Debug Checklist

When debugging, follow this checklist:

- [ ] Check container status: `docker compose -f ctf-autopilot/infra/docker-compose.yml ps -a`
- [ ] Check service logs: `docker compose -f ctf-autopilot/infra/docker-compose.yml logs <service> --tail 100`
- [ ] Check disk space: `df -h /`
- [ ] Check memory: `free -h`
- [ ] Check API health: `curl http://localhost:8000/api/health`
- [ ] Check database: `docker compose exec postgres pg_isready`
- [ ] Check Redis: `docker compose exec redis redis-cli ping`
- [ ] Check .env file exists and is configured
- [ ] Check file permissions: `ls -la /opt/ctf-compass/data`
- [ ] Check firewall: `sudo ufw status`

---

## Getting Help

- **Install Logs:** `/var/log/ctf-compass-install.log`
- **GitHub Issues:** [github.com/huynhtrungcipp/ctf-compass/issues](https://github.com/huynhtrungcipp/ctf-compass/issues)
- **Documentation:** [ctf-autopilot/docs/](.)
