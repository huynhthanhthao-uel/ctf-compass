# Runbook

Operations and troubleshooting guide for CTF Compass.

**GitHub:** [github.com/huynhtrungcipp/ctf-compass](https://github.com/huynhtrungcipp/ctf-compass)

---

## Installation

### Prerequisites

- Ubuntu 24.04 LTS
- Docker Engine 24.0+
- Docker Compose v2.20+
- 4GB RAM minimum
- 20GB disk space

### Quick Install

```bash
# One-command installation
curl -fsSL https://raw.githubusercontent.com/huynhtrungcipp/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash
```

### Clean Install (Remove Old First)

```bash
# Stop and cleanup old installation
sudo docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml down -v 2>/dev/null || true
sudo rm -rf /opt/ctf-compass /opt/ctf-compass-backups
sudo docker system prune -af

# Fresh install
curl -fsSL https://raw.githubusercontent.com/huynhtrungcipp/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash
```

### Manual Install

```bash
# Clone repository
git clone https://github.com/huynhtrungcipp/ctf-compass.git
cd ctf-compass

# Install Docker
curl -fsSL https://get.docker.com | bash
sudo usermod -aG docker $USER
newgrp docker

# Configure environment
cp ctf-autopilot/.env.example .env
nano .env  # Set MEGALLM_API_KEY

# Start services
./ctf-autopilot/infra/scripts/prod_up.sh
```

---

## Configuration

### Required Environment Variables

```bash
# .env (in project root)
MEGALLM_API_KEY=your-api-key-here
ADMIN_PASSWORD=strong-password-here
POSTGRES_PASSWORD=database-password-here
```

### Optional Settings

See `ctf-autopilot/.env.example` for all available options.

---

## TLS Configuration

### Development (Self-Signed)

```bash
# Generate self-signed certificate
./ctf-autopilot/infra/scripts/generate_self_signed_cert.sh

# Start with TLS
ENABLE_TLS=true ./ctf-autopilot/infra/scripts/prod_up.sh
```

### Production (Let's Encrypt)

1. Set domain in `.env`:
   ```bash
   ENABLE_TLS=true
   TLS_DOMAIN=ctfcompass.example.com
   LETSENCRYPT_EMAIL=admin@example.com
   ```

2. Ensure ports 80 and 443 are accessible

3. Start with Let's Encrypt profile

---

## Operations

### Starting Services

```bash
# Production (from install directory)
cd /opt/ctf-compass
./ctf-autopilot/infra/scripts/prod_up.sh

# Or using docker compose directly
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml up -d

# Development
./ctf-autopilot/infra/scripts/dev_up.sh
```

### Stopping Services

```bash
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml down
```

### Viewing Logs

```bash
# All services
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml logs -f

# Specific service
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml logs -f api
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml logs -f worker
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml logs -f web
```

### System Update

```bash
# Check for updates
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh --check

# Perform update (includes cleanup)
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh
```

### Database Backup

```bash
# Backup
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml exec -T postgres pg_dump -U ctfautopilot ctfautopilot > backup.sql

# Restore
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml exec -T postgres psql -U ctfautopilot ctfautopilot < backup.sql
```

---

## Cleanup & Maintenance

### Remove Old Docker Resources

```bash
# Remove stopped containers
docker container prune -f

# Remove dangling images
docker image prune -f

# Remove unused volumes (WARNING: deletes data)
docker volume prune -f

# Full cleanup (removes all unused resources)
docker system prune -af
```

### Complete Uninstall

```bash
# Stop services
sudo docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml down -v

# Remove installation
sudo rm -rf /opt/ctf-compass
sudo rm -rf /opt/ctf-compass-backups
sudo rm -f /var/log/ctf-compass-*.log

# Remove Docker images
sudo docker rmi $(docker images | grep -E 'ctf-compass|ctf-autopilot' | awk '{print $3}') 2>/dev/null || true

# Remove sandbox image
sudo docker rmi ctf-compass-sandbox:latest 2>/dev/null || true
sudo docker rmi ctf-autopilot-sandbox:latest 2>/dev/null || true
```

---

## Troubleshooting

### Build Errors

```bash
# Clean Docker build cache
docker builder prune -af

# Rebuild from scratch
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml build --no-cache
```

### Job Stuck in "Running"

```bash
# Check worker logs
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml logs -f worker

# Restart worker
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml restart worker
```

### Sandbox Container Not Starting

```bash
# Check Docker socket access
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml exec api docker ps

# Rebuild sandbox image
docker build -t ctf-compass-sandbox:latest -f /opt/ctf-compass/ctf-autopilot/sandbox/image/Dockerfile /opt/ctf-compass/ctf-autopilot/sandbox/image/
```

### Database Connection Error

```bash
# Check postgres is running
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml ps postgres

# Check connection
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml exec postgres pg_isready
```

### Port Already in Use

```bash
# Check what's using the port
sudo lsof -i :3000
sudo lsof -i :8000

# Kill process or change port in .env
WEB_PORT=3001
API_PORT=8001
```

### High Memory Usage

```bash
# Check container stats
docker stats

# Restart services to free memory
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml restart
```

---

## Monitoring

### Health Check

```bash
curl http://localhost:8000/api/health
```

### Check All Services

```bash
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml ps
```

---

## Security Checklist

### Before Going Live

- [ ] Changed `ADMIN_PASSWORD` from default
- [ ] Set strong `POSTGRES_PASSWORD`
- [ ] Configured `SECRET_KEY`
- [ ] Enabled TLS
- [ ] Configured firewall (only 80/443 exposed)
- [ ] Reviewed rate limits
- [ ] Tested file upload restrictions

### Regular Maintenance

- [ ] Rotate passwords quarterly
- [ ] Update system monthly (`update.sh`)
- [ ] Review logs weekly
- [ ] Test backups monthly
- [ ] Cleanup Docker resources monthly

---

## Upgrading

```bash
# Update from GitHub (includes cleanup)
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh
```

## Rollback

```bash
# Revert to previous version
cd /opt/ctf-compass
git checkout <previous-tag>

# Rebuild
docker compose -f ctf-autopilot/infra/docker-compose.yml up -d --build
```

---

## Getting Help

- **Documentation:** [ctf-autopilot/docs/](.)
- **Debug Guide:** [DEBUG.md](DEBUG.md)
- **GitHub Issues:** [github.com/huynhtrungcipp/ctf-compass/issues](https://github.com/huynhtrungcipp/ctf-compass/issues)
