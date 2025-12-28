#!/bin/bash
#===============================================================================
# CTF Compass - Complete Uninstall Script
# Wrapper for install script with cleanup mode
#===============================================================================
#
# GitHub: https://github.com/huynhthanhthao-uel/ctf-compass.git
#
# USAGE:
#   sudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/uninstall.sh
#
# OPTIONS:
#   --force       Skip confirmation prompts
#   --purge       Remove all data including backups
#   --keep-data   Keep database backups (default behavior)
#   --help        Show help message
#
#===============================================================================

# Use -eo instead of -euo to handle potential unbound BASH_SOURCE
set -eo pipefail

#-------------------------------------------------------------------------------
# Configuration
#-------------------------------------------------------------------------------
INSTALL_DIR="${INSTALL_DIR:-/opt/ctf-compass}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd)" || SCRIPT_DIR="/opt/ctf-compass/ctf-autopilot/infra/scripts"
INSTALL_SCRIPT="$SCRIPT_DIR/install_ubuntu_24.04.sh"
REMOTE_SCRIPT="https://raw.githubusercontent.com/huynhthanhthao-uel/ctf-compass/main/ctf-autopilot/infra/scripts/install_ubuntu_24.04.sh"

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
FORCE_FLAG=""
PURGE_FLAG=""

for arg in "$@"; do
    case $arg in
        --force) FORCE_FLAG="--force" ;;
        --purge) PURGE_FLAG="--purge" ;;
        --keep-data) ;; # Default behavior, backups are kept
        --help|-h)
            echo "CTF Compass Uninstall Script"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --force       Skip confirmation prompts"
            echo "  --purge       Remove all data including backups"
            echo "  --keep-data   Keep database backups (default)"
            echo "  --help        Show this help message"
            echo ""
            echo "Examples:"
            echo "  # Standard uninstall (keeps backups)"
            echo "  sudo $0"
            echo ""
            echo "  # Complete removal including backups"
            echo "  sudo $0 --purge"
            echo ""
            echo "  # Force uninstall without prompts"
            echo "  sudo $0 --force --purge"
            exit 0
            ;;
    esac
done

#-------------------------------------------------------------------------------
# Check Root
#-------------------------------------------------------------------------------
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}[ERROR]${NC} This script must be run as root (use sudo)"
    exit 1
fi

#-------------------------------------------------------------------------------
# Banner
#-------------------------------------------------------------------------------
echo -e "${RED}"
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                                                                   ║"
echo "║              CTF Compass - Uninstall Script                       ║"
echo "║                                                                   ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

#-------------------------------------------------------------------------------
# Confirmation
#-------------------------------------------------------------------------------
if [[ -z "$FORCE_FLAG" ]]; then
    echo -e "${YELLOW}"
    echo "╔═══════════════════════════════════════════════════════════════════╗"
    echo "║  WARNING: This will remove CTF Compass completely!                ║"
    echo "╠═══════════════════════════════════════════════════════════════════╣"
    echo "║                                                                   ║"
    echo "║  The following will be deleted:                                   ║"
    echo "║    • All Docker containers, images, volumes, networks             ║"
    echo "║    • Installation directory ($INSTALL_DIR)             ║"
    echo "║    • Log files and configuration                                  ║"
    echo "║    • Systemd services and cron jobs                               ║"
    if [[ -n "$PURGE_FLAG" ]]; then
        echo "║                                                                   ║"
        echo "║  ${RED}• All backups will also be removed (--purge)${YELLOW}                   ║"
    else
        echo "║                                                                   ║"
        echo "║  Note: Backups will be preserved at /opt/ctf-compass-backups     ║"
    fi
    echo "║                                                                   ║"
    echo "╚═══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    read -p "Are you sure you want to continue? (type 'yes' to confirm): " response
    if [[ "$response" != "yes" ]]; then
        echo -e "${BLUE}[INFO]${NC} Uninstall cancelled."
        exit 0
    fi
    FORCE_FLAG="--force"  # Already confirmed
fi

#-------------------------------------------------------------------------------
# Run Cleanup
#-------------------------------------------------------------------------------
echo ""
echo -e "${BLUE}[INFO]${NC} Starting cleanup process..."
echo ""

# Try local script first, fall back to remote
if [[ -f "$INSTALL_SCRIPT" ]]; then
    echo -e "${BLUE}[INFO]${NC} Using local install script for cleanup..."
    bash "$INSTALL_SCRIPT" --clean-only $FORCE_FLAG $PURGE_FLAG
else
    echo -e "${BLUE}[INFO]${NC} Downloading cleanup script from GitHub..."
    curl -fsSL "$REMOTE_SCRIPT" | bash -s -- --clean-only $FORCE_FLAG $PURGE_FLAG
fi

#-------------------------------------------------------------------------------
# Final Cleanup (things the install script might miss)
#-------------------------------------------------------------------------------
echo ""
echo -e "${BLUE}[INFO]${NC} Performing final cleanup..."

# Remove the uninstall log if it exists
rm -f /var/log/ctf-compass-uninstall.log

# Remove any remaining Docker resources
docker system prune -af --volumes 2>/dev/null || true

#-------------------------------------------------------------------------------
# Summary
#-------------------------------------------------------------------------------
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                                   ║${NC}"
echo -e "${GREEN}║        ✓ CTF Compass Uninstalled Successfully                     ║${NC}"
echo -e "${GREEN}║                                                                   ║${NC}"
echo -e "${GREEN}╠═══════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                                                   ║${NC}"
echo -e "${GREEN}║  All CTF Compass components have been removed.                   ║${NC}"
echo -e "${GREEN}║                                                                   ║${NC}"
if [[ -z "$PURGE_FLAG" ]]; then
    echo -e "${GREEN}║  ${YELLOW}Backups preserved at: /opt/ctf-compass-backups${NC}                 ${GREEN}║${NC}"
    echo -e "${GREEN}║  ${CYAN}To remove: rm -rf /opt/ctf-compass-backups${NC}                     ${GREEN}║${NC}"
else
    echo -e "${GREEN}║  ${RED}All data including backups has been removed.${NC}                   ${GREEN}║${NC}"
fi
echo -e "${GREEN}║                                                                   ║${NC}"
echo -e "${GREEN}║  To reinstall:                                                   ║${NC}"
echo -e "${GREEN}║  ${CYAN}curl -fsSL https://raw.githubusercontent.com/huynhthanhthao-uel/${NC}   ${GREEN}║${NC}"
echo -e "${GREEN}║  ${CYAN}  ctf-compass/main/ctf-autopilot/infra/scripts/${NC}                  ${GREEN}║${NC}"
echo -e "${GREEN}║  ${CYAN}  install_ubuntu_24.04.sh | sudo bash${NC}                            ${GREEN}║${NC}"
echo -e "${GREEN}║                                                                   ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
