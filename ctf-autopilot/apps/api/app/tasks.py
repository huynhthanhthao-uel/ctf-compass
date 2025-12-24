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
    
    if '.pcap' in extensions or '.pcapng' in extensions:
        return _load_playbook("network")
    elif '.pdf' in extensions:
        return _load_playbook("pdf")
    elif '.elf' in extensions or '.exe' in extensions or '.bin' in extensions:
        return _load_playbook("binary")
    elif '.png' in extensions or '.jpg' in extensions or '.gif' in extensions:
        return _load_playbook("forensics")
    elif '.zip' in extensions or '.tar' in extensions:
        return _load_playbook("archive")
    else:
        return _load_playbook("default")


def _load_playbook(name: str) -> dict:
    """Load playbook by name."""
    playbooks = {
        "default": {
            "name": "default",
            "steps": [
                {"tool": "file", "arguments": ["{files}"]},
                {"tool": "strings", "arguments": ["-n", "8", "{files}"]},
                {"tool": "xxd", "arguments": ["-l", "256", "{files}"]},
                {"tool": "sha256sum", "arguments": ["{files}"]},
            ]
        },
        "binary": {
            "name": "binary",
            "steps": [
                {"tool": "file", "arguments": ["{files}"]},
                {"tool": "readelf", "arguments": ["-h", "{files}"]},
                {"tool": "readelf", "arguments": ["-S", "{files}"]},
                {"tool": "strings", "arguments": ["-n", "8", "{files}"]},
                {"tool": "objdump", "arguments": ["-d", "-M", "intel", "{files}"]},
            ]
        },
        "pdf": {
            "name": "pdf",
            "steps": [
                {"tool": "file", "arguments": ["{files}"]},
                {"tool": "pdfinfo", "arguments": ["{files}"]},
                {"tool": "pdftotext", "arguments": ["{files}", "-"]},
                {"tool": "strings", "arguments": ["{files}"]},
                {"tool": "exiftool", "arguments": ["{files}"]},
            ]
        },
        "network": {
            "name": "network",
            "steps": [
                {"tool": "file", "arguments": ["{files}"]},
                {"tool": "tshark", "arguments": ["-r", "{files}", "-q", "-z", "io,stat,0"]},
                {"tool": "tshark", "arguments": ["-r", "{files}", "-Y", "http"]},
                {"tool": "tshark", "arguments": ["-r", "{files}", "-Y", "tcp.flags.syn==1"]},
                {"tool": "strings", "arguments": ["{files}"]},
            ]
        },
        "forensics": {
            "name": "forensics",
            "steps": [
                {"tool": "file", "arguments": ["{files}"]},
                {"tool": "exiftool", "arguments": ["{files}"]},
                {"tool": "binwalk", "arguments": ["{files}"]},
                {"tool": "strings", "arguments": ["{files}"]},
                {"tool": "xxd", "arguments": ["-l", "512", "{files}"]},
            ]
        },
        "archive": {
            "name": "archive",
            "steps": [
                {"tool": "file", "arguments": ["{files}"]},
                {"tool": "unzip", "arguments": ["-l", "{files}"]},
                {"tool": "strings", "arguments": ["{files}"]},
            ]
        },
    }
    
    return playbooks.get(name, playbooks["default"])
