# CTF Compass - Quick Start (Local Deployment)

## 🚀 One-Line Deploy

```bash
curl -fsSL https://raw.githubusercontent.com/huynhthanhthao-uel/ctf-compass/main/ctf-autopilot/infra/scripts/deploy.sh | bash
```

**✨ No login required - just open the Web UI!**

---

## 📋 Post-Installation Steps

1. **Open Web UI:** `http://YOUR_IP:3000`
2. **Set Backend URL:** Enter `http://YOUR_IP:8000`
3. **Click Test** to verify connection
4. **Continue to Dashboard** and start analyzing!

---

## 📋 Alternative Installation Methods

### Full Install (Ubuntu 24.04)
```bash
curl -fsSL https://raw.githubusercontent.com/huynhthanhthao-uel/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash
```

### Manual Deploy
```bash
# Clone repo
cd /opt
sudo git clone https://github.com/huynhthanhthao-uel/ctf-compass.git
cd ctf-compass

# Copy simple config
cp ctf-autopilot/infra/.env.example ctf-autopilot/infra/.env

# Build sandbox image (optional)
docker build -t ctf-autopilot-sandbox:latest ctf-autopilot/sandbox/image/

# Start services
cd ctf-autopilot/infra
docker compose up -d

# Wait for healthy
sleep 30
docker compose ps
```

---

## 📍 Access URLs

| Service | URL |
|---------|-----|
| **Web UI** | http://YOUR_IP:3000 |
| **API** | http://YOUR_IP:8000 |
| **CORS Tester** | http://YOUR_IP:3000/cors-tester |

---

## 🛠️ Common Commands

```bash
# View logs
docker compose logs -f

# Restart services
docker compose restart

# Stop all
docker compose down

# Clean reinstall
docker compose down -v
docker compose up -d --build

# Check status
docker compose ps
```

---

## 🤖 Enable AI Analysis (Optional)

1. Get API key from: https://ai.megallm.io
2. Edit `.env` file:
   ```bash
   nano /opt/ctf-compass/ctf-autopilot/infra/.env
   # Add: MEGALLM_API_KEY=your-key-here
   ```
3. Restart:
   ```bash
   docker compose restart
   ```

---

## 🎯 PWN/Remote Challenges (Netcat)

For challenges requiring `nc host port`:

1. Create a new job
2. Toggle **"Remote Connection (nc)"** to ON
3. Enter **Host** and **Port**
4. Submit job and go to the **Netcat** tab
5. Click **Connect** to start interaction
6. Use **Generate AI Solve Script** for pwntools code

---

## 🧪 CORS Troubleshooting

If you encounter CORS errors:

1. **Use built-in CORS Tester:** `http://YOUR_IP:3000/cors-tester`
2. **Check your `.env` file:**
   ```bash
   CORS_ORIGINS=http://YOUR_IP:3000,http://localhost:3000
   ```
3. **Restart the API:**
   ```bash
   docker compose restart api
   ```

---

## 🧪 Sandbox Tools

The sandbox includes 50+ CTF analysis tools:

| Category | Tools |
|----------|-------|
| **Binary** | binwalk, file, strings, xxd, radare2, gdb, checksec |
| **Crypto** | openssl, hashcat, john, pwntools |
| **Forensics** | tshark, volatility3, exiftool, foremost |
| **Stego** | zsteg, stegcracker, steghide |
| **Reverse** | retdec, objdump, nm, pwntools |
| **PWN** | pwntools, ROPgadget, one_gadget |

---

## 💡 Troubleshooting

### Check service status
```bash
docker compose ps
docker compose logs api
```

### Test API health
```bash
curl http://localhost:8000/api/health
```

### Full reset
```bash
docker compose down -v --rmi local
docker compose up -d --build
```

---

## 📚 More Documentation

- [README.md](README.md) - Full documentation
- [docs/USAGE.md](docs/USAGE.md) - User guide
- [docs/DEBUG.md](docs/DEBUG.md) - Troubleshooting
- [docs/RUNBOOK.md](docs/RUNBOOK.md) - Operations guide
