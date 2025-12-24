# CTF Compass

**AI-powered CTF challenge analyzer with sandboxed execution environment.**

[![GitHub](https://img.shields.io/badge/GitHub-huynhtrungcipp%2Fctf--compass-blue?logo=github)](https://github.com/huynhtrungcipp/ctf-compass)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Ubuntu 24.04](https://img.shields.io/badge/Ubuntu-24.04%20LTS-E95420?logo=ubuntu)](https://ubuntu.com/)
[![Docker](https://img.shields.io/badge/Docker-Required-2496ED?logo=docker)](https://www.docker.com/)

---

## 🚀 Quick Deploy

### One-Command Installation (Ubuntu 24.04)

```bash
curl -fsSL https://raw.githubusercontent.com/huynhtrungcipp/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash
```

### Clean Installation (Remove Old First)

```bash
curl -fsSL https://raw.githubusercontent.com/huynhtrungcipp/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash -s -- --clean
```

### Post-Installation

1. **Access Web UI:** `http://YOUR_SERVER_IP:3000`
2. **Login** with the admin password shown during installation
3. **Configure API Key:** Go to Configuration page and enter your MegaLLM API key
4. **Start analyzing CTF challenges!**

---

## 📋 Requirements

- **OS:** Ubuntu 24.04 LTS (recommended)
- **Docker:** Engine 24.0+ with Compose v2.20+
- **RAM:** 4GB minimum, 8GB recommended
- **Disk:** 20GB minimum
- **API Key:** MegaLLM API key from [ai.megallm.io](https://ai.megallm.io)

---

## 🔧 Operations

### Start/Stop Services

```bash
# Start services
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml up -d

# Stop services
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml down

# Restart services
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml restart

# Check status
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml ps
```

### View Logs

```bash
# All services
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml logs -f

# Specific service
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml logs -f api
docker compose -f /opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml logs -f worker
```

### System Update

```bash
# Check for updates
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh --check

# Perform update
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh

# Deep cleanup and update
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh --clean
```

### Uninstall

```bash
# Interactive uninstall
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/uninstall.sh

# Force uninstall (no prompts)
sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/uninstall.sh --force
```

---

## 🔐 Security

- **Isolated Sandbox:** All analysis runs in Docker containers with network disabled
- **Resource Limits:** CPU, memory, and time limits on all sandboxed operations
- **Session-based Auth:** Secure session management with CSRF protection
- **API Key Protection:** Keys stored securely, never exposed in logs

### Security Checklist

- [ ] Change `ADMIN_PASSWORD` from default
- [ ] Configure `SECRET_KEY` for production
- [ ] Enable TLS for public deployments
- [ ] Set API key via Web UI (not environment)

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Architecture](ctf-autopilot/docs/ARCHITECTURE.md) | System design overview |
| [Security](ctf-autopilot/docs/SECURITY.md) | Security controls |
| [Usage Guide](ctf-autopilot/docs/USAGE.md) | User guide |
| [Debug Guide](ctf-autopilot/docs/DEBUG.md) | Troubleshooting |
| [Runbook](ctf-autopilot/docs/RUNBOOK.md) | Operations guide |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Frontend (React/Vite)                      │
│                    localhost:3000                            │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP/WebSocket
┌─────────────────────▼───────────────────────────────────────┐
│                    FastAPI Backend                           │
│                    localhost:8000                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                    Celery Workers                            │
│              (Background Job Processing)                     │
└─────────────────────┬───────────────────────────────────────┘
                      │ Docker API
┌─────────────────────▼───────────────────────────────────────┐
│              Sandbox Container (--network=none)              │
│  Tools: strings, file, binwalk, exiftool, readelf, etc.     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| **Backend** | Python 3.12, FastAPI, Celery, SQLAlchemy |
| **Database** | PostgreSQL 16, Redis 7 |
| **Infrastructure** | Docker, Docker Compose, Nginx |
| **AI** | MegaLLM API |

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Demo Mode" on login | Backend not running - check `docker compose ps` |
| Job stuck in "Queued" | Worker issue - `docker compose restart worker` |
| API Key not saving | Check backend connectivity and permissions |
| File upload fails | Check file size limit and disk space |

For detailed troubleshooting, see [DEBUG.md](ctf-autopilot/docs/DEBUG.md).

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
