# CTF Compass - Operations Runbook

Operations and maintenance guide for CTF Compass.

**GitHub:** [github.com/HaryLya/ctf-compass](https://github.com/HaryLya/ctf-compass)

---

## Table of Contents
1. [Installation](#installation)
2. [Configuration](#configuration)
3. [Operations](#operations)
4. [Maintenance](#maintenance)
5. [Backup & Recovery](#backup--recovery)
6. [TLS Configuration](#tls-configuration)
7. [Troubleshooting](#troubleshooting)
8. [Security Checklist](#security-checklist)

---

## Installation

### Prerequisites

- Ubuntu 24.04 LTS
- Docker Engine 24.0+
- Docker Compose v2.20+
- 4GB RAM minimum (8GB recommended)
- 20GB disk space

### Quick Deploy (One-Line)

```bash
curl -fsSL https://raw.githubusercontent.com/HaryLya/ctf-compass/main/ctf-autopilot/infra/scripts/deploy.sh | bash
```

**Default Password: `admin`**

### Full Install

### Clean Install (Remove Old First)

```bash
# Use --clean flag to remove previous installation
curl -fsSL https://raw.githubusercontent.com/HaryLya/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash -s -- --clean
```

### Manual Install

```bash
# Clone repository
git clone https://github.com/HaryLya/ctf-compass.git
cd ctf-compass

# Install Docker if not installed
curl -fsSL https://get.docker.com | bash
sudo usermod -aG docker $USER
newgrp docker

# Configure environment
cp ctf-autopilot/.env.example .env
nano .env  # Set required values

# Start services
./ctf-autopilot/infra/scripts/prod_up.sh
```

### Post-Installation

1. Access Web UI at `http://YOUR_SERVER_IP:3000`
2. Login with password: `admin`
3. Go to **Configuration** page to set MegaLLM API key (optional)
4. Start analyzing CTF challenges!

---

## Configuration

### Default Credentials

| Credential | Default Value |
|------------|---------------|
| `ADMIN_PASSWORD` | `admin` |
| `POSTGRES_USER` | `ctfautopilot` |
| `POSTGRES_PASSWORD` | `ctfautopilot` |

### Optional Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MEGALLM_API_KEY` | (empty) | AI API key (optional for Cloud Mode) |
| `MAX_UPLOAD_SIZE_MB` | 200 | Maximum file upload size |
| `SANDBOX_TIMEOUT_SECONDS` | 60 | Per-command timeout |
| `MEGALLM_MODEL` | llama3.3-70b-instruct | AI model to use |
| `ENVIRONMENT` | production | production/development |
| `DEBUG` | false | Enable debug mode |

### Configuration Files

```
/opt/ctf-compass/
├── .env                    # Main configuration
├── CREDENTIALS.txt         # Generated credentials
└── ctf-autopilot/
    └── infra/
        └── .env            # Copy for docker-compose
```

---

## Operations

### Service Management

```bash
# Start all services
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml up -d

# Stop all services
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml down

# Restart all services
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml restart

# Restart specific service
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml restart api
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml restart worker

# Check status
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml ps
```

### Viewing Logs

```bash
# All services (follow mode)
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml logs -f

# Specific service
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml logs -f api
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml logs -f worker
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml logs -f web

# Last N lines
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml logs --tail=100

# Since time
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml logs --since=1h
```

### Health Checks

```bash
# Quick health check
curl -sf http://localhost:8000/api/health && echo "API: OK"
curl -sf http://localhost:3000 > /dev/null && echo "Web: OK"

# Detailed check
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml ps

# Container resource usage
docker stats --no-stream
```

---

## Maintenance

### System Update

```bash
# Check for updates
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh --check

# Perform update (includes cleanup)
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh

# Force deep cleanup and update
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh --clean
```

### Docker Cleanup

```bash
# Remove stopped containers
docker container prune -f

# Remove dangling images
docker image prune -f

# Remove unused volumes (WARNING: may delete data)
docker volume prune -f

# Full cleanup (removes all unused resources)
docker system prune -af

# Show disk usage
docker system df
```

### Uninstall

```bash
# Interactive uninstall
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/uninstall.sh

# Force uninstall (no prompts)
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/uninstall.sh --force

# Keep database data
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/uninstall.sh --keep-data
```

### Manual Cleanup

```bash
# Stop services and remove volumes
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml down -v

# Remove installation directory
sudo rm -rf /opt/ctf-compass
sudo rm -rf /opt/ctf-compass-backups
sudo rm -f /var/log/ctf-compass-*.log

# Remove Docker images
docker rmi $(docker images | grep -E 'ctf[-_]compass|ctf[-_]autopilot' | awk '{print $3}') 2>/dev/null || true
```

---

## Backup & Recovery

### Database Backup

```bash
# Backup to file
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml \
  exec -T postgres pg_dump -U ctfautopilot ctfautopilot > backup_$(date +%Y%m%d).sql

# Compressed backup
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml \
  exec -T postgres pg_dump -U ctfautopilot ctfautopilot | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Database Restore

```bash
# Restore from file
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml \
  exec -T postgres psql -U ctfautopilot ctfautopilot < backup.sql

# Restore from compressed file
gunzip -c backup.sql.gz | docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml \
  exec -T postgres psql -U ctfautopilot ctfautopilot
```

### Configuration Backup

```bash
# Backup configuration
mkdir -p /opt/ctf-compass-backups
cp /opt/ctf-compass/.env /opt/ctf-compass-backups/env_$(date +%Y%m%d)
cp /opt/ctf-compass/CREDENTIALS.txt /opt/ctf-compass-backups/credentials_$(date +%Y%m%d)
```

### Full System Backup

```bash
# Create full backup archive
cd /opt/ctf-compass
tar -czf /opt/ctf-compass-backups/full_backup_$(date +%Y%m%d).tar.gz \
  .env CREDENTIALS.txt data/
```

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

1. Configure domain in `.env`:
   ```bash
   ENABLE_TLS=true
   TLS_DOMAIN=ctfcompass.example.com
   LETSENCRYPT_EMAIL=admin@example.com
   ```

2. Ensure ports 80 and 443 are accessible from internet

3. Start services:
   ```bash
   ./ctf-autopilot/infra/scripts/prod_up.sh
   ```

### Manual Nginx Configuration

```nginx
# /etc/nginx/sites-available/ctf-compass
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
    
    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /ws {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "Demo Mode" on login | Backend not running - `docker compose ps` |
| Job stuck in "Queued" | Restart worker - `docker compose restart worker` |
| API Key not saving | Check file permissions on `.env` |
| Container keeps restarting | Check logs - `docker compose logs [service]` |
| Port already in use | Change port in `.env` or kill existing process |

### Diagnostic Commands

```bash
# Check all services
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml ps

# View recent errors
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml logs --tail=50 2>&1 | grep -i error

# Check resource usage
docker stats --no-stream

# Check disk space
df -h /

# Check memory
free -h
```

### Recovery Commands

```bash
# Restart all services
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml restart

# Rebuild containers
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml up -d --build

# Reset to clean state (DESTROYS DATA)
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml down -v
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml up -d --build
```

---

## Security Checklist

### Pre-Deployment (For Public Deployment)

- [ ] Changed `ADMIN_PASSWORD` from default `admin`
- [ ] Set strong `POSTGRES_PASSWORD`
- [ ] Set MegaLLM API key via Settings page (optional)
- [ ] Enabled TLS (for production)
- [ ] Configured firewall (UFW)
- [ ] Tested file upload restrictions
- [ ] Verified sandbox isolation

> **Note:** For local-only deployment, default credentials are acceptable.

### Regular Maintenance

- [ ] Rotate passwords quarterly
- [ ] Update system monthly (`update.sh`)
- [ ] Review logs weekly
- [ ] Test backups monthly
- [ ] Cleanup Docker resources monthly
- [ ] Security scan dependencies quarterly

### Firewall Rules

```bash
# View current rules
sudo ufw status verbose

# Recommended rules
sudo ufw allow ssh
sudo ufw allow 3000/tcp  # Web UI
sudo ufw allow 8000/tcp  # API (optional)
sudo ufw enable
```

---

## Getting Help

- **Debug Guide:** [DEBUG.md](DEBUG.md)
- **User Guide:** [USAGE.md](USAGE.md)
- **Security:** [SECURITY.md](SECURITY.md)
- **Architecture:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **GitHub Issues:** [github.com/HaryLya/ctf-compass/issues](https://github.com/HaryLya/ctf-compass/issues)
