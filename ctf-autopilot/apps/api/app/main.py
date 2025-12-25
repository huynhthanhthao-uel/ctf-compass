# FastAPI Backend
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio

from app.config import settings
from app.middleware.security import SecurityHeadersMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.routers import auth, jobs, config, health, system, ai, history
from app.routers import ws as ws_router
from app.database import engine
from app.models import Base


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

# Security middleware
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)

# CORS
cors_origins = settings.cors_origins
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
