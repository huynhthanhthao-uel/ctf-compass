"""System management endpoints for updates and configuration."""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import subprocess
import os
import json
import asyncio

from app.routers.auth import get_current_session, verify_csrf


router = APIRouter()


class UpdateCheckResponse(BaseModel):
    """Response for update check endpoint."""
    updates_available: bool
    current_version: str
    latest_version: str
    changelog: Optional[str] = None


class UpdateResponse(BaseModel):
    """Response for update action."""
    success: bool
    message: str


class ApiKeyUpdateRequest(BaseModel):
    """Request to update API key."""
    api_key: str


class ApiKeyResponse(BaseModel):
    """Response for API key status."""
    is_configured: bool
    key_prefix: Optional[str] = None


class ModelConfigRequest(BaseModel):
    """Request to update model configuration."""
    analysis_model: Optional[str] = None
    writeup_model: Optional[str] = None
    extraction_model: Optional[str] = None


class ModelConfigResponse(BaseModel):
    """Response for model configuration."""
    analysis_model: str
    writeup_model: str
    extraction_model: str


# In-memory storage for runtime config (persisted separately)
_runtime_config = {
    "api_key": None,
    "analysis_model": "llama3.3-70b-instruct",
    "writeup_model": "llama3.3-70b-instruct",
    "extraction_model": "openai-gpt-oss-20b",
}


def _get_current_version() -> str:
    """Get current installed version from git or VERSION file."""
    try:
        # Try git first
        result = subprocess.run(
            ["git", "describe", "--tags", "--always"],
            capture_output=True,
            text=True,
            cwd="/opt/ctf-compass"
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    
    # Fallback to VERSION file
    version_file = "/opt/ctf-compass/VERSION"
    if os.path.exists(version_file):
        with open(version_file) as f:
            return f.read().strip()
    
    return "1.0.0"


def _get_latest_version() -> tuple[str, str]:
    """Get latest version from GitHub."""
    try:
        result = subprocess.run(
            ["git", "fetch", "--tags"],
            capture_output=True,
            text=True,
            cwd="/opt/ctf-compass"
        )
        
        result = subprocess.run(
            ["git", "describe", "--tags", "--abbrev=0", "origin/main"],
            capture_output=True,
            text=True,
            cwd="/opt/ctf-compass"
        )
        if result.returncode == 0:
            return result.stdout.strip(), ""
    except Exception as e:
        return _get_current_version(), str(e)
    
    return _get_current_version(), ""


@router.get("/check-update", response_model=UpdateCheckResponse)
async def check_update(
    _session=Depends(get_current_session),
):
    """Check if updates are available."""
    current = _get_current_version()
    latest, _ = _get_latest_version()
    
    # Simple version comparison
    updates_available = current != latest and latest > current
    
    return UpdateCheckResponse(
        updates_available=updates_available,
        current_version=current,
        latest_version=latest,
        changelog=None,
    )


async def _run_update_stream():
    """Generator that streams update progress."""
    steps = [
        ("Backing up configuration...", "backup"),
        ("Pulling latest from GitHub...", "git pull"),
        ("Updating dependencies...", "deps"),
        ("Rebuilding containers...", "docker build"),
        ("Restarting services...", "docker restart"),
        ("Running health checks...", "health"),
    ]
    
    for i, (message, _step) in enumerate(steps, 1):
        yield json.dumps({
            "level": "step",
            "step": i,
            "total": len(steps),
            "message": f"Step {i}/{len(steps)}: {message}",
        }) + "\n"
        await asyncio.sleep(1)
    
    # Actually run update script
    try:
        process = await asyncio.create_subprocess_exec(
            "bash", "/opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        
        async for line in process.stdout:
            yield json.dumps({
                "level": "log",
                "message": line.decode().strip(),
            }) + "\n"
        
        await process.wait()
        
        if process.returncode == 0:
            yield json.dumps({
                "level": "complete",
                "success": True,
                "message": "Update completed successfully!",
            }) + "\n"
        else:
            yield json.dumps({
                "level": "error",
                "success": False,
                "message": f"Update failed with exit code {process.returncode}",
            }) + "\n"
    except Exception as e:
        yield json.dumps({
            "level": "error",
            "success": False,
            "message": str(e),
        }) + "\n"


@router.post("/update")
async def perform_update(
    _session=Depends(get_current_session),
    _csrf=Depends(verify_csrf),
):
    """Perform system update with streaming progress."""
    return StreamingResponse(
        _run_update_stream(),
        media_type="text/event-stream",
    )


@router.get("/api-key", response_model=ApiKeyResponse)
async def get_api_key_status(
    _session=Depends(get_current_session),
):
    """Check if API key is configured."""
    from app.config import settings
    
    # Check environment variable first, then runtime config
    env_key = settings.megallm_api_key
    runtime_key = _runtime_config.get("api_key")
    
    key = runtime_key or env_key
    
    if key and len(key) > 8:
        return ApiKeyResponse(
            is_configured=True,
            key_prefix=f"{key[:8]}...{key[-4:]}",
        )
    
    return ApiKeyResponse(is_configured=False)


@router.post("/api-key", response_model=ApiKeyResponse)
async def set_api_key(
    request: ApiKeyUpdateRequest,
    _session=Depends(get_current_session),
    _csrf=Depends(verify_csrf),
):
    """Update the MegaLLM API key (runtime only)."""
    if not request.api_key or len(request.api_key) < 10:
        raise HTTPException(status_code=400, detail="Invalid API key")
    
    # Store in runtime config
    _runtime_config["api_key"] = request.api_key
    
    # Try to persist to .env file
    try:
        env_file = "/opt/ctf-compass/.env"
        if os.path.exists(env_file):
            with open(env_file, "r") as f:
                lines = f.readlines()
            
            # Update or add MEGALLM_API_KEY
            found = False
            for i, line in enumerate(lines):
                if line.startswith("MEGALLM_API_KEY="):
                    lines[i] = f"MEGALLM_API_KEY={request.api_key}\n"
                    found = True
                    break
            
            if not found:
                lines.append(f"MEGALLM_API_KEY={request.api_key}\n")
            
            with open(env_file, "w") as f:
                f.writelines(lines)
    except Exception:
        # Runtime update only if file write fails
        pass
    
    return ApiKeyResponse(
        is_configured=True,
        key_prefix=f"{request.api_key[:8]}...{request.api_key[-4:]}",
    )


@router.get("/models", response_model=ModelConfigResponse)
async def get_model_config(
    _session=Depends(get_current_session),
):
    """Get current model configuration."""
    return ModelConfigResponse(
        analysis_model=_runtime_config.get("analysis_model", "llama3.3-70b-instruct"),
        writeup_model=_runtime_config.get("writeup_model", "llama3.3-70b-instruct"),
        extraction_model=_runtime_config.get("extraction_model", "openai-gpt-oss-20b"),
    )


@router.post("/models", response_model=ModelConfigResponse)
async def set_model_config(
    request: ModelConfigRequest,
    _session=Depends(get_current_session),
    _csrf=Depends(verify_csrf),
):
    """Update model configuration."""
    if request.analysis_model:
        _runtime_config["analysis_model"] = request.analysis_model
    if request.writeup_model:
        _runtime_config["writeup_model"] = request.writeup_model
    if request.extraction_model:
        _runtime_config["extraction_model"] = request.extraction_model
    
    return ModelConfigResponse(
        analysis_model=_runtime_config.get("analysis_model", "llama3.3-70b-instruct"),
        writeup_model=_runtime_config.get("writeup_model", "llama3.3-70b-instruct"),
        extraction_model=_runtime_config.get("extraction_model", "openai-gpt-oss-20b"),
    )


def get_megallm_api_key() -> str:
    """Get the current MegaLLM API key (runtime or env)."""
    from app.config import settings
    return _runtime_config.get("api_key") or settings.megallm_api_key


def get_model_for_task(task: str) -> str:
    """Get the configured model for a specific task."""
    task_map = {
        "analysis": "analysis_model",
        "writeup": "writeup_model",
        "extraction": "extraction_model",
    }
    key = task_map.get(task, "analysis_model")
    return _runtime_config.get(key, "llama3.3-70b-instruct")
