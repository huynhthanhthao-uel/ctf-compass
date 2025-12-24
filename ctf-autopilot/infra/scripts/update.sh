#!/bin/bash
#===============================================================================
# CTF Compass - System Update Script
# Automatically pulls latest changes from GitHub, updates, and restarts
#===============================================================================
#
# GitHub Repository: https://github.com/huynhtrungcipp/ctf-compass.git
#
# USAGE:
#   sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh
#
# OPTIONS:
#   --check   Check for updates without installing
#   --json    Output in JSON format (for API use)
#   --help    Show help message
#
# WHAT THIS SCRIPT DOES:
#   1. Backup current configuration
#   2. Pull latest changes from GitHub
#   3. Clean up old Docker images and containers
#   4. Rebuild sandbox image if needed
#   5. Restart all services
#   6. Verify health
#
#===============================================================================

set -euo pipefail

#-------------------------------------------------------------------------------
# Configuration
#-------------------------------------------------------------------------------
INSTALL_DIR="${INSTALL_DIR:-/opt/ctf-compass}"
LOG_FILE="/var/log/ctf-compass-update.log"
GITHUB_REPO="https://github.com/huynhtrungcipp/ctf-compass.git"
GITHUB_BRANCH="main"
BACKUP_DIR="/opt/ctf-compass-backups"

#-------------------------------------------------------------------------------
# Colors and Logging
#-------------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# JSON output mode for API
JSON_MODE="${JSON_MODE:-false}"

log_info()    { 
    if [[ "$JSON_MODE" == "true" ]]; then
        echo "{\"level\":\"info\",\"message\":\"$1\",\"timestamp\":\"$(date -Iseconds)\"}"
    else
        echo -e "${BLUE}[$(date '+%H:%M:%S')] [INFO]${NC} $1" | tee -a "$LOG_FILE"
    fi
}
log_success() { 
    if [[ "$JSON_MODE" == "true" ]]; then
        echo "{\"level\":\"success\",\"message\":\"$1\",\"timestamp\":\"$(date -Iseconds)\"}"
    else
        echo -e "${GREEN}[$(date '+%H:%M:%S')] [SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
    fi
}
log_warn()    { 
    if [[ "$JSON_MODE" == "true" ]]; then
        echo "{\"level\":\"warn\",\"message\":\"$1\",\"timestamp\":\"$(date -Iseconds)\"}"
    else
        echo -e "${YELLOW}[$(date '+%H:%M:%S')] [WARN]${NC} $1" | tee -a "$LOG_FILE"
    fi
}
log_error()   { 
    if [[ "$JSON_MODE" == "true" ]]; then
        echo "{\"level\":\"error\",\"message\":\"$1\",\"timestamp\":\"$(date -Iseconds)\"}"
        exit 1
    else
        echo -e "${RED}[$(date '+%H:%M:%S')] [ERROR]${NC} $1" | tee -a "$LOG_FILE"
        exit 1
    fi
}
log_step()    { 
    if [[ "$JSON_MODE" == "true" ]]; then
        echo "{\"level\":\"step\",\"message\":\"$1\",\"timestamp\":\"$(date -Iseconds)\"}"
    else
        echo -e "${CYAN}${BOLD}[$(date '+%H:%M:%S')] [STEP]${NC} $1" | tee -a "$LOG_FILE"
    fi
}

#-------------------------------------------------------------------------------
# Pre-flight Checks
#-------------------------------------------------------------------------------
preflight_checks() {
    log_step "Running pre-flight checks..."
    
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
    fi
    
    # Check if install directory exists
    if [[ ! -d "$INSTALL_DIR" ]]; then
        log_error "Installation directory not found: $INSTALL_DIR"
    fi
    
    # Check if git is available
    if ! command -v git &> /dev/null; then
        log_error "Git is not installed"
    fi
    
    # Check if docker is running
    if ! docker info &> /dev/null; then
        log_error "Docker is not running"
    fi
    
    log_success "Pre-flight checks passed"
}

#-------------------------------------------------------------------------------
# Backup Configuration
#-------------------------------------------------------------------------------
backup_config() {
    log_step "Step 1/6: Backing up configuration..."
    
    mkdir -p "$BACKUP_DIR"
    BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).tar.gz"
    
    cd "$INSTALL_DIR"
    
    # Backup .env and credentials
    if [[ -f ".env" ]]; then
        tar -czf "$BACKUP_FILE" .env CREDENTIALS.txt 2>/dev/null || tar -czf "$BACKUP_FILE" .env 2>/dev/null || true
        log_info "Configuration backed up to: $BACKUP_FILE"
    fi
    
    # Keep only last 5 backups
    ls -t "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm -f
    
    log_success "Backup completed"
}

#-------------------------------------------------------------------------------
# Pull Latest Changes
#-------------------------------------------------------------------------------
pull_latest() {
    log_step "Step 2/6: Pulling latest changes from GitHub..."
    
    cd "$INSTALL_DIR"
    
    # Store current version
    OLD_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    
    # Check if it's a git repo
    if [[ ! -d ".git" ]]; then
        log_warn "Not a git repository. Initializing..."
        git init
        git remote add origin "$GITHUB_REPO" 2>/dev/null || git remote set-url origin "$GITHUB_REPO"
    fi
    
    # Ensure correct remote URL
    git remote set-url origin "$GITHUB_REPO" 2>/dev/null || true
    
    # Stash any local changes (preserve .env)
    git stash --include-untracked 2>/dev/null || true
    
    # Fetch and reset to origin
    git fetch origin $GITHUB_BRANCH 2>&1 | tee -a "$LOG_FILE"
    git reset --hard origin/$GITHUB_BRANCH 2>&1 | tee -a "$LOG_FILE"
    
    # Get new version
    NEW_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    
    if [[ "$OLD_COMMIT" == "$NEW_COMMIT" ]]; then
        log_info "Already up to date (${NEW_COMMIT:0:8})"
    else
        log_info "Updated: ${OLD_COMMIT:0:8} → ${NEW_COMMIT:0:8}"
        
        # Show changes
        log_info "Recent changes:"
        git log --oneline "$OLD_COMMIT".."$NEW_COMMIT" 2>/dev/null | head -10 | while read line; do
            log_info "  $line"
        done
    fi
    
    # Restore .env if it was stashed
    git stash pop 2>/dev/null || true
    
    log_success "Latest code pulled from GitHub"
}

#-------------------------------------------------------------------------------
# Clean Up Docker Resources
#-------------------------------------------------------------------------------
cleanup_docker() {
    log_step "Step 3/6: Cleaning up Docker resources..."
    
    cd "$INSTALL_DIR"
    
    # Find docker-compose location
    COMPOSE_FILE=""
    if [[ -f "ctf-autopilot/infra/docker-compose.yml" ]]; then
        COMPOSE_FILE="ctf-autopilot/infra/docker-compose.yml"
    elif [[ -f "infra/docker-compose.yml" ]]; then
        COMPOSE_FILE="infra/docker-compose.yml"
    elif [[ -f "docker-compose.yml" ]]; then
        COMPOSE_FILE="docker-compose.yml"
    fi
    
    if [[ -n "$COMPOSE_FILE" ]]; then
        # Export environment variables
        set -a
        source .env 2>/dev/null || true
        set +a
        
        # Stop services gracefully
        log_info "Stopping services..."
        docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>&1 | tee -a "$LOG_FILE" || true
    fi
    
    # Remove old containers
    log_info "Removing old containers..."
    docker container prune -f 2>&1 | tee -a "$LOG_FILE" || true
    
    # Remove dangling images
    log_info "Removing dangling images..."
    docker image prune -f 2>&1 | tee -a "$LOG_FILE" || true
    
    # Remove unused volumes (careful - not all, just dangling)
    log_info "Removing dangling volumes..."
    docker volume prune -f 2>&1 | tee -a "$LOG_FILE" || true
    
    # Remove old build cache
    log_info "Removing old build cache..."
    docker builder prune -f --keep-storage=2GB 2>&1 | tee -a "$LOG_FILE" || true
    
    log_success "Docker cleanup completed"
}

#-------------------------------------------------------------------------------
# Rebuild Sandbox Image
#-------------------------------------------------------------------------------
rebuild_sandbox() {
    log_step "Step 4/6: Rebuilding sandbox image..."
    
    cd "$INSTALL_DIR"
    
    # Find Dockerfile location
    SANDBOX_PATH=""
    if [[ -f "sandbox/image/Dockerfile" ]]; then
        SANDBOX_PATH="sandbox/image"
    elif [[ -f "ctf-autopilot/sandbox/image/Dockerfile" ]]; then
        SANDBOX_PATH="ctf-autopilot/sandbox/image"
    fi
    
    if [[ -z "$SANDBOX_PATH" ]]; then
        log_warn "Sandbox Dockerfile not found, skipping..."
        return 0
    fi
    
    # Check if Dockerfile changed
    DOCKERFILE_HASH=$(md5sum "$SANDBOX_PATH/Dockerfile" | cut -d' ' -f1)
    HASH_FILE="/tmp/ctf_compass_sandbox_hash"
    
    if [[ -f "$HASH_FILE" ]] && [[ "$(cat $HASH_FILE)" == "$DOCKERFILE_HASH" ]]; then
        log_info "Sandbox Dockerfile unchanged, skipping rebuild"
    else
        log_info "Building sandbox image..."
        docker build \
            --no-cache \
            -t ctf-compass-sandbox:latest \
            -t ctf-autopilot-sandbox:latest \
            -f "$SANDBOX_PATH/Dockerfile" \
            "$SANDBOX_PATH/" 2>&1 | tee -a "$LOG_FILE"
        
        echo "$DOCKERFILE_HASH" > "$HASH_FILE"
        log_success "Sandbox image rebuilt"
    fi
}

#-------------------------------------------------------------------------------
# Restart Services
#-------------------------------------------------------------------------------
restart_services() {
    log_step "Step 5/6: Restarting services..."
    
    cd "$INSTALL_DIR"
    
    # Create data directories if not exist
    mkdir -p data/runs ctf-autopilot/data/runs ctf-autopilot/infra/data/runs
    chmod -R 755 data ctf-autopilot/data 2>/dev/null || true
    
    # Find docker-compose location
    COMPOSE_FILE=""
    if [[ -f "ctf-autopilot/infra/docker-compose.yml" ]]; then
        COMPOSE_FILE="ctf-autopilot/infra/docker-compose.yml"
    elif [[ -f "infra/docker-compose.yml" ]]; then
        COMPOSE_FILE="infra/docker-compose.yml"
    elif [[ -f "docker-compose.yml" ]]; then
        COMPOSE_FILE="docker-compose.yml"
    fi
    
    if [[ -z "$COMPOSE_FILE" ]]; then
        log_warn "docker-compose.yml not found, skipping service restart..."
        return 0
    fi
    
    # Copy .env to compose directory if needed
    COMPOSE_DIR=$(dirname "$COMPOSE_FILE")
    if [[ "$COMPOSE_DIR" != "." ]] && [[ -f ".env" ]]; then
        cp .env "$COMPOSE_DIR/.env" 2>/dev/null || true
    fi
    
    # Export environment variables
    set -a
    source .env 2>/dev/null || true
    set +a
    
    # Start services with rebuild
    log_info "Starting services..."
    docker compose -f "$COMPOSE_FILE" up -d --build 2>&1 | tee -a "$LOG_FILE"
    
    # Wait for services
    log_info "Waiting for services to start (20 seconds)..."
    sleep 20
    
    log_success "Services restarted"
}

#-------------------------------------------------------------------------------
# Health Check
#-------------------------------------------------------------------------------
health_check() {
    log_step "Step 6/6: Running health checks..."
    
    HEALTH_OK=true
    
    # Check API
    if curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
        log_success "  API: Healthy"
    else
        log_warn "  API: Not responding"
        HEALTH_OK=false
    fi
    
    # Check Web
    if curl -sf http://localhost:3000 > /dev/null 2>&1; then
        log_success "  Web UI: Healthy"
    else
        log_warn "  Web UI: Not responding"
        HEALTH_OK=false
    fi
    
    if [[ "$HEALTH_OK" == "true" ]]; then
        log_success "All health checks passed"
    else
        log_warn "Some services may still be starting."
        log_warn "Check logs: docker compose logs -f"
    fi
}

#-------------------------------------------------------------------------------
# Print Summary
#-------------------------------------------------------------------------------
print_summary() {
    VERSION=$(cd $INSTALL_DIR && git rev-parse --short HEAD 2>/dev/null || echo 'unknown')
    SERVER_IP=$(hostname -I | awk '{print $1}')
    
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}        ${BOLD}✓ CTF Compass Update Complete!${NC}                             ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}╠═══════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}Version:${NC} $VERSION                                                    ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}Updated:${NC} $(date '+%Y-%m-%d %H:%M:%S')                               ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}Access:${NC}                                                           ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    Web UI: ${CYAN}http://${SERVER_IP}:3000${NC}                             ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    API:    ${CYAN}http://${SERVER_IP}:8000${NC}                             ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

#-------------------------------------------------------------------------------
# Check for Updates (dry run)
#-------------------------------------------------------------------------------
check_updates() {
    cd "$INSTALL_DIR"
    
    if [[ ! -d ".git" ]]; then
        if [[ "$JSON_MODE" == "true" ]]; then
            echo '{"updates_available":false,"error":"Not a git repository"}'
        else
            echo "Not a git repository"
        fi
        return 0
    fi
    
    # Ensure correct remote
    git remote set-url origin "$GITHUB_REPO" 2>/dev/null || true
    
    # Fetch latest
    git fetch origin $GITHUB_BRANCH 2>/dev/null
    
    LOCAL=$(git rev-parse HEAD 2>/dev/null)
    REMOTE=$(git rev-parse origin/$GITHUB_BRANCH 2>/dev/null)
    
    if [[ "$LOCAL" == "$REMOTE" ]]; then
        if [[ "$JSON_MODE" == "true" ]]; then
            echo "{\"updates_available\":false,\"current_version\":\"${LOCAL:0:8}\",\"message\":\"Already up to date\"}"
        else
            echo "Already up to date (${LOCAL:0:8})"
        fi
    else
        COMMITS_BEHIND=$(git rev-list --count HEAD..origin/$GITHUB_BRANCH 2>/dev/null || echo "unknown")
        if [[ "$JSON_MODE" == "true" ]]; then
            echo "{\"updates_available\":true,\"current_version\":\"${LOCAL:0:8}\",\"latest_version\":\"${REMOTE:0:8}\",\"commits_behind\":$COMMITS_BEHIND}"
        else
            echo "Updates available: $COMMITS_BEHIND commits behind"
            echo "Current: ${LOCAL:0:8}"
            echo "Latest:  ${REMOTE:0:8}"
            echo ""
            echo "Run 'sudo bash $0' to update"
        fi
    fi
}

#-------------------------------------------------------------------------------
# Main
#-------------------------------------------------------------------------------
main() {
    # Parse arguments
    case "${1:-}" in
        --check)
            check_updates
            exit 0
            ;;
        --json)
            JSON_MODE="true"
            ;;
        --help|-h)
            echo "CTF Compass Update Script"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --check   Check for updates without installing"
            echo "  --json    Output in JSON format (for API use)"
            echo "  --help    Show this help message"
            echo ""
            echo "GitHub: https://github.com/huynhtrungcipp/ctf-compass"
            exit 0
            ;;
    esac
    
    # Create log file
    touch "$LOG_FILE"
    chmod 644 "$LOG_FILE"
    
    if [[ "$JSON_MODE" != "true" ]]; then
        echo ""
        echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${CYAN}║${NC}                   CTF Compass System Update                       ${CYAN}║${NC}"
        echo -e "${CYAN}║${NC}          github.com/huynhtrungcipp/ctf-compass                   ${CYAN}║${NC}"
        echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
        echo ""
    fi
    
    log_info "Update started at $(date)"
    
    preflight_checks
    backup_config
    pull_latest
    cleanup_docker
    rebuild_sandbox
    restart_services
    health_check
    
    log_info "Update completed at $(date)"
    
    if [[ "$JSON_MODE" == "true" ]]; then
        VERSION=$(cd $INSTALL_DIR && git rev-parse --short HEAD 2>/dev/null || echo 'unknown')
        echo "{\"status\":\"success\",\"version\":\"$VERSION\",\"timestamp\":\"$(date -Iseconds)\"}"
    else
        print_summary
    fi
}

# Run main
main "$@"
