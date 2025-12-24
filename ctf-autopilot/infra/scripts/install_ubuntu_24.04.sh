#!/bin/bash
#===============================================================================
# CTF Compass - Production Installation Script
# Ubuntu 24.04 LTS Only
#===============================================================================
#
# GitHub Repository: https://github.com/huynhtrungcipp/ctf-compass.git
#
# USAGE:
#   # Fresh install
#   curl -fsSL https://raw.githubusercontent.com/huynhtrungcipp/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash
#
#   # Clean install (remove old first)
#   curl -fsSL https://raw.githubusercontent.com/huynhtrungcipp/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash -s -- --clean
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

set -euo pipefail

#-------------------------------------------------------------------------------
# Configuration
#-------------------------------------------------------------------------------
INSTALL_DIR="/opt/ctf-compass"
BACKUP_DIR="/opt/ctf-compass-backups"
LOG_FILE="/var/log/ctf-compass-install.log"
GITHUB_REPO="https://github.com/huynhtrungcipp/ctf-compass.git"
GITHUB_BRANCH="main"
MIN_MEMORY_MB=3072
MIN_DISK_GB=15

# Flags
CLEAN_MODE=false
FORCE_MODE=false
NO_START=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --clean) CLEAN_MODE=true ;;
        --force) FORCE_MODE=true ;;
        --no-start) NO_START=true ;;
        --help|-h)
            echo "CTF Compass Installation Script"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --clean     Remove old installation before installing"
            echo "  --force     Skip confirmation prompts"
            echo "  --no-start  Don't start services after install"
            echo "  --help      Show this help message"
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
    echo "║                   CTF Compass v1.0.0                              ║"
    echo "║             Automated CTF Challenge Analyzer                      ║"
    echo "║                                                                   ║"
    echo "║     GitHub: github.com/huynhtrungcipp/ctf-compass                 ║"
    echo "║                                                                   ║"
    echo "╚═══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

#-------------------------------------------------------------------------------
# Cleanup Old Installation
#-------------------------------------------------------------------------------
cleanup_old_installation() {
    log_step "Cleaning up old installation..."
    
    # CRITICAL: Change to safe directory first to prevent getcwd() errors
    cd /tmp || cd /root || cd /
    
    # Stop and remove old containers
    if [[ -f "$INSTALL_DIR/ctf-autopilot/infra/docker-compose.yml" ]]; then
        log_info "Stopping old services..."
        
        # Export env if exists
        if [[ -f "$INSTALL_DIR/.env" ]]; then
            set -a
            source "$INSTALL_DIR/.env" 2>/dev/null || true
            set +a
        fi
        
        docker compose -f "$INSTALL_DIR/ctf-autopilot/infra/docker-compose.yml" down -v --remove-orphans 2>/dev/null || true
    fi
    
    # Stop containers by label/name
    log_info "Removing old containers..."
    docker ps -aq --filter "label=com.ctf-compass.service" 2>/dev/null | xargs -r docker rm -f 2>/dev/null || true
    docker ps -aq --filter "name=ctf_compass" 2>/dev/null | xargs -r docker rm -f 2>/dev/null || true
    docker ps -aq --filter "name=ctf-compass" 2>/dev/null | xargs -r docker rm -f 2>/dev/null || true
    docker ps -aq --filter "name=infra" 2>/dev/null | xargs -r docker rm -f 2>/dev/null || true
    
    # Remove old images
    log_info "Removing old images..."
    docker images --format "{{.Repository}}:{{.Tag}} {{.ID}}" 2>/dev/null | grep -E "ctf[-_]compass|ctf[-_]autopilot|infra" | awk '{print $2}' | xargs -r docker rmi -f 2>/dev/null || true
    
    # Remove old volumes
    log_info "Removing old volumes..."
    docker volume ls -q 2>/dev/null | grep -E "ctf[-_]compass|ctf[-_]autopilot|infra" | xargs -r docker volume rm -f 2>/dev/null || true
    
    # Remove old networks
    docker network ls -q --filter "name=ctf" 2>/dev/null | xargs -r docker network rm 2>/dev/null || true
    docker network ls -q --filter "name=infra" 2>/dev/null | xargs -r docker network rm 2>/dev/null || true
    
    # Cleanup dangling resources
    log_info "Pruning Docker resources..."
    docker system prune -af --volumes 2>/dev/null || true
    
    # Remove old files (safe because we changed to /tmp first)
    log_info "Removing old files..."
    rm -rf "$INSTALL_DIR"
    rm -f /var/log/ctf-compass-*.log
    rm -f /tmp/ctf_compass_sandbox_hash
    
    log_success "Old installation cleaned up"
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
    log_step "Step 1/8: Updating system packages..."
    
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
        2>&1 | tee -a "$LOG_FILE"
    
    log_success "System packages updated"
}

#-------------------------------------------------------------------------------
# Docker Installation
#-------------------------------------------------------------------------------
install_docker() {
    log_step "Step 2/8: Installing Docker..."
    
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
    log_step "Step 3/8: Configuring firewall..."
    
    ufw --force reset > /dev/null 2>&1
    ufw default deny incoming > /dev/null
    ufw default allow outgoing > /dev/null
    
    ufw allow ssh comment 'SSH access' > /dev/null
    ufw allow 80/tcp comment 'HTTP' > /dev/null
    ufw allow 443/tcp comment 'HTTPS' > /dev/null
    ufw allow 3000/tcp comment 'CTF Compass Web' > /dev/null
    ufw allow 8000/tcp comment 'CTF Compass API' > /dev/null
    
    ufw --force enable > /dev/null
    
    log_success "Firewall configured"
}

#-------------------------------------------------------------------------------
# Fail2ban Configuration
#-------------------------------------------------------------------------------
configure_fail2ban() {
    log_step "Step 4/8: Configuring fail2ban..."
    
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
    log_step "Step 5/8: Setting up repository..."
    
    # Ensure we're in a valid directory before git operations
    cd /tmp || cd /root || cd /
    
    log_info "Cloning from GitHub..."
    if ! git clone --depth 1 --branch "$GITHUB_BRANCH" "$GITHUB_REPO" "$INSTALL_DIR" 2>&1 | tee -a "$LOG_FILE"; then
        log_error "Failed to clone repository. Check internet connection and GitHub access."
    fi
    
    cd "$INSTALL_DIR" || log_error "Failed to enter install directory"
    CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    log_info "Version: $CURRENT_COMMIT"
    
    log_success "Repository ready at $INSTALL_DIR"
}

#-------------------------------------------------------------------------------
# Environment Configuration
#-------------------------------------------------------------------------------
configure_environment() {
    log_step "Step 6/8: Configuring environment..."
    
    cd "$INSTALL_DIR"
    
    # Generate secure credentials
    SECRET_KEY=$(openssl rand -base64 48 | tr -d '\n')
    POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
    ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 16)
    REDIS_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
    
    # Create .env file
    cat > .env << EOF
#===============================================================================
# CTF Compass Configuration
# Generated: $(date)
#===============================================================================

# AI Configuration (REQUIRED)
# Get your API key from: https://ai.megallm.io
MEGALLM_API_KEY=
MEGALLM_MODEL=llama3.3-70b-instruct

# Authentication
ADMIN_PASSWORD=$ADMIN_PASSWORD

# Database
POSTGRES_USER=ctfautopilot
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=ctfautopilot

# Security
SECRET_KEY=$SECRET_KEY
REDIS_PASSWORD=$REDIS_PASSWORD

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

    chmod 600 .env
    
    # Copy to infra directory for docker-compose
    cp .env ctf-autopilot/infra/.env
    
    # Save credentials
    cat > CREDENTIALS.txt << EOF
#===============================================================================
# CTF Compass Credentials
# Generated: $(date)
# KEEP THIS FILE SECURE!
#===============================================================================

Admin Password: $ADMIN_PASSWORD

Database:
  User: ctfautopilot
  Password: $POSTGRES_PASSWORD
  Database: ctfautopilot

Redis Password: $REDIS_PASSWORD

#===============================================================================
# IMPORTANT: Set your MegaLLM API key!
# 
# Option 1: Edit via Web UI
#   Go to Configuration page after login
#
# Option 2: Edit .env file
#   sudo nano $INSTALL_DIR/.env
#   Add: MEGALLM_API_KEY=your-key-here
#   Then restart: docker compose restart
#===============================================================================
EOF

    chmod 600 CREDENTIALS.txt
    
    # Display credentials
    echo ""
    echo -e "${YELLOW}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║${NC}  ${BOLD}IMPORTANT: Save these credentials securely!${NC}                      ${YELLOW}║${NC}"
    echo -e "${YELLOW}╠═══════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${YELLOW}║${NC}                                                                   ${YELLOW}║${NC}"
    echo -e "${YELLOW}║${NC}  Admin Password: ${CYAN}${ADMIN_PASSWORD}${NC}                                  ${YELLOW}║${NC}"
    echo -e "${YELLOW}║${NC}                                                                   ${YELLOW}║${NC}"
    echo -e "${YELLOW}║${NC}  Credentials saved to: ${CYAN}$INSTALL_DIR/CREDENTIALS.txt${NC}  ${YELLOW}║${NC}"
    echo -e "${YELLOW}║${NC}                                                                   ${YELLOW}║${NC}"
    echo -e "${YELLOW}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    log_success "Environment configured"
}

#-------------------------------------------------------------------------------
# Build Sandbox Image
#-------------------------------------------------------------------------------
build_sandbox() {
    log_step "Step 7/8: Building sandbox image..."
    
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
# Start Services
#-------------------------------------------------------------------------------
start_services() {
    if [[ "$NO_START" == "true" ]]; then
        log_info "Skipping service start (--no-start flag set)"
        return 0
    fi
    
    log_step "Step 8/8: Starting services..."
    
    cd "$INSTALL_DIR"
    
    # Create data directories
    mkdir -p data/runs ctf-autopilot/data/runs
    
    # Export environment
    set -a
    source .env
    set +a
    
    COMPOSE_FILE="ctf-autopilot/infra/docker-compose.yml"
    
    log_info "Building and starting containers..."
    docker compose -f "$COMPOSE_FILE" up -d --build 2>&1 | tee -a "$LOG_FILE"
    
    log_info "Waiting for services to start (30 seconds)..."
    sleep 30
    
    # Health checks
    log_info "Running health checks..."
    
    if curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
        log_success "  API: Healthy"
    else
        log_warn "  API: Starting..."
    fi
    
    if curl -sf http://localhost:3000 > /dev/null 2>&1; then
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
    VERSION=$(cd "$INSTALL_DIR" && git rev-parse --short HEAD 2>/dev/null || echo 'unknown')
    SERVER_IP=$(hostname -I | awk '{print $1}')
    
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}        ${BOLD}✓ CTF Compass Installation Complete!${NC}                       ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}╠═══════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}Version:${NC} $VERSION                                                    ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}Access the Application:${NC}                                          ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    Web UI: ${CYAN}http://${SERVER_IP}:3000${NC}                             ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    API:    ${CYAN}http://${SERVER_IP}:8000${NC}                             ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}Installation Directory:${NC}                                          ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    $INSTALL_DIR                                              ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}Next Steps:${NC}"
    echo "  1. Open the Web UI and log in with your admin password"
    echo "  2. Go to Configuration page to set your MegaLLM API key"
    echo "  3. Start analyzing CTF challenges!"
    echo ""
    echo -e "${CYAN}Useful Commands:${NC}"
    echo "  View logs:     docker compose -f $INSTALL_DIR/ctf-autopilot/infra/docker-compose.yml logs -f"
    echo "  Stop:          docker compose -f $INSTALL_DIR/ctf-autopilot/infra/docker-compose.yml down"
    echo "  Start:         docker compose -f $INSTALL_DIR/ctf-autopilot/infra/docker-compose.yml up -d"
    echo "  Update:        sudo bash $INSTALL_DIR/ctf-autopilot/infra/scripts/update.sh"
    echo "  Uninstall:     sudo bash $INSTALL_DIR/ctf-autopilot/infra/scripts/uninstall.sh"
    echo ""
    echo -e "${CYAN}Documentation:${NC}"
    echo "  README:        $INSTALL_DIR/ctf-autopilot/README.md"
    echo "  User Guide:    $INSTALL_DIR/ctf-autopilot/docs/USAGE.md"
    echo "  Troubleshoot:  $INSTALL_DIR/ctf-autopilot/docs/DEBUG.md"
    echo ""
    echo -e "${CYAN}GitHub:${NC} https://github.com/huynhtrungcipp/ctf-compass"
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
    preflight_checks
    update_system
    install_docker
    configure_firewall
    configure_fail2ban
    setup_repository
    configure_environment
    build_sandbox
    start_services
    print_summary
    
    echo "Installation completed at $(date)" >> "$LOG_FILE"
}

main "$@"
