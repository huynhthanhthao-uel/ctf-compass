from pathlib import Path
from typing import List, Dict, Optional, Tuple
from uuid import UUID
from datetime import datetime
import subprocess
import hashlib
import docker
import tempfile
import os

from app.config import settings


class SandboxService:
    """Service for running analysis tools in isolated containers."""
    
    # Allowlist of safe analysis tools for CTF challenges
    allowed_tools: List[str] = [
        # Binary analysis
        "strings",
        "file",
        "readelf",
        "objdump",
        "nm",
        "size",
        "ldd",
        "checksec",
        
        # Hex/Binary viewing
        "xxd",
        "hexdump",
        "od",
        
        # Encoding/Decoding
        "base64",
        "base32",
        "openssl",
        
        # Image/Media forensics
        "exiftool",
        "identify",
        "convert",
        "steghide",
        "zsteg",
        "stegseek",
        "foremost",
        "binwalk",
        
        # PDF analysis
        "pdfinfo",
        "pdftotext",
        "pdfimages",
        "pdftk",
        
        # Network analysis
        "tshark",
        "tcpdump",
        "ssldump",
        
        # Archive handling
        "unzip",
        "zipinfo",
        "tar",
        "gzip",
        "gunzip",
        "bzip2",
        "xz",
        "7z",
        "unrar",
        "cabextract",
        
        # Text processing
        "head",
        "tail",
        "cat",
        "wc",
        "grep",
        "egrep",
        "awk",
        "gawk",
        "sed",
        "cut",
        "sort",
        "uniq",
        "tr",
        "rev",
        
        # File system
        "find",
        "ls",
        "stat",
        "file",
        
        # Hashing
        "sha256sum",
        "sha1sum",
        "md5sum",
        "sha512sum",
        "cksum",
        
        # Python for scripting
        "python3",
        
        # Crypto analysis
        "john",
        "hashcat",
        "hash-identifier",
        "name-that-hash",
        "nth",
        "fcrackzip",
        
        # Memory/Disk forensics
        "volatility",
        "volatility3",
        "bulk_extractor",
        "photorec",
        "testdisk",
        
        # Reverse engineering
        "radare2",
        "r2",
        "rabin2",
        "rasm2",
        "rafind2",
        "rahash2",
        "r2pipe",
        # Decompiler
        "retdec-decompiler",
        "retdec-fileinfo",
        "retdec-unpacker",
        # ROP/Exploit tools
        "ropper",
        "ROPgadget",
        "one_gadget",
        "checksec",
        "patchelf",
        
        # Debugging
        "gdb",
        "ltrace",
        "strace",
        "objcopy",
        
        # QR/Barcode
        "zbarimg",
        "zxing",
        
        # Image analysis
        "pngcheck",
        "pngcrush",
        "optipng",
        
        # Audio analysis
        "sox",
        "ffmpeg",
        "ffprobe",
        "audacity",
        
        # Misc utilities
        "jq",
        "yq",
        "xmllint",
        "curl",
        "wget",
        "nc",
        "ncat",
        "xxd",
        "od",
        "hexdump",
        "dd",
        "split",
        "file",
        "stat",
    ]
    
    def __init__(self):
        self.client = docker.from_env()
    
    def is_tool_allowed(self, tool: str) -> bool:
        """Check if tool is in allowlist."""
        # Get just the command name, not the path
        tool_name = Path(tool).name
        return tool_name in self.allowed_tools
    
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
