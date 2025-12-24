from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from uuid import UUID

from app.models import Job, JobStatus


class JobService:
    """Service for managing jobs."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_job(
        self,
        title: str,
        description: str,
        flag_format: str,
    ) -> Job:
        """Create a new job."""
        job = Job(
            title=title,
            description=description,
            flag_format=flag_format,
            status=JobStatus.PENDING,
            timeline=[{
                "timestamp": datetime.utcnow().isoformat(),
                "event": "Job created",
            }],
        )
        
        self.db.add(job)
        await self.db.commit()
        await self.db.refresh(job)
        
        return job
    
    async def update_status(
        self,
        job_id: UUID,
        status: JobStatus,
        event: str = None,
        error_message: str = None,
    ) -> None:
        """Update job status."""
        from sqlalchemy import select
        
        result = await self.db.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()
        
        if not job:
            return
        
        job.status = status
        
        if status == JobStatus.RUNNING and not job.started_at:
            job.started_at = datetime.utcnow()
        
        if status in [JobStatus.COMPLETED, JobStatus.FAILED]:
            job.completed_at = datetime.utcnow()
        
        if error_message:
            job.error_message = error_message
        
        if event:
            job.timeline = job.timeline + [{
                "timestamp": datetime.utcnow().isoformat(),
                "event": event,
            }]
        
        await self.db.commit()
    
    async def add_timeline_event(self, job_id: UUID, event: str) -> None:
        """Add event to job timeline."""
        from sqlalchemy import select
        
        result = await self.db.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()
        
        if job:
            job.timeline = job.timeline + [{
                "timestamp": datetime.utcnow().isoformat(),
                "event": event,
            }]
            await self.db.commit()
    
    async def increment_commands(self, job_id: UUID) -> None:
        """Increment executed commands counter."""
        from sqlalchemy import select
        
        result = await self.db.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()
        
        if job:
            job.commands_executed += 1
            await self.db.commit()
