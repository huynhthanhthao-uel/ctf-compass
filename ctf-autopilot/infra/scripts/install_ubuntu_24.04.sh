#!/bin/bash
#===============================================================================
# CTF Compass - Production Installation Script
# Ubuntu 24.04 LTS Only
# Version: 2.0.0 (2025-12-26)
#===============================================================================
#
# GitHub Repository: https://github.com/huynhtrungpc01/ctf-compass.git
#
# ARCHITECTURE:
#   Frontend connects directly to Docker Backend via user-configured Backend URL.
#   No login required - single-user local deployment.
#   No external cloud/edge functions required for core functionality.
#
# FEATURES:
#   - No login required (single-user mode)
#   - Full Autopilot AI analysis
#   - Netcat terminal for PWN/remote challenges
#   - AI Solve Script generation (pwntools)
#   - Sandbox Terminal with Docker isolation
#   - Built-in CORS Tester
#
# USAGE:
#   # Fresh install
#   curl -fsSL https://raw.githubusercontent.com/huynhtrungpc01/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash
#
#   # Clean install (remove old first)
#   curl -fsSL https://raw.githubusercontent.com/huynhtrungpc01/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash -s -- --clean
#
# OPTIONS:
#   --clean     Remove old installation completely before installing
#   --force     Skip confirmation prompts
#   --no-start  Don't start services after install
#   --help      Show help message
#
# PREREQUISITES:
#   1. Ubuntu 24.04 LTS
#   2. Root or sudo access
#   3. Internet connection
#   4. Minimum 4GB RAM, 15GB disk
#
#===============================================================================

# Use -eo instead of -euo to handle potential unbound variables when piped
set -eo pipefail

#-------------------------------------------------------------------------------
# Configuration
#-------------------------------------------------------------------------------
INSTALL_DIR="/opt/ctf-compass"
BACKUP_DIR="/opt/ctf-compass-backups"
LOG_FILE="/var/log/ctf-compass-install.log"
GITHUB_REPO="https://github.com/huynhtrungpc01/ctf-compass.git"
GITHUB_BRANCH="main"
MIN_MEMORY_MB=3072
MIN_DISK_GB=15

# Flags
CLEAN_MODE=false
FORCE_MODE=false
NO_START=false
PURGE_MODE=false
CLEAN_ONLY=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --clean) CLEAN_MODE=true ;;
        --force) FORCE_MODE=true ;;
        --no-start) NO_START=true ;;
        --purge) PURGE_MODE=true; CLEAN_MODE=true ;;
        --clean-only) CLEAN_ONLY=true; CLEAN_MODE=true ;;
        --help|-h)
            echo "CTF Compass Installation Script"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --clean       Remove old installation before installing"
            echo "  --clean-only  Only clean up, don't install (for uninstall)"
            echo "  --purge       Clean + remove backups and all user data"
            echo "  --force       Skip confirmation prompts"
            echo "  --no-start    Don't start services after install"
            echo "  --help        Show this help message"
            echo ""
            echo "Examples:"
            echo "  # Fresh install"
            echo "  sudo $0"
            echo ""
            echo "  # Clean reinstall"
            echo "  sudo $0 --clean"
            echo ""
            echo "  # Complete uninstall"
            echo "  sudo $0 --clean-only --purge"
            exit 0
            ;;
    esac
done

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

log_info()    { echo -e "${BLUE}[$(date '+%H:%M:%S')] [INFO]${NC} $1" | tee -a "$LOG_FILE"; }
log_success() { echo -e "${GREEN}[$(date '+%H:%M:%S')] [SUCCESS]${NC} $1" | tee -a "$LOG_FILE"; }
log_warn()    { echo -e "${YELLOW}[$(date '+%H:%M:%S')] [WARN]${NC} $1" | tee -a "$LOG_FILE"; }
log_error()   { echo -e "${RED}[$(date '+%H:%M:%S')] [ERROR]${NC} $1" | tee -a "$LOG_FILE"; exit 1; }
log_step()    { echo -e "${CYAN}${BOLD}[$(date '+%H:%M:%S')] [STEP]${NC} $1" | tee -a "$LOG_FILE"; }
log_debug()   { echo "[$(date '+%H:%M:%S')] [DEBUG] $1" >> "$LOG_FILE"; }

#-------------------------------------------------------------------------------
# Banner
#-------------------------------------------------------------------------------
print_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════════════╗"
    echo "║                                                                   ║"
    echo "║      ██████╗████████╗███████╗     ██████╗ ██████╗ ███╗   ███╗    ║"
    echo "║     ██╔════╝╚══██╔══╝██╔════╝    ██╔════╝██╔═══██╗████╗ ████║    ║"
    echo "║     ██║        ██║   █████╗      ██║     ██║   ██║██╔████╔██║    ║"
    echo "║     ██║        ██║   ██╔══╝      ██║     ██║   ██║██║╚██╔╝██║    ║"
    echo "║     ╚██████╗   ██║   ██║         ╚██████╗╚██████╔╝██║ ╚═╝ ██║    ║"
    echo "║      ╚═════╝   ╚═╝   ╚═╝          ╚═════╝ ╚═════╝ ╚═╝     ╚═╝    ║"
    echo "║                                                                   ║"
    echo "║                   CTF Compass v2.0.0                              ║"
    echo "║             Automated CTF Challenge Analyzer                      ║"
    echo "║         No Login Required - Single User Mode                      ║"
    echo "║                                                                   ║"
    echo "║     GitHub: github.com/huynhtrungpc01/ctf-compass                  ║"
    echo "║                                                                   ║"
    echo "╚═══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

#-------------------------------------------------------------------------------
# Cleanup Old Installation (Comprehensive)
#-------------------------------------------------------------------------------
cleanup_old_installation() {
    log_step "Cleaning up old installation..."
    
    # CRITICAL: Change to safe directory first to prevent getcwd() errors
    cd /tmp || cd /root || cd /
    
    #---------------------------------------------------------------------------
    # 1. Stop systemd services (if any)
    #---------------------------------------------------------------------------
    log_info "Stopping systemd services..."
    if systemctl is-active --quiet ctf-compass 2>/dev/null; then
        systemctl stop ctf-compass 2>/dev/null || true
        systemctl disable ctf-compass 2>/dev/null || true
    fi
    if systemctl is-active --quiet ctf-compass-api 2>/dev/null; then
        systemctl stop ctf-compass-api 2>/dev/null || true
        systemctl disable ctf-compass-api 2>/dev/null || true
    fi
    if systemctl is-active --quiet ctf-compass-worker 2>/dev/null; then
        systemctl stop ctf-compass-worker 2>/dev/null || true
        systemctl disable ctf-compass-worker 2>/dev/null || true
    fi
    
    # Remove systemd service files
    rm -f /etc/systemd/system/ctf-compass*.service
    rm -f /etc/systemd/system/multi-user.target.wants/ctf-compass*.service
    systemctl daemon-reload 2>/dev/null || true
    
    #---------------------------------------------------------------------------
    # 2. Remove cron jobs
    #---------------------------------------------------------------------------
    log_info "Removing cron jobs..."
    crontab -l 2>/dev/null | grep -v "ctf-compass" | crontab - 2>/dev/null || true
    rm -f /etc/cron.d/ctf-compass*
    rm -f /etc/cron.daily/ctf-compass*
    rm -f /etc/cron.hourly/ctf-compass*
    
    #---------------------------------------------------------------------------
    # 3. Stop Docker containers
    #---------------------------------------------------------------------------
    if [[ -f "$INSTALL_DIR/ctf-autopilot/infra/docker-compose.yml" ]]; then
        log_info "Stopping Docker services via compose..."
        
        # Export env if exists
        if [[ -f "$INSTALL_DIR/.env" ]]; then
            set -a
            source "$INSTALL_DIR/.env" 2>/dev/null || true
            set +a
        fi
        
        docker compose -f "$INSTALL_DIR/ctf-autopilot/infra/docker-compose.yml" down -v --remove-orphans --timeout 30 2>/dev/null || true
    fi
    
    # Also check dev compose
    if [[ -f "$INSTALL_DIR/ctf-autopilot/infra/docker-compose.dev.yml" ]]; then
        docker compose -f "$INSTALL_DIR/ctf-autopilot/infra/docker-compose.dev.yml" down -v --remove-orphans 2>/dev/null || true
    fi
    
    # Stop containers by various naming patterns
    log_info "Removing Docker containers..."
    CONTAINER_PATTERNS=(
        "ctf_compass"
        "ctf-compass"
        "ctfcompass"
        "ctf_autopilot"
        "ctf-autopilot"
        "infra-api"
        "infra-web"
        "infra-postgres"
        "infra-redis"
        "infra-worker"
        "infra-nginx"
    )
    
    for pattern in "${CONTAINER_PATTERNS[@]}"; do
        docker ps -aq --filter "name=$pattern" 2>/dev/null | xargs -r docker rm -f 2>/dev/null || true
    done
    
    # By label
    docker ps -aq --filter "label=com.ctf-compass.service" 2>/dev/null | xargs -r docker rm -f 2>/dev/null || true
    docker ps -aq --filter "label=project=ctf-compass" 2>/dev/null | xargs -r docker rm -f 2>/dev/null || true
    
    #---------------------------------------------------------------------------
    # 4. Remove Docker images
    #---------------------------------------------------------------------------
    log_info "Removing Docker images..."
    IMAGE_PATTERNS=(
        "ctf[-_]compass"
        "ctf[-_]autopilot"
        "ctfcompass"
        "sandbox[-_]ctf"
        "infra[-_]api"
        "infra[-_]web"
    )
    
    for pattern in "${IMAGE_PATTERNS[@]}"; do
        docker images --format "{{.Repository}}:{{.Tag}} {{.ID}}" 2>/dev/null | grep -E "$pattern" | awk '{print $2}' | xargs -r docker rmi -f 2>/dev/null || true
    done
    
    # Remove by label
    docker images --filter "label=com.ctf-compass.service" -q 2>/dev/null | xargs -r docker rmi -f 2>/dev/null || true
    
    #---------------------------------------------------------------------------
    # 5. Remove Docker volumes
    #---------------------------------------------------------------------------
    log_info "Removing Docker volumes..."
    VOLUME_PATTERNS=(
        "ctf[-_]compass"
        "ctf[-_]autopilot"
        "ctfcompass"
        "infra[-_]postgres"
        "infra[-_]redis"
        "infra[-_]uploads"
    )
    
    for pattern in "${VOLUME_PATTERNS[@]}"; do
        docker volume ls -q 2>/dev/null | grep -E "$pattern" | xargs -r docker volume rm -f 2>/dev/null || true
    done
    
    #---------------------------------------------------------------------------
    # 6. Remove Docker networks
    #---------------------------------------------------------------------------
    log_info "Removing Docker networks..."
    docker network ls -q --filter "name=ctf" 2>/dev/null | xargs -r docker network rm 2>/dev/null || true
    docker network ls -q --filter "name=infra" 2>/dev/null | xargs -r docker network rm 2>/dev/null || true
    docker network ls -q --filter "name=compass" 2>/dev/null | xargs -r docker network rm 2>/dev/null || true
    
    #---------------------------------------------------------------------------
    # 7. Prune Docker resources
    #---------------------------------------------------------------------------
    log_info "Pruning dangling Docker resources..."
    docker system prune -af --volumes 2>/dev/null || true
    
    #---------------------------------------------------------------------------
    # 8. Remove application files
    #---------------------------------------------------------------------------
    log_info "Removing application files..."
    rm -rf "$INSTALL_DIR"
    rm -rf /opt/ctf-autopilot
    rm -rf /var/lib/ctf-compass
    rm -rf /var/run/ctf-compass
    
    #---------------------------------------------------------------------------
    # 9. Remove log files
    #---------------------------------------------------------------------------
    log_info "Removing log files..."
    rm -f /var/log/ctf-compass*.log
    rm -rf /var/log/ctf-compass/
    
    #---------------------------------------------------------------------------
    # 10. Remove temp files
    #---------------------------------------------------------------------------
    log_info "Removing temp files..."
    rm -rf /tmp/ctf_compass* 2>/dev/null || true
    rm -rf /tmp/ctf-compass* 2>/dev/null || true
    rm -rf /tmp/ctf_sandbox* 2>/dev/null || true
    
    #---------------------------------------------------------------------------
    # 11. Remove configuration files
    #---------------------------------------------------------------------------
    log_info "Removing configuration files..."
    rm -f /etc/ctf-compass.conf
    rm -rf /etc/ctf-compass/
    rm -f /etc/nginx/sites-enabled/ctf-compass*
    rm -f /etc/nginx/sites-available/ctf-compass*
    
    #---------------------------------------------------------------------------
    # 12. Purge mode: Remove backups and user data
    #---------------------------------------------------------------------------
    if [[ "$PURGE_MODE" == "true" ]]; then
        log_warn "Purge mode: Removing all backups and user data..."
        rm -rf "$BACKUP_DIR"
        rm -rf /home/*/ctf-compass-*
        rm -rf /root/ctf-compass-*
        
        # Remove any exported data
        rm -rf /tmp/ctf-compass-export*
        
        log_warn "All backups and user data removed!"
    else
        log_info "Backups preserved at: $BACKUP_DIR (use --purge to remove)"
    fi
    
    #---------------------------------------------------------------------------
    # 13. Reload services
    #---------------------------------------------------------------------------
    systemctl daemon-reload 2>/dev/null || true
    
    # Reload nginx if installed
    if systemctl is-active --quiet nginx 2>/dev/null; then
        systemctl reload nginx 2>/dev/null || true
    fi
    
    log_success "Old installation cleaned up completely"
}

#-------------------------------------------------------------------------------
# Clean Only Mode Handler
#-------------------------------------------------------------------------------
handle_clean_only() {
    if [[ "$CLEAN_ONLY" == "true" ]]; then
        print_banner
        log_step "Running cleanup only (no installation)..."
        
        if [[ "$FORCE_MODE" != "true" && "$PURGE_MODE" != "true" ]]; then
            echo ""
            echo -e "${YELLOW}This will remove CTF Compass completely.${NC}"
            echo -e "${YELLOW}Backups will be preserved unless --purge is used.${NC}"
            echo ""
            read -p "Continue? (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_info "Cleanup cancelled."
                exit 0
            fi
        fi
        
        cleanup_old_installation
        
        echo ""
        echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║                    CLEANUP COMPLETE                               ║${NC}"
        echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        
        if [[ "$PURGE_MODE" == "true" ]]; then
            echo -e "  ${RED}All data including backups has been removed.${NC}"
        else
            echo -e "  ${CYAN}Backups preserved at: $BACKUP_DIR${NC}"
        fi
        
        echo ""
        echo -e "  To reinstall CTF Compass:"
        echo -e "  ${BOLD}curl -fsSL https://raw.githubusercontent.com/huynhtrungpc01/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash${NC}"
        echo ""
        
        exit 0
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
    log_debug "Running as root: OK"
    
    # Handle existing installation
    if [[ -d "$INSTALL_DIR" ]]; then
        if [[ "$CLEAN_MODE" == "true" ]]; then
            cleanup_old_installation
        elif [[ "$FORCE_MODE" == "true" ]]; then
            cleanup_old_installation
        else
            log_warn "Existing installation found at $INSTALL_DIR"
            read -p "Remove and reinstall? (y/N) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                cleanup_old_installation
            else
                log_error "Installation cancelled. Use --clean to force reinstall."
            fi
        fi
    fi
    
    # Check Ubuntu version
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        if [[ "$ID" != "ubuntu" ]]; then
            log_error "This script requires Ubuntu. Detected: $ID"
        fi
        if [[ ! "$VERSION_ID" =~ ^24\. ]]; then
            log_warn "This script is designed for Ubuntu 24.04 LTS"
            log_warn "Detected version: $VERSION_ID"
            if [[ "$FORCE_MODE" != "true" ]]; then
                read -p "Continue anyway? (y/N) " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    exit 1
                fi
            fi
        fi
        log_debug "Ubuntu version: $VERSION_ID - OK"
    else
        log_error "Cannot determine OS version. /etc/os-release not found."
    fi
    
    # Check available memory
    TOTAL_MEMORY_MB=$(free -m | awk '/^Mem:/{print $2}')
    if [[ $TOTAL_MEMORY_MB -lt $MIN_MEMORY_MB ]]; then
        log_warn "Low memory detected: ${TOTAL_MEMORY_MB}MB (recommended: ${MIN_MEMORY_MB}MB+)"
    fi
    log_debug "Memory: ${TOTAL_MEMORY_MB}MB total - OK"
    
    # Check available disk space
    AVAILABLE_DISK_GB=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
    if [[ $AVAILABLE_DISK_GB -lt $MIN_DISK_GB ]]; then
        log_error "Insufficient disk space: ${AVAILABLE_DISK_GB}GB available (need ${MIN_DISK_GB}GB+)"
    fi
    log_debug "Disk space: ${AVAILABLE_DISK_GB}GB available - OK"
    
    # Check internet connectivity
    if ! ping -c 1 -W 5 github.com > /dev/null 2>&1; then
        if ! ping -c 1 -W 5 8.8.8.8 > /dev/null 2>&1; then
            log_error "No internet connection. Please check your network."
        fi
    fi
    log_debug "Internet connectivity: OK"
    
    log_success "All pre-flight checks passed"
}

#-------------------------------------------------------------------------------
# System Update
#-------------------------------------------------------------------------------
update_system() {
    log_step "Step 1/10: Updating system packages..."
    
    apt-get update -qq 2>&1 | tee -a "$LOG_FILE"
    DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq 2>&1 | tee -a "$LOG_FILE"
    
    log_info "Installing prerequisites..."
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release \
        git \
        ufw \
        fail2ban \
        jq \
        htop \
        net-tools \
        make \
        2>&1 | tee -a "$LOG_FILE"
    
    log_success "System packages updated"
}

#-------------------------------------------------------------------------------
# Docker Installation
#-------------------------------------------------------------------------------
install_docker() {
    log_step "Step 2/10: Installing Docker..."
    
    if command -v docker &> /dev/null && docker compose version &> /dev/null; then
        DOCKER_VERSION=$(docker --version | awk '{print $3}' | tr -d ',')
        COMPOSE_VERSION=$(docker compose version --short)
        log_info "Docker already installed: v${DOCKER_VERSION}"
        log_info "Docker Compose: v${COMPOSE_VERSION}"
        log_success "Docker installation verified"
        return 0
    fi
    
    log_info "Installing Docker Engine..."
    
    # Remove old versions
    apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    
    # Add Docker repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
        tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
        docker-ce \
        docker-ce-cli \
        containerd.io \
        docker-buildx-plugin \
        docker-compose-plugin \
        2>&1 | tee -a "$LOG_FILE"
    
    # Start and enable Docker
    systemctl start docker
    systemctl enable docker
    
    # Verify installation
    if ! docker run --rm hello-world > /dev/null 2>&1; then
        log_error "Docker installation verification failed"
    fi
    
    log_success "Docker installed successfully"
}

#-------------------------------------------------------------------------------
# Firewall Configuration
#-------------------------------------------------------------------------------
configure_firewall() {
    log_step "Step 3/10: Configuring firewall..."
    
    ufw --force reset > /dev/null 2>&1
    ufw default deny incoming > /dev/null
    ufw default allow outgoing > /dev/null
    
    ufw allow ssh comment 'SSH access' > /dev/null
    ufw allow 80/tcp comment 'HTTP' > /dev/null
    ufw allow 443/tcp comment 'HTTPS' > /dev/null
    ufw allow 3000/tcp comment 'CTF Compass Web' > /dev/null
    ufw allow 8000/tcp comment 'CTF Compass API' > /dev/null
    
    # Monitoring ports (optional - uncomment if needed externally)
    # ufw allow 3001/tcp comment 'Grafana' > /dev/null
    # ufw allow 9090/tcp comment 'Prometheus' > /dev/null
    # ufw allow 9093/tcp comment 'Alertmanager' > /dev/null
    
    ufw --force enable > /dev/null
    
    log_success "Firewall configured"
}

#-------------------------------------------------------------------------------
# Fail2ban Configuration
#-------------------------------------------------------------------------------
configure_fail2ban() {
    log_step "Step 4/10: Configuring fail2ban..."
    
    cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
ignoreip = 127.0.0.1/8 ::1

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 2h
EOF

    systemctl restart fail2ban
    systemctl enable fail2ban
    
    log_success "fail2ban configured"
}

#-------------------------------------------------------------------------------
# Repository Setup
#-------------------------------------------------------------------------------
setup_repository() {
    log_step "Step 5/10: Setting up repository..."
    
    # Ensure we're in a valid directory before git operations
    cd /tmp || cd /root || cd /
    
    log_info "Cloning from GitHub..."
    if ! git clone --depth 1 --branch "$GITHUB_BRANCH" "$GITHUB_REPO" "$INSTALL_DIR" 2>&1 | tee -a "$LOG_FILE"; then
        log_error "Failed to clone repository. Check internet connection and GitHub access."
    fi
    
    cd "$INSTALL_DIR" || log_error "Failed to enter install directory"
    CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    log_info "Version: $CURRENT_COMMIT"
    
    # Make scripts executable
    chmod +x ctf-autopilot/infra/scripts/*.sh 2>/dev/null || true
    
    log_success "Repository ready at $INSTALL_DIR"
}

#-------------------------------------------------------------------------------
# Environment Configuration
#-------------------------------------------------------------------------------
configure_environment() {
    log_step "Step 6/10: Configuring environment..."
    
    cd "$INSTALL_DIR"
    
    # Simple fixed credentials for local deployment
    SECRET_KEY=$(openssl rand -base64 48 | tr -d '\n')
    POSTGRES_PASSWORD="ctfautopilot"
    REDIS_PASSWORD=""
    
    # Detect server IP for CORS
    SERVER_IP=$(hostname -I | awk '{print $1}')
    
    # Create .env file - NO LOGIN REQUIRED
    cat > .env << EOF
#===============================================================================
# CTF Compass v2.0.0 Configuration
# Generated: $(date)
# No login required - single user mode
#===============================================================================

# AI Configuration (OPTIONAL - for AI analysis features)
# Get your API key from: https://ai.megallm.io
MEGALLM_API_KEY=
MEGALLM_MODEL=llama3.3-70b-instruct

# Database - Simple defaults
POSTGRES_USER=ctfautopilot
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=ctfautopilot

# Security
SECRET_KEY=$SECRET_KEY

# CORS - allow frontend to connect
# Add your specific origins or use * for all
CORS_ORIGINS=http://${SERVER_IP}:3000,http://localhost:3000

# Application Settings
MAX_UPLOAD_SIZE_MB=200
SANDBOX_TIMEOUT_SECONDS=60
SANDBOX_MEMORY_LIMIT=512m
SANDBOX_CPU_LIMIT=1
ENVIRONMENT=production
DEBUG=false

# TLS (set to true for HTTPS)
ENABLE_TLS=false
EOF

    # Keep secrets readable by the installing user (so they can run docker compose without sudo)
    if [[ -n "${SUDO_USER:-}" ]]; then
        chown "$SUDO_USER":"$SUDO_USER" .env
    fi
    chmod 600 .env

    # Copy to infra directory for docker-compose (compose loads .env from the compose file directory)
    cp .env ctf-autopilot/infra/.env
    cp .env ctf-autopilot/infra/monitoring/.env 2>/dev/null || true
    if [[ -n "${SUDO_USER:-}" ]]; then
        chown "$SUDO_USER":"$SUDO_USER" ctf-autopilot/infra/.env
    fi
    chmod 600 ctf-autopilot/infra/.env
    
    # Display simple info
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}CTF Compass v2.0.0 - No Login Required${NC}                          ${GREEN}║${NC}"
    echo -e "${GREEN}╠═══════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  Just open the Web UI and set your Backend URL!                  ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  CORS configured for: ${CYAN}http://${SERVER_IP}:3000${NC}                   ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    log_success "Environment configured"
}

#-------------------------------------------------------------------------------
# Build Sandbox Image
#-------------------------------------------------------------------------------
build_sandbox() {
    log_step "Step 7/10: Building sandbox image..."
    
    cd "$INSTALL_DIR"
    
    SANDBOX_PATH=""
    if [[ -f "ctf-autopilot/sandbox/image/Dockerfile" ]]; then
        SANDBOX_PATH="ctf-autopilot/sandbox/image"
    elif [[ -f "sandbox/image/Dockerfile" ]]; then
        SANDBOX_PATH="sandbox/image"
    fi
    
    if [[ -z "$SANDBOX_PATH" ]]; then
        log_warn "Sandbox Dockerfile not found, skipping..."
        return 0
    fi
    
    docker build \
        -t ctf-compass-sandbox:latest \
        -t ctf-autopilot-sandbox:latest \
        -f "$SANDBOX_PATH/Dockerfile" \
        "$SANDBOX_PATH/" 2>&1 | tee -a "$LOG_FILE"
    
    # Save hash for future comparisons
    md5sum "$SANDBOX_PATH/Dockerfile" | cut -d' ' -f1 > /tmp/ctf_compass_sandbox_hash
    
    log_success "Sandbox image built"
}

#-------------------------------------------------------------------------------
# Setup Backup & Health Check
#-------------------------------------------------------------------------------
setup_maintenance() {
    log_step "Step 8/10: Setting up backup & health check..."
    
    cd "$INSTALL_DIR"
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    chmod 700 "$BACKUP_DIR"
    
    # Setup daily backup cron (2 AM)
    local backup_script="$INSTALL_DIR/ctf-autopilot/infra/scripts/backup.sh"
    if [[ -f "$backup_script" ]]; then
        chmod +x "$backup_script"
        
        # Add to cron
        local cron_entry="0 2 * * * $backup_script --backup >> /var/log/ctf-compass-backup.log 2>&1"
        if ! crontab -l 2>/dev/null | grep -q "backup.sh"; then
            (crontab -l 2>/dev/null; echo "$cron_entry") | crontab -
            log_info "Daily backup cron job added (2 AM)"
        fi
    fi
    
    # Setup health check cron (every 5 minutes)
    local health_script="$INSTALL_DIR/ctf-autopilot/infra/scripts/health-check.sh"
    if [[ -f "$health_script" ]]; then
        chmod +x "$health_script"
        
        # Add to cron
        local health_cron="*/5 * * * * $health_script --check >> /var/log/ctf-compass-health.log 2>&1"
        if ! crontab -l 2>/dev/null | grep -q "health-check.sh"; then
            (crontab -l 2>/dev/null; echo "$health_cron") | crontab -
            log_info "Health check cron job added (every 5 minutes)"
        fi
    fi
    
    log_success "Backup & health check configured"
}

#-------------------------------------------------------------------------------
# Start Services
#-------------------------------------------------------------------------------
start_services() {
    if [[ "$NO_START" == "true" ]]; then
        log_info "Skipping service start (--no-start flag set)"
        return 0
    fi
    
    log_step "Step 9/10: Starting services..."
    
    cd "$INSTALL_DIR"
    
    # Create data directories
    mkdir -p data/runs ctf-autopilot/data/runs backups
    
    # Export environment
    set -a
    source .env
    set +a
    
    COMPOSE_FILE="ctf-autopilot/infra/docker-compose.yml"
    
    log_info "Building and starting containers..."

    # docker compose can return non-zero if a dependency healthcheck hasn't flipped yet.
    # We run it, then perform our own bounded wait with diagnostics.
    set +e
    docker compose -f "$COMPOSE_FILE" up -d --build 2>&1 | tee -a "$LOG_FILE"
    COMPOSE_EXIT=${PIPESTATUS[0]}
    set -e

    if [[ $COMPOSE_EXIT -ne 0 ]]; then
        log_warn "docker compose reported an error (exit code $COMPOSE_EXIT). Continuing with health diagnostics..."
    fi

    log_info "Waiting for API to become healthy (up to 180 seconds)..."
    API_OK=false
    for _ in {1..36}; do
        if curl -sf --max-time 2 http://localhost:8000/api/health > /dev/null 2>&1; then
            API_OK=true
            break
        fi
        sleep 5
    done

    if [[ "$API_OK" != "true" ]]; then
        log_warn "API did not become healthy in time. Last 200 lines of API logs:"
        docker compose -f "$COMPOSE_FILE" logs --no-color --tail=200 api 2>&1 | tee -a "$LOG_FILE" || true
        log_error "API container is unhealthy. Please review logs above."
    fi

    log_info "Running health checks..."

    log_success "  API: Healthy"

    if curl -sf --max-time 2 http://localhost:3000 > /dev/null 2>&1; then
        log_success "  Web UI: Healthy"
    else
        log_warn "  Web UI: Starting..."
    fi
    
    log_success "Services started"
}

#-------------------------------------------------------------------------------
# Print Summary
#-------------------------------------------------------------------------------
print_summary() {
    log_step "Step 10/10: Installation complete!"
    
    VERSION=$(cd "$INSTALL_DIR" && git rev-parse --short HEAD 2>/dev/null || echo 'unknown')
    SERVER_IP=$(hostname -I | awk '{print $1}')
    
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}        ${BOLD}✓ CTF Compass v2.0.0 Installation Complete!${NC}               ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}╠═══════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}Version:${NC} $VERSION                                                    ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}Access the Application:${NC}                                          ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    Web UI: ${CYAN}http://${SERVER_IP}:3000${NC}                             ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    API:    ${CYAN}http://${SERVER_IP}:8000${NC}                             ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${YELLOW}✨ No login required - just open the Web UI!${NC}                   ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}Installation Directory:${NC}                                          ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    $INSTALL_DIR                                              ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}Next Steps:${NC}"
    echo "  1. Open the Web UI at http://${SERVER_IP}:3000"
    echo "  2. Set Backend URL to: http://${SERVER_IP}:8000"
    echo "  3. (Optional) Go to Configuration to set your MegaLLM API key"
    echo "  4. (Optional) Use CORS Tester: http://${SERVER_IP}:3000/cors-tester"
    echo "  5. Start analyzing CTF challenges!"
    echo ""
    echo -e "${CYAN}Quick Commands (from $INSTALL_DIR/ctf-autopilot):${NC}"
    echo "  make help          # Show all available commands"
    echo "  make status        # Check service status"
    echo "  make logs          # View logs"
    echo "  make update        # Pull latest & rebuild"
    echo "  make backup        # Create database backup"
    echo ""
    echo -e "${CYAN}Documentation:${NC}"
    echo "  README:        $INSTALL_DIR/ctf-autopilot/README.md"
    echo "  User Guide:    $INSTALL_DIR/ctf-autopilot/docs/USAGE.md"
    echo "  Troubleshoot:  $INSTALL_DIR/ctf-autopilot/docs/DEBUG.md"
    echo ""
    echo -e "${CYAN}GitHub:${NC} https://github.com/huynhtrungpc01/ctf-compass"
    echo ""
}

#-------------------------------------------------------------------------------
# Main
#-------------------------------------------------------------------------------
main() {
    # Initialize log file
    mkdir -p "$(dirname "$LOG_FILE")"
    echo "=== CTF Compass Installation Log ===" > "$LOG_FILE"
    echo "Started: $(date)" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
    
    print_banner
    
    # Handle clean-only mode (uninstall)
    handle_clean_only
    
    preflight_checks
    update_system
    install_docker
    configure_firewall
    configure_fail2ban
    setup_repository
    configure_environment
    build_sandbox
    setup_maintenance
    start_services
    print_summary
    
    echo "Installation completed at $(date)" >> "$LOG_FILE"
}

main "$@"
