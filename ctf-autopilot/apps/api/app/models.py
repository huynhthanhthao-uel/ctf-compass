from sqlalchemy import Column, String, Text, DateTime, Integer, Float, JSON, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
import enum

from app.database import Base


class JobStatus(str, enum.Enum):
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class Job(Base):
    __tablename__ = "jobs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    flag_format = Column(String(500), default=r"CTF\{[^}]+\}")
    status = Column(SQLEnum(JobStatus), default=JobStatus.PENDING)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    input_files = Column(JSON, default=list)
    commands_executed = Column(Integer, default=0)
    
    error_message = Column(Text, nullable=True)
    timeline = Column(JSON, default=list)


class Command(Base):
    __tablename__ = "commands"
    
    id = Column(String(50), primary_key=True)
    job_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    tool = Column(String(100), nullable=False)
    arguments = Column(JSON, default=list)
    
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    exit_code = Column(Integer, nullable=True)
    
    stdout = Column(Text, default="")
    stderr = Column(Text, default="")
    stdout_truncated = Column(Text, default="")  # First 10KB
    
    output_hash = Column(String(100), nullable=True)


class FlagCandidate(Base):
    __tablename__ = "flag_candidates"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    value = Column(String(500), nullable=False)
    confidence = Column(Float, default=0.5)
    source = Column(String(200), nullable=False)
    evidence_id = Column(String(50), nullable=True)
    context = Column(Text, nullable=True)


class Session(Base):
    __tablename__ = "sessions"
    
    id = Column(String(64), primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    csrf_token = Column(String(64), nullable=False)
