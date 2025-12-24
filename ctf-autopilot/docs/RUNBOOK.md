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
cp .env.example .env
nano .env  # Set MEGALLM_API_KEY

# Start services
./ctf-autopilot/infra/scripts/prod_up.sh
```

---

## Configuration

### Required Environment Variables

```bash
# .env
MEGALLM_API_KEY=your-api-key-here
ADMIN_PASSWORD=strong-password-here
POSTGRES_PASSWORD=database-password-here
```

### Optional Settings

See `.env.example` for all available options.

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
# Production
./ctf-autopilot/infra/scripts/prod_up.sh

# Development
./ctf-autopilot/infra/scripts/dev_up.sh
```

### Stopping Services

```bash
docker compose down
```

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f worker
```

### System Update

```bash
# Check for updates
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh --check

# Perform update
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh
```

### Database Backup

```bash
# Backup
docker compose exec postgres pg_dump -U ctfautopilot ctfautopilot > backup.sql

# Restore
docker compose exec -T postgres psql -U ctfautopilot ctfautopilot < backup.sql
```

---

## Troubleshooting

### Job Stuck in "Running"

```bash
# Check worker logs
docker compose logs -f worker

# Restart worker
docker compose restart worker
```

### Sandbox Container Not Starting

```bash
# Check Docker socket access
docker compose exec api docker ps

# Verify sandbox image exists
docker images | grep ctf-compass-sandbox
```

### Database Connection Error

```bash
# Check postgres is running
docker compose ps postgres

# Check connection
docker compose exec postgres pg_isready
```

### High Memory Usage

```bash
# Check container stats
docker stats

# Adjust limits in docker-compose.yml
```

---

## Monitoring

### Health Check

```bash
curl http://localhost:8000/api/health
```

### Metrics (if enabled)

```bash
curl http://localhost:8000/metrics
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
- [ ] Update containers monthly
- [ ] Review logs weekly
- [ ] Test backups monthly

---

## Upgrading

```bash
# Update from GitHub
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh
```

## Rollback

```bash
# Revert to previous version
cd /opt/ctf-compass
git checkout <previous-tag>

# Rebuild
docker compose up -d --build
```

---

## Getting Help

- **Documentation:** [ctf-autopilot/docs/](.)
- **Debug Guide:** [DEBUG.md](DEBUG.md)
- **GitHub Issues:** [github.com/huynhtrungcipp/ctf-compass/issues](https://github.com/huynhtrungcipp/ctf-compass/issues)
