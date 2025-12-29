# FastAPI Backend
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import os
import json

from app.config import settings
from app.middleware.security import SecurityHeadersMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.routers import auth, jobs, config, health, system, ai, history
from app.routers import ws as ws_router
from app.database import engine
from app.models import Base


def _parse_cors_origins_env(raw: str) -> list[str]:
    s = (raw or "").strip()
    if not s:
        return ["*"]

    if s.startswith("["):
        try:
            parsed = json.loads(s)
            if isinstance(parsed, list):
                return [str(x).strip() for x in parsed if str(x).strip()]
        except Exception:
            pass

    # CSV
    return [item.strip() for item in s.split(",") if item.strip()]


def _read_dotenv_value(key: str) -> str | None:
    """Read a value from a local .env file.

    This is a defensive fallback for container setups where env_file hydration may fail.
    Supports basic KEY=VALUE and quoted values.
    """

    for path in ("/app/.env", ".env"):
        try:
            if not os.path.isfile(path):
                continue
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    s = line.strip()
                    if not s or s.startswith("#") or "=" not in s:
                        continue
                    k, v = s.split("=", 1)
                    if k.strip() != key:
                        continue
                    v = v.strip().strip('"').strip("'")
                    return v
        except Exception:
            continue
    return None


def _get_effective_cors_origins() -> list[str]:
    # Prefer explicit env var at runtime (most reliable in containers)
    env_v = os.getenv("CORS_ORIGINS")
    # IMPORTANT: Treat empty string as "unset" (compose may pass CORS_ORIGINS='')
    if env_v is not None and env_v.strip():
        return _parse_cors_origins_env(env_v)

    # Fallback: try reading from mounted /app/.env (if any)
    file_v = _read_dotenv_value("CORS_ORIGINS")
    if file_v is not None and str(file_v).strip():
        return _parse_cors_origins_env(file_v)

    # Fallback to settings (which may be default ['*'] if env hydration fails)
    try:
        return list(settings.cors_origins)
    except Exception:
        return ["*"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: wait for DB and initialize schema (first boot)
    max_attempts = 30
    delay_seconds = 2

    last_error: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            last_error = None
            break
        except Exception as e:
            last_error = e
            # Keep retrying for a short window (common in docker-compose start order)
            if attempt < max_attempts:
                print(f"[startup] DB init failed (attempt {attempt}/{max_attempts}): {e}")
                await asyncio.sleep(delay_seconds)

    if last_error is not None:
        raise last_error

    # Log effective CORS config (helps diagnose container env issues)
    try:
        dotenv_v = _read_dotenv_value("CORS_ORIGINS")
        print(
            f"[startup] CORS_ORIGINS env={os.getenv('CORS_ORIGINS')!r} dotenv={dotenv_v!r} effective={_get_effective_cors_origins()!r}"
        )
    except Exception:
        pass

    yield

    # Shutdown
    await engine.dispose()


app = FastAPI(
    title="CTF Autopilot Analyzer",
    description="Security-first CTF challenge analyzer and writeup generator",
    version="1.0.0",
    docs_url="/api/docs" if settings.debug else None,
    redoc_url="/api/redoc" if settings.debug else None,
    lifespan=lifespan,
)


# Simple root health check - available immediately (before lifespan completes)
@app.get("/api/health")
async def root_health():
    """Simple health check that works before full startup."""
    from datetime import datetime
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# Security middleware
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)

# CORS
cors_origins = _get_effective_cors_origins()
allow_credentials = True

# Wildcard origins cannot be combined with credentials (cookies).
# If '*' is present, we fall back to non-credentialed CORS.
if any(origin == "*" for origin in cors_origins):
    cors_origins = ["*"]
    allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=allow_credentials,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# REST API Routers
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["Jobs"])
app.include_router(config.router, prefix="/api/config", tags=["Configuration"])
app.include_router(system.router, prefix="/api/system", tags=["System"])
app.include_router(ai.router, prefix="/api", tags=["AI Analysis"])
app.include_router(history.router, prefix="/api", tags=["Analysis History"])

# WebSocket Router
app.include_router(ws_router.router, prefix="/ws", tags=["WebSocket"])
