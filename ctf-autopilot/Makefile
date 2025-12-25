# CTF Compass - Makefile
# Quick commands for managing the CTF Compass system

# Configuration
INSTALL_DIR := /opt/ctf-compass
COMPOSE_FILE := $(INSTALL_DIR)/ctf-autopilot/infra/docker-compose.yml
DOCKER_COMPOSE := docker compose -f $(COMPOSE_FILE)

# Colors
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m

.PHONY: help status start stop restart logs logs-api logs-worker logs-web \
        update rebuild rebuild-api rebuild-worker rebuild-web clean \
        backup restore shell-api shell-db health test

# Default target
help:
	@echo ""
	@echo "$(GREEN)╔══════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(GREEN)║         CTF Compass - Available Commands                 ║$(NC)"
	@echo "$(GREEN)╚══════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(YELLOW)Service Management:$(NC)"
	@echo "  make status      - Show status of all containers"
	@echo "  make start       - Start all services"
	@echo "  make stop        - Stop all services"
	@echo "  make restart     - Restart all services"
	@echo ""
	@echo "$(YELLOW)Logs:$(NC)"
	@echo "  make logs        - View all logs (follow)"
	@echo "  make logs-api    - View API logs"
	@echo "  make logs-worker - View Worker logs"
	@echo "  make logs-web    - View Web logs"
	@echo ""
	@echo "$(YELLOW)Updates & Builds:$(NC)"
	@echo "  make update      - Pull latest code and rebuild"
	@echo "  make rebuild     - Rebuild all containers (no cache)"
	@echo "  make rebuild-api - Rebuild API container only"
	@echo "  make rebuild-worker - Rebuild Worker container only"
	@echo "  make rebuild-web - Rebuild Web container only"
	@echo ""
	@echo "$(YELLOW)Database:$(NC)"
	@echo "  make backup      - Backup PostgreSQL database"
	@echo "  make restore     - Restore from latest backup"
	@echo "  make shell-db    - Open PostgreSQL shell"
	@echo ""
	@echo "$(YELLOW)Debugging:$(NC)"
	@echo "  make shell-api   - Open shell in API container"
	@echo "  make health      - Check API health"
	@echo "  make test        - Run tests"
	@echo ""
	@echo "$(YELLOW)Cleanup:$(NC)"
	@echo "  make clean       - Remove unused Docker resources"
	@echo "  make clean-all   - Remove ALL Docker resources (dangerous)"
	@echo ""

# ============================================
# Service Management
# ============================================

status:
	@echo "$(GREEN)📊 Container Status$(NC)"
	@docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "ctf_compass|NAMES"
	@echo ""
	@$(DOCKER_COMPOSE) ps

start:
	@echo "$(GREEN)🚀 Starting services...$(NC)"
	@$(DOCKER_COMPOSE) up -d
	@echo "$(GREEN)✅ Services started$(NC)"

stop:
	@echo "$(YELLOW)🛑 Stopping services...$(NC)"
	@$(DOCKER_COMPOSE) down
	@echo "$(GREEN)✅ Services stopped$(NC)"

restart:
	@echo "$(YELLOW)🔄 Restarting services...$(NC)"
	@$(DOCKER_COMPOSE) restart
	@echo "$(GREEN)✅ Services restarted$(NC)"

# ============================================
# Logs
# ============================================

logs:
	@$(DOCKER_COMPOSE) logs -f --tail=100

logs-api:
	@docker logs ctf_compass_api --tail 100 -f

logs-worker:
	@docker logs ctf_compass_worker --tail 100 -f

logs-web:
	@docker logs ctf_compass_web --tail 100 -f

logs-db:
	@docker logs ctf_compass_postgres --tail 100 -f

logs-redis:
	@docker logs ctf_compass_redis --tail 100 -f

# ============================================
# Updates & Builds
# ============================================

update:
	@echo "$(GREEN)📥 Updating CTF Compass...$(NC)"
	@cd $(INSTALL_DIR) && git config --global --add safe.directory $(INSTALL_DIR) 2>/dev/null || true
	@cd $(INSTALL_DIR) && git pull
	@$(DOCKER_COMPOSE) up -d --build
	@echo "$(GREEN)✅ Update complete$(NC)"
	@make health

rebuild:
	@echo "$(YELLOW)🔨 Rebuilding all containers (no cache)...$(NC)"
	@$(DOCKER_COMPOSE) build --no-cache
	@$(DOCKER_COMPOSE) up -d
	@echo "$(GREEN)✅ Rebuild complete$(NC)"

rebuild-api:
	@echo "$(YELLOW)🔨 Rebuilding API...$(NC)"
	@$(DOCKER_COMPOSE) build api --no-cache
	@$(DOCKER_COMPOSE) up -d api
	@echo "$(GREEN)✅ API rebuilt$(NC)"

rebuild-worker:
	@echo "$(YELLOW)🔨 Rebuilding Worker...$(NC)"
	@$(DOCKER_COMPOSE) build worker --no-cache
	@$(DOCKER_COMPOSE) up -d worker
	@echo "$(GREEN)✅ Worker rebuilt$(NC)"

rebuild-web:
	@echo "$(YELLOW)🔨 Rebuilding Web...$(NC)"
	@$(DOCKER_COMPOSE) build web --no-cache
	@$(DOCKER_COMPOSE) up -d web
	@echo "$(GREEN)✅ Web rebuilt$(NC)"

# ============================================
# Database
# ============================================

backup:
	@echo "$(GREEN)💾 Creating database backup...$(NC)"
	@bash $(INSTALL_DIR)/ctf-autopilot/infra/scripts/backup.sh
	@echo "$(GREEN)✅ Backup complete$(NC)"

restore:
	@echo "$(YELLOW)⚠️  Restoring database from latest backup...$(NC)"
	@bash $(INSTALL_DIR)/ctf-autopilot/infra/scripts/backup.sh --restore
	@echo "$(GREEN)✅ Restore complete$(NC)"

shell-db:
	@echo "$(GREEN)🐘 Opening PostgreSQL shell...$(NC)"
	@docker exec -it ctf_compass_postgres psql -U postgres -d ctf_compass

# ============================================
# Debugging
# ============================================

shell-api:
	@echo "$(GREEN)🐚 Opening API shell...$(NC)"
	@docker exec -it ctf_compass_api /bin/bash

health:
	@echo "$(GREEN)🏥 Checking API health...$(NC)"
	@curl -s http://localhost:8000/api/health | python3 -m json.tool 2>/dev/null || echo "$(RED)❌ API not responding$(NC)"

test:
	@echo "$(GREEN)🧪 Running tests...$(NC)"
	@docker exec ctf_compass_api pytest -v

# ============================================
# Cleanup
# ============================================

clean:
	@echo "$(YELLOW)🧹 Cleaning unused Docker resources...$(NC)"
	@docker system prune -f
	@docker image prune -f
	@echo "$(GREEN)✅ Cleanup complete$(NC)"

clean-all:
	@echo "$(RED)⚠️  WARNING: This will remove ALL unused Docker resources!$(NC)"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	@docker system prune -af
	@docker volume prune -f
	@echo "$(GREEN)✅ Full cleanup complete$(NC)"
