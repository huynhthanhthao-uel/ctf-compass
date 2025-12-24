#!/bin/bash
#===============================================================================
# CTF Autopilot Analyzer - Production Installation Script
# Ubuntu 24.04 LTS Only
#===============================================================================
#
# USAGE:
#   curl -fsSL https://raw.githubusercontent.com/your-org/ctf-autopilot/main/infra/scripts/install_ubuntu_24.04.sh | sudo bash
#
# OR (local installation):
#   sudo bash install_ubuntu_24.04.sh
#
# PREREQUISITES (Manual Steps Before Running):
#   1. Fresh Ubuntu 24.04 LTS installation
#   2. Root or sudo access
#   3. Internet connection for package downloads
#   4. MegaLLM API key from https://ai.megallm.io
#
# WHAT THIS SCRIPT DOES:
#   ✓ Updates system packages
#   ✓ Installs Docker Engine and Docker Compose
#   ✓ Configures UFW firewall (opens ports 22, 80, 443)
#   ✓ Configures fail2ban for SSH protection
#   ✓ Clones/updates CTF Autopilot repository
#   ✓ Generates secure passwords
#   ✓ Builds sandbox Docker image
#   ✓ Starts all services
#
# POST-INSTALLATION (Manual Steps After Running):
#   1. Edit /opt/ctf-autopilot/.env and set MEGALLM_API_KEY
#   2. (Optional) Configure TLS certificates
#   3. (Optional) Change default ports
#
#===============================================================================

set -euo pipefail

#-------------------------------------------------------------------------------
# Configuration
#-------------------------------------------------------------------------------
INSTALL_DIR="/opt/ctf-autopilot"
LOG_FILE="/var/log/ctf-autopilot-install.log"
GITHUB_REPO="https://github.com/your-org/ctf-autopilot.git"
MIN_MEMORY_MB=3072
MIN_DISK_GB=15

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
    echo "║     ██████╗████████╗███████╗     █████╗ ██╗   ██╗████████╗ ██████╗║"
    echo "║    ██╔════╝╚══██╔══╝██╔════╝    ██╔══██╗██║   ██║╚══██╔══╝██╔═══██║"
    echo "║    ██║        ██║   █████╗      ███████║██║   ██║   ██║   ██║   ██║"
    echo "║    ██║        ██║   ██╔══╝      ██╔══██║██║   ██║   ██║   ██║   ██║"
    echo "║    ╚██████╗   ██║   ██║         ██║  ██║╚██████╔╝   ██║   ╚██████╔║"
    echo "║     ╚═════╝   ╚═╝   ╚═╝         ╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝║"
    echo "║                                                                   ║"
    echo "║                 CTF Autopilot Analyzer v1.0.0                     ║"
    echo "║                 Ubuntu 24.04 LTS Installation                     ║"
    echo "║                                                                   ║"
    echo "╚═══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
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
    
    # Check Ubuntu version
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        if [[ "$ID" != "ubuntu" ]]; then
            log_error "This script requires Ubuntu. Detected: $ID"
        fi
        if [[ ! "$VERSION_ID" =~ ^24\. ]]; then
            log_warn "This script is designed for Ubuntu 24.04 LTS"
            log_warn "Detected version: $VERSION_ID"
            read -p "Continue anyway? (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
        log_debug "Ubuntu version: $VERSION_ID - OK"
    else
        log_error "Cannot determine OS version. /etc/os-release not found."
    fi
    
    # Check available memory
    AVAILABLE_MEMORY_MB=$(free -m | awk '/^Mem:/{print $7}')
    TOTAL_MEMORY_MB=$(free -m | awk '/^Mem:/{print $2}')
    if [[ $TOTAL_MEMORY_MB -lt $MIN_MEMORY_MB ]]; then
        log_warn "Low memory detected: ${TOTAL_MEMORY_MB}MB (recommended: ${MIN_MEMORY_MB}MB+)"
        log_warn "The system may run slowly or fail to start all services."
    else
        log_debug "Memory: ${TOTAL_MEMORY_MB}MB total, ${AVAILABLE_MEMORY_MB}MB available - OK"
    fi
    
    # Check available disk space
    AVAILABLE_DISK_GB=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
    if [[ $AVAILABLE_DISK_GB -lt $MIN_DISK_GB ]]; then
        log_error "Insufficient disk space: ${AVAILABLE_DISK_GB}GB available (need ${MIN_DISK_GB}GB+)"
    fi
    log_debug "Disk space: ${AVAILABLE_DISK_GB}GB available - OK"
    
    # Check internet connectivity
    if ! ping -c 1 -W 5 google.com > /dev/null 2>&1; then
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
    
    # Update package lists
    apt-get update -qq 2>&1 | tee -a "$LOG_FILE"
    
    # Upgrade existing packages
    DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq 2>&1 | tee -a "$LOG_FILE"
    
    # Install prerequisites
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
    
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version | awk '{print $3}' | tr -d ',')
        log_info "Docker already installed: v${DOCKER_VERSION}"
        
        # Check Docker Compose
        if docker compose version &> /dev/null; then
            COMPOSE_VERSION=$(docker compose version --short)
            log_info "Docker Compose already installed: v${COMPOSE_VERSION}"
            log_success "Docker installation verified"
            return 0
        fi
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
    
    # Reset UFW
    ufw --force reset > /dev/null 2>&1
    
    # Set default policies
    ufw default deny incoming > /dev/null
    ufw default allow outgoing > /dev/null
    
    # Allow SSH (important - do this first!)
    ufw allow ssh comment 'SSH access' > /dev/null
    
    # Allow HTTP and HTTPS
    ufw allow 80/tcp comment 'HTTP' > /dev/null
    ufw allow 443/tcp comment 'HTTPS' > /dev/null
    
    # Enable UFW
    ufw --force enable > /dev/null
    
    log_info "Firewall rules configured:"
    log_info "  - Port 22 (SSH): ALLOWED"
    log_info "  - Port 80 (HTTP): ALLOWED"
    log_info "  - Port 443 (HTTPS): ALLOWED"
    log_info "  - All other incoming: DENIED"
    
    log_success "Firewall configured"
}

#-------------------------------------------------------------------------------
# Fail2ban Configuration
#-------------------------------------------------------------------------------
configure_fail2ban() {
    log_step "Step 4/8: Configuring fail2ban..."
    
    cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
# Ban duration: 1 hour
bantime = 1h
# Time window for counting failures
findtime = 10m
# Number of failures before ban
maxretry = 5
# Ignore localhost
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
    
    log_success "fail2ban configured (SSH protection enabled)"
}

#-------------------------------------------------------------------------------
# Repository Setup
#-------------------------------------------------------------------------------
setup_repository() {
    log_step "Step 5/8: Setting up repository..."
    
    if [[ -d "$INSTALL_DIR" ]]; then
        log_info "Installation directory exists, updating..."
        cd "$INSTALL_DIR"
        
        # Check if it's a git repo
        if [[ -d ".git" ]]; then
            git fetch origin 2>&1 | tee -a "$LOG_FILE" || true
            git reset --hard origin/main 2>&1 | tee -a "$LOG_FILE" || true
            log_info "Repository updated"
        else
            log_warn "Directory exists but is not a git repository"
        fi
    else
        log_info "Creating installation directory..."
        mkdir -p "$INSTALL_DIR"
        
        # Check if we're running from a cloned repo
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        if [[ -f "$SCRIPT_DIR/../../docker-compose.yml" ]] || [[ -f "$SCRIPT_DIR/../docker-compose.yml" ]]; then
            log_info "Using local repository..."
            # Find project root
            PROJECT_ROOT="$SCRIPT_DIR"
            while [[ ! -f "$PROJECT_ROOT/docker-compose.yml" ]] && [[ ! -f "$PROJECT_ROOT/infra/docker-compose.yml" ]]; do
                PROJECT_ROOT="$(dirname "$PROJECT_ROOT")"
                if [[ "$PROJECT_ROOT" == "/" ]]; then
                    break
                fi
            done
            
            if [[ -f "$PROJECT_ROOT/infra/docker-compose.yml" ]]; then
                cp -r "$PROJECT_ROOT"/* "$INSTALL_DIR/"
                log_info "Copied local files to $INSTALL_DIR"
            else
                log_info "Cloning from GitHub..."
                git clone "$GITHUB_REPO" "$INSTALL_DIR" 2>&1 | tee -a "$LOG_FILE"
            fi
        else
            log_info "Cloning from GitHub..."
            git clone "$GITHUB_REPO" "$INSTALL_DIR" 2>&1 | tee -a "$LOG_FILE"
        fi
    fi
    
    cd "$INSTALL_DIR"
    log_success "Repository ready at $INSTALL_DIR"
}

#-------------------------------------------------------------------------------
# Environment Configuration
#-------------------------------------------------------------------------------
configure_environment() {
    log_step "Step 6/8: Configuring environment..."
    
    cd "$INSTALL_DIR"
    
    if [[ -f ".env" ]]; then
        log_info ".env file already exists"
        
        # Check if MEGALLM_API_KEY is set
        if grep -q "^MEGALLM_API_KEY=.\+$" .env; then
            log_info "MEGALLM_API_KEY is configured"
        else
            log_warn "MEGALLM_API_KEY is not set in .env"
        fi
    else
        if [[ ! -f ".env.example" ]]; then
            log_error ".env.example not found. Repository may be incomplete."
        fi
        
        log_info "Creating .env from template..."
        cp .env.example .env
        
        # Generate secure values
        SECRET_KEY=$(openssl rand -base64 48 | tr -d '\n')
        POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
        ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 16)
        REDIS_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
        
        # Update .env with generated values
        sed -i "s|^SECRET_KEY=.*|SECRET_KEY=$SECRET_KEY|" .env
        sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$POSTGRES_PASSWORD|" .env
        sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=$ADMIN_PASSWORD|" .env
        sed -i "s|^# REDIS_PASSWORD=.*|REDIS_PASSWORD=$REDIS_PASSWORD|" .env
        
        # Secure .env file permissions
        chmod 600 .env
        
        log_info "Generated secure credentials:"
        echo ""
        echo -e "${YELLOW}╔═══════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║${NC}  ${BOLD}IMPORTANT: Save these credentials securely!${NC}                      ${YELLOW}║${NC}"
        echo -e "${YELLOW}╠═══════════════════════════════════════════════════════════════════╣${NC}"
        echo -e "${YELLOW}║${NC}                                                                   ${YELLOW}║${NC}"
        echo -e "${YELLOW}║${NC}  Admin Password: ${GREEN}${ADMIN_PASSWORD}${NC}                                 ${YELLOW}║${NC}"
        echo -e "${YELLOW}║${NC}                                                                   ${YELLOW}║${NC}"
        echo -e "${YELLOW}║${NC}  ${RED}ACTION REQUIRED:${NC}                                               ${YELLOW}║${NC}"
        echo -e "${YELLOW}║${NC}  Edit ${CYAN}/opt/ctf-autopilot/.env${NC} and set MEGALLM_API_KEY          ${YELLOW}║${NC}"
        echo -e "${YELLOW}║${NC}  Get your API key from: ${CYAN}https://ai.megallm.io${NC}                  ${YELLOW}║${NC}"
        echo -e "${YELLOW}║${NC}                                                                   ${YELLOW}║${NC}"
        echo -e "${YELLOW}╚═══════════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        
        # Save credentials to file
        cat > "$INSTALL_DIR/CREDENTIALS.txt" << EOF
CTF Autopilot Analyzer - Generated Credentials
================================================
Generated: $(date)

Admin Password: $ADMIN_PASSWORD
PostgreSQL Password: $POSTGRES_PASSWORD
Redis Password: $REDIS_PASSWORD

IMPORTANT: 
- Keep this file secure and delete after saving credentials elsewhere
- Set MEGALLM_API_KEY in .env before starting services

EOF
        chmod 600 "$INSTALL_DIR/CREDENTIALS.txt"
        log_info "Credentials saved to $INSTALL_DIR/CREDENTIALS.txt"
    fi
    
    log_success "Environment configured"
}

#-------------------------------------------------------------------------------
# Build Sandbox Image
#-------------------------------------------------------------------------------
build_sandbox() {
    log_step "Step 7/8: Building sandbox image..."
    
    cd "$INSTALL_DIR"
    
    if [[ ! -f "sandbox/image/Dockerfile" ]] && [[ ! -f "ctf-autopilot/sandbox/image/Dockerfile" ]]; then
        log_error "Sandbox Dockerfile not found. Repository may be incomplete."
    fi
    
    # Find Dockerfile location
    if [[ -f "sandbox/image/Dockerfile" ]]; then
        SANDBOX_PATH="sandbox/image"
    elif [[ -f "ctf-autopilot/sandbox/image/Dockerfile" ]]; then
        SANDBOX_PATH="ctf-autopilot/sandbox/image"
    else
        log_error "Cannot find sandbox Dockerfile"
    fi
    
    log_info "Building sandbox Docker image (this may take a few minutes)..."
    docker build \
        -t ctf-autopilot-sandbox:latest \
        -f "$SANDBOX_PATH/Dockerfile" \
        "$SANDBOX_PATH/" 2>&1 | tee -a "$LOG_FILE"
    
    # Verify image was built
    if ! docker images | grep -q "ctf-autopilot-sandbox"; then
        log_error "Sandbox image build failed"
    fi
    
    log_success "Sandbox image built successfully"
}

#-------------------------------------------------------------------------------
# Start Services
#-------------------------------------------------------------------------------
start_services() {
    log_step "Step 8/8: Starting services..."
    
    cd "$INSTALL_DIR"
    
    # Create data directories
    mkdir -p data/runs
    chmod 755 data
    
    # Find docker-compose.yml location
    if [[ -f "infra/docker-compose.yml" ]]; then
        cd infra
    elif [[ -f "docker-compose.yml" ]]; then
        : # Already in correct directory
    elif [[ -f "ctf-autopilot/infra/docker-compose.yml" ]]; then
        cd ctf-autopilot/infra
    else
        log_error "docker-compose.yml not found"
    fi
    
    log_info "Starting Docker containers..."
    docker compose up -d --build 2>&1 | tee -a "$LOG_FILE"
    
    # Wait for services to be ready
    log_info "Waiting for services to start (30 seconds)..."
    sleep 30
    
    # Health checks
    log_info "Running health checks..."
    
    HEALTH_OK=true
    
    # Check API
    if curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
        log_success "  API: Healthy"
    else
        log_warn "  API: Not responding (may still be starting)"
        HEALTH_OK=false
    fi
    
    # Check PostgreSQL
    if docker compose exec -T postgres pg_isready -U ctfautopilot > /dev/null 2>&1; then
        log_success "  PostgreSQL: Healthy"
    else
        log_warn "  PostgreSQL: Not ready"
        HEALTH_OK=false
    fi
    
    # Check Redis
    if docker compose exec -T redis redis-cli ping > /dev/null 2>&1; then
        log_success "  Redis: Healthy"
    else
        log_warn "  Redis: Not ready"
        HEALTH_OK=false
    fi
    
    # Check Web
    if curl -sf http://localhost:3000 > /dev/null 2>&1; then
        log_success "  Web UI: Healthy"
    else
        log_warn "  Web UI: Not responding (may still be starting)"
        HEALTH_OK=false
    fi
    
    if [[ "$HEALTH_OK" == "false" ]]; then
        log_warn "Some services may still be starting. Check logs with:"
        log_warn "  cd $INSTALL_DIR/infra && docker compose logs -f"
    fi
    
    log_success "Services started"
}

#-------------------------------------------------------------------------------
# Print Summary
#-------------------------------------------------------------------------------
print_summary() {
    # Get server IP
    SERVER_IP=$(hostname -I | awk '{print $1}')
    
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}        ${BOLD}✓ CTF Autopilot Installation Complete!${NC}                     ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}╠═══════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}Access the Application:${NC}                                        ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    Local:  ${CYAN}http://localhost:3000${NC}                                ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    Server: ${CYAN}http://${SERVER_IP}:3000${NC}                           ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}Installation Directory:${NC}                                        ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    ${CYAN}$INSTALL_DIR${NC}                                       ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}Log File:${NC}                                                      ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    ${CYAN}$LOG_FILE${NC}                        ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                                   ${GREEN}║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo -e "  1. Set your MegaLLM API key:"
    echo -e "     ${CYAN}nano $INSTALL_DIR/.env${NC}"
    echo -e "     Add: MEGALLM_API_KEY=your-key-here"
    echo ""
    echo -e "  2. Restart services after editing .env:"
    echo -e "     ${CYAN}cd $INSTALL_DIR/infra && docker compose restart${NC}"
    echo ""
    echo -e "${YELLOW}Useful Commands:${NC}"
    echo -e "  View logs:      ${CYAN}cd $INSTALL_DIR/infra && docker compose logs -f${NC}"
    echo -e "  Stop services:  ${CYAN}cd $INSTALL_DIR/infra && docker compose down${NC}"
    echo -e "  Start services: ${CYAN}cd $INSTALL_DIR/infra && docker compose up -d${NC}"
    echo -e "  Check status:   ${CYAN}cd $INSTALL_DIR/infra && docker compose ps${NC}"
    echo ""
    echo -e "  Debug API:      ${CYAN}curl http://localhost:8000/api/health${NC}"
    echo -e "  Debug DB:       ${CYAN}docker compose exec postgres pg_isready${NC}"
    echo -e "  Debug Redis:    ${CYAN}docker compose exec redis redis-cli ping${NC}"
    echo ""
    echo -e "${BOLD}Documentation:${NC}"
    echo -e "  Full guide:     ${CYAN}$INSTALL_DIR/docs/RUNBOOK.md${NC}"
    echo -e "  Debug guide:    ${CYAN}$INSTALL_DIR/docs/DEBUG.md${NC}"
    echo ""
}

#-------------------------------------------------------------------------------
# Main Execution
#-------------------------------------------------------------------------------
main() {
    # Create log file
    touch "$LOG_FILE"
    chmod 644 "$LOG_FILE"
    
    print_banner
    
    log_info "Installation started at $(date)"
    log_info "Log file: $LOG_FILE"
    echo ""
    
    preflight_checks
    update_system
    install_docker
    configure_firewall
    configure_fail2ban
    setup_repository
    configure_environment
    build_sandbox
    start_services
    
    log_info "Installation completed at $(date)"
    
    print_summary
}

# Run main function
main "$@"
