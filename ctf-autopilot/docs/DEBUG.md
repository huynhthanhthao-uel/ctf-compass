# Debug & Troubleshooting Guide

Complete debugging guide for CTF Autopilot Analyzer. This document covers common issues, debugging commands, and step-by-step troubleshooting procedures.

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
cd /opt/ctf-autopilot/infra && \
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
cd /opt/ctf-autopilot/infra

# List all containers with status
docker compose ps -a

# Expected output:
# NAME                    STATUS
# ctf-autopilot-api-1     Up (healthy)
# ctf-autopilot-web-1     Up
# ctf-autopilot-worker-1  Up
# ctf-autopilot-postgres-1 Up (healthy)
# ctf-autopilot-redis-1   Up (healthy)
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

### Individual Service Health

```bash
# PostgreSQL
docker compose exec postgres pg_isready -U ctfautopilot -d ctfautopilot
# Expected: /var/run/postgresql:5432 - accepting connections

# Redis
docker compose exec redis redis-cli ping
# Expected: PONG

# Celery Worker
docker compose exec worker celery -A app.tasks inspect ping
# Expected: pong response from worker
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
docker compose logs worker --tail 100
```

**Common Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Missing .env file | `cp .env.example .env` and configure |
| Invalid POSTGRES_PASSWORD | Set a non-empty password in .env |
| Port already in use | Change ports or stop conflicting service |
| Docker socket permission | `sudo chmod 666 /var/run/docker.sock` |

### Issue 2: API Returns 500 Errors

**Symptoms:**
- Web UI shows errors
- API calls fail

**Diagnosis:**

```bash
# Check API logs for stack traces
docker compose logs api --tail 200 | grep -A 10 "Traceback\|Error\|Exception"

# Check if database is accessible
docker compose exec api python -c "from app.database import engine; engine.connect()"
```

**Common Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Database migration pending | `docker compose exec api alembic upgrade head` |
| Database connection failed | Check POSTGRES_* env variables |
| Missing MEGALLM_API_KEY | Set API key in .env |
| Out of memory | Increase container memory limits |

### Issue 3: Jobs Stuck in "Running"

**Symptoms:**
- Jobs never complete
- Status stays "running" indefinitely

**Diagnosis:**

```bash
# Check worker status
docker compose logs worker --tail 200

# Check for stuck Celery tasks
docker compose exec worker celery -A app.tasks inspect active

# Check Redis queue
docker compose exec redis redis-cli LLEN celery
```

**Solutions:**

```bash
# Restart worker
docker compose restart worker

# Clear stuck tasks (CAUTION: clears all pending tasks)
docker compose exec redis redis-cli FLUSHDB

# Force restart all services
docker compose down && docker compose up -d
```

### Issue 4: File Upload Fails

**Symptoms:**
- Upload returns error
- Files not saved

**Diagnosis:**

```bash
# Check upload directory permissions
ls -la /opt/ctf-autopilot/data/runs/

# Check disk space
df -h /opt/ctf-autopilot/data

# Check nginx upload limits (if using nginx)
grep client_max_body_size /opt/ctf-autopilot/infra/nginx/nginx.conf
```

**Solutions:**

```bash
# Fix permissions
sudo chown -R 1000:1000 /opt/ctf-autopilot/data
sudo chmod -R 755 /opt/ctf-autopilot/data

# Increase upload limit in .env
MAX_UPLOAD_SIZE_MB=500
```

### Issue 5: Sandbox Container Fails

**Symptoms:**
- Analysis doesn't run
- "Sandbox error" in job logs

**Diagnosis:**

```bash
# Check if sandbox image exists
docker images | grep ctf-autopilot-sandbox

# Test sandbox manually
docker run --rm -it --network=none ctf-autopilot-sandbox:latest /bin/bash

# Check Docker socket access
docker compose exec api docker ps
```

**Solutions:**

```bash
# Rebuild sandbox image
docker build -t ctf-autopilot-sandbox:latest -f sandbox/image/Dockerfile sandbox/image/

# Fix Docker socket permissions
sudo chmod 666 /var/run/docker.sock

# Check seccomp/AppArmor profiles
docker run --rm --security-opt apparmor=unconfined ctf-autopilot-sandbox:latest echo "test"
```

---

## Log Analysis

### View Logs by Service

```bash
cd /opt/ctf-autopilot/infra

# Real-time logs (all services)
docker compose logs -f

# Real-time logs (specific service)
docker compose logs -f api
docker compose logs -f worker
docker compose logs -f postgres

# Last N lines
docker compose logs --tail 500 api

# Since timestamp
docker compose logs --since "2024-01-01T00:00:00" api

# With timestamps
docker compose logs -t api
```

### Search Logs for Errors

```bash
# Find all errors
docker compose logs api 2>&1 | grep -i "error\|exception\|failed"

# Find specific error type
docker compose logs api 2>&1 | grep -i "database"

# Save logs to file for analysis
docker compose logs api > /tmp/api-logs.txt 2>&1
```

### Log Rotation

```bash
# Check log sizes
docker system df -v

# Clear old logs (CAUTION: loses log history)
docker compose down
docker system prune -f
docker compose up -d
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

-- Check recent errors
SELECT id, title, error_message, created_at 
FROM jobs 
WHERE status = 'failed' 
ORDER BY created_at DESC 
LIMIT 10;

-- Database size
SELECT pg_size_pretty(pg_database_size('ctfautopilot'));
```

### Database Backup & Restore

```bash
# Backup
docker compose exec -T postgres pg_dump -U ctfautopilot ctfautopilot > backup_$(date +%Y%m%d).sql

# Restore
docker compose exec -T postgres psql -U ctfautopilot ctfautopilot < backup_20240101.sql

# Reset database (CAUTION: deletes all data)
docker compose down -v
docker compose up -d
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
  ctf-autopilot-sandbox:latest \
  /bin/bash

# Inside sandbox, test tools
strings --version
file --version
binwalk --help
```

### Check Sandbox Security

```bash
# Verify no network access
docker run --rm --network=none ctf-autopilot-sandbox:latest ping -c 1 google.com
# Should fail: Network is unreachable

# Verify read-only filesystem
docker run --rm --read-only ctf-autopilot-sandbox:latest touch /test
# Should fail: Read-only file system

# Verify user is non-root
docker run --rm ctf-autopilot-sandbox:latest id
# Should show: uid=1000(sandbox) gid=1000(sandbox)
```

### Debug Analysis Execution

```bash
# Check what commands were run for a job
cat /opt/ctf-autopilot/data/runs/<JOB_ID>/logs/commands.log

# Check tool outputs
ls -la /opt/ctf-autopilot/data/runs/<JOB_ID>/output/

# Check extracted evidence
cat /opt/ctf-autopilot/data/runs/<JOB_ID>/evidence.json | jq .
```

---

## Network Debugging

### Check Port Bindings

```bash
# List all listening ports
sudo netstat -tlnp | grep -E "3000|8000|5432|6379"

# Or with ss
sudo ss -tlnp | grep -E "3000|8000|5432|6379"
```

### Check Firewall Rules

```bash
# UFW status
sudo ufw status verbose

# Expected:
# 22/tcp    ALLOW IN    Anywhere
# 80/tcp    ALLOW IN    Anywhere
# 443/tcp   ALLOW IN    Anywhere
```

### Test Internal Connectivity

```bash
# From API to database
docker compose exec api python -c "
import socket
s = socket.socket()
s.connect(('postgres', 5432))
print('PostgreSQL: OK')
s.close()
"

# From API to Redis
docker compose exec api python -c "
import socket
s = socket.socket()
s.connect(('redis', 6379))
print('Redis: OK')
s.close()
"
```

---

## Performance Issues

### High Memory Usage

```bash
# Check container memory usage
docker stats --no-stream

# Check host memory
free -h

# Reduce worker concurrency
# Edit docker-compose.yml, change:
# command: celery -A app.tasks worker --loglevel=info --concurrency=1
```

### Slow Job Processing

```bash
# Check queue length
docker compose exec redis redis-cli LLEN celery

# Check active tasks
docker compose exec worker celery -A app.tasks inspect active

# Increase workers
docker compose up -d --scale worker=2
```

### Disk Space Issues

```bash
# Check disk usage
df -h /
du -sh /opt/ctf-autopilot/data/*

# Clean old job data (older than 30 days)
find /opt/ctf-autopilot/data/runs -mtime +30 -delete

# Clean Docker
docker system prune -f
docker image prune -a -f
```

---

## Recovery Procedures

### Full Service Restart

```bash
cd /opt/ctf-autopilot/infra

# Graceful restart
docker compose restart

# Full restart (if issues persist)
docker compose down
docker compose up -d

# Nuclear option (rebuilds everything)
docker compose down -v
docker compose up -d --build
```

### Reset to Clean State

```bash
# CAUTION: This deletes ALL data

cd /opt/ctf-autopilot/infra

# Stop and remove everything
docker compose down -v

# Remove data
rm -rf ../data/runs/*

# Rebuild and start
docker compose up -d --build
```

### Restore from Backup

```bash
# Stop services
docker compose down

# Restore database
docker compose up -d postgres
sleep 10
docker compose exec -T postgres psql -U ctfautopilot ctfautopilot < backup.sql

# Restore files
tar -xzf data-backup.tar.gz -C /opt/ctf-autopilot/

# Start all services
docker compose up -d
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
- [ ] Check file permissions: `ls -la /opt/ctf-autopilot/data`
- [ ] Check firewall: `sudo ufw status`

---

## Getting Help

If you're still stuck:

1. Check the full log file: `/var/log/ctf-autopilot-install.log`
2. Create a debug bundle:
   ```bash
   cd /opt/ctf-autopilot
   mkdir -p /tmp/ctf-debug
   docker compose -f infra/docker-compose.yml logs > /tmp/ctf-debug/docker-logs.txt 2>&1
   docker compose -f infra/docker-compose.yml ps -a > /tmp/ctf-debug/containers.txt
   cp .env /tmp/ctf-debug/env.txt
   sed -i 's/=.*/=REDACTED/' /tmp/ctf-debug/env.txt  # Remove sensitive values
   tar -czf /tmp/ctf-debug-$(date +%Y%m%d).tar.gz -C /tmp ctf-debug
   ```
3. Open an issue with the debug bundle attached
