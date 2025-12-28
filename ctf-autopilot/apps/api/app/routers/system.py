"""System management endpoints for updates and configuration."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import subprocess
import os
import json
import asyncio
import shutil

from app.routers.auth import optional_session, optional_csrf
from app.config import settings


router = APIRouter()


class UpdateCheckResponse(BaseModel):
    """Response for update check endpoint."""
    updates_available: bool
    current_version: str
    latest_version: str
    commits_behind: int = 0
    changelog: Optional[str] = None
    error: Optional[str] = None


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


def _find_install_dir() -> str:
    """Find the installation directory."""
    candidates = [
        "/opt/ctf-compass",
        "/app",
        os.environ.get("INSTALL_DIR", ""),
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
    ]
    for path in candidates:
        if path and os.path.exists(path) and (
            os.path.exists(os.path.join(path, ".git")) or
            os.path.exists(os.path.join(path, "ctf-autopilot"))
        ):
            return path
    return "/opt/ctf-compass"


def _find_update_script() -> Optional[str]:
    """Find the update script path."""
    install_dir = _find_install_dir()
    candidates = [
        os.path.join(install_dir, "ctf-autopilot/infra/scripts/update.sh"),
        os.path.join(install_dir, "infra/scripts/update.sh"),
        "/opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh",
        "/app/ctf-autopilot/infra/scripts/update.sh",
    ]
    for path in candidates:
        if os.path.exists(path) and os.access(path, os.X_OK):
            return path
        if os.path.exists(path):
            return path
    return None


def _get_current_version() -> str:
    """Get current installed version from git or VERSION file."""
    install_dir = _find_install_dir()
    
    try:
        # Try git first
        result = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True,
            cwd=install_dir,
            timeout=10
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    
    # Fallback to VERSION file
    version_file = os.path.join(install_dir, "VERSION")
    if os.path.exists(version_file):
        with open(version_file) as f:
            return f.read().strip()
    
    return "local-dev"


def _check_for_updates() -> dict:
    """Check for updates from GitHub."""
    install_dir = _find_install_dir()
    result = {
        "updates_available": False,
        "current_version": "local-dev",
        "latest_version": "local-dev",
        "commits_behind": 0,
        "error": None,
    }
    
    # Check if git is available
    if not shutil.which("git"):
        result["error"] = "Git not installed"
        return result
    
    # Check if it's a git repo
    git_dir = os.path.join(install_dir, ".git")
    if not os.path.exists(git_dir):
        result["error"] = "Not a git repository"
        return result
    
    try:
        # Get current commit
        proc = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True, text=True,
            cwd=install_dir, timeout=10
        )
        if proc.returncode == 0:
            result["current_version"] = proc.stdout.strip()
        
        # Fetch from origin
        subprocess.run(
            ["git", "fetch", "origin", "main"],
            capture_output=True, text=True,
            cwd=install_dir, timeout=30
        )
        
        # Get remote commit
        proc = subprocess.run(
            ["git", "rev-parse", "--short", "origin/main"],
            capture_output=True, text=True,
            cwd=install_dir, timeout=10
        )
        if proc.returncode == 0:
            result["latest_version"] = proc.stdout.strip()
        
        # Check if behind
        proc = subprocess.run(
            ["git", "rev-list", "--count", "HEAD..origin/main"],
            capture_output=True, text=True,
            cwd=install_dir, timeout=10
        )
        if proc.returncode == 0:
            commits_behind = int(proc.stdout.strip())
            result["commits_behind"] = commits_behind
            result["updates_available"] = commits_behind > 0
        
    except subprocess.TimeoutExpired:
        result["error"] = "Git operation timed out"
    except Exception as e:
        result["error"] = str(e)
    
    return result


@router.get("/check-update", response_model=UpdateCheckResponse)
async def check_update(
    _session=Depends(optional_session),
):
    """Check if updates are available."""
    result = _check_for_updates()
    
    return UpdateCheckResponse(
        updates_available=result["updates_available"],
        current_version=result["current_version"],
        latest_version=result["latest_version"],
        commits_behind=result["commits_behind"],
        error=result["error"],
    )


async def _run_update_stream():
    """Generator that streams update progress."""
    script_path = _find_update_script()
    install_dir = _find_install_dir()
    
    # Initial status
    yield json.dumps({
        "level": "info",
        "message": f"Starting update from {install_dir}...",
        "step": 0,
        "total": 6,
    }) + "\n"
    
    if not script_path:
        yield json.dumps({
            "level": "error",
            "success": False,
            "message": "Update script not found. Please run manually:\nsudo bash /opt/ctf-compass/ctf-autopilot/infra/scripts/update.sh",
        }) + "\n"
        return
    
    yield json.dumps({
        "level": "info",
        "message": f"Using script: {script_path}",
    }) + "\n"
    
    # Check if we can execute the script
    # In Docker, we typically need to run the update outside the container
    in_docker = os.path.exists("/.dockerenv") or os.environ.get("DOCKER", "")
    
    if in_docker:
        yield json.dumps({
            "level": "warn",
            "message": "Running inside Docker container. Update will affect container only.",
        }) + "\n"
    
    try:
        # Run the update script with JSON output
        env = os.environ.copy()
        env["INSTALL_DIR"] = install_dir
        
        process = await asyncio.create_subprocess_exec(
            "bash", script_path, "--json",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=install_dir,
            env=env,
        )
        
        step_count = 0
        async for line in process.stdout:
            decoded = line.decode().strip()
            if not decoded:
                continue
            
            # Try to parse as JSON
            try:
                data = json.loads(decoded)
                if data.get("level") == "step":
                    step_count += 1
                    data["step"] = step_count
                    data["total"] = 6
                yield json.dumps(data) + "\n"
            except json.JSONDecodeError:
                # Plain text log
                yield json.dumps({
                    "level": "log",
                    "message": decoded,
                }) + "\n"
        
        await process.wait()
        
        if process.returncode == 0:
            yield json.dumps({
                "level": "complete",
                "success": True,
                "message": "Update completed successfully! Services will restart.",
            }) + "\n"
        else:
            yield json.dumps({
                "level": "error",
                "success": False,
                "message": f"Update failed with exit code {process.returncode}",
            }) + "\n"
            
    except asyncio.CancelledError:
        yield json.dumps({
            "level": "warn",
            "message": "Update cancelled",
        }) + "\n"
    except PermissionError:
        yield json.dumps({
            "level": "error",
            "success": False,
            "message": "Permission denied. Run update manually with sudo:\nsudo bash " + (script_path or "update.sh"),
        }) + "\n"
    except Exception as e:
        yield json.dumps({
            "level": "error",
            "success": False,
            "message": f"Update error: {str(e)}",
        }) + "\n"


@router.post("/update")
async def perform_update(
    _session=Depends(optional_session),
    _csrf=Depends(optional_csrf),
):
    """Perform system update with streaming progress."""
    return StreamingResponse(
        _run_update_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )


@router.get("/api-key", response_model=ApiKeyResponse)
async def get_api_key_status(
    _session=Depends(optional_session),
):
    """Check if API key is configured."""
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
    _session=Depends(optional_session),
    _csrf=Depends(optional_csrf),
):
    """Update the MegaLLM API key (runtime only)."""
    if not request.api_key or len(request.api_key) < 10:
        raise HTTPException(status_code=400, detail="Invalid API key")
    
    # Store in runtime config
    _runtime_config["api_key"] = request.api_key
    
    # Try to persist to .env file
    install_dir = _find_install_dir()
    env_file = os.path.join(install_dir, ".env")
    
    try:
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
    _session=Depends(optional_session),
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
    _session=Depends(optional_session),
    _csrf=Depends(optional_csrf),
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


# ============ Tool Availability API ============

class ToolAvailabilityResponse(BaseModel):
    """Response for tool availability check."""
    tools: dict
    cached: bool
    checked_at: str
    summary: Optional[dict] = None


class PythonPackagesResponse(BaseModel):
    """Response for pre-installed Python packages."""
    packages: list
    can_install_more: bool
    venv_supported: bool


class RunScriptRequest(BaseModel):
    """Request to run a Python script."""
    script: str
    pip_packages: Optional[list] = None
    timeout: int = 300


class RunScriptResponse(BaseModel):
    """Response from running a Python script."""
    exit_code: int
    stdout: str
    stderr: str
    script: str
    packages: list


@router.get("/sandbox/tools", response_model=ToolAvailabilityResponse)
async def check_tool_availability(
    refresh: bool = False,
    _session=Depends(optional_session),
):
    """Check which tools are installed in the sandbox."""
    from app.services.sandbox_service import SandboxService
    
    sandbox = SandboxService()
    result = await sandbox.check_tool_availability(force_refresh=refresh)
    
    return ToolAvailabilityResponse(**result)


@router.get("/sandbox/python-packages", response_model=PythonPackagesResponse)
async def get_python_packages(
    _session=Depends(optional_session),
):
    """Get list of pre-installed Python packages in sandbox."""
    from app.services.sandbox_service import SandboxService
    
    sandbox = SandboxService()
    packages = sandbox.get_installed_python_packages()
    
    return PythonPackagesResponse(
        packages=packages,
        can_install_more=True,
        venv_supported=True,
    )


@router.post("/sandbox/run-script", response_model=RunScriptResponse)
async def run_python_script(
    request: RunScriptRequest,
    _session=Depends(optional_session),
    _csrf=Depends(optional_csrf),
):
    """Run a Python script in the sandbox."""
    from app.services.sandbox_service import SandboxService
    from uuid import uuid4
    from pathlib import Path
    import tempfile
    
    sandbox = SandboxService()
    
    # Create temp working directory
    with tempfile.TemporaryDirectory() as temp_dir:
        working_dir = Path(temp_dir)
        
        result = await sandbox.run_python_script(
            job_id=uuid4(),
            script_content=request.script,
            working_dir=working_dir,
            pip_packages=request.pip_packages,
            timeout=request.timeout,
        )
        
        return RunScriptResponse(
            exit_code=result.get("exit_code", 1),
            stdout=result.get("stdout", ""),
            stderr=result.get("stderr", ""),
            script=result.get("script", request.script),
            packages=result.get("packages", []),
        )


def get_megallm_api_key() -> Optional[str]:
    """Get the current MegaLLM API key (runtime or env)."""
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
