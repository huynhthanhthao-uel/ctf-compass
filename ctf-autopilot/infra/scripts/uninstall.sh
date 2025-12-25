#!/bin/bash
#===============================================================================
# CTF Compass - Complete Uninstall Script
# Removes all components, data, and Docker resources
#===============================================================================
#
# GitHub: https://github.com/HaryLya/ctf-compass.git
#
# USAGE:
#   sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/uninstall.sh
#
# OPTIONS:
#   --force     Skip confirmation prompts
#   --keep-data Keep database volumes (only remove containers/images)
#   --help      Show help message
#
#===============================================================================

set -euo pipefail

#-------------------------------------------------------------------------------
# Configuration
#-------------------------------------------------------------------------------
INSTALL_DIR="${INSTALL_DIR:-/opt/ctf-compass}"
BACKUP_DIR="/opt/ctf-compass-backups"
LOG_FILE="/var/log/ctf-compass-uninstall.log"

FORCE_MODE=false
KEEP_DATA=false

#-------------------------------------------------------------------------------
# Colors
#-------------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"; exit 1; }
log_step()    { echo -e "${CYAN}${BOLD}[STEP]${NC} $1" | tee -a "$LOG_FILE"; }

#-------------------------------------------------------------------------------
# Parse Arguments
#-------------------------------------------------------------------------------
for arg in "$@"; do
    case $arg in
        --force) FORCE_MODE=true ;;
        --keep-data) KEEP_DATA=true ;;
        --help|-h)
            echo "CTF Compass Uninstall Script"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --force       Skip confirmation prompts"
            echo "  --keep-data   Keep database volumes"
            echo "  --help        Show this help message"
            exit 0
            ;;
    esac
done

#-------------------------------------------------------------------------------
# Banner
#-------------------------------------------------------------------------------
print_banner() {
    echo -e "${RED}"
    echo "╔═══════════════════════════════════════════════════════════════════╗"
    echo "║                                                                   ║"
    echo "║              CTF Compass - Uninstall Script                       ║"
    echo "║                                                                   ║"
    echo "╚═══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

#-------------------------------------------------------------------------------
# Confirmation
#-------------------------------------------------------------------------------
confirm_uninstall() {
    if [[ "$FORCE_MODE" == "true" ]]; then
        return 0
    fi
    
    echo -e "${YELLOW}"
    echo "╔═══════════════════════════════════════════════════════════════════╗"
    echo "║  WARNING: This will remove CTF Compass completely!                ║"
    echo "╠═══════════════════════════════════════════════════════════════════╣"
    echo "║                                                                   ║"
    echo "║  The following will be deleted:                                   ║"
    echo "║    • All Docker containers                                        ║"
    echo "║    • All Docker images                                            ║"
    if [[ "$KEEP_DATA" != "true" ]]; then
        echo "║    • All database data (PostgreSQL, Redis)                        ║"
        echo "║    • All uploaded files and job results                           ║"
    fi
    echo "║    • Installation directory ($INSTALL_DIR)             ║"
    echo "║    • Log files                                                    ║"
    echo "║                                                                   ║"
    echo "╚═══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    read -p "Are you sure you want to continue? (type 'yes' to confirm): " response
    if [[ "$response" != "yes" ]]; then
        echo "Uninstall cancelled."
        exit 0
    fi
}

#-------------------------------------------------------------------------------
# Stop Services
#-------------------------------------------------------------------------------
stop_services() {
    log_step "Step 1/5: Stopping services..."
    
    COMPOSE_FILE="$INSTALL_DIR/ctf-autopilot/infra/docker-compose.yml"
    
    if [[ -f "$COMPOSE_FILE" ]]; then
        # Export env vars if .env exists
        if [[ -f "$INSTALL_DIR/.env" ]]; then
            set -a
            source "$INSTALL_DIR/.env" 2>/dev/null || true
            set +a
        fi
        
        docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>&1 | tee -a "$LOG_FILE" || true
        log_success "Services stopped"
    else
        log_warn "docker-compose.yml not found, attempting manual cleanup..."
    fi
    
    # Stop any remaining containers with ctf-compass label
    log_info "Stopping any remaining containers..."
    docker ps -q --filter "label=com.ctf-compass.service" | xargs -r docker stop 2>/dev/null || true
    docker ps -aq --filter "label=com.ctf-compass.service" | xargs -r docker rm -f 2>/dev/null || true
    
    # Stop containers by name pattern
    docker ps -aq --filter "name=ctf_compass" | xargs -r docker rm -f 2>/dev/null || true
    docker ps -aq --filter "name=ctf-compass" | xargs -r docker rm -f 2>/dev/null || true
}

#-------------------------------------------------------------------------------
# Remove Volumes
#-------------------------------------------------------------------------------
remove_volumes() {
    log_step "Step 2/5: Removing Docker volumes..."
    
    if [[ "$KEEP_DATA" == "true" ]]; then
        log_info "Keeping data volumes (--keep-data flag set)"
        return 0
    fi
    
    # Remove named volumes
    docker volume rm ctf_compass_postgres_data 2>/dev/null || true
    docker volume rm ctf_compass_redis_data 2>/dev/null || true
    docker volume rm ctf_compass_app_data 2>/dev/null || true
    
    # Remove any volumes with ctf-compass label
    docker volume ls -q --filter "label=com.ctf-compass.volume" | xargs -r docker volume rm 2>/dev/null || true
    
    log_success "Volumes removed"
}

#-------------------------------------------------------------------------------
# Remove Images
#-------------------------------------------------------------------------------
remove_images() {
    log_step "Step 3/5: Removing Docker images..."
    
    # Remove images by name pattern
    docker images --format "{{.Repository}}:{{.Tag}} {{.ID}}" | grep -E "ctf[-_]compass|ctf[-_]autopilot" | awk '{print $2}' | xargs -r docker rmi -f 2>/dev/null || true
    
    # Remove dangling images
    docker image prune -f 2>&1 | tee -a "$LOG_FILE" || true
    
    log_success "Images removed"
}

#-------------------------------------------------------------------------------
# Remove Networks
#-------------------------------------------------------------------------------
remove_networks() {
    log_step "Step 4/5: Removing Docker networks..."
    
    docker network rm ctf_compass_frontend 2>/dev/null || true
    docker network rm ctf_compass_backend 2>/dev/null || true
    
    # Prune unused networks
    docker network prune -f 2>&1 | tee -a "$LOG_FILE" || true
    
    log_success "Networks removed"
}

#-------------------------------------------------------------------------------
# Remove Files
#-------------------------------------------------------------------------------
remove_files() {
    log_step "Step 5/5: Removing files..."
    
    # Remove installation directory
    if [[ -d "$INSTALL_DIR" ]]; then
        rm -rf "$INSTALL_DIR"
        log_info "Removed: $INSTALL_DIR"
    fi
    
    # Remove backup directory
    if [[ -d "$BACKUP_DIR" ]]; then
        rm -rf "$BACKUP_DIR"
        log_info "Removed: $BACKUP_DIR"
    fi
    
    # Remove log files
    rm -f /var/log/ctf-compass-*.log
    log_info "Removed log files"
    
    # Remove sandbox hash file
    rm -f /tmp/ctf_compass_sandbox_hash
    
    log_success "Files removed"
}

#-------------------------------------------------------------------------------
# Print Summary
#-------------------------------------------------------------------------------
print_summary() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}        ${BOLD}✓ CTF Compass Uninstalled Successfully${NC}                     ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}╠═══════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  All CTF Compass components have been removed.                   ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    if [[ "$KEEP_DATA" == "true" ]]; then
        echo -e "${GREEN}║${NC}  ${YELLOW}Note: Database volumes were preserved (--keep-data)${NC}             ${GREEN}║${NC}"
        echo -e "${GREEN}║${NC}  To remove them: docker volume prune                            ${GREEN}║${NC}"
    fi
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  To reinstall:                                                   ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  curl -fsSL https://raw.githubusercontent.com/HaryLya/            ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}    ctf-compass/main/ctf-autopilot/infra/scripts/                  ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}    install_ubuntu_24.04.sh | sudo bash                            ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

#-------------------------------------------------------------------------------
# Main
#-------------------------------------------------------------------------------
main() {
    # Check root
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
    fi
    
    print_banner
    confirm_uninstall
    
    echo "" | tee -a "$LOG_FILE"
    log_info "Starting uninstall at $(date)"
    echo ""
    
    stop_services
    remove_volumes
    remove_images
    remove_networks
    remove_files
    
    print_summary
}

main "$@"
