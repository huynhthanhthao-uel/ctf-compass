#!/bin/bash
#===============================================================================
# CTF Compass - Simple One-Line Deploy Script (Local)
# Version: 2.0.0 (2025-12-26)
# Goal: 1 command installs prerequisites + pulls code + runs docker compose.
#
# NO LOGIN REQUIRED - Single-user local deployment
#===============================================================================
#
# USAGE (recommended):
#   curl -fsSL https://raw.githubusercontent.com/huynhtrungpc01/ctf-compass/main/ctf-autopilot/infra/scripts/deploy.sh | bash
#
# Or run locally from repo root:
#   bash ctf-autopilot/infra/scripts/deploy.sh
#
#===============================================================================

set -eo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

banner() {
  echo -e "${CYAN}"
  echo "╔═══════════════════════════════════════════════════════════════════╗"
  echo "║           CTF Compass v2.0.0 - Quick Local Deploy                 ║"
  echo "║           No Login Required - Single User Mode                    ║"
  echo "╚═══════════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

have() { command -v "$1" >/dev/null 2>&1; }

# Prefer sudo when needed
SUDO=""
if [[ $EUID -ne 0 ]] && have sudo; then
  SUDO="sudo"
fi

install_pkg_apt() {
  local pkg="$1"
  if have apt-get; then
    $SUDO apt-get update -qq
    $SUDO apt-get install -y -qq "$pkg"
    return 0
  fi
  return 1
}

ensure_git() {
  if have git; then return 0; fi
  echo -e "${YELLOW}🔧 Installing git...${NC}"
  if ! install_pkg_apt git; then
    echo -e "${RED}❌ git is required but could not be installed automatically.${NC}"
    echo -e "   Please install git and rerun."
    exit 1
  fi
}

ensure_docker() {
  if have docker; then return 0; fi
  echo -e "${YELLOW}🔧 Docker not found. Installing Docker...${NC}"

  if [[ -z "$SUDO" && $EUID -ne 0 ]]; then
    echo -e "${RED}❌ Need sudo/root to install Docker.${NC}"
    echo -e "   Run: ${CYAN}curl -fsSL https://get.docker.com | sudo sh${NC}"
    exit 1
  fi

  curl -fsSL https://get.docker.com | $SUDO sh

  # Best-effort: start daemon
  $SUDO systemctl start docker >/dev/null 2>&1 || $SUDO service docker start >/dev/null 2>&1 || true
  $SUDO systemctl enable docker >/dev/null 2>&1 || true
}

# Determine whether we need sudo for docker commands (common when user not in docker group)
setup_docker_cmd() {
  DOCKER="docker"
  if docker info >/dev/null 2>&1; then
    return 0
  fi

  if [[ -n "$SUDO" ]] && $SUDO docker info >/dev/null 2>&1; then
    DOCKER="$SUDO docker"
    return 0
  fi

  echo -e "${RED}❌ Docker is installed but not accessible.${NC}"
  echo -e "   Try: ${CYAN}sudo usermod -aG docker $USER && newgrp docker${NC}"
  echo -e "   Or rerun this command with a user that can run docker."
  exit 1
}

banner

# Prereqs
ensure_git
ensure_docker
setup_docker_cmd

#-------------------------------------------------------------------------------
# Locate compose directory
#-------------------------------------------------------------------------------
COMPOSE_DIR=""
SANDBOX_DIR=""

# 1) If already installed
if [[ -f "/opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml" ]]; then
  COMPOSE_DIR="/opt/ctf-compass/ctf-autopilot/infra"
  SANDBOX_DIR="/opt/ctf-compass/ctf-autopilot/sandbox/image"
fi

# 2) If running from repo root
if [[ -z "$COMPOSE_DIR" ]] && [[ -f "./ctf-autopilot/infra/docker-compose.yml" ]]; then
  COMPOSE_DIR="./ctf-autopilot/infra"
  SANDBOX_DIR="./ctf-autopilot/sandbox/image"
fi

# 3) Otherwise clone fresh to /tmp
if [[ -z "$COMPOSE_DIR" ]]; then
  echo -e "${YELLOW}📥 Cloning repository...${NC}"
  cd /tmp
  rm -rf ctf-compass
  git clone --depth 1 https://github.com/huynhtrungpc01/ctf-compass.git
  COMPOSE_DIR="/tmp/ctf-compass/ctf-autopilot/infra"
  SANDBOX_DIR="/tmp/ctf-compass/ctf-autopilot/sandbox/image"
fi

cd "$COMPOSE_DIR"

#-------------------------------------------------------------------------------
# Create .env if missing
#-------------------------------------------------------------------------------
if [[ ! -f ".env" ]]; then
  echo -e "${YELLOW}📝 Creating configuration...${NC}"
  cat > .env << 'EOF'
# CTF Compass v2.0.0 - Simple Local Config
# No login required - single user mode

# Database
POSTGRES_USER=ctfautopilot
POSTGRES_PASSWORD=ctfautopilot
POSTGRES_DB=ctfautopilot

# Environment
ENVIRONMENT=production
DEBUG=false
ENABLE_TLS=false

# Sandbox limits
MAX_UPLOAD_SIZE_MB=200
SANDBOX_TIMEOUT_SECONDS=60
SANDBOX_MEMORY_LIMIT=512m
SANDBOX_CPU_LIMIT=1

# CORS - allow all origins for easier local deployment
# For specific origins: CORS_ORIGINS=http://192.168.1.100:3000,http://localhost:3000
CORS_ORIGINS=*

# AI (optional) - get key from https://ai.megallm.io
# MEGALLM_API_KEY=your-key-here
# MEGALLM_MODEL=llama3.3-70b-instruct
EOF
fi

#-------------------------------------------------------------------------------
# Build sandbox image (optional)
#-------------------------------------------------------------------------------
if [[ -f "$SANDBOX_DIR/Dockerfile" ]]; then
  echo -e "${YELLOW}🔨 Building sandbox image...${NC}"
  $DOCKER build -t ctf-autopilot-sandbox:latest "$SANDBOX_DIR/" 2>/dev/null || {
    echo -e "${YELLOW}⚠️ Sandbox build skipped (optional)${NC}"
  }
fi

#-------------------------------------------------------------------------------
# Start services
#-------------------------------------------------------------------------------
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
$DOCKER compose down 2>/dev/null || true

echo -e "${YELLOW}🚀 Starting services...${NC}"
$DOCKER compose up -d

#-------------------------------------------------------------------------------
# Wait for API
#-------------------------------------------------------------------------------
echo -e "${YELLOW}⏳ Waiting for API...${NC}"
MAX_WAIT=120
WAITED=0
while [[ $WAITED -lt $MAX_WAIT ]]; do
  if curl -sf http://localhost:8000/api/health >/dev/null 2>&1; then
    break
  fi
  sleep 5
  WAITED=$((WAITED + 5))
  echo -e "   Waiting... ($WAITED/${MAX_WAIT}s)"
done

# IP
IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [[ -z "$IP" ]]; then IP="localhost"; fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    ✅ DEPLOY SUCCESSFUL                           ║${NC}"
echo -e "${GREEN}╠═══════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  🌐 Web UI:   ${CYAN}http://${IP}:3000${NC}                              ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  🔌 API:      ${CYAN}http://${IP}:8000${NC}                              ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ✨ No login required - just open the Web UI!                    ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  📌 First time? Set Backend URL to: ${YELLOW}http://${IP}:8000${NC}           ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "📋 Useful Commands:"
echo -e "   ${CYAN}$DOCKER compose logs -f${NC}      # View logs"
echo -e "   ${CYAN}$DOCKER compose restart${NC}      # Restart services"
echo -e "   ${CYAN}$DOCKER compose down${NC}         # Stop services"
echo -e "   ${CYAN}$DOCKER compose down -v${NC}      # Stop + delete data"
echo ""
echo -e "🧪 CORS Tester: ${CYAN}http://${IP}:3000/cors-tester${NC}"
