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
7. [Network Debugging](#network-debugging)
8. [Performance Issues](#performance-issues)
9. [Recovery Procedures](#recovery-procedures)

---

## Quick Diagnostics

### One-Command Health Check

```bash
# Run full system diagnostic
cd /opt/ctf-compass && \
echo "=== Container Status ===" && docker compose ps && \
echo -e "\n=== API Health ===" && curl -sf http://localhost:8000/api/health || echo "API not responding" && \
echo -e "\n=== Database ===" && docker compose exec -T postgres pg_isready && \
echo -e "\n=== Redis ===" && docker compose exec -T redis redis-cli ping && \
echo -e "\n=== Web UI ===" && curl -sf http://localhost:3000 > /dev/null && echo "Web UI OK" || echo "Web UI not responding"
```

### System Resource Check

```bash
# Check memory, CPU, and disk
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

# List all containers with status
docker compose ps -a

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
#   "database": "connected",
#   "redis": "connected",
#   "version": "1.0.0"
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
docker compose ps -a

# Check specific container logs
docker compose logs api --tail 100
docker compose logs postgres --tail 100
```

**Common Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Missing .env file | `cp .env.example .env` and configure |
| Invalid POSTGRES_PASSWORD | Set a non-empty password in .env |
| Port already in use | Change ports or stop conflicting service |
| Docker socket permission | `sudo chmod 666 /var/run/docker.sock` |

### Issue 2: API Returns 500 Errors

**Diagnosis:**

```bash
# Check API logs for stack traces
docker compose logs api --tail 200 | grep -A 10 "Traceback\|Error\|Exception"
```

**Solutions:**

| Cause | Solution |
|-------|----------|
| Database migration pending | `docker compose exec api alembic upgrade head` |
| Database connection failed | Check POSTGRES_* env variables |
| Missing MEGALLM_API_KEY | Set API key in .env |

### Issue 3: Jobs Stuck in "Running"

**Diagnosis:**

```bash
# Check worker status
docker compose logs worker --tail 200

# Check for stuck Celery tasks
docker compose exec worker celery -A app.tasks inspect active
```

**Solutions:**

```bash
# Restart worker
docker compose restart worker

# Clear stuck tasks (CAUTION: clears all pending tasks)
docker compose exec redis redis-cli FLUSHDB
```

### Issue 4: Sandbox Container Fails

**Diagnosis:**

```bash
# Check if sandbox image exists
docker images | grep ctf-compass-sandbox

# Test sandbox manually
docker run --rm -it --network=none ctf-compass-sandbox:latest /bin/bash
```

**Solutions:**

```bash
# Rebuild sandbox image
cd /opt/ctf-compass
docker build -t ctf-compass-sandbox:latest -f ctf-autopilot/sandbox/image/Dockerfile ctf-autopilot/sandbox/image/
```

---

## Log Analysis

### View Logs by Service

```bash
cd /opt/ctf-compass

# Real-time logs (all services)
docker compose logs -f

# Real-time logs (specific service)
docker compose logs -f api
docker compose logs -f worker

# Last N lines
docker compose logs --tail 500 api
```

### Search Logs for Errors

```bash
# Find all errors
docker compose logs api 2>&1 | grep -i "error\|exception\|failed"

# Save logs to file for analysis
docker compose logs api > /tmp/api-logs.txt 2>&1
```

---

## Database Debugging

### Connect to Database

```bash
# Interactive PostgreSQL shell
docker compose exec postgres psql -U ctfautopilot -d ctfautopilot

# Run single query
docker compose exec postgres psql -U ctfautopilot -d ctfautopilot -c "SELECT COUNT(*) FROM jobs;"
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
docker compose exec -T postgres pg_dump -U ctfautopilot ctfautopilot > backup_$(date +%Y%m%d).sql

# Restore
docker compose exec -T postgres psql -U ctfautopilot ctfautopilot < backup_20240101.sql
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

### Check Sandbox Security

```bash
# Verify no network access
docker run --rm --network=none ctf-compass-sandbox:latest ping -c 1 google.com
# Should fail: Network is unreachable

# Verify user is non-root
docker run --rm ctf-compass-sandbox:latest id
# Should show: uid=1000(sandbox) gid=1000(sandbox)
```

---

## Recovery Procedures

### Full Service Restart

```bash
cd /opt/ctf-compass

# Graceful restart
docker compose restart

# Full restart (if issues persist)
docker compose down
docker compose up -d

# Nuclear option (rebuilds everything)
docker compose down -v
docker compose up -d --build
```

### System Update (fixes most issues)

```bash
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh
```

---

## Debug Checklist

When debugging, follow this checklist:

- [ ] Check container status: `docker compose ps -a`
- [ ] Check service logs: `docker compose logs <service> --tail 100`
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

- **Full Logs:** `/var/log/ctf-compass-install.log`
- **GitHub Issues:** [github.com/huynhtrungcipp/ctf-compass/issues](https://github.com/huynhtrungcipp/ctf-compass/issues)
- **Documentation:** [ctf-autopilot/docs/](.)
