#!/bin/bash
#===============================================================================
# CTF Compass - Monitoring Stack Management
# Manages Prometheus, Grafana, and Alertmanager
#===============================================================================

# Use -eo instead of -euo to handle potential unbound variables
set -eo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/ctf-compass}"
MONITORING_DIR="${INSTALL_DIR}/ctf-autopilot/infra/monitoring"
COMPOSE_FILE="${MONITORING_DIR}/docker-compose.monitoring.yml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "${BLUE}[STEP]${NC} $1"; }

show_help() {
    echo ""
    echo "CTF Compass - Monitoring Stack Management"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start       Start monitoring stack (Prometheus, Grafana, Alertmanager)"
    echo "  stop        Stop monitoring stack"
    echo "  restart     Restart monitoring stack"
    echo "  status      Show status of monitoring services"
    echo "  logs        View monitoring logs"
    echo "  urls        Show access URLs"
    echo "  setup       Initial setup and configuration"
    echo "  help        Show this help message"
    echo ""
    echo "Access URLs (after start):"
    echo "  Grafana:      http://localhost:3001 (admin / ctfcompass123)"
    echo "  Prometheus:   http://localhost:9090"
    echo "  Alertmanager: http://localhost:9093"
    echo ""
}

check_requirements() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        log_error "Compose file not found: $COMPOSE_FILE"
        exit 1
    fi
}

start_monitoring() {
    log_step "Starting monitoring stack..."
    
    cd "$MONITORING_DIR"
    docker compose -f docker-compose.monitoring.yml up -d
    
    log_info "✅ Monitoring stack started!"
    show_urls
}

stop_monitoring() {
    log_step "Stopping monitoring stack..."
    
    cd "$MONITORING_DIR"
    docker compose -f docker-compose.monitoring.yml down
    
    log_info "✅ Monitoring stack stopped"
}

restart_monitoring() {
    log_step "Restarting monitoring stack..."
    
    cd "$MONITORING_DIR"
    docker compose -f docker-compose.monitoring.yml restart
    
    log_info "✅ Monitoring stack restarted"
}

show_status() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║         CTF Compass - Monitoring Status                  ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""
    
    cd "$MONITORING_DIR"
    docker compose -f docker-compose.monitoring.yml ps
    
    echo ""
}

show_logs() {
    cd "$MONITORING_DIR"
    docker compose -f docker-compose.monitoring.yml logs -f --tail=100 "$@"
}

show_urls() {
    local host_ip=$(hostname -I | awk '{print $1}')
    
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║         Monitoring Access URLs                           ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""
    echo -e "  ${GREEN}Grafana:${NC}      http://${host_ip}:3001"
    echo -e "                Username: admin"
    echo -e "                Password: ctfcompass123"
    echo ""
    echo -e "  ${GREEN}Prometheus:${NC}   http://${host_ip}:9090"
    echo ""
    echo -e "  ${GREEN}Alertmanager:${NC} http://${host_ip}:9093"
    echo ""
    echo -e "  ${GREEN}Node Exporter:${NC}    http://${host_ip}:9100/metrics"
    echo -e "  ${GREEN}cAdvisor:${NC}         http://${host_ip}:8080"
    echo ""
}

setup_monitoring() {
    log_step "Setting up monitoring stack..."
    
    # Create necessary directories
    mkdir -p "${MONITORING_DIR}/prometheus"
    mkdir -p "${MONITORING_DIR}/alertmanager"
    mkdir -p "${MONITORING_DIR}/grafana/provisioning/datasources"
    mkdir -p "${MONITORING_DIR}/grafana/provisioning/dashboards"
    mkdir -p "${MONITORING_DIR}/grafana/dashboards"
    
    log_info "Directories created"
    
    # Check if main CTF Compass network exists
    if ! docker network ls | grep -q "infra_backend"; then
        log_warn "Main CTF Compass backend network not found"
        log_info "Please start the main application first: make start"
    fi
    
    # Ask for Discord webhook
    echo ""
    read -p "Discord Webhook URL (optional, press Enter to skip): " discord_url
    
    if [[ -n "$discord_url" ]]; then
        # Update alertmanager config
        sed -i "s|DISCORD_WEBHOOK_URL_HERE|${discord_url}|g" \
            "${MONITORING_DIR}/alertmanager/alertmanager.yml"
        log_info "Discord webhook configured"
    fi
    
    # Ask for Grafana password
    echo ""
    read -p "Grafana admin password (default: ctfcompass123): " grafana_pass
    grafana_pass="${grafana_pass:-ctfcompass123}"
    
    # Create .env file for monitoring
    cat > "${MONITORING_DIR}/.env" << EOF
# Monitoring Stack Environment
GRAFANA_PASSWORD=${grafana_pass}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}
EOF
    
    chmod 600 "${MONITORING_DIR}/.env"
    
    log_info "✅ Setup complete!"
    echo ""
    log_info "Run '$0 start' to start the monitoring stack"
}

main() {
    check_requirements
    
    case "${1:-}" in
        start)
            start_monitoring
            ;;
        stop)
            stop_monitoring
            ;;
        restart)
            restart_monitoring
            ;;
        status)
            show_status
            ;;
        logs)
            shift
            show_logs "$@"
            ;;
        urls)
            show_urls
            ;;
        setup)
            setup_monitoring
            ;;
        help|--help|-h)
            show_help
            ;;
        "")
            show_status
            ;;
        *)
            log_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
