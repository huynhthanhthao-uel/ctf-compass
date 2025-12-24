#!/bin/bash
# CTF Autopilot - Development Environment Startup
# Starts only infrastructure services (Postgres, Redis) for local development

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

cd "$PROJECT_ROOT"

echo "🚀 Starting CTF Autopilot development environment..."

# Start infrastructure services
echo "📦 Starting PostgreSQL and Redis..."
docker compose -f infra/docker-compose.dev.yml up -d

# Wait for services
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check PostgreSQL
if docker compose -f infra/docker-compose.dev.yml exec -T postgres pg_isready -U ctfautopilot > /dev/null 2>&1; then
    echo "✅ PostgreSQL is ready"
else
    echo "❌ PostgreSQL is not ready"
    exit 1
fi

# Check Redis
if docker compose -f infra/docker-compose.dev.yml exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is ready"
else
    echo "❌ Redis is not ready"
    exit 1
fi

echo ""
echo "========================================"
echo "✅ Development environment is ready!"
echo "========================================"
echo ""
echo "Services running:"
echo "  PostgreSQL: localhost:5432 (user: ctfautopilot, pass: devpassword)"
echo "  Redis:      localhost:6379"
echo ""
echo "To start the API:"
echo "  cd apps/api && poetry install && poetry run uvicorn app.main:app --reload"
echo ""
echo "To start the frontend:"
echo "  cd apps/web && npm install && npm run dev"
echo ""
echo "To stop services:"
echo "  docker compose -f infra/docker-compose.dev.yml down"
echo ""
