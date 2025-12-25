#!/bin/bash
#===============================================================================
# CTF Compass - Simple One-Line Deploy Script
# For local deployment - single user
#===============================================================================
#
# USAGE:
#   curl -fsSL https://raw.githubusercontent.com/HaryLya/ctf-compass/main/ctf-autopilot/infra/scripts/deploy.sh | bash
#
#   # Or locally:
#   bash ctf-autopilot/infra/scripts/deploy.sh
#
#===============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║           CTF Compass - Quick Local Deploy                        ║"
echo "║           Password: admin                                         ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Detect if running from repo or remote
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/../../docker-compose.yml" ]]; then
    COMPOSE_DIR="$SCRIPT_DIR/.."
    SANDBOX_DIR="$SCRIPT_DIR/../../sandbox/image"
elif [[ -f "/opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml" ]]; then
    COMPOSE_DIR="/opt/ctf-compass/ctf-autopilot/infra"
    SANDBOX_DIR="/opt/ctf-compass/ctf-autopilot/sandbox/image"
else
    echo -e "${YELLOW}📥 Cloning repository...${NC}"
    cd /tmp
    rm -rf ctf-compass
    git clone --depth 1 https://github.com/HaryLya/ctf-compass.git
    COMPOSE_DIR="/tmp/ctf-compass/ctf-autopilot/infra"
    SANDBOX_DIR="/tmp/ctf-compass/ctf-autopilot/sandbox/image"
fi

cd "$COMPOSE_DIR"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not installed. Please install Docker first.${NC}"
    echo "   Run: curl -fsSL https://get.docker.com | sh"
    exit 1
fi

# Create simple .env if not exists
if [[ ! -f ".env" ]]; then
    echo -e "${YELLOW}📝 Creating simple config...${NC}"
    cat > .env << 'EOF'
# CTF Compass - Simple Local Config
ADMIN_PASSWORD=admin
POSTGRES_USER=ctfautopilot
POSTGRES_PASSWORD=ctfautopilot
POSTGRES_DB=ctfautopilot
ENVIRONMENT=production
DEBUG=false
ENABLE_TLS=false
MAX_UPLOAD_SIZE_MB=200
SANDBOX_TIMEOUT_SECONDS=60
SANDBOX_MEMORY_LIMIT=512m
SANDBOX_CPU_LIMIT=1
EOF
fi

# Build sandbox image if Dockerfile exists
if [[ -f "$SANDBOX_DIR/Dockerfile" ]]; then
    echo -e "${YELLOW}🔨 Building sandbox image...${NC}"
    docker build -t ctf-autopilot-sandbox:latest "$SANDBOX_DIR/" 2>/dev/null || {
        echo -e "${YELLOW}⚠️ Sandbox build skipped (optional)${NC}"
    }
fi

# Stop existing containers
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
docker compose down 2>/dev/null || true

# Start services
echo -e "${YELLOW}🚀 Starting services...${NC}"
docker compose up -d

# Wait for healthy
echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
sleep 10

# Check health
MAX_WAIT=60
WAITED=0
while [[ $WAITED -lt $MAX_WAIT ]]; do
    if docker compose ps | grep -q "healthy"; then
        break
    fi
    sleep 5
    WAITED=$((WAITED + 5))
    echo -e "   Waiting... ($WAITED/${MAX_WAIT}s)"
done

# Get IP
IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    ✅ DEPLOY SUCCESSFUL                           ║${NC}"
echo -e "${GREEN}╠═══════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  🌐 Web UI:   ${CYAN}http://${IP}:3000${NC}                              ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  🔌 API:      ${CYAN}http://${IP}:8000${NC}                              ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  🔑 Password: ${YELLOW}admin${NC}                                           ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "📋 Commands:"
echo -e "   ${CYAN}docker compose logs -f${NC}      # View logs"
echo -e "   ${CYAN}docker compose restart${NC}      # Restart"
echo -e "   ${CYAN}docker compose down${NC}         # Stop"
echo -e "   ${CYAN}docker compose down -v${NC}      # Stop + delete data"
echo ""
