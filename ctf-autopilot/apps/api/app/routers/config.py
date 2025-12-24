from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import settings
from app.schemas import ConfigResponse, ConfigUpdate
from app.routers.auth import get_current_session, verify_csrf
from app.services.sandbox_service import SandboxService


router = APIRouter()


@router.get("", response_model=ConfigResponse)
async def get_config(
    _session = Depends(get_current_session),
):
    """Get current configuration."""
    sandbox_service = SandboxService()
    
    return ConfigResponse(
        max_upload_size_mb=settings.max_upload_size_mb,
        sandbox_timeout_seconds=settings.sandbox_timeout_seconds,
        allowed_extensions=settings.allowed_extensions_list,
        allowed_tools=sandbox_service.allowed_tools,
    )


@router.patch("", response_model=ConfigResponse)
async def update_config(
    config: ConfigUpdate,
    _session = Depends(get_current_session),
    _csrf = Depends(verify_csrf),
):
    """Update configuration (runtime only, not persisted)."""
    # Note: This only updates runtime settings, not .env
    # For production, you'd want to persist these changes
    
    if config.max_upload_size_mb:
        settings.max_upload_size_mb = config.max_upload_size_mb
    
    if config.sandbox_timeout_seconds:
        settings.sandbox_timeout_seconds = config.sandbox_timeout_seconds
    
    sandbox_service = SandboxService()
    
    return ConfigResponse(
        max_upload_size_mb=settings.max_upload_size_mb,
        sandbox_timeout_seconds=settings.sandbox_timeout_seconds,
        allowed_extensions=settings.allowed_extensions_list,
        allowed_tools=sandbox_service.allowed_tools,
    )
