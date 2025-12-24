# Runbook

## Installation

### Prerequisites

- Ubuntu 24.04 LTS
- Docker Engine 24.0+
- Docker Compose v2.20+
- 4GB RAM minimum
- 20GB disk space

### Quick Install

```bash
# Download and run install script
curl -fsSL https://raw.githubusercontent.com/your-org/ctf-autopilot/main/infra/scripts/install_ubuntu_24.04.sh | bash
```

### Manual Install

```bash
# Install Docker
curl -fsSL https://get.docker.com | bash
sudo usermod -aG docker $USER
newgrp docker

# Clone repository
git clone https://github.com/your-org/ctf-autopilot.git
cd ctf-autopilot

# Configure environment
cp .env.example .env
nano .env  # Edit and set required values

# Build and start
docker compose up -d --build
```

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

## TLS Configuration

### Development (Self-Signed)

```bash
# Generate self-signed certificate
./infra/scripts/generate_self_signed_cert.sh

# Start with TLS
docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d
```

### Production (Let's Encrypt)

1. Set domain in `.env`:
   ```bash
   ENABLE_TLS=true
   TLS_DOMAIN=ctfautopilot.example.com
   LETSENCRYPT_EMAIL=admin@example.com
   ```

2. Ensure ports 80 and 443 are accessible

3. Start with Let's Encrypt:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.letsencrypt.yml up -d
   ```

## Operations

### Starting Services

```bash
# Production
./infra/scripts/prod_up.sh

# Development
./infra/scripts/dev_up.sh
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

### Database Backup

```bash
# Backup
docker compose exec postgres pg_dump -U ctfautopilot ctfautopilot > backup.sql

# Restore
docker compose exec -T postgres psql -U ctfautopilot ctfautopilot < backup.sql
```

### Cleaning Up Old Jobs

```bash
# Remove jobs older than 30 days
docker compose exec api python -m app.scripts.cleanup --days 30
```

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
docker images | grep ctf-sandbox
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

## Monitoring

### Health Check

```bash
curl http://localhost:8000/api/health
```

### Metrics (if enabled)

```bash
curl http://localhost:8000/metrics
```

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

## Upgrading

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker compose down
docker compose up -d --build
```

## Rollback

```bash
# Revert to previous version
git checkout <previous-tag>

# Rebuild
docker compose up -d --build
```
