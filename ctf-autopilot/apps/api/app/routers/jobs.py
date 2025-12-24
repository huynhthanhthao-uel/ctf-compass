from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from datetime import datetime
from uuid import UUID
from pathlib import Path
import zipfile
import io

from app.database import get_db
from app.models import Job, Command, FlagCandidate, JobStatus
from app.schemas import (
    JobCreate, JobSummary, JobDetail, JobListResponse,
    CommandListResponse, CommandResponse,
    ArtifactListResponse, ArtifactInfo, FlagCandidateResponse,
)
from app.routers.auth import get_current_session, verify_csrf
from app.services.file_service import FileService
from app.services.job_service import JobService
from app.tasks import run_analysis_task


router = APIRouter()


@router.post("", status_code=201, response_model=JobSummary)
async def create_job(
    title: str = Form(..., min_length=1, max_length=200),
    description: str = Form(..., max_length=10000),
    flag_format: str = Form(default=r"CTF\{[^}]+\}"),
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    _session = Depends(get_current_session),
    _csrf = Depends(verify_csrf),
):
    """Create a new analysis job."""
    # Validate files
    file_service = FileService()
    validated_files = []
    
    for file in files:
        try:
            await file_service.validate_file(file)
            validated_files.append(file)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    # Create job
    job_service = JobService(db)
    job = await job_service.create_job(
        title=title,
        description=description,
        flag_format=flag_format,
    )
    
    # Save files
    try:
        file_paths = await file_service.save_files(job.id, validated_files)
        job.input_files = file_paths
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save files: {e}")
    
    return job


@router.get("", response_model=JobListResponse)
async def list_jobs(
    status: Optional[JobStatus] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    _session = Depends(get_current_session),
):
    """List all jobs."""
    query = select(Job).order_by(Job.created_at.desc())
    
    if status:
        query = query.where(Job.status == status)
    
    # Get total count
    count_query = select(func.count()).select_from(Job)
    if status:
        count_query = count_query.where(Job.status == status)
    total = (await db.execute(count_query)).scalar()
    
    # Get paginated results
    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    jobs = result.scalars().all()
    
    return JobListResponse(
        jobs=[JobSummary.model_validate(j) for j in jobs],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{job_id}", response_model=JobDetail)
async def get_job(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    _session = Depends(get_current_session),
):
    """Get job details."""
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Get flag candidates
    candidates_result = await db.execute(
        select(FlagCandidate).where(FlagCandidate.job_id == job_id)
    )
    candidates = candidates_result.scalars().all()
    
    job_detail = JobDetail.model_validate(job)
    job_detail.flag_candidates = [
        FlagCandidateResponse.model_validate(c) for c in candidates
    ]
    
    return job_detail


@router.post("/{job_id}/run", status_code=202)
async def run_job(
    job_id: UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _session = Depends(get_current_session),
    _csrf = Depends(verify_csrf),
):
    """Start job execution."""
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.status not in [JobStatus.PENDING, JobStatus.FAILED]:
        raise HTTPException(
            status_code=400,
            detail=f"Job cannot be run in {job.status} status"
        )
    
    # Queue the job
    job.status = JobStatus.QUEUED
    job.timeline.append({
        "timestamp": datetime.utcnow().isoformat(),
        "event": "Job queued for execution"
    })
    await db.commit()
    
    # Trigger Celery task
    run_analysis_task.delay(str(job_id))
    
    return {"message": "Job queued for execution", "status": "queued"}


@router.get("/{job_id}/commands", response_model=CommandListResponse)
async def get_commands(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    _session = Depends(get_current_session),
):
    """Get executed commands."""
    result = await db.execute(
        select(Command)
        .where(Command.job_id == job_id)
        .order_by(Command.started_at)
    )
    commands = result.scalars().all()
    
    return CommandListResponse(
        commands=[CommandResponse.model_validate(c) for c in commands]
    )


@router.get("/{job_id}/artifacts", response_model=ArtifactListResponse)
async def get_artifacts(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    _session = Depends(get_current_session),
):
    """List job artifacts."""
    file_service = FileService()
    artifacts = await file_service.list_artifacts(job_id)
    
    return ArtifactListResponse(artifacts=artifacts)


@router.get("/{job_id}/download/report")
async def download_report(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    _session = Depends(get_current_session),
):
    """Download generated writeup."""
    file_service = FileService()
    report_path = file_service.get_report_path(job_id)
    
    if not report_path.exists():
        raise HTTPException(status_code=404, detail="Report not found")
    
    return FileResponse(
        path=report_path,
        filename=f"writeup_{job_id}.md",
        media_type="text/markdown",
    )


@router.get("/{job_id}/download/bundle")
async def download_bundle(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    _session = Depends(get_current_session),
):
    """Download all artifacts as zip."""
    file_service = FileService()
    job_dir = file_service.get_job_dir(job_id)
    
    if not job_dir.exists():
        raise HTTPException(status_code=404, detail="Job artifacts not found")
    
    # Create zip in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path in job_dir.rglob("*"):
            if file_path.is_file():
                arcname = file_path.relative_to(job_dir)
                zf.write(file_path, arcname)
    
    zip_buffer.seek(0)
    
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=job_{job_id}_bundle.zip"
        },
    )
