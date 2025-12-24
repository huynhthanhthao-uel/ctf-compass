#!/bin/bash
#===============================================================================
# CTF Compass - Development Environment Startup
# Starts only infrastructure services (Postgres, Redis) for local development
#===============================================================================
#
# GitHub Repository: https://github.com/huynhtrungcipp/ctf-compass.git
#
# USAGE:
#   ./dev_up.sh [--clean]
#
# OPTIONS:
#   --clean   Remove old containers and volumes before starting
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

# Parse arguments
for arg in "$@"; do
    case $arg in
        --clean)
            CLEAN_MODE=true
            shift
            ;;
    esac
done

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║               CTF Compass - Development Environment               ║"
echo "║            github.com/huynhtrungcipp/ctf-compass                  ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

cd "$PROJECT_ROOT"

# Find docker-compose.dev.yml
DEV_COMPOSE=""
if [[ -f "ctf-autopilot/infra/docker-compose.dev.yml" ]]; then
    DEV_COMPOSE="ctf-autopilot/infra/docker-compose.dev.yml"
elif [[ -f "infra/docker-compose.dev.yml" ]]; then
    DEV_COMPOSE="infra/docker-compose.dev.yml"
fi

if [[ -z "$DEV_COMPOSE" ]]; then
    log_warn "docker-compose.dev.yml not found, using main compose file"
    
    if [[ -f "ctf-autopilot/infra/docker-compose.yml" ]]; then
        DEV_COMPOSE="ctf-autopilot/infra/docker-compose.yml"
    elif [[ -f "infra/docker-compose.yml" ]]; then
        DEV_COMPOSE="infra/docker-compose.yml"
    elif [[ -f "docker-compose.yml" ]]; then
        DEV_COMPOSE="docker-compose.yml"
    else
        log_error "No docker-compose file found!"
    fi
fi

log_info "Using compose file: $DEV_COMPOSE"

# Clean mode - remove old containers and volumes
if [[ "$CLEAN_MODE" == "true" ]]; then
    log_info "Cleaning old development containers and volumes..."
    docker compose -f "$DEV_COMPOSE" down -v 2>/dev/null || true
    docker volume rm ctf_compass_postgres_dev_data ctf_compass_redis_dev_data 2>/dev/null || true
    log_success "Cleanup completed"
fi

# Start infrastructure services
log_info "Starting PostgreSQL and Redis..."
docker compose -f "$DEV_COMPOSE" up -d postgres redis 2>/dev/null || \
    docker compose -f "$DEV_COMPOSE" up -d

# Wait for services
log_info "Waiting for services to be ready..."
sleep 5

# Check PostgreSQL
if docker compose -f "$DEV_COMPOSE" exec -T postgres pg_isready -U ctfautopilot > /dev/null 2>&1; then
    log_success "PostgreSQL is ready"
else
    log_warn "PostgreSQL may still be starting"
fi

# Check Redis
if docker compose -f "$DEV_COMPOSE" exec -T redis redis-cli ping > /dev/null 2>&1; then
    log_success "Redis is ready"
else
    log_warn "Redis may still be starting"
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}           ✓ Development environment is ready!                       ${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Services running:"
echo -e "  PostgreSQL: ${CYAN}localhost:5432${NC} (user: ctfautopilot, pass: devpassword)"
echo -e "  Redis:      ${CYAN}localhost:6379${NC}"
echo ""
echo -e "To start the API:"
echo -e "  ${CYAN}cd ctf-autopilot/apps/api && poetry install && poetry run uvicorn app.main:app --reload${NC}"
echo ""
echo -e "To start the frontend:"
echo -e "  ${CYAN}npm run dev${NC}"
echo ""
echo -e "To stop services:"
echo -e "  ${CYAN}docker compose -f $DEV_COMPOSE down${NC}"
echo ""
echo -e "To clean and restart:"
echo -e "  ${CYAN}$0 --clean${NC}"
echo ""
echo -e "GitHub: ${CYAN}https://github.com/huynhtrungcipp/ctf-compass${NC}"
echo ""
