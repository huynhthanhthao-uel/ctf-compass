# FastAPI Backend
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
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


# ============================================================
# Global state for tracking initialization (non-blocking)
# ============================================================
_db_ready = False
_db_error: str | None = None


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
    """Read a value from a local .env file."""
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
    env_v = os.getenv("CORS_ORIGINS")
    if env_v is not None and env_v.strip():
        return _parse_cors_origins_env(env_v)

    file_v = _read_dotenv_value("CORS_ORIGINS")
    if file_v is not None and str(file_v).strip():
        return _parse_cors_origins_env(file_v)

    try:
        return list(settings.cors_origins)
    except Exception:
        return ["*"]


async def _init_database_background():
    """Initialize database in background - does NOT block app startup."""
    global _db_ready, _db_error
    
    max_attempts = 60  # Try for up to 2 minutes
    delay_seconds = 2

    for attempt in range(1, max_attempts + 1):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            _db_ready = True
            _db_error = None
            print(f"[startup] Database initialized successfully (attempt {attempt})")
            
            # Log CORS config
            try:
                dotenv_v = _read_dotenv_value("CORS_ORIGINS")
                print(f"[startup] CORS_ORIGINS env={os.getenv('CORS_ORIGINS')!r} dotenv={dotenv_v!r} effective={_get_effective_cors_origins()!r}")
            except Exception:
                pass
            return
        except Exception as e:
            _db_error = str(e)
            print(f"[startup] DB init attempt {attempt}/{max_attempts} failed: {e}")
            if attempt < max_attempts:
                await asyncio.sleep(delay_seconds)
    
    print(f"[startup] WARNING: Database initialization failed after {max_attempts} attempts")


# ============================================================
# Create FastAPI app WITHOUT blocking lifespan
# This ensures health check is available IMMEDIATELY
# ============================================================
app = FastAPI(
    title="CTF Autopilot Analyzer",
    description="Security-first CTF challenge analyzer and writeup generator",
    version="1.0.0",
    docs_url="/api/docs" if settings.debug else None,
    redoc_url="/api/redoc" if settings.debug else None,
)


# ============================================================
# CRITICAL: Health check endpoint - available IMMEDIATELY
# Docker healthcheck will hit this endpoint
# ============================================================
@app.get("/api/health")
async def health_check():
    """
    Simple health check - returns healthy as soon as app starts.
    This is what Docker healthcheck uses.
    """
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "db_ready": _db_ready,
    }


@app.get("/api/health/ready")
async def readiness_check():
    """Readiness check - returns ready only when DB is initialized."""
    if _db_ready:
        return {"status": "ready", "timestamp": datetime.utcnow().isoformat()}
    else:
        return {
            "status": "initializing",
            "timestamp": datetime.utcnow().isoformat(),
            "error": _db_error,
        }


# ============================================================
# Startup event - triggers background DB init (non-blocking)
# ============================================================
@app.on_event("startup")
async def on_startup():
    """Start background database initialization."""
    asyncio.create_task(_init_database_background())


@app.on_event("shutdown")
async def on_shutdown():
    """Cleanup on shutdown."""
    await engine.dispose()


# Security middleware
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)

# CORS
cors_origins = _get_effective_cors_origins()
allow_credentials = True

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
