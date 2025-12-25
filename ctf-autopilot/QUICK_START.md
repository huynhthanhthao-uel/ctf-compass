# CTF Compass - Quick Start (Local Deployment)

## 🚀 Quick Start

### Option 1: Auto Install (Ubuntu 24.04)
```bash
curl -fsSL https://raw.githubusercontent.com/HaryLya/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash
```

### Option 2: Manual Deploy
```bash
# Clone repo
cd /opt
sudo git clone https://github.com/HaryLya/ctf-compass.git
cd ctf-compass

# Copy simple config
cp ctf-autopilot/infra/.env.local ctf-autopilot/infra/.env

# Build sandbox image
docker build -t ctf-autopilot-sandbox:latest ctf-autopilot/sandbox/image/

# Start services
cd ctf-autopilot/infra
docker compose up -d

# Wait for healthy
sleep 30
docker compose ps
```

## 🔐 Login Credentials

**Password:** `admin`

## 📍 Access URLs

- **Web UI:** http://YOUR_IP (or http://localhost:3000)
- **API:** http://YOUR_IP:8000

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
```

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

## 🧪 Sandbox Tools

The sandbox includes 50+ CTF analysis tools:
- Binary analysis: binwalk, file, strings, xxd, radare2, gdb
- Crypto: openssl, hashcat, john
- Forensics: tshark, volatility3, exiftool
- Steganography: zsteg, stegcracker
- Reverse engineering: retdec, checksec, pwntools

## 💡 Troubleshooting

### Check service status
```bash
docker compose ps
docker compose logs api
```

### Test login
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"admin"}'
```

### Full reset
```bash
docker compose down -v --rmi local
docker compose up -d --build
```
