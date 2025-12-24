# CTF Autopilot API - FastAPI Application
# Production-ready Docker image

FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install poetry
RUN pip install --no-cache-dir poetry

# Copy dependency files
COPY pyproject.toml ./

# Create a dummy poetry.lock if not exists and install dependencies
# This ensures the build works even without poetry.lock
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi --no-root --only main 2>/dev/null \
    || poetry lock --no-interaction && poetry install --no-interaction --no-ansi --no-root --only main

# Copy application code
COPY . .

# Create non-root user and directories
RUN useradd -m -u 1000 appuser && \
    mkdir -p /data/runs && \
    chown -R appuser:appuser /app /data

USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Run application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
