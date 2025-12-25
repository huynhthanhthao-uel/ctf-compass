#!/bin/bash
#===============================================================================
# CTF Compass - Simple One-Line Deploy Script
# For local deployment - single user
#===============================================================================
#
# USAGE:
#   curl -fsSL https://raw.githubusercontent.com/huynhtrungpc01/ctf-compass/main/ctf-autopilot/infra/scripts/deploy.sh | bash
#
#   # Or locally:
#   bash ctf-autopilot/infra/scripts/deploy.sh
#
#===============================================================================

# Don't use 'set -u' because BASH_SOURCE may be unbound when piping from curl
set -eo pipefail

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

#-------------------------------------------------------------------------------
# Check Docker first (before cloning)
#-------------------------------------------------------------------------------
install_docker() {
    echo -e "${YELLOW}🔧 Installing Docker...${NC}"
    
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        echo -e "${RED}❌ Docker installation requires root. Please run:${NC}"
        echo -e "   ${CYAN}curl -fsSL https://get.docker.com | sudo sh${NC}"
        echo -e "   ${CYAN}sudo usermod -aG docker \$USER${NC}"
        echo -e "   Then logout and login again, and re-run this script."
        exit 1
    fi
    
    # Install Docker
    curl -fsSL https://get.docker.com | sh
    
    # Start Docker
    systemctl start docker 2>/dev/null || service docker start 2>/dev/null || true
    systemctl enable docker 2>/dev/null || true
    
    echo -e "${GREEN}✅ Docker installed successfully${NC}"
}

if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠️ Docker not installed.${NC}"
    echo ""
    read -p "Do you want to install Docker now? (y/N) " -n 1 -r REPLY
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        install_docker
    else
        echo -e "${RED}❌ Docker is required. Please install Docker first:${NC}"
        echo -e "   ${CYAN}curl -fsSL https://get.docker.com | sudo sh${NC}"
        exit 1
    fi
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null 2>&1; then
    echo -e "${RED}❌ Docker daemon is not running.${NC}"
    echo -e "   Start Docker with: ${CYAN}sudo systemctl start docker${NC}"
    exit 1
fi

#-------------------------------------------------------------------------------
# Detect script location or clone repository
#-------------------------------------------------------------------------------
COMPOSE_DIR=""
SANDBOX_DIR=""

# Try to detect if running from local repo
# Use ${BASH_SOURCE[0]:-} to handle unbound variable when piping from curl
if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)" || SCRIPT_DIR=""
    if [[ -n "$SCRIPT_DIR" && -f "$SCRIPT_DIR/../docker-compose.yml" ]]; then
        COMPOSE_DIR="$SCRIPT_DIR/.."
        SANDBOX_DIR="$SCRIPT_DIR/../../sandbox/image"
    fi
fi

# Check if already installed at /opt/ctf-compass
if [[ -z "$COMPOSE_DIR" && -f "/opt/ctf-compass/ctf-autopilot/infra/docker-compose.yml" ]]; then
    COMPOSE_DIR="/opt/ctf-compass/ctf-autopilot/infra"
    SANDBOX_DIR="/opt/ctf-compass/ctf-autopilot/sandbox/image"
fi

# Clone if not found locally
if [[ -z "$COMPOSE_DIR" ]]; then
    echo -e "${YELLOW}📥 Cloning repository...${NC}"
    cd /tmp
    rm -rf ctf-compass
    if ! git clone --depth 1 https://github.com/huynhtrungpc01/ctf-compass.git; then
        echo -e "${RED}❌ Failed to clone repository. Check your internet connection.${NC}"
        exit 1
    fi
    COMPOSE_DIR="/tmp/ctf-compass/ctf-autopilot/infra"
    SANDBOX_DIR="/tmp/ctf-compass/ctf-autopilot/sandbox/image"
fi

cd "$COMPOSE_DIR" || {
    echo -e "${RED}❌ Failed to change to compose directory: $COMPOSE_DIR${NC}"
    exit 1
}

#-------------------------------------------------------------------------------
# Create .env configuration
#-------------------------------------------------------------------------------
if [[ ! -f ".env" ]]; then
    echo -e "${YELLOW}📝 Creating configuration...${NC}"
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

#-------------------------------------------------------------------------------
# Build sandbox image (optional)
#-------------------------------------------------------------------------------
if [[ -f "$SANDBOX_DIR/Dockerfile" ]]; then
    echo -e "${YELLOW}🔨 Building sandbox image...${NC}"
    docker build -t ctf-autopilot-sandbox:latest "$SANDBOX_DIR/" 2>/dev/null || {
        echo -e "${YELLOW}⚠️ Sandbox build skipped (optional)${NC}"
    }
fi

#-------------------------------------------------------------------------------
# Start services
#-------------------------------------------------------------------------------
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
docker compose down 2>/dev/null || true

echo -e "${YELLOW}🚀 Starting services...${NC}"
if ! docker compose up -d; then
    echo -e "${RED}❌ Failed to start services. Check docker-compose.yml${NC}"
    docker compose logs --tail 50
    exit 1
fi

#-------------------------------------------------------------------------------
# Wait for services to be ready
#-------------------------------------------------------------------------------
echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
sleep 10

MAX_WAIT=90
WAITED=0
while [[ $WAITED -lt $MAX_WAIT ]]; do
    # Check if any service is healthy
    if docker compose ps 2>/dev/null | grep -q "healthy\|running"; then
        # Check if API is responding
        if curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
            break
        fi
    fi
    sleep 5
    WAITED=$((WAITED + 5))
    echo -e "   Waiting... ($WAITED/${MAX_WAIT}s)"
done

#-------------------------------------------------------------------------------
# Get local IP address
#-------------------------------------------------------------------------------
IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [[ -z "$IP" ]]; then
    IP=$(ip route get 1 2>/dev/null | awk '{print $(NF-2);exit}')
fi
if [[ -z "$IP" ]]; then
    IP="localhost"
fi

#-------------------------------------------------------------------------------
# Display success message
#-------------------------------------------------------------------------------
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
echo -e "📋 Useful Commands:"
echo -e "   ${CYAN}docker compose logs -f${NC}      # View logs"
echo -e "   ${CYAN}docker compose restart${NC}      # Restart services"
echo -e "   ${CYAN}docker compose down${NC}         # Stop services"
echo -e "   ${CYAN}docker compose down -v${NC}      # Stop + delete data"
echo ""
echo -e "📚 Documentation: ${CYAN}https://github.com/huynhtrungpc01/ctf-compass${NC}"
echo ""
