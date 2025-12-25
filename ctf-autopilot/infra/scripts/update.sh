#!/bin/bash
#===============================================================================
# CTF Compass - System Update Script
# Pulls latest changes, cleans up, and restarts services
#===============================================================================
#
# GitHub: https://github.com/huynhtrungpc01/ctf-compass.git
#
# USAGE:
#   sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh
#
# OPTIONS:
#   --check     Check for updates without installing
#   --clean     Force deep cleanup before update
#   --json      Output in JSON format (for API)
#   --force     Skip confirmation prompts
#   --help      Show help message
#
#===============================================================================

set -euo pipefail

#-------------------------------------------------------------------------------
# Auto-detect Installation Directory
#-------------------------------------------------------------------------------
detect_install_dir() {
    # Check environment variable first
    if [[ -n "${INSTALL_DIR:-}" ]] && [[ -d "$INSTALL_DIR" ]]; then
        echo "$INSTALL_DIR"
        return
    fi
    
    # Common installation paths
    local candidates=(
        "/opt/ctf-compass"
        "/app"
        "$(dirname "$(dirname "$(dirname "$(dirname "$(realpath "${BASH_SOURCE[0]}")")")")")"
        "$(pwd)"
    )
    
    for path in "${candidates[@]}"; do
        if [[ -d "$path" ]] && { [[ -d "$path/.git" ]] || [[ -d "$path/ctf-autopilot" ]]; }; then
            echo "$path"
            return
        fi
    done
    
    # Default fallback
    echo "/opt/ctf-compass"
}

INSTALL_DIR="$(detect_install_dir)"
BACKUP_DIR="${BACKUP_DIR:-/opt/ctf-compass-backups}"
LOG_FILE="${LOG_FILE:-/var/log/ctf-compass-update.log}"
GITHUB_REPO="${GITHUB_REPO:-https://github.com/huynhtrungpc01/ctf-compass.git}"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"

# Flags
CLEAN_MODE=false
JSON_MODE=false
FORCE_MODE=false
CHECK_ONLY=false

#-------------------------------------------------------------------------------
# Colors (disabled for JSON mode)
#-------------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

#-------------------------------------------------------------------------------
# Logging Functions
#-------------------------------------------------------------------------------
log_json() {
    local level="$1"
    local message="$2"
    echo "{\"level\":\"$level\",\"message\":\"$message\",\"timestamp\":\"$(date -Iseconds)\"}"
}

log_info() {
    if [[ "$JSON_MODE" == "true" ]]; then
        log_json "info" "$1"
    else
        echo -e "${BLUE}[$(date '+%H:%M:%S')] [INFO]${NC} $1" | tee -a "$LOG_FILE" 2>/dev/null || echo -e "${BLUE}[INFO]${NC} $1"
    fi
}

log_success() {
    if [[ "$JSON_MODE" == "true" ]]; then
        log_json "success" "$1"
    else
        echo -e "${GREEN}[$(date '+%H:%M:%S')] [SUCCESS]${NC} $1" | tee -a "$LOG_FILE" 2>/dev/null || echo -e "${GREEN}[SUCCESS]${NC} $1"
    fi
}

log_warn() {
    if [[ "$JSON_MODE" == "true" ]]; then
        log_json "warn" "$1"
    else
        echo -e "${YELLOW}[$(date '+%H:%M:%S')] [WARN]${NC} $1" | tee -a "$LOG_FILE" 2>/dev/null || echo -e "${YELLOW}[WARN]${NC} $1"
    fi
}

log_error() {
    if [[ "$JSON_MODE" == "true" ]]; then
        log_json "error" "$1"
        exit 1
    else
        echo -e "${RED}[$(date '+%H:%M:%S')] [ERROR]${NC} $1" | tee -a "$LOG_FILE" 2>/dev/null || echo -e "${RED}[ERROR]${NC} $1"
        exit 1
    fi
}

log_step() {
    if [[ "$JSON_MODE" == "true" ]]; then
        log_json "step" "$1"
    else
        echo -e "${CYAN}${BOLD}[$(date '+%H:%M:%S')] [STEP]${NC} $1" | tee -a "$LOG_FILE" 2>/dev/null || echo -e "${CYAN}[STEP]${NC} $1"
    fi
}

#-------------------------------------------------------------------------------
# Pre-flight Checks
#-------------------------------------------------------------------------------
preflight_checks() {
    log_step "Running pre-flight checks..."
    
    # Check if running as root (warn but don't fail)
    if [[ $EUID -ne 0 ]]; then
        log_warn "Not running as root. Some operations may fail."
    fi
    
    # Check installation directory
    if [[ ! -d "$INSTALL_DIR" ]]; then
        log_error "Installation directory not found: $INSTALL_DIR"
    fi
    
    # Check for git
    if ! command -v git &> /dev/null; then
        log_error "Git is not installed. Please install git first."
    fi
    
    # Check for Docker (optional for some operations)
    if ! command -v docker &> /dev/null; then
        log_warn "Docker not found. Container operations will be skipped."
    elif ! docker info &> /dev/null 2>&1; then
        log_warn "Docker is not running or not accessible."
    fi
    
    log_success "Pre-flight checks passed"
}

#-------------------------------------------------------------------------------
# Check for Updates (without installing)
#-------------------------------------------------------------------------------
check_updates() {
    cd "$INSTALL_DIR" || exit 1
    
    # Not a git repository
    if [[ ! -d ".git" ]]; then
        if [[ "$JSON_MODE" == "true" ]]; then
            echo '{"updates_available":false,"error":"Not a git repository","current_version":"unknown","latest_version":"unknown"}'
        else
            echo "Not a git repository: $INSTALL_DIR"
        fi
        return 0
    fi
    
    # Set up remote
    git remote set-url origin "$GITHUB_REPO" 2>/dev/null || git remote add origin "$GITHUB_REPO" 2>/dev/null || true
    
    # Fetch latest
    if ! git fetch origin "$GITHUB_BRANCH" 2>/dev/null; then
        if [[ "$JSON_MODE" == "true" ]]; then
            echo '{"updates_available":false,"error":"Failed to fetch from remote","current_version":"unknown","latest_version":"unknown"}'
        else
            echo "Failed to fetch from remote. Check network connection."
        fi
        return 1
    fi
    
    # Get versions
    LOCAL=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    REMOTE=$(git rev-parse --short "origin/$GITHUB_BRANCH" 2>/dev/null || echo "unknown")
    
    if [[ "$LOCAL" == "unknown" ]] || [[ "$REMOTE" == "unknown" ]]; then
        if [[ "$JSON_MODE" == "true" ]]; then
            echo "{\"updates_available\":false,\"error\":\"Could not determine versions\",\"current_version\":\"$LOCAL\",\"latest_version\":\"$REMOTE\"}"
        else
            echo "Could not determine versions"
        fi
        return 1
    fi
    
    if [[ "$LOCAL" == "$REMOTE" ]]; then
        if [[ "$JSON_MODE" == "true" ]]; then
            echo "{\"updates_available\":false,\"current_version\":\"$LOCAL\",\"latest_version\":\"$REMOTE\",\"commits_behind\":0,\"message\":\"Already up to date\"}"
        else
            echo "✓ Already up to date ($LOCAL)"
        fi
    else
        COMMITS_BEHIND=$(git rev-list --count "HEAD..origin/$GITHUB_BRANCH" 2>/dev/null || echo "0")
        if [[ "$JSON_MODE" == "true" ]]; then
            echo "{\"updates_available\":true,\"current_version\":\"$LOCAL\",\"latest_version\":\"$REMOTE\",\"commits_behind\":$COMMITS_BEHIND}"
        else
            echo "Updates available!"
            echo "  Current: $LOCAL"
            echo "  Latest:  $REMOTE"
            echo "  Commits behind: $COMMITS_BEHIND"
            echo ""
            echo "Run 'sudo bash $0' to update"
        fi
    fi
}

#-------------------------------------------------------------------------------
# Backup Configuration
#-------------------------------------------------------------------------------
backup_config() {
    log_step "Step 1/6: Backing up configuration..."
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR" 2>/dev/null || log_warn "Could not create backup directory"
    
    cd "$INSTALL_DIR" || return 1
    
    # Backup .env and credentials if they exist
    if [[ -f ".env" ]]; then
        BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).tar.gz"
        tar -czf "$BACKUP_FILE" .env CREDENTIALS.txt 2>/dev/null || tar -czf "$BACKUP_FILE" .env 2>/dev/null || true
        log_info "Backed up configuration to: $BACKUP_FILE"
    else
        log_info "No .env file to backup"
    fi
    
    # Keep only last 5 backups
    if [[ -d "$BACKUP_DIR" ]]; then
        ls -t "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm -f 2>/dev/null || true
    fi
    
    log_success "Backup completed"
}

#-------------------------------------------------------------------------------
# Pull Latest Changes
#-------------------------------------------------------------------------------
pull_latest() {
    log_step "Step 2/6: Pulling latest changes from GitHub..."
    
    cd "$INSTALL_DIR" || return 1
    
    OLD_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    
    # Initialize git if needed
    if [[ ! -d ".git" ]]; then
        log_warn "Not a git repository. Initializing..."
        git init
        git remote add origin "$GITHUB_REPO" 2>/dev/null || git remote set-url origin "$GITHUB_REPO"
    fi
    
    # Ensure remote is correct
    git remote set-url origin "$GITHUB_REPO" 2>/dev/null || true
    
    # Stash local changes
    git stash --include-untracked 2>/dev/null || true
    
    # Fetch and reset
    log_info "Fetching from origin/$GITHUB_BRANCH..."
    git fetch origin "$GITHUB_BRANCH" 2>&1 | tee -a "$LOG_FILE" 2>/dev/null || true
    
    log_info "Resetting to origin/$GITHUB_BRANCH..."
    git reset --hard "origin/$GITHUB_BRANCH" 2>&1 | tee -a "$LOG_FILE" 2>/dev/null || true
    
    NEW_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    
    if [[ "$OLD_COMMIT" == "$NEW_COMMIT" ]]; then
        log_info "Already up to date ($NEW_COMMIT)"
    else
        log_info "Updated: $OLD_COMMIT → $NEW_COMMIT"
        # Show recent commits
        git log --oneline "$OLD_COMMIT".."$NEW_COMMIT" 2>/dev/null | head -5 | while read -r line; do
            log_info "  $line"
        done
    fi
    
    # Try to restore stashed changes
    git stash pop 2>/dev/null || true
    
    log_success "Latest code pulled"
}

#-------------------------------------------------------------------------------
# Cleanup Docker Resources
#-------------------------------------------------------------------------------
cleanup_docker() {
    log_step "Step 3/6: Cleaning up Docker resources..."
    
    # Check if Docker is available
    if ! command -v docker &> /dev/null; then
        log_warn "Docker not found, skipping cleanup"
        return 0
    fi
    
    if ! docker info &> /dev/null 2>&1; then
        log_warn "Docker not accessible, skipping cleanup"
        return 0
    fi
    
    cd "$INSTALL_DIR" || return 1
    
    # Find compose file
    COMPOSE_FILE=""
    for cf in "ctf-autopilot/infra/docker-compose.yml" "infra/docker-compose.yml" "docker-compose.yml"; do
        if [[ -f "$cf" ]]; then
            COMPOSE_FILE="$cf"
            break
        fi
    done
    
    if [[ -n "$COMPOSE_FILE" ]]; then
        # Copy .env to compose directory
        COMPOSE_DIR=$(dirname "$COMPOSE_FILE")
        if [[ "$COMPOSE_DIR" != "." ]] && [[ -f ".env" ]]; then
            cp .env "$COMPOSE_DIR/.env" 2>/dev/null || true
        fi
        
        # Export env vars
        if [[ -f ".env" ]]; then
            set -a
            source .env 2>/dev/null || true
            set +a
        fi
        
        log_info "Stopping services..."
        docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>&1 | tee -a "$LOG_FILE" 2>/dev/null || true
    fi
    
    # Clean containers
    log_info "Removing old containers..."
    docker container prune -f 2>&1 | tee -a "$LOG_FILE" 2>/dev/null || true
    
    # Clean images
    log_info "Removing dangling images..."
    docker image prune -f 2>&1 | tee -a "$LOG_FILE" 2>/dev/null || true
    
    # Deep cleanup if requested
    if [[ "$CLEAN_MODE" == "true" ]]; then
        log_info "Deep cleanup mode - removing project images..."
        docker images --format "{{.Repository}}:{{.Tag}} {{.ID}}" | grep -E "ctf[-_]compass|ctf[-_]autopilot" | awk '{print $2}' | xargs -r docker rmi -f 2>/dev/null || true
        docker builder prune -af 2>&1 | tee -a "$LOG_FILE" 2>/dev/null || true
    else
        docker builder prune -f --keep-storage=2GB 2>&1 | tee -a "$LOG_FILE" 2>/dev/null || true
    fi
    
    log_success "Docker cleanup completed"
}

#-------------------------------------------------------------------------------
# Rebuild Sandbox Image
#-------------------------------------------------------------------------------
rebuild_sandbox() {
    log_step "Step 4/6: Rebuilding sandbox image..."
    
    if ! command -v docker &> /dev/null || ! docker info &> /dev/null 2>&1; then
        log_warn "Docker not available, skipping sandbox rebuild"
        return 0
    fi
    
    cd "$INSTALL_DIR" || return 1
    
    # Find sandbox Dockerfile
    SANDBOX_PATH=""
    for sp in "ctf-autopilot/sandbox/image" "sandbox/image"; do
        if [[ -f "$sp/Dockerfile" ]]; then
            SANDBOX_PATH="$sp"
            break
        fi
    done
    
    if [[ -z "$SANDBOX_PATH" ]]; then
        log_warn "Sandbox Dockerfile not found, skipping..."
        return 0
    fi
    
    # Check if rebuild is needed
    DOCKERFILE_HASH=$(md5sum "$SANDBOX_PATH/Dockerfile" 2>/dev/null | cut -d' ' -f1 || echo "unknown")
    HASH_FILE="/tmp/ctf_compass_sandbox_hash"
    
    if [[ "$CLEAN_MODE" == "true" ]] || [[ ! -f "$HASH_FILE" ]] || [[ "$(cat "$HASH_FILE" 2>/dev/null)" != "$DOCKERFILE_HASH" ]]; then
        log_info "Building sandbox image..."
        docker build \
            -t ctf-compass-sandbox:latest \
            -t ctf-autopilot-sandbox:latest \
            -f "$SANDBOX_PATH/Dockerfile" \
            "$SANDBOX_PATH/" 2>&1 | tee -a "$LOG_FILE" 2>/dev/null || true
        
        echo "$DOCKERFILE_HASH" > "$HASH_FILE"
        log_success "Sandbox image rebuilt"
    else
        log_info "Sandbox unchanged, skipping rebuild"
    fi
}

#-------------------------------------------------------------------------------
# Restart Services
#-------------------------------------------------------------------------------
restart_services() {
    log_step "Step 5/6: Restarting services..."
    
    if ! command -v docker &> /dev/null || ! docker info &> /dev/null 2>&1; then
        log_warn "Docker not available, skipping service restart"
        return 0
    fi
    
    cd "$INSTALL_DIR" || return 1
    
    # Create data directories
    mkdir -p data/runs ctf-autopilot/data/runs 2>/dev/null || true
    
    # Find compose file
    COMPOSE_FILE=""
    for cf in "ctf-autopilot/infra/docker-compose.yml" "infra/docker-compose.yml" "docker-compose.yml"; do
        if [[ -f "$cf" ]]; then
            COMPOSE_FILE="$cf"
            break
        fi
    done
    
    if [[ -z "$COMPOSE_FILE" ]]; then
        log_warn "docker-compose.yml not found, skipping service restart"
        return 0
    fi
    
    # Copy .env to compose directory
    COMPOSE_DIR=$(dirname "$COMPOSE_FILE")
    if [[ "$COMPOSE_DIR" != "." ]] && [[ -f ".env" ]]; then
        cp .env "$COMPOSE_DIR/.env" 2>/dev/null || true
    fi
    
    # Export env vars
    if [[ -f ".env" ]]; then
        set -a
        source .env 2>/dev/null || true
        set +a
    fi
    
    # Build options
    BUILD_OPTS="--build"
    if [[ "$CLEAN_MODE" == "true" ]]; then
        BUILD_OPTS="--build --no-cache"
    fi
    
    log_info "Starting services with: docker compose -f $COMPOSE_FILE up -d $BUILD_OPTS"
    docker compose -f "$COMPOSE_FILE" up -d $BUILD_OPTS 2>&1 | tee -a "$LOG_FILE" 2>/dev/null || true
    
    log_info "Waiting for services (25 seconds)..."
    sleep 25
    
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
        log_success "API: Healthy"
    else
        log_warn "API: Not responding (may still be starting)"
        HEALTH_OK=false
    fi
    
    # Check Web UI
    if curl -sf http://localhost:3000 > /dev/null 2>&1; then
        log_success "Web UI: Healthy"
    else
        log_warn "Web UI: Not responding (may still be starting)"
        HEALTH_OK=false
    fi
    
    if [[ "$HEALTH_OK" == "true" ]]; then
        log_success "All health checks passed"
    else
        log_warn "Some services may still be starting"
        log_info "Check logs: docker compose logs -f"
    fi
}

#-------------------------------------------------------------------------------
# Print Summary
#-------------------------------------------------------------------------------
print_summary() {
    VERSION=$(cd "$INSTALL_DIR" && git rev-parse --short HEAD 2>/dev/null || echo 'unknown')
    SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
    
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
# Show Help
#-------------------------------------------------------------------------------
show_help() {
    echo "CTF Compass - System Update Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --check   Check for updates without installing"
    echo "  --clean   Force deep cleanup before update"
    echo "  --json    Output in JSON format (for API integration)"
    echo "  --force   Skip confirmation prompts"
    echo "  --help    Show this help message"
    echo ""
    echo "Examples:"
    echo "  sudo bash $0                 # Normal update"
    echo "  sudo bash $0 --check         # Check for updates only"
    echo "  sudo bash $0 --clean         # Deep cleanup and update"
    echo "  sudo bash $0 --json          # JSON output for API"
    echo ""
    echo "Installation directory: $INSTALL_DIR"
}

#-------------------------------------------------------------------------------
# Main
#-------------------------------------------------------------------------------
main() {
    # Parse arguments
    for arg in "$@"; do
        case $arg in
            --check)
                CHECK_ONLY=true
                ;;
            --clean)
                CLEAN_MODE=true
                ;;
            --json)
                JSON_MODE=true
                ;;
            --force)
                FORCE_MODE=true
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                echo "Unknown option: $arg"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Check only mode
    if [[ "$CHECK_ONLY" == "true" ]]; then
        check_updates
        exit 0
    fi
    
    # Initialize log file
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
    echo "=== CTF Compass Update Log ===" > "$LOG_FILE" 2>/dev/null || true
    echo "Started: $(date)" >> "$LOG_FILE" 2>/dev/null || true
    echo "Install directory: $INSTALL_DIR" >> "$LOG_FILE" 2>/dev/null || true
    
    # Show banner (non-JSON mode)
    if [[ "$JSON_MODE" != "true" ]]; then
        echo -e "${CYAN}"
        echo "╔═══════════════════════════════════════════════════════════════════╗"
        echo "║                  CTF Compass - System Update                      ║"
        echo "║            github.com/huynhtrungpc01/ctf-compass                  ║"
        echo "╚═══════════════════════════════════════════════════════════════════╝"
        echo -e "${NC}"
        echo ""
        echo "Installation directory: $INSTALL_DIR"
        echo ""
    fi
    
    # Run update steps
    preflight_checks
    backup_config
    pull_latest
    cleanup_docker
    rebuild_sandbox
    restart_services
    health_check
    
    # Print summary
    if [[ "$JSON_MODE" == "true" ]]; then
        VERSION=$(cd "$INSTALL_DIR" && git rev-parse --short HEAD 2>/dev/null || echo 'unknown')
        echo "{\"level\":\"complete\",\"success\":true,\"version\":\"$VERSION\",\"message\":\"Update completed successfully!\",\"timestamp\":\"$(date -Iseconds)\"}"
    else
        print_summary
    fi
}

main "$@"
