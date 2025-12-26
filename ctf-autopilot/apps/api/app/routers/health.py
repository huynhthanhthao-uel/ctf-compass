from fastapi import APIRouter
from datetime import datetime
from sqlalchemy import text

from app.database import engine

router = APIRouter()


@router.get("/health")
async def health_check():
    """Health check endpoint - simple ping without DB check."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "ctf-autopilot-api",
    }


@router.get("/health/ready")
async def readiness_check():
    """Readiness check - verifies DB connection."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    return {
        "status": "ready" if db_status == "connected" else "not_ready",
        "timestamp": datetime.utcnow().isoformat(),
        "database": db_status,
    }
