#!/bin/bash
#===============================================================================
# CTF Compass - Environment Checker & Auto-Installer
# Checks system requirements and installs missing dependencies
#===============================================================================
#
# GitHub: https://github.com/huynhtrungpc01/ctf-compass.git
#
# USAGE:
#   # Quick check (one-liner)
#   curl -fsSL https://raw.githubusercontent.com/huynhtrungpc01/ctf-compass/main/ctf-autopilot/infra/scripts/check_env.sh | bash
#
#   # Check only (no install)
#   curl -fsSL https://raw.githubusercontent.com/huynhtrungpc01/ctf-compass/main/ctf-autopilot/infra/scripts/check_env.sh | bash -s -- --check-only
#
#   # Auto-install missing dependencies
#   curl -fsSL https://raw.githubusercontent.com/huynhtrungpc01/ctf-compass/main/ctf-autopilot/infra/scripts/check_env.sh | sudo bash -s -- --install
#
# OPTIONS:
#   --check-only   Only check, don't install anything
#   --install      Auto-install missing dependencies (requires sudo)
#   --json         Output in JSON format
#   --help         Show help message
#
#===============================================================================

# Use -eo instead of -euo to handle potential unbound variables when piped
set -eo pipefail

#-------------------------------------------------------------------------------
# Configuration
#-------------------------------------------------------------------------------
MIN_MEMORY_MB=3072
MIN_DISK_GB=15
MIN_DOCKER_VERSION="24.0.0"
MIN_COMPOSE_VERSION="2.20.0"
GITHUB_REPO="https://github.com/huynhtrungpc01/ctf-compass.git"

# Flags
CHECK_ONLY=false
AUTO_INSTALL=false
JSON_MODE=false

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

#-------------------------------------------------------------------------------
# Parse Arguments
#-------------------------------------------------------------------------------
for arg in "$@"; do
    case $arg in
        --check-only) CHECK_ONLY=true ;;
        --install) AUTO_INSTALL=true ;;
        --json) JSON_MODE=true ;;
        --help|-h)
            echo "CTF Compass - Environment Checker"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --check-only   Only check, don't install anything"
            echo "  --install      Auto-install missing dependencies (requires sudo)"
            echo "  --json         Output in JSON format"
            echo "  --help         Show this help message"
            echo ""
            echo "One-liner usage:"
            echo "  curl -fsSL https://raw.githubusercontent.com/huynhtrungpc01/ctf-compass/main/ctf-autopilot/infra/scripts/check_env.sh | bash"
            exit 0
            ;;
    esac
done

#-------------------------------------------------------------------------------
# Logging Functions
#-------------------------------------------------------------------------------
log_json() {
    local status="$1"
    local component="$2"
    local message="$3"
    local value="${4:-}"
    if [[ -n "$value" ]]; then
        echo "{\"status\":\"$status\",\"component\":\"$component\",\"message\":\"$message\",\"value\":\"$value\"}"
    else
        echo "{\"status\":\"$status\",\"component\":\"$component\",\"message\":\"$message\"}"
    fi
}

log_check() {
    local status="$1"
    local component="$2"
    local message="$3"
    local value="${4:-}"
    
    if [[ "$JSON_MODE" == "true" ]]; then
        log_json "$status" "$component" "$message" "$value"
    else
        case $status in
            ok)      echo -e "${GREEN}✓${NC} $component: $message" ;;
            warn)    echo -e "${YELLOW}⚠${NC} $component: $message" ;;
            error)   echo -e "${RED}✗${NC} $component: $message" ;;
            info)    echo -e "${BLUE}ℹ${NC} $component: $message" ;;
        esac
    fi
}

#-------------------------------------------------------------------------------
# Version Comparison
#-------------------------------------------------------------------------------
version_gte() {
    local v1="$1"
    local v2="$2"
    # Remove 'v' prefix if present
    v1="${v1#v}"
    v2="${v2#v}"
    # Compare versions
    printf '%s\n%s\n' "$v2" "$v1" | sort -V -C
}

#-------------------------------------------------------------------------------
# Check Functions
#-------------------------------------------------------------------------------
check_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        local os_name="$NAME $VERSION_ID"
        
        if [[ "$ID" == "ubuntu" && "$VERSION_ID" =~ ^24\. ]]; then
            log_check "ok" "OS" "Ubuntu 24.04 LTS (recommended)" "$os_name"
            return 0
        elif [[ "$ID" == "ubuntu" ]]; then
            log_check "warn" "OS" "Ubuntu detected but not 24.04 LTS" "$os_name"
            return 1
        else
            log_check "warn" "OS" "Non-Ubuntu system detected" "$os_name"
            return 1
        fi
    else
        log_check "error" "OS" "Cannot determine OS version"
        return 1
    fi
}

check_memory() {
    local total_mb=$(free -m | awk '/^Mem:/{print $2}')
    
    if [[ $total_mb -ge $MIN_MEMORY_MB ]]; then
        log_check "ok" "Memory" "${total_mb}MB available (min: ${MIN_MEMORY_MB}MB)" "$total_mb"
        return 0
    else
        log_check "warn" "Memory" "${total_mb}MB available (recommended: ${MIN_MEMORY_MB}MB+)" "$total_mb"
        return 1
    fi
}

check_disk() {
    local available_gb=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
    
    if [[ $available_gb -ge $MIN_DISK_GB ]]; then
        log_check "ok" "Disk" "${available_gb}GB available (min: ${MIN_DISK_GB}GB)" "$available_gb"
        return 0
    else
        log_check "error" "Disk" "${available_gb}GB available (need: ${MIN_DISK_GB}GB+)" "$available_gb"
        return 1
    fi
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        log_check "error" "Docker" "Not installed"
        return 1
    fi
    
    local docker_version=$(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1)
    
    if version_gte "$docker_version" "$MIN_DOCKER_VERSION"; then
        log_check "ok" "Docker" "v$docker_version installed (min: v$MIN_DOCKER_VERSION)" "$docker_version"
        return 0
    else
        log_check "warn" "Docker" "v$docker_version (recommended: v$MIN_DOCKER_VERSION+)" "$docker_version"
        return 1
    fi
}

check_docker_compose() {
    if ! docker compose version &> /dev/null; then
        log_check "error" "Docker Compose" "Not installed"
        return 1
    fi
    
    local compose_version=$(docker compose version --short 2>/dev/null | head -1)
    compose_version="${compose_version#v}"
    
    if version_gte "$compose_version" "$MIN_COMPOSE_VERSION"; then
        log_check "ok" "Docker Compose" "v$compose_version installed (min: v$MIN_COMPOSE_VERSION)" "$compose_version"
        return 0
    else
        log_check "warn" "Docker Compose" "v$compose_version (recommended: v$MIN_COMPOSE_VERSION+)" "$compose_version"
        return 1
    fi
}

check_docker_running() {
    if docker info &> /dev/null 2>&1; then
        log_check "ok" "Docker Daemon" "Running and accessible"
        return 0
    else
        log_check "error" "Docker Daemon" "Not running or not accessible"
        return 1
    fi
}

check_git() {
    if command -v git &> /dev/null; then
        local git_version=$(git --version | awk '{print $3}')
        log_check "ok" "Git" "v$git_version installed" "$git_version"
        return 0
    else
        log_check "error" "Git" "Not installed"
        return 1
    fi
}

check_curl() {
    if command -v curl &> /dev/null; then
        log_check "ok" "curl" "Installed"
        return 0
    else
        log_check "error" "curl" "Not installed"
        return 1
    fi
}

check_network() {
    if ping -c 1 -W 3 github.com &> /dev/null; then
        log_check "ok" "Network" "Internet connectivity OK"
        return 0
    elif ping -c 1 -W 3 8.8.8.8 &> /dev/null; then
        log_check "warn" "Network" "Internet OK but DNS may have issues"
        return 0
    else
        log_check "error" "Network" "No internet connectivity"
        return 1
    fi
}

check_ports() {
    local ports_in_use=""
    
    for port in 3000 8000 5432 6379; do
        if ss -tulpn 2>/dev/null | grep -q ":$port "; then
            ports_in_use="$ports_in_use $port"
        fi
    done
    
    if [[ -z "$ports_in_use" ]]; then
        log_check "ok" "Ports" "Required ports (3000, 8000, 5432, 6379) are free"
        return 0
    else
        log_check "warn" "Ports" "Ports in use:$ports_in_use"
        return 1
    fi
}

check_existing_installation() {
    if [[ -d "/opt/ctf-compass" ]]; then
        if [[ -f "/opt/ctf-compass/.env" ]]; then
            log_check "info" "CTF Compass" "Already installed at /opt/ctf-compass"
        else
            log_check "warn" "CTF Compass" "Directory exists but incomplete installation"
        fi
        return 0
    else
        log_check "info" "CTF Compass" "Not installed"
        return 1
    fi
}

#-------------------------------------------------------------------------------
# Install Functions
#-------------------------------------------------------------------------------
install_docker() {
    log_check "info" "Install" "Installing Docker..."
    
    # Add Docker's official GPG key
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    # Add Docker repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
        tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Start and enable Docker
    systemctl start docker
    systemctl enable docker
    
    log_check "ok" "Install" "Docker installed successfully"
}

install_git() {
    log_check "info" "Install" "Installing Git..."
    apt-get update -qq
    apt-get install -y -qq git
    log_check "ok" "Install" "Git installed successfully"
}

install_prerequisites() {
    log_check "info" "Install" "Installing prerequisites..."
    apt-get update -qq
    apt-get install -y -qq \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release \
        jq
    log_check "ok" "Install" "Prerequisites installed"
}

#-------------------------------------------------------------------------------
# Main
#-------------------------------------------------------------------------------
main() {
    if [[ "$JSON_MODE" != "true" ]]; then
        echo ""
        echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${CYAN}║              CTF Compass - Environment Checker                    ║${NC}"
        echo -e "${CYAN}║            github.com/huynhtrungpc01/ctf-compass                   ║${NC}"
        echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
        echo ""
    fi
    
    local errors=0
    local warnings=0
    
    # Run checks
    check_os || ((warnings++))
    check_memory || ((warnings++))
    check_disk || ((errors++))
    check_git || ((errors++))
    check_curl || ((errors++))
    check_docker || ((errors++))
    check_docker_compose || ((errors++))
    check_docker_running || ((errors++))
    check_network || ((errors++))
    check_ports || ((warnings++))
    check_existing_installation
    
    if [[ "$JSON_MODE" != "true" ]]; then
        echo ""
        echo "─────────────────────────────────────────────────────────────────────"
    fi
    
    # Auto-install if requested and there are errors
    if [[ "$AUTO_INSTALL" == "true" && $errors -gt 0 ]]; then
        if [[ $EUID -ne 0 ]]; then
            log_check "error" "Install" "Auto-install requires root (use sudo)"
            exit 1
        fi
        
        echo ""
        log_check "info" "Install" "Auto-installing missing dependencies..."
        
        # Install missing components
        if ! command -v curl &> /dev/null; then
            install_prerequisites
        fi
        
        if ! command -v git &> /dev/null; then
            install_git
        fi
        
        if ! command -v docker &> /dev/null; then
            install_docker
        fi
        
        echo ""
        log_check "ok" "Install" "Dependencies installed! Run the check again to verify."
    fi
    
    # Summary
    if [[ "$JSON_MODE" == "true" ]]; then
        echo "{\"summary\":{\"errors\":$errors,\"warnings\":$warnings,\"ready\":$([ $errors -eq 0 ] && echo true || echo false)}}"
    else
        if [[ $errors -eq 0 && $warnings -eq 0 ]]; then
            echo -e "${GREEN}${BOLD}✓ All checks passed! System is ready for CTF Compass.${NC}"
            echo ""
            echo "Install CTF Compass with:"
            echo -e "  ${CYAN}curl -fsSL https://raw.githubusercontent.com/huynhtrungpc01/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash${NC}"
        elif [[ $errors -eq 0 ]]; then
            echo -e "${YELLOW}${BOLD}⚠ Checks passed with $warnings warning(s). System should work.${NC}"
            echo ""
            echo "Install CTF Compass with:"
            echo -e "  ${CYAN}curl -fsSL https://raw.githubusercontent.com/huynhtrungpc01/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh | sudo bash${NC}"
        else
            echo -e "${RED}${BOLD}✗ $errors error(s) and $warnings warning(s) found.${NC}"
            echo ""
            if [[ "$CHECK_ONLY" != "true" ]]; then
                echo "Auto-install missing dependencies with:"
                echo -e "  ${CYAN}curl -fsSL https://raw.githubusercontent.com/huynhtrungpc01/ctf-compass/main/ctf-autopilot/infra/scripts/check_env.sh | sudo bash -s -- --install${NC}"
            fi
        fi
        echo ""
    fi
    
    exit $errors
}

main "$@"
