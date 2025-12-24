from celery import Celery
from sqlalchemy import select
from sqlalchemy.orm import Session
from pathlib import Path
from uuid import UUID
import json
import asyncio

from app.config import settings
from app.database import AsyncSessionLocal
from app.models import Job, JobStatus, Command, FlagCandidate
from app.services.sandbox_service import SandboxService
from app.services.evidence_service import EvidenceService
from app.services.writeup_service import WriteupService
from app.services.job_service import JobService


celery_app = Celery(
    "ctf-autopilot",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=settings.sandbox_timeout_seconds * 20,  # Overall task limit
)


def run_async(coro):
    """Helper to run async code in Celery tasks."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(bind=True, max_retries=2)
def run_analysis_task(self, job_id: str):
    """Run analysis on uploaded files."""
    run_async(_run_analysis(job_id))


async def _run_analysis(job_id: str):
    """Async implementation of analysis task."""
    job_uuid = UUID(job_id)
    
    async with AsyncSessionLocal() as db:
        job_service = JobService(db)
        
        # Get job
        result = await db.execute(select(Job).where(Job.id == job_uuid))
        job = result.scalar_one_or_none()
        
        if not job:
            return
        
        try:
            # Update status to running
            await job_service.update_status(
                job_uuid,
                JobStatus.RUNNING,
                "Analysis started"
            )
            
            # Initialize services
            sandbox_service = SandboxService()
            evidence_service = EvidenceService()
            writeup_service = WriteupService()
            
            # Get job directory
            job_dir = Path(settings.runs_dir) / str(job_uuid)
            input_dir = job_dir / "input"
            extracted_dir = job_dir / "extracted"
            
            # Load appropriate playbook based on file types
            playbook = _select_playbook(job.input_files)
            
            await job_service.add_timeline_event(
                job_uuid,
                f"Selected playbook: {playbook.get('name', 'default')}"
            )
            
            # Determine working directory
            if extracted_dir.exists() and any(extracted_dir.iterdir()):
                working_dir = extracted_dir
            else:
                working_dir = input_dir
            
            # Run playbook
            command_results = await sandbox_service.run_playbook(
                job_uuid,
                working_dir,
                playbook,
            )
            
            # Save commands to database
            for result in command_results:
                cmd = Command(
                    id=result["command_id"],
                    job_id=job_uuid,
                    tool=result["tool"],
                    arguments=result["arguments"],
                    exit_code=result.get("exit_code"),
                    stdout=result.get("stdout", ""),
                    stderr=result.get("stderr", ""),
                    stdout_truncated=result.get("stdout", "")[:10000],
                    output_hash=result.get("output_hash"),
                )
                db.add(cmd)
                await job_service.increment_commands(job_uuid)
            
            await db.commit()
            
            await job_service.add_timeline_event(
                job_uuid,
                f"Executed {len(command_results)} commands"
            )
            
            # Extract flag candidates
            candidates = evidence_service.extract_flags(
                job_uuid,
                command_results,
                job.flag_format,
            )
            
            # Save candidates to database
            for candidate in candidates:
                flag = FlagCandidate(
                    job_id=job_uuid,
                    value=candidate["value"],
                    confidence=candidate["confidence"],
                    source=candidate["source"],
                    evidence_id=candidate.get("evidence_id"),
                    context=candidate.get("context"),
                )
                db.add(flag)
            
            await db.commit()
            
            await job_service.add_timeline_event(
                job_uuid,
                f"Found {len(candidates)} flag candidates"
            )
            
            # Save evidence files
            evidence_service.save_evidence(job_uuid, command_results, candidates)
            
            # Build evidence pack
            evidence_pack = evidence_service.build_evidence_pack(
                job_uuid,
                command_results,
                candidates,
            )
            
            # Generate writeup
            await job_service.add_timeline_event(job_uuid, "Generating writeup...")
            
            writeup = await writeup_service.generate_writeup(
                job_uuid,
                job.title,
                job.description,
                evidence_pack,
            )
            
            await job_service.add_timeline_event(job_uuid, "Writeup generated")
            
            # Mark as completed
            await job_service.update_status(
                job_uuid,
                JobStatus.COMPLETED,
                "Analysis completed successfully"
            )
            
        except Exception as e:
            await job_service.update_status(
                job_uuid,
                JobStatus.FAILED,
                f"Analysis failed: {str(e)}",
                error_message=str(e),
            )
            raise


def _select_playbook(files: list) -> dict:
    """Select appropriate playbook based on file types."""
    # Check file extensions
    extensions = set(Path(f).suffix.lower() for f in files)
    filenames = [Path(f).name.lower() for f in files]
    
    # Check for specific CTF categories
    if '.pcap' in extensions or '.pcapng' in extensions:
        return _load_playbook("network")
    elif '.pdf' in extensions:
        return _load_playbook("pdf")
    elif '.elf' in extensions or '.exe' in extensions or '.bin' in extensions or '.so' in extensions or '.dll' in extensions:
        return _load_playbook("pwn")  # Use pwn for binaries (includes reversing)
    elif '.pyc' in extensions or '.class' in extensions:
        return _load_playbook("reversing")
    elif '.png' in extensions or '.jpg' in extensions or '.jpeg' in extensions or '.gif' in extensions or '.bmp' in extensions:
        return _load_playbook("stego")
    elif '.wav' in extensions or '.mp3' in extensions or '.flac' in extensions:
        return _load_playbook("audio_stego")
    elif '.zip' in extensions or '.tar' in extensions or '.gz' in extensions or '.7z' in extensions or '.rar' in extensions:
        return _load_playbook("forensics")
    elif '.img' in extensions or '.raw' in extensions or '.dd' in extensions or '.mem' in extensions or '.vmem' in extensions:
        return _load_playbook("memory_forensics")
    elif '.enc' in extensions or '.aes' in extensions or '.rsa' in extensions or '.pem' in extensions or '.key' in extensions:
        return _load_playbook("crypto")
    elif '.html' in extensions or '.php' in extensions or '.js' in extensions:
        return _load_playbook("web")
    elif any('flag' in name or 'cipher' in name or 'secret' in name or 'encrypted' in name for name in filenames):
        return _load_playbook("crypto")
    else:
        return _load_playbook("default")


def _load_playbook(name: str) -> dict:
    """Load playbook by name."""
    playbooks = {
        # ========== DEFAULT PLAYBOOK ==========
        "default": {
            "name": "default",
            "description": "General analysis for unknown file types",
            "steps": [
                {"tool": "file", "arguments": ["{files}"]},
                {"tool": "exiftool", "arguments": ["{files}"]},
                {"tool": "strings", "arguments": ["-n", "8", "{files}"]},
                {"tool": "xxd", "arguments": ["-l", "512", "{files}"]},
                {"tool": "sha256sum", "arguments": ["{files}"]},
                {"tool": "binwalk", "arguments": ["-e", "{files}"]},
                {"tool": "grep", "arguments": ["-aoE", "(flag|FLAG|ctf|CTF|key|secret|password|hint)[{]?[a-zA-Z0-9_-]+[}]?", "{files}"]},
            ]
        },
        
        # ========== PWN / BINARY EXPLOITATION ==========
        "pwn": {
            "name": "pwn",
            "description": "Binary exploitation and vulnerability analysis",
            "steps": [
                # Basic info
                {"tool": "file", "arguments": ["{files}"]},
                {"tool": "checksec", "arguments": ["--file", "{files}"]},
                # ELF headers and sections
                {"tool": "readelf", "arguments": ["-h", "{files}"]},
                {"tool": "readelf", "arguments": ["-S", "{files}"]},
                {"tool": "readelf", "arguments": ["-s", "{files}"]},
                {"tool": "readelf", "arguments": ["-r", "{files}"]},
                # Symbols and functions
                {"tool": "nm", "arguments": ["-C", "{files}"]},
                # Disassembly
                {"tool": "objdump", "arguments": ["-d", "-M", "intel", "{files}"]},
                {"tool": "objdump", "arguments": ["-t", "{files}"]},
                # Radare2 analysis
                {"tool": "r2", "arguments": ["-q", "-c", "aaa;afl;pdf@main", "{files}"]},
                {"tool": "rabin2", "arguments": ["-I", "{files}"]},
                {"tool": "rabin2", "arguments": ["-i", "{files}"]},
                {"tool": "rabin2", "arguments": ["-z", "{files}"]},
                # ROP gadgets
                {"tool": "ropper", "arguments": ["--file", "{files}", "--search", "pop"]},
                # Strings
                {"tool": "strings", "arguments": ["-n", "8", "{files}"]},
                # Decompile (if available)
                {"tool": "retdec-decompiler", "arguments": ["{files}"]},
            ]
        },
        
        # ========== REVERSING ==========
        "reversing": {
            "name": "reversing",
            "description": "Reverse engineering and code analysis",
            "steps": [
                {"tool": "file", "arguments": ["{files}"]},
                {"tool": "checksec", "arguments": ["--file", "{files}"]},
                {"tool": "readelf", "arguments": ["-a", "{files}"]},
                {"tool": "nm", "arguments": ["-C", "{files}"]},
                {"tool": "objdump", "arguments": ["-d", "-M", "intel", "{files}"]},
                {"tool": "objdump", "arguments": ["-s", "-j", ".rodata", "{files}"]},
                # Radare2 deep analysis
                {"tool": "r2", "arguments": ["-q", "-c", "aaa;aflj;agCj", "{files}"]},
                {"tool": "r2", "arguments": ["-q", "-c", "aaa;pdf@main", "{files}"]},
                {"tool": "r2", "arguments": ["-q", "-c", "izj", "{files}"]},
                # Decompile
                {"tool": "retdec-decompiler", "arguments": ["{files}"]},
                {"tool": "strings", "arguments": ["-n", "6", "{files}"]},
                {"tool": "strings", "arguments": ["-e", "l", "{files}"]},  # Unicode
            ]
        },
        
        # ========== CRYPTO ==========
        "crypto": {
            "name": "crypto",
            "description": "Cryptography challenge analysis",
            "steps": [
                {"tool": "file", "arguments": ["{files}"]},
                {"tool": "xxd", "arguments": ["{files}"]},
                {"tool": "xxd", "arguments": ["-r", "-p", "{files}"]},
                # Identify hash types
                {"tool": "hash-identifier", "arguments": []},
                {"tool": "name-that-hash", "arguments": ["-f", "{files}"]},
                # Base encoding detection
                {"tool": "base64", "arguments": ["-d", "{files}"]},
                {"tool": "base32", "arguments": ["-d", "{files}"]},
                # OpenSSL analysis
                {"tool": "openssl", "arguments": ["asn1parse", "-in", "{files}"]},
                {"tool": "openssl", "arguments": ["rsa", "-in", "{files}", "-text", "-noout"]},
                {"tool": "openssl", "arguments": ["x509", "-in", "{files}", "-text", "-noout"]},
                # Frequency analysis
                {"tool": "python3", "arguments": ["-c", "import sys;from collections import Counter;d=open(sys.argv[1],'rb').read();print(Counter(d).most_common(30))", "{files}"]},
                {"tool": "strings", "arguments": ["{files}"]},
                # XOR brute force
                {"tool": "python3", "arguments": ["-c", "import sys;d=open(sys.argv[1],'rb').read()[:100];[print(f'Key {k}:',bytes(b^k for b in d)[:50]) for k in range(256)]", "{files}"]},
            ]
        },
        
        # ========== FORENSICS ==========
        "forensics": {
            "name": "forensics",
            "description": "Digital forensics and file carving",
            "steps": [
                {"tool": "file", "arguments": ["{files}"]},
                {"tool": "exiftool", "arguments": ["-a", "-u", "-g1", "{files}"]},
                # Archive analysis
                {"tool": "zipinfo", "arguments": ["{files}"]},
                {"tool": "unzip", "arguments": ["-l", "{files}"]},
                {"tool": "7z", "arguments": ["l", "{files}"]},
                # Binwalk extraction
                {"tool": "binwalk", "arguments": ["-e", "-M", "{files}"]},
                {"tool": "binwalk", "arguments": ["--entropy", "{files}"]},
                # File carving
                {"tool": "foremost", "arguments": ["-v", "-i", "{files}"]},
                # Strings and hidden data
                {"tool": "strings", "arguments": ["-n", "6", "{files}"]},
                {"tool": "strings", "arguments": ["-e", "l", "{files}"]},
                {"tool": "strings", "arguments": ["-e", "b", "{files}"]},
                # Hex analysis
                {"tool": "xxd", "arguments": ["{files}"]},
                {"tool": "sha256sum", "arguments": ["{files}"]},
                {"tool": "md5sum", "arguments": ["{files}"]},
            ]
        },
        
        # ========== MEMORY FORENSICS ==========
        "memory_forensics": {
            "name": "memory_forensics",
            "description": "Memory dump analysis",
            "steps": [
                {"tool": "file", "arguments": ["{files}"]},
                {"tool": "strings", "arguments": ["-n", "10", "{files}"]},
                # Volatility analysis
                {"tool": "volatility", "arguments": ["-f", "{files}", "imageinfo"]},
                {"tool": "volatility", "arguments": ["-f", "{files}", "pslist"]},
                {"tool": "volatility", "arguments": ["-f", "{files}", "pstree"]},
                {"tool": "volatility", "arguments": ["-f", "{files}", "cmdline"]},
                {"tool": "volatility", "arguments": ["-f", "{files}", "filescan"]},
                {"tool": "volatility", "arguments": ["-f", "{files}", "netscan"]},
                {"tool": "volatility", "arguments": ["-f", "{files}", "hashdump"]},
                {"tool": "volatility", "arguments": ["-f", "{files}", "hivelist"]},
                {"tool": "bulk_extractor", "arguments": ["-o", "bulk_out", "{files}"]},
            ]
        },
        
        # ========== STEGANOGRAPHY (IMAGE) ==========
        "stego": {
            "name": "stego",
            "description": "Image steganography analysis",
            "steps": [
                {"tool": "file", "arguments": ["{files}"]},
                {"tool": "exiftool", "arguments": ["-a", "-u", "-g1", "{files}"]},
                {"tool": "identify", "arguments": ["-verbose", "{files}"]},
                # Steganography tools
                {"tool": "zsteg", "arguments": ["-a", "{files}"]},
                {"tool": "steghide", "arguments": ["info", "{files}"]},
                {"tool": "steghide", "arguments": ["extract", "-sf", "{files}", "-p", ""]},
                {"tool": "stegseek", "arguments": ["{files}"]},
                # Binwalk for embedded files
                {"tool": "binwalk", "arguments": ["-e", "{files}"]},
                # Strings in image
                {"tool": "strings", "arguments": ["-n", "8", "{files}"]},
                # LSB analysis
                {"tool": "python3", "arguments": ["-c", "from PIL import Image;import sys;img=Image.open(sys.argv[1]);d=list(img.getdata());print('LSB:',''.join(str(p[0]&1) for p in d[:1000]))", "{files}"]},
                # PNG specific
                {"tool": "pngcheck", "arguments": ["-v", "{files}"]},
                # Hex header analysis
                {"tool": "xxd", "arguments": ["-l", "100", "{files}"]},
            ]
        },
        
        # ========== AUDIO STEGANOGRAPHY ==========
        "audio_stego": {
            "name": "audio_stego",
            "description": "Audio steganography and analysis",
            "steps": [
                {"tool": "file", "arguments": ["{files}"]},
                {"tool": "exiftool", "arguments": ["{files}"]},
                {"tool": "ffprobe", "arguments": ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", "{files}"]},
                # Sox analysis
                {"tool": "sox", "arguments": ["{files}", "-n", "stat"]},
                {"tool": "sox", "arguments": ["{files}", "-n", "spectrogram", "-o", "spectrogram.png"]},
                # Convert to WAV for analysis
                {"tool": "ffmpeg", "arguments": ["-i", "{files}", "-f", "wav", "-"]},
                {"tool": "strings", "arguments": ["-n", "8", "{files}"]},
                # Morse code detection
                {"tool": "python3", "arguments": ["-c", "import wave;import sys;w=wave.open(sys.argv[1],'rb');print('Channels:',w.getnchannels(),'Rate:',w.getframerate(),'Frames:',w.getnframes())", "{files}"]},
                {"tool": "xxd", "arguments": ["-l", "256", "{files}"]},
            ]
        },
        
        # ========== NETWORK / PCAP ==========
        "network": {
            "name": "network",
            "description": "Network traffic and PCAP analysis",
            "steps": [
                {"tool": "file", "arguments": ["{files}"]},
                # Tshark overview
                {"tool": "tshark", "arguments": ["-r", "{files}", "-q", "-z", "io,stat,0"]},
                {"tool": "tshark", "arguments": ["-r", "{files}", "-q", "-z", "conv,tcp"]},
                {"tool": "tshark", "arguments": ["-r", "{files}", "-q", "-z", "http,tree"]},
                {"tool": "tshark", "arguments": ["-r", "{files}", "-q", "-z", "dns,tree"]},
                # Protocol filters
                {"tool": "tshark", "arguments": ["-r", "{files}", "-Y", "http"]},
                {"tool": "tshark", "arguments": ["-r", "{files}", "-Y", "dns"]},
                {"tool": "tshark", "arguments": ["-r", "{files}", "-Y", "ftp"]},
                {"tool": "tshark", "arguments": ["-r", "{files}", "-Y", "smtp"]},
                {"tool": "tshark", "arguments": ["-r", "{files}", "-Y", "tcp.flags.syn==1"]},
                # Extract HTTP objects
                {"tool": "tshark", "arguments": ["-r", "{files}", "--export-objects", "http,http_objects/"]},
                # SSL/TLS info
                {"tool": "tshark", "arguments": ["-r", "{files}", "-Y", "ssl.handshake"]},
                # Follow TCP streams
                {"tool": "tshark", "arguments": ["-r", "{files}", "-q", "-z", "follow,tcp,ascii,0"]},
                {"tool": "strings", "arguments": ["-n", "10", "{files}"]},
            ]
        },
        
        # ========== WEB ==========
        "web": {
            "name": "web",
            "description": "Web challenge file analysis",
            "steps": [
                {"tool": "file", "arguments": ["{files}"]},
                # HTML/JS/PHP analysis
                {"tool": "cat", "arguments": ["{files}"]},
                {"tool": "grep", "arguments": ["-i", "flag", "{files}"]},
                {"tool": "grep", "arguments": ["-i", "password", "{files}"]},
                {"tool": "grep", "arguments": ["-i", "secret", "{files}"]},
                {"tool": "grep", "arguments": ["-oE", "https?://[^\"' >]+", "{files}"]},
                # JavaScript analysis
                {"tool": "grep", "arguments": ["-oE", "eval\\([^)]+\\)", "{files}"]},
                {"tool": "grep", "arguments": ["-oE", "atob\\([^)]+\\)", "{files}"]},
                {"tool": "grep", "arguments": ["-oE", "btoa\\([^)]+\\)", "{files}"]},
                # Base64 in source
                {"tool": "grep", "arguments": ["-oE", "[A-Za-z0-9+/]{20,}={0,2}", "{files}"]},
                # PHP backdoors
                {"tool": "grep", "arguments": ["-E", "(eval|exec|system|passthru|shell_exec|base64_decode)", "{files}"]},
                {"tool": "strings", "arguments": ["{files}"]},
                {"tool": "xxd", "arguments": ["-l", "256", "{files}"]},
            ]
        },
        
        # ========== PDF ==========
        "pdf": {
            "name": "pdf",
            "description": "PDF document analysis",
            "steps": [
                {"tool": "file", "arguments": ["{files}"]},
                {"tool": "pdfinfo", "arguments": ["{files}"]},
                {"tool": "pdftotext", "arguments": ["{files}", "-"]},
                {"tool": "pdftotext", "arguments": ["-layout", "{files}", "-"]},
                {"tool": "pdfimages", "arguments": ["-list", "{files}"]},
                {"tool": "pdfimages", "arguments": ["-all", "{files}", "pdf_images"]},
                {"tool": "exiftool", "arguments": ["-a", "-u", "{files}"]},
                {"tool": "strings", "arguments": ["{files}"]},
                # PDF structure
                {"tool": "grep", "arguments": ["-a", "JavaScript", "{files}"]},
                {"tool": "grep", "arguments": ["-a", "/OpenAction", "{files}"]},
                {"tool": "grep", "arguments": ["-a", "stream", "{files}"]},
                {"tool": "binwalk", "arguments": ["-e", "{files}"]},
                {"tool": "xxd", "arguments": ["-l", "512", "{files}"]},
            ]
        },
    }
    
    return playbooks.get(name, playbooks["default"])
