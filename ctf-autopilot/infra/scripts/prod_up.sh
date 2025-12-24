#!/bin/bash
# CTF Autopilot - Production Startup Script
# Starts all services in production mode

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

cd "$PROJECT_ROOT"

echo "🚀 Starting CTF Autopilot in production mode..."

# Check for .env file
if [[ ! -f ".env" ]]; then
    echo "❌ .env file not found!"
    echo "Please copy .env.example to .env and configure it."
    exit 1
fi

# Check for required environment variables
source .env
if [[ -z "${MEGALLM_API_KEY:-}" ]]; then
    echo "⚠️  Warning: MEGALLM_API_KEY is not set"
    echo "AI features will not work without it."
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Build sandbox image if not exists
if ! docker image inspect ctf-autopilot-sandbox:latest > /dev/null 2>&1; then
    echo "📦 Building sandbox image..."
    docker build -t ctf-autopilot-sandbox:latest -f sandbox/image/Dockerfile sandbox/image/
fi

# Create data directories
mkdir -p data/runs

# Start all services
echo "📦 Starting all services..."
cd infra

if [[ "${ENABLE_TLS:-false}" == "true" ]]; then
    echo "🔒 Starting with TLS enabled..."
    docker compose --profile production up -d --build
else
    echo "🔓 Starting without TLS (development mode)..."
    docker compose up -d --build
fi

# Wait for services
echo "⏳ Waiting for services to be ready..."
sleep 15

# Health checks
echo "🏥 Running health checks..."

# Check API
if curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
    echo "✅ API is healthy"
else
    echo "❌ API health check failed"
    docker compose logs api --tail 20
    exit 1
fi

# Check database
if docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-ctfautopilot}" > /dev/null 2>&1; then
    echo "✅ PostgreSQL is healthy"
else
    echo "❌ PostgreSQL is not ready"
    exit 1
fi

# Check Redis
if docker compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is healthy"
else
    echo "❌ Redis is not ready"
    exit 1
fi

echo ""
echo "========================================"
echo "✅ CTF Autopilot is running!"
echo "========================================"
echo ""
echo "Access the application:"
if [[ "${ENABLE_TLS:-false}" == "true" ]]; then
    echo "  https://$(hostname -I | awk '{print $1}')"
else
    echo "  http://$(hostname -I | awk '{print $1}'):3000"
fi
echo ""
echo "View logs:"
echo "  docker compose -f infra/docker-compose.yml logs -f"
echo ""
echo "Stop services:"
echo "  docker compose -f infra/docker-compose.yml down"
echo ""
