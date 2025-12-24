# CTF Compass

**AI-powered CTF challenge solver with sandboxed execution environment.**

[![GitHub](https://img.shields.io/badge/GitHub-huynhtrungcipp%2Fctf--compass-blue?logo=github)](https://github.com/huynhtrungcipp/ctf-compass)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 🚀 Quick Deploy

### One-Command Installation (Ubuntu 24.04)

```bash
curl -fsSL https://raw.githubusercontent.com/huynhtrungcipp/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash
```

### Manual Installation

```bash
# 1. Clone repository
git clone https://github.com/huynhtrungcipp/ctf-compass.git
cd ctf-compass

# 2. Install Docker (if not installed)
curl -fsSL https://get.docker.com | bash
sudo usermod -aG docker $USER
newgrp docker

# 3. Configure environment
cp .env.example .env
nano .env  # Set MEGALLM_API_KEY and other settings

# 4. Start production services
./ctf-autopilot/infra/scripts/prod_up.sh
```

---

## 📋 Requirements

- **OS:** Ubuntu 24.04 LTS (recommended)
- **Docker:** Engine 24.0+ with Compose v2.20+
- **RAM:** 4GB minimum, 8GB recommended
- **Disk:** 20GB minimum
- **API Key:** MegaLLM API key for AI features

---

## ⚙️ Configuration

### Required Environment Variables

```bash
# .env file
MEGALLM_API_KEY=your-api-key-here      # Required for AI features
ADMIN_PASSWORD=strong-password-here     # Admin login password
POSTGRES_PASSWORD=db-password-here      # Database password
SECRET_KEY=random-secret-key            # JWT secret key
```

### Optional Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_TLS` | `false` | Enable HTTPS |
| `TLS_DOMAIN` | - | Domain for Let's Encrypt |
| `MAX_UPLOAD_SIZE` | `50MB` | Max file upload size |
| `JOB_TIMEOUT` | `300` | Job timeout in seconds |

---

## 🔧 Operations

### Start Services

```bash
# Production mode
./ctf-autopilot/infra/scripts/prod_up.sh

# Development mode
./ctf-autopilot/infra/scripts/dev_up.sh
```

### Stop Services

```bash
docker compose down
```

### View Logs

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

# Perform full update
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

## 🔒 Security

### Before Going Live

- [ ] Change `ADMIN_PASSWORD` from default
- [ ] Set strong `POSTGRES_PASSWORD`
- [ ] Configure `SECRET_KEY`
- [ ] Enable TLS (`ENABLE_TLS=true`)
- [ ] Configure firewall (only expose 80/443)

### TLS Configuration

**Self-signed (Development):**
```bash
./ctf-autopilot/infra/scripts/generate_self_signed_cert.sh
ENABLE_TLS=true ./ctf-autopilot/infra/scripts/prod_up.sh
```

**Let's Encrypt (Production):**
```bash
# In .env file
ENABLE_TLS=true
TLS_DOMAIN=ctfcompass.example.com
LETSENCRYPT_EMAIL=admin@example.com
```

---

## 🛠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| Job stuck in "Running" | `docker compose restart worker` |
| Database connection error | `docker compose ps postgres` |
| Sandbox not starting | Check Docker socket access |
| High memory usage | `docker stats` to monitor |

For detailed troubleshooting, see [DEBUG.md](ctf-autopilot/docs/DEBUG.md).

---

## 📚 Documentation

- [Architecture](ctf-autopilot/docs/ARCHITECTURE.md) - System design
- [API Reference](ctf-autopilot/docs/API.md) - REST API docs
- [Usage Guide](ctf-autopilot/docs/USAGE.md) - User guide
- [Security](ctf-autopilot/docs/SECURITY.md) - Security practices
- [Runbook](ctf-autopilot/docs/RUNBOOK.md) - Operations guide
- [Debug Guide](ctf-autopilot/docs/DEBUG.md) - Troubleshooting

---

## 🏗️ Tech Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | React, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| **Backend** | Python, FastAPI, Celery |
| **Database** | PostgreSQL, Redis |
| **Infrastructure** | Docker, Nginx |
| **AI** | MegaLLM API |

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📞 Support

- **GitHub Issues:** [github.com/huynhtrungcipp/ctf-compass/issues](https://github.com/huynhtrungcipp/ctf-compass/issues)
- **Documentation:** [ctf-autopilot/docs/](ctf-autopilot/docs/)
