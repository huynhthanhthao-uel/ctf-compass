from pathlib import Path
from typing import List, Dict, Optional, Tuple
from uuid import UUID
from datetime import datetime
import subprocess
import hashlib
import docker
import tempfile
import os
import json
import asyncio

from app.config import settings


class SandboxService:
    """Service for running analysis tools in isolated containers."""
    
    # Allowlist of safe analysis tools for CTF challenges
    allowed_tools: List[str] = [
        # Binary analysis
        "strings", "file", "readelf", "objdump", "nm", "size", "ldd", "checksec",
        # Hex/Binary viewing
        "xxd", "hexdump", "od",
        # Encoding/Decoding
        "base64", "base32", "openssl",
        # Image/Media forensics
        "exiftool", "identify", "convert", "steghide", "zsteg", "stegseek", 
        "stegcracker", "foremost", "binwalk",
        # PDF analysis
        "pdfinfo", "pdftotext", "pdfimages", "pdftk",
        # Network analysis
        "tshark", "tcpdump", "ssldump",
        # Archive handling
        "unzip", "zipinfo", "tar", "gzip", "gunzip", "bzip2", "xz", "7z", "7za",
        "unrar", "cabextract", "fcrackzip", "zip2john", "rar2john",
        # Text processing
        "head", "tail", "cat", "wc", "grep", "egrep", "awk", "gawk", "sed",
        "cut", "sort", "uniq", "tr", "rev", "fold", "column",
        # File system
        "find", "ls", "stat",
        # Hashing
        "sha256sum", "sha1sum", "md5sum", "sha512sum", "cksum",
        # Python for scripting (with pip support)
        "python3", "python", "pip3", "pip",
        # Crypto analysis
        "john", "hashcat", "hash-identifier", "name-that-hash", "nth", 
        "factordb-cli", "rsatool", "RsaCtfTool", "xortool", "ciphey",
        # Memory/Disk forensics
        "volatility", "volatility3", "vol3", "bulk_extractor", "photorec", "testdisk",
        # Reverse engineering
        "radare2", "r2", "rabin2", "rasm2", "rafind2", "rahash2", "r2pipe",
        "retdec-decompiler", "retdec-fileinfo", "retdec-unpacker",
        "ghidra-headless",
        # ROP/Exploit tools
        "ropper", "ROPgadget", "one_gadget", "patchelf",
        # Debugging
        "gdb", "ltrace", "strace", "objcopy",
        # QR/Barcode
        "zbarimg", "zxing",
        # Image analysis
        "pngcheck", "pngcrush", "optipng",
        # Audio analysis
        "sox", "ffmpeg", "ffprobe",
        # Scripting/Shell
        "bash", "sh", "zsh",
        # Web tools
        "curl", "wget",
        # Misc utilities
        "jq", "yq", "xmllint", "nc", "ncat", "dd", "split",
        # Compilers for solve scripts
        "gcc", "g++", "clang", "make", "cmake",
        # Node.js
        "node", "npm", "npx",
        # Other languages
        "ruby", "perl", "php", "go", "rustc", "cargo", "java", "javac",
        # PWN tools
        "pwn", "cyclic", "shellcraft",
        # OCR
        "tesseract",
    ]
    
    # Tools that require special handling
    script_tools = ["python3", "python", "node", "ruby", "perl", "php"]
    
    # Cache for tool availability
    _tool_cache: Dict[str, bool] = {}
    _cache_timestamp: Optional[datetime] = None
    
    def __init__(self):
        self.client = docker.from_env()
    
    def is_tool_allowed(self, tool: str) -> bool:
        """Check if tool is in allowlist."""
        tool_name = Path(tool).name
        return tool_name in self.allowed_tools
    
    async def check_tool_availability(self, force_refresh: bool = False) -> Dict[str, any]:
        """Check which tools are actually installed in the sandbox."""
        # Use cache if available and fresh (5 minutes)
        cache_age = 300  # 5 minutes
        if (not force_refresh and 
            self._cache_timestamp and 
            (datetime.utcnow() - self._cache_timestamp).total_seconds() < cache_age and
            self._tool_cache):
            return {
                "tools": self._tool_cache,
                "cached": True,
                "checked_at": self._cache_timestamp.isoformat(),
            }
        
        # Check each tool in the sandbox
        tool_status = {}
        tools_to_check = list(set(self.allowed_tools))  # Remove duplicates
        
        # Build a single command to check all tools at once (faster)
        check_script = """
import subprocess
import json
import shutil
import sys

tools = sys.argv[1:]
results = {}

for tool in tools:
    # Try which command first
    path = shutil.which(tool)
    if path:
        results[tool] = {"available": True, "path": path}
    else:
        # Try running with --version or --help
        try:
            result = subprocess.run([tool, "--version"], 
                                    capture_output=True, timeout=2)
            if result.returncode == 0:
                results[tool] = {"available": True, "path": "found"}
            else:
                results[tool] = {"available": False, "error": "not found"}
        except Exception as e:
            results[tool] = {"available": False, "error": str(e)}

print(json.dumps(results))
"""
        
        try:
            # Create temp script
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
                f.write(check_script)
                script_path = f.name
            
            # Run in sandbox
            cmd = ["python3", "/tmp/check_tools.py"] + tools_to_check
            
            result = self.client.containers.run(
                image=settings.sandbox_image,
                command=cmd,
                volumes={
                    script_path: {
                        "bind": "/tmp/check_tools.py",
                        "mode": "ro",
                    }
                },
                working_dir="/tmp",
                network_disabled=True,
                user="1000:1000",
                mem_limit="512m",
                cpu_period=100000,
                cpu_quota=50000,
                security_opt=["no-new-privileges"],
                cap_drop=["ALL"],
                remove=True,
                stdout=True,
                stderr=True,
                detach=False,
            )
            
            # Parse result
            output = result.decode("utf-8", errors="replace").strip()
            tool_status = json.loads(output)
            
            # Clean up temp file
            os.unlink(script_path)
            
        except Exception as e:
            # Fallback: assume all tools are available
            for tool in tools_to_check:
                tool_status[tool] = {"available": True, "assumed": True}
            tool_status["_error"] = str(e)
        
        # Update cache
        self._tool_cache = tool_status
        self._cache_timestamp = datetime.utcnow()
        
        # Calculate summary
        available_count = sum(1 for t in tool_status.values() 
                             if isinstance(t, dict) and t.get("available"))
        total_count = len(tools_to_check)
        
        return {
            "tools": tool_status,
            "cached": False,
            "checked_at": self._cache_timestamp.isoformat(),
            "summary": {
                "available": available_count,
                "total": total_count,
                "percentage": round(available_count / total_count * 100, 1) if total_count > 0 else 0,
            }
        }
    
    async def run_python_script(
        self,
        job_id: UUID,
        script_content: str,
        working_dir: Path,
        pip_packages: Optional[List[str]] = None,
        timeout: int = 300,
    ) -> Dict:
        """
        Run a Python script in the sandbox with optional pip packages.
        
        Args:
            job_id: Job ID for logging
            script_content: Python script code to execute
            working_dir: Working directory with challenge files
            pip_packages: List of pip packages to install
            timeout: Execution timeout in seconds
        
        Returns:
            Dict with exit_code, stdout, stderr
        """
        # Create a temp directory for the script and virtual env
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            # Write the script
            script_path = temp_path / "solve.py"
            script_path.write_text(script_content)
            
            # Build the execution command
            if pip_packages:
                # Create a setup script that creates venv, installs packages, then runs
                setup_script = f"""#!/bin/bash
set -e

# Create virtual environment in /tmp (writable)
python3 -m venv /tmp/venv 2>/dev/null || true

# Activate and install packages
source /tmp/venv/bin/activate 2>/dev/null || true

# Install packages if specified
pip install --quiet --disable-pip-version-check {' '.join(pip_packages)} 2>/dev/null || true

# Run the solve script
cd /workspace
python3 /script/solve.py
"""
                setup_path = temp_path / "run.sh"
                setup_path.write_text(setup_script)
                
                cmd = ["bash", "/script/run.sh"]
            else:
                # Simple execution without packages
                cmd = ["python3", "/script/solve.py"]
            
            try:
                result = self.client.containers.run(
                    image=settings.sandbox_image,
                    command=cmd,
                    volumes={
                        str(working_dir): {
                            "bind": "/workspace",
                            "mode": "ro",  # Read-only input files
                        },
                        str(temp_path): {
                            "bind": "/script",
                            "mode": "ro",  # Read-only script
                        },
                    },
                    working_dir="/workspace",
                    network_disabled=True,  # No network for security
                    user="1000:1000",
                    # Note: read_only=False to allow venv creation in /tmp
                    mem_limit=settings.sandbox_memory_limit,
                    cpu_period=100000,
                    cpu_quota=int(settings.sandbox_cpu_limit * 100000),
                    security_opt=["no-new-privileges"],
                    cap_drop=["ALL"],
                    remove=True,
                    stdout=True,
                    stderr=True,
                    detach=False,
                    environment={
                        "PYTHONUNBUFFERED": "1",
                        "HOME": "/tmp",
                    },
                )
                
                stdout = result.decode("utf-8", errors="replace")
                
                return {
                    "exit_code": 0,
                    "stdout": stdout,
                    "stderr": "",
                    "script": script_content,
                    "packages": pip_packages or [],
                }
                
            except docker.errors.ContainerError as e:
                return {
                    "exit_code": e.exit_status,
                    "stdout": e.stdout.decode("utf-8", errors="replace") if e.stdout else "",
                    "stderr": e.stderr.decode("utf-8", errors="replace") if e.stderr else str(e),
                    "script": script_content,
                    "packages": pip_packages or [],
                }
            except Exception as e:
                return {
                    "exit_code": 1,
                    "stdout": "",
                    "stderr": f"Script execution error: {str(e)}",
                    "script": script_content,
                    "packages": pip_packages or [],
                }
    
    async def run_command(
        self,
        job_id: UUID,
        command_id: str,
        tool: str,
        arguments: List[str],
        working_dir: Path,
    ) -> Dict:
        """Run a command in the sandbox container."""
        if not self.is_tool_allowed(tool):
            return {
                "exit_code": 1,
                "stdout": "",
                "stderr": f"Tool not allowed: {tool}",
                "error": True,
            }
        
        # Sanitize arguments
        safe_args = self._sanitize_arguments(arguments)
        
        # Build command
        cmd = [tool] + safe_args
        
        try:
            result = self.client.containers.run(
                image=settings.sandbox_image,
                command=cmd,
                volumes={
                    str(working_dir): {
                        "bind": "/workspace",
                        "mode": "ro",  # Read-only
                    }
                },
                working_dir="/workspace",
                network_disabled=True,
                user="1000:1000",  # Non-root user
                read_only=True,
                mem_limit=settings.sandbox_memory_limit,
                cpu_period=100000,
                cpu_quota=int(settings.sandbox_cpu_limit * 100000),
                security_opt=["no-new-privileges"],
                cap_drop=["ALL"],
                remove=True,
                stdout=True,
                stderr=True,
                detach=False,
            )
            
            # Decode output
            stdout = result.decode("utf-8", errors="replace")
            
            return {
                "exit_code": 0,
                "stdout": stdout,
                "stderr": "",
                "output_hash": f"sha256:{hashlib.sha256(result).hexdigest()}",
            }
            
        except docker.errors.ContainerError as e:
            return {
                "exit_code": e.exit_status,
                "stdout": e.stdout.decode("utf-8", errors="replace") if e.stdout else "",
                "stderr": e.stderr.decode("utf-8", errors="replace") if e.stderr else str(e),
            }
        except docker.errors.ImageNotFound:
            return {
                "exit_code": 1,
                "stdout": "",
                "stderr": f"Sandbox image not found: {settings.sandbox_image}",
                "error": True,
            }
        except Exception as e:
            return {
                "exit_code": 1,
                "stdout": "",
                "stderr": f"Sandbox error: {str(e)}",
                "error": True,
            }
    
    def _sanitize_arguments(self, arguments: List[str]) -> List[str]:
        """Sanitize command arguments."""
        safe_args = []
        
        for arg in arguments:
            # Remove any shell metacharacters
            # Only allow safe characters
            if arg.startswith("-"):
                # It's an option - allow alphanumeric and some safe chars
                safe_arg = "".join(c for c in arg if c.isalnum() or c in "-_=.")
            else:
                # It's a filename - sanitize path
                safe_arg = Path(arg).name  # Just the filename
                safe_arg = "".join(c for c in safe_arg if c.isalnum() or c in "-_.")
            
            if safe_arg:
                safe_args.append(safe_arg)
        
        return safe_args
    
    async def run_playbook(
        self,
        job_id: UUID,
        working_dir: Path,
        playbook: Dict,
    ) -> List[Dict]:
        """Run a series of commands from a playbook."""
        results = []
        
        for step in playbook.get("steps", []):
            tool = step.get("tool")
            args = step.get("arguments", [])
            
            # Replace placeholders in arguments
            processed_args = []
            for arg in args:
                if arg == "{files}":
                    # Get all files in working directory
                    for f in working_dir.iterdir():
                        if f.is_file():
                            processed_args.append(f.name)
                elif arg.startswith("{") and arg.endswith("}"):
                    continue  # Skip unknown placeholders
                else:
                    processed_args.append(arg)
            
            command_id = f"cmd_{len(results):03d}"
            result = await self.run_command(
                job_id=job_id,
                command_id=command_id,
                tool=tool,
                arguments=processed_args,
                working_dir=working_dir,
            )
            
            result["command_id"] = command_id
            result["tool"] = tool
            result["arguments"] = processed_args
            result["timestamp"] = datetime.utcnow().isoformat()
            
            results.append(result)
        
        return results
    
    def get_installed_python_packages(self) -> List[str]:
        """Get list of pre-installed Python packages in sandbox."""
        return [
            "pycryptodome",
            "pwntools", 
            "pillow",
            "pypdf2",
            "zsteg",
            "stegcracker",
            "name-that-hash",
            "search-that-hash",
            "ropper",
            "ROPgadget",
            "one_gadget",
            "z3-solver",
            "capstone",
            "keystone-engine",
            "unicorn",
            "volatility3",
            "r2pipe",
            # Standard library extras
            "requests",
            "numpy",
            "sympy",
            "gmpy2",
        ]
