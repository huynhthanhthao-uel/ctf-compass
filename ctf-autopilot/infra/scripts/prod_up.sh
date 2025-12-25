#!/bin/bash
#===============================================================================
# CTF Compass - Production Startup Script
# Starts all services in production mode
#===============================================================================
#
# GitHub Repository: https://github.com/HaryLya/ctf-compass.git
#
# USAGE:
#   ./prod_up.sh [--clean] [--rebuild]
#
# OPTIONS:
#   --clean    Remove old containers and images before starting
#   --rebuild  Force rebuild all images
#
#===============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

CLEAN_MODE=false
REBUILD_MODE=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --clean)
            CLEAN_MODE=true
            ;;
        --rebuild)
            REBUILD_MODE=true
            ;;
    esac
done

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                CTF Compass - Production Startup                   ║"
echo "║          github.com/HaryLya/ctf-compass                           ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

cd "$PROJECT_ROOT"

log_info "Starting CTF Compass in production mode..."

# Find docker-compose file
COMPOSE_FILE=""
if [[ -f "ctf-autopilot/infra/docker-compose.yml" ]]; then
    COMPOSE_FILE="ctf-autopilot/infra/docker-compose.yml"
elif [[ -f "infra/docker-compose.yml" ]]; then
    COMPOSE_FILE="infra/docker-compose.yml"
elif [[ -f "docker-compose.yml" ]]; then
    COMPOSE_FILE="docker-compose.yml"
fi

if [[ -z "$COMPOSE_FILE" ]]; then
    log_error "docker-compose.yml not found!"
fi

log_info "Using compose file: $COMPOSE_FILE"

# Check for .env file
if [[ ! -f ".env" ]]; then
    if [[ -f "ctf-autopilot/.env.example" ]]; then
        log_warn ".env file not found, copying from ctf-autopilot/.env.example"
        cp ctf-autopilot/.env.example .env
        log_warn "Please edit .env and set MEGALLM_API_KEY"
    elif [[ -f ".env.example" ]]; then
        cp .env.example .env
        log_warn "Please edit .env and set MEGALLM_API_KEY"
    else
        log_error ".env file not found! Please create one from .env.example"
    fi
fi

# Copy .env to compose directory
COMPOSE_DIR=$(dirname "$COMPOSE_FILE")
if [[ "$COMPOSE_DIR" != "." ]] && [[ -f ".env" ]]; then
    cp .env "$COMPOSE_DIR/.env" 2>/dev/null || true
fi

# Source .env to check required variables
set -a
source .env 2>/dev/null || true
set +a

if [[ -z "${MEGALLM_API_KEY:-}" ]]; then
    log_warn "MEGALLM_API_KEY is not set in .env"
    log_warn "AI features will not work without it."
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Clean mode - remove old containers and images
if [[ "$CLEAN_MODE" == "true" ]]; then
    log_info "Cleaning old containers and images..."
    docker compose -f "$COMPOSE_FILE" down -v --remove-orphans 2>/dev/null || true
    docker image prune -af 2>/dev/null || true
    docker builder prune -af 2>/dev/null || true
    log_success "Cleanup completed"
fi

# Build sandbox image if not exists
if ! docker image inspect ctf-compass-sandbox:latest > /dev/null 2>&1; then
    log_info "Building sandbox image..."
    
    SANDBOX_PATH=""
    if [[ -f "ctf-autopilot/sandbox/image/Dockerfile" ]]; then
        SANDBOX_PATH="ctf-autopilot/sandbox/image"
    elif [[ -f "sandbox/image/Dockerfile" ]]; then
        SANDBOX_PATH="sandbox/image"
    fi
    
    if [[ -n "$SANDBOX_PATH" ]]; then
        docker build -t ctf-compass-sandbox:latest -t ctf-autopilot-sandbox:latest -f "$SANDBOX_PATH/Dockerfile" "$SANDBOX_PATH/"
        log_success "Sandbox image built"
    else
        log_warn "Sandbox Dockerfile not found, skipping..."
    fi
fi

# Create data directories
mkdir -p data/runs ctf-autopilot/data/runs 2>/dev/null || true

# Build options
BUILD_OPTS="--build"
if [[ "$REBUILD_MODE" == "true" ]]; then
    BUILD_OPTS="--build --no-cache"
fi

# Start all services
log_info "Starting all services..."

if [[ "${ENABLE_TLS:-false}" == "true" ]]; then
    log_info "Starting with TLS enabled..."
    docker compose -f "$COMPOSE_FILE" --profile production up -d $BUILD_OPTS
else
    log_info "Starting without TLS..."
    docker compose -f "$COMPOSE_FILE" up -d $BUILD_OPTS
fi

# Wait for services
log_info "Waiting for services to be ready (20 seconds)..."
sleep 20

# Health checks
log_info "Running health checks..."

HEALTH_OK=true

# Check API
if curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
    log_success "API is healthy"
else
    log_warn "API health check failed (may still be starting)"
    HEALTH_OK=false
fi

# Check database
if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U "${POSTGRES_USER:-ctfautopilot}" > /dev/null 2>&1; then
    log_success "PostgreSQL is healthy"
else
    log_warn "PostgreSQL is not ready"
    HEALTH_OK=false
fi

# Check Redis
if docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping > /dev/null 2>&1; then
    log_success "Redis is healthy"
else
    log_warn "Redis is not ready"
    HEALTH_OK=false
fi

# Check Web UI
if curl -sf http://localhost:3000 > /dev/null 2>&1; then
    log_success "Web UI is healthy"
else
    log_warn "Web UI is not ready (may still be starting)"
    HEALTH_OK=false
fi

# Get server IP
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}                    ✓ CTF Compass is running!                        ${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Access the application:"
if [[ "${ENABLE_TLS:-false}" == "true" ]]; then
    echo -e "  Web UI: ${CYAN}https://${SERVER_IP}${NC}"
    echo -e "  API:    ${CYAN}https://${SERVER_IP}/api${NC}"
else
    echo -e "  Web UI: ${CYAN}http://${SERVER_IP}:3000${NC}"
    echo -e "  API:    ${CYAN}http://${SERVER_IP}:8000${NC}"
fi
echo ""
echo -e "Useful commands:"
echo -e "  View logs:     ${CYAN}docker compose -f $COMPOSE_FILE logs -f${NC}"
echo -e "  Stop services: ${CYAN}docker compose -f $COMPOSE_FILE down${NC}"
echo -e "  Check status:  ${CYAN}docker compose -f $COMPOSE_FILE ps${NC}"
echo -e "  Clean restart: ${CYAN}$0 --clean${NC}"
echo ""
echo -e "Update system:"
echo -e "  ${CYAN}sudo bash $PROJECT_ROOT/ctf-autopilot/infra/scripts/update.sh${NC}"
echo ""
