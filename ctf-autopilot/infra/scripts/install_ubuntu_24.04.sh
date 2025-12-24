#!/bin/bash
# CTF Autopilot - Ubuntu 24.04 LTS Installation Script
# One-command installation for production deployment
#
# Usage: curl -fsSL https://raw.githubusercontent.com/your-org/ctf-autopilot/main/infra/scripts/install_ubuntu_24.04.sh | sudo bash

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   log_error "This script must be run as root (use sudo)"
fi

# Check Ubuntu version
if ! grep -q "Ubuntu 24" /etc/os-release 2>/dev/null; then
    log_warn "This script is designed for Ubuntu 24.04 LTS"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

log_info "Starting CTF Autopilot installation..."

# =============================================================================
# Step 1: Update system and install prerequisites
# =============================================================================
log_info "Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

log_info "Installing prerequisites..."
apt-get install -y -qq \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    ufw \
    fail2ban

# =============================================================================
# Step 2: Install Docker
# =============================================================================
if command -v docker &> /dev/null; then
    log_info "Docker already installed, skipping..."
else
    log_info "Installing Docker..."
    
    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    # Add Docker repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Start and enable Docker
    systemctl start docker
    systemctl enable docker

    log_success "Docker installed successfully"
fi

# =============================================================================
# Step 3: Configure firewall
# =============================================================================
log_info "Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
log_success "Firewall configured"

# =============================================================================
# Step 4: Configure fail2ban
# =============================================================================
log_info "Configuring fail2ban..."
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
EOF
systemctl restart fail2ban
log_success "fail2ban configured"

# =============================================================================
# Step 5: Clone repository (or use current directory)
# =============================================================================
INSTALL_DIR="/opt/ctf-autopilot"

if [[ -d "$INSTALL_DIR" ]]; then
    log_info "Installation directory exists, pulling latest..."
    cd "$INSTALL_DIR"
    git pull origin main || true
else
    log_info "Creating installation directory..."
    mkdir -p "$INSTALL_DIR"
    
    # Check if we're in a git repo
    if [[ -f "./infra/docker-compose.yml" ]]; then
        log_info "Using current directory..."
        cp -r . "$INSTALL_DIR"
    else
        log_info "Cloning repository..."
        git clone https://github.com/your-org/ctf-autopilot.git "$INSTALL_DIR"
    fi
fi

cd "$INSTALL_DIR"

# =============================================================================
# Step 6: Configure environment
# =============================================================================
if [[ ! -f ".env" ]]; then
    log_info "Creating .env configuration..."
    cp .env.example .env
    
    # Generate secure passwords
    SECRET_KEY=$(openssl rand -base64 32)
    POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
    ADMIN_PASSWORD=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 16)
    
    # Update .env with generated values
    sed -i "s|SECRET_KEY=.*|SECRET_KEY=$SECRET_KEY|" .env
    sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$POSTGRES_PASSWORD|" .env
    sed -i "s|ADMIN_PASSWORD=.*|ADMIN_PASSWORD=$ADMIN_PASSWORD|" .env
    
    log_warn "================================================"
    log_warn "IMPORTANT: Configure your MegaLLM API key!"
    log_warn "Edit /opt/ctf-autopilot/.env and set MEGALLM_API_KEY"
    log_warn "Your admin password is: $ADMIN_PASSWORD"
    log_warn "================================================"
else
    log_info ".env file already exists, skipping..."
fi

# =============================================================================
# Step 7: Build sandbox image
# =============================================================================
log_info "Building sandbox image..."
docker build -t ctf-autopilot-sandbox:latest -f sandbox/image/Dockerfile sandbox/image/
log_success "Sandbox image built"

# =============================================================================
# Step 8: Create data directories
# =============================================================================
log_info "Creating data directories..."
mkdir -p data/runs
chmod 755 data
log_success "Data directories created"

# =============================================================================
# Step 9: Start services
# =============================================================================
log_info "Starting services..."
cd infra
docker compose up -d --build
log_success "Services started"

# =============================================================================
# Step 10: Final checks
# =============================================================================
log_info "Waiting for services to be ready..."
sleep 10

if curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
    log_success "API is healthy"
else
    log_warn "API health check failed, checking logs..."
    docker compose logs api --tail 50
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "========================================"
log_success "CTF Autopilot installation complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Edit /opt/ctf-autopilot/.env to set your MEGALLM_API_KEY"
echo "2. (Optional) Configure TLS certificates in /opt/ctf-autopilot/infra/nginx/ssl/"
echo "3. Access the application at http://$(hostname -I | awk '{print $1}')"
echo ""
echo "Useful commands:"
echo "  cd /opt/ctf-autopilot/infra && docker compose logs -f    # View logs"
echo "  cd /opt/ctf-autopilot/infra && docker compose restart    # Restart services"
echo "  cd /opt/ctf-autopilot/infra && docker compose down       # Stop services"
echo ""
