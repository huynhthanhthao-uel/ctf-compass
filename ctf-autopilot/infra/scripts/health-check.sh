#!/bin/bash
#===============================================================================
# CTF Compass - Health Check & Alert Script
# Monitors services and sends notifications via Telegram/Discord when down
#===============================================================================

# Use -eo instead of -euo to handle potential unbound variables
set -eo pipefail

# Configuration
INSTALL_DIR="${INSTALL_DIR:-/opt/ctf-compass}"
CONFIG_FILE="${INSTALL_DIR}/ctf-autopilot/infra/scripts/alerts.conf"
LOG_FILE="/var/log/ctf-compass-health.log"
STATE_FILE="/tmp/ctf-compass-health-state"

# Default check interval (seconds)
CHECK_INTERVAL="${CHECK_INTERVAL:-60}"

# Services to monitor
declare -A SERVICES=(
    ["api"]="http://localhost:8000/api/health"
    ["web"]="http://localhost:3000"
)

# Container names
declare -A CONTAINERS=(
    ["api"]="ctf_compass_api"
    ["worker"]="ctf_compass_worker"
    ["web"]="ctf_compass_web"
    ["postgres"]="ctf_compass_postgres"
    ["redis"]="ctf_compass_redis"
)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

#===============================================================================
# Logging
#===============================================================================

log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    case "$level" in
        INFO)  echo -e "${GREEN}[INFO]${NC} $message" ;;
        WARN)  echo -e "${YELLOW}[WARN]${NC} $message" ;;
        ERROR) echo -e "${RED}[ERROR]${NC} $message" ;;
        DEBUG) echo -e "${BLUE}[DEBUG]${NC} $message" ;;
    esac
}

#===============================================================================
# Configuration
#===============================================================================

load_config() {
    if [[ -f "$CONFIG_FILE" ]]; then
        source "$CONFIG_FILE"
        log "DEBUG" "Loaded config from $CONFIG_FILE"
    else
        log "WARN" "Config file not found: $CONFIG_FILE"
        log "INFO" "Run with --setup to configure alerts"
    fi
}

setup_config() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║         CTF Compass - Alert Configuration                ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""
    
    # Telegram setup
    echo -e "${YELLOW}Telegram Setup (optional - press Enter to skip):${NC}"
    read -p "  Telegram Bot Token: " TELEGRAM_BOT_TOKEN
    read -p "  Telegram Chat ID: " TELEGRAM_CHAT_ID
    
    echo ""
    
    # Discord setup
    echo -e "${YELLOW}Discord Setup (optional - press Enter to skip):${NC}"
    read -p "  Discord Webhook URL: " DISCORD_WEBHOOK_URL
    
    echo ""
    
    # Slack setup
    echo -e "${YELLOW}Slack Setup (optional - press Enter to skip):${NC}"
    read -p "  Slack Webhook URL: " SLACK_WEBHOOK_URL
    
    # Save config
    mkdir -p "$(dirname "$CONFIG_FILE")"
    cat > "$CONFIG_FILE" << EOF
# CTF Compass - Alert Configuration
# Generated: $(date)

# Telegram
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID}"

# Discord
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL}"

# Slack
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL}"

# Check interval in seconds
CHECK_INTERVAL=60

# Enable/disable notifications (true/false)
NOTIFY_ON_DOWN=true
NOTIFY_ON_RECOVERY=true
EOF

    chmod 600 "$CONFIG_FILE"
    log "INFO" "Configuration saved to $CONFIG_FILE"
    
    echo ""
    echo -e "${GREEN}✅ Configuration saved!${NC}"
    echo ""
}

#===============================================================================
# Notification Functions
#===============================================================================

send_telegram() {
    local message="$1"
    
    if [[ -z "${TELEGRAM_BOT_TOKEN:-}" ]] || [[ -z "${TELEGRAM_CHAT_ID:-}" ]]; then
        return 0
    fi
    
    local url="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage"
    
    curl -s -X POST "$url" \
        -H "Content-Type: application/json" \
        -d "{\"chat_id\": \"${TELEGRAM_CHAT_ID}\", \"text\": \"${message}\", \"parse_mode\": \"HTML\"}" \
        > /dev/null 2>&1
    
    log "DEBUG" "Telegram notification sent"
}

send_discord() {
    local message="$1"
    local color="${2:-16711680}"  # Default red
    
    if [[ -z "${DISCORD_WEBHOOK_URL:-}" ]]; then
        return 0
    fi
    
    local hostname=$(hostname)
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    local payload=$(cat << EOF
{
    "embeds": [{
        "title": "🚨 CTF Compass Alert",
        "description": "${message}",
        "color": ${color},
        "footer": {"text": "Server: ${hostname}"},
        "timestamp": "${timestamp}"
    }]
}
EOF
)
    
    curl -s -X POST "$DISCORD_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "$payload" \
        > /dev/null 2>&1
    
    log "DEBUG" "Discord notification sent"
}

send_slack() {
    local message="$1"
    local emoji="${2:-:rotating_light:}"
    
    if [[ -z "${SLACK_WEBHOOK_URL:-}" ]]; then
        return 0
    fi
    
    local payload=$(cat << EOF
{
    "text": "${emoji} *CTF Compass Alert*\n${message}",
    "username": "CTF Compass Monitor",
    "icon_emoji": ":robot_face:"
}
EOF
)
    
    curl -s -X POST "$SLACK_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "$payload" \
        > /dev/null 2>&1
    
    log "DEBUG" "Slack notification sent"
}

send_all_notifications() {
    local message="$1"
    local is_recovery="${2:-false}"
    
    local color=16711680  # Red for down
    local emoji=":rotating_light:"
    
    if [[ "$is_recovery" == "true" ]]; then
        color=65280  # Green for recovery
        emoji=":white_check_mark:"
    fi
    
    send_telegram "$message"
    send_discord "$message" "$color"
    send_slack "$message" "$emoji"
}

#===============================================================================
# Health Check Functions
#===============================================================================

check_container() {
    local name="$1"
    local container="$2"
    
    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        local health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "none")
        
        if [[ "$health" == "healthy" ]] || [[ "$health" == "none" ]]; then
            return 0
        else
            return 1
        fi
    else
        return 1
    fi
}

check_http_endpoint() {
    local url="$1"
    local timeout=5
    
    if curl -s -f -o /dev/null -w "%{http_code}" --connect-timeout "$timeout" "$url" 2>/dev/null | grep -q "^2"; then
        return 0
    else
        return 1
    fi
}

get_state() {
    local service="$1"
    if [[ -f "$STATE_FILE" ]]; then
        grep "^${service}=" "$STATE_FILE" 2>/dev/null | cut -d'=' -f2 || echo "unknown"
    else
        echo "unknown"
    fi
}

set_state() {
    local service="$1"
    local state="$2"
    
    touch "$STATE_FILE"
    
    if grep -q "^${service}=" "$STATE_FILE" 2>/dev/null; then
        sed -i "s/^${service}=.*/${service}=${state}/" "$STATE_FILE"
    else
        echo "${service}=${state}" >> "$STATE_FILE"
    fi
}

do_health_check() {
    local all_healthy=true
    local hostname=$(hostname)
    local issues=()
    local recoveries=()
    
    log "INFO" "Running health check..."
    
    # Check containers
    for name in "${!CONTAINERS[@]}"; do
        local container="${CONTAINERS[$name]}"
        local prev_state=$(get_state "$name")
        
        if check_container "$name" "$container"; then
            if [[ "$prev_state" == "down" ]]; then
                recoveries+=("✅ <b>${name}</b> is back online")
                log "INFO" "RECOVERY: $name is back online"
            fi
            set_state "$name" "up"
        else
            all_healthy=false
            if [[ "$prev_state" != "down" ]]; then
                issues+=("🔴 <b>${name}</b> container is DOWN")
                log "ERROR" "DOWN: $name container is not running"
            fi
            set_state "$name" "down"
        fi
    done
    
    # Check HTTP endpoints
    for name in "${!SERVICES[@]}"; do
        local url="${SERVICES[$name]}"
        local state_key="${name}_http"
        local prev_state=$(get_state "$state_key")
        
        if check_http_endpoint "$url"; then
            if [[ "$prev_state" == "down" ]]; then
                recoveries+=("✅ <b>${name}</b> endpoint is responding")
                log "INFO" "RECOVERY: $name HTTP endpoint is responding"
            fi
            set_state "$state_key" "up"
        else
            all_healthy=false
            if [[ "$prev_state" != "down" ]]; then
                issues+=("🔴 <b>${name}</b> endpoint not responding (${url})")
                log "ERROR" "DOWN: $name HTTP endpoint not responding"
            fi
            set_state "$state_key" "down"
        fi
    done
    
    # Send notifications for issues
    if [[ ${#issues[@]} -gt 0 ]] && [[ "${NOTIFY_ON_DOWN:-true}" == "true" ]]; then
        local message="🚨 <b>Service Alert on ${hostname}</b>\n\n$(printf '%s\n' "${issues[@]}")\n\n🕐 $(date '+%Y-%m-%d %H:%M:%S')"
        send_all_notifications "$message" "false"
    fi
    
    # Send notifications for recoveries
    if [[ ${#recoveries[@]} -gt 0 ]] && [[ "${NOTIFY_ON_RECOVERY:-true}" == "true" ]]; then
        local message="✅ <b>Service Recovery on ${hostname}</b>\n\n$(printf '%s\n' "${recoveries[@]}")\n\n🕐 $(date '+%Y-%m-%d %H:%M:%S')"
        send_all_notifications "$message" "true"
    fi
    
    # Summary
    if [[ "$all_healthy" == "true" ]]; then
        log "INFO" "All services healthy"
        return 0
    else
        log "WARN" "Some services are unhealthy"
        return 1
    fi
}

#===============================================================================
# Daemon Mode
#===============================================================================

run_daemon() {
    log "INFO" "Starting health check daemon (interval: ${CHECK_INTERVAL}s)"
    
    while true; do
        do_health_check || true
        sleep "$CHECK_INTERVAL"
    done
}

#===============================================================================
# Cron Setup
#===============================================================================

setup_cron() {
    local script_path="${INSTALL_DIR}/ctf-autopilot/infra/scripts/health-check.sh"
    local cron_entry="* * * * * ${script_path} --check >> /var/log/ctf-compass-health.log 2>&1"
    
    # Check if already exists
    if crontab -l 2>/dev/null | grep -q "health-check.sh"; then
        log "WARN" "Cron entry already exists"
    else
        (crontab -l 2>/dev/null; echo "$cron_entry") | crontab -
        log "INFO" "Added cron entry for every minute health check"
    fi
    
    echo -e "${GREEN}✅ Cron job setup complete!${NC}"
    echo "   Health checks will run every minute"
    echo "   Logs: /var/log/ctf-compass-health.log"
}

#===============================================================================
# Status Display
#===============================================================================

show_status() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║         CTF Compass - Service Status                     ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""
    
    # Container status
    echo -e "${BLUE}Container Status:${NC}"
    for name in "${!CONTAINERS[@]}"; do
        local container="${CONTAINERS[$name]}"
        if check_container "$name" "$container"; then
            echo -e "  ✅ ${GREEN}${name}${NC} - running"
        else
            echo -e "  🔴 ${RED}${name}${NC} - DOWN"
        fi
    done
    
    echo ""
    
    # HTTP endpoints
    echo -e "${BLUE}HTTP Endpoints:${NC}"
    for name in "${!SERVICES[@]}"; do
        local url="${SERVICES[$name]}"
        if check_http_endpoint "$url"; then
            echo -e "  ✅ ${GREEN}${name}${NC} - responding (${url})"
        else
            echo -e "  🔴 ${RED}${name}${NC} - not responding (${url})"
        fi
    done
    
    echo ""
    
    # Alert config status
    echo -e "${BLUE}Alert Configuration:${NC}"
    if [[ -n "${TELEGRAM_BOT_TOKEN:-}" ]] && [[ -n "${TELEGRAM_CHAT_ID:-}" ]]; then
        echo -e "  ✅ Telegram: configured"
    else
        echo -e "  ⚪ Telegram: not configured"
    fi
    
    if [[ -n "${DISCORD_WEBHOOK_URL:-}" ]]; then
        echo -e "  ✅ Discord: configured"
    else
        echo -e "  ⚪ Discord: not configured"
    fi
    
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        echo -e "  ✅ Slack: configured"
    else
        echo -e "  ⚪ Slack: not configured"
    fi
    
    echo ""
}

#===============================================================================
# Test Notifications
#===============================================================================

test_notifications() {
    echo -e "${BLUE}Testing notifications...${NC}"
    
    local test_message="🧪 <b>Test Alert</b>\n\nThis is a test notification from CTF Compass Health Monitor.\n\n🕐 $(date '+%Y-%m-%d %H:%M:%S')"
    
    send_all_notifications "$test_message" "false"
    
    echo -e "${GREEN}✅ Test notifications sent!${NC}"
    echo "   Check your configured channels for the test message."
}

#===============================================================================
# Help
#===============================================================================

show_help() {
    echo ""
    echo "CTF Compass - Health Check & Alert Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --check       Run single health check"
    echo "  --status      Show current service status"
    echo "  --daemon      Run as continuous daemon"
    echo "  --setup       Configure alert notifications"
    echo "  --setup-cron  Setup cron job for automatic checks"
    echo "  --test        Send test notifications"
    echo "  --help        Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  CHECK_INTERVAL   Check interval in seconds (default: 60)"
    echo "  INSTALL_DIR      Installation directory"
    echo ""
    echo "Configuration:"
    echo "  Config file: $CONFIG_FILE"
    echo "  Log file: $LOG_FILE"
    echo ""
}

#===============================================================================
# Main
#===============================================================================

main() {
    # Ensure log directory exists
    mkdir -p "$(dirname "$LOG_FILE")"
    touch "$LOG_FILE"
    
    # Load configuration
    load_config
    
    case "${1:-}" in
        --check)
            do_health_check
            ;;
        --status)
            show_status
            ;;
        --daemon)
            run_daemon
            ;;
        --setup)
            setup_config
            ;;
        --setup-cron)
            setup_cron
            ;;
        --test)
            test_notifications
            ;;
        --help|-h)
            show_help
            ;;
        "")
            show_status
            ;;
        *)
            log "ERROR" "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
