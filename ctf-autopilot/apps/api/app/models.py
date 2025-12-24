from sqlalchemy import Column, String, Text, DateTime, Integer, Float, JSON, Enum as SQLEnum, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
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
    category = Column(String(50), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    input_files = Column(JSON, default=list)
    commands_executed = Column(Integer, default=0)
    
    error_message = Column(Text, nullable=True)
    timeline = Column(JSON, default=list)
    
    # Relationships
    analysis_sessions = relationship("AnalysisSession", back_populates="job", cascade="all, delete-orphan")


class Command(Base):
    __tablename__ = "commands"
    
    id = Column(String(50), primary_key=True)
    job_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("analysis_sessions.id"), nullable=True)
    
    tool = Column(String(100), nullable=False)
    arguments = Column(JSON, default=list)
    
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    exit_code = Column(Integer, nullable=True)
    
    stdout = Column(Text, default="")
    stderr = Column(Text, default="")
    stdout_truncated = Column(Text, default="")
    duration_ms = Column(Integer, default=0)
    
    output_hash = Column(String(100), nullable=True)
    
    # Relationships
    session = relationship("AnalysisSession", back_populates="commands")


class FlagCandidate(Base):
    __tablename__ = "flag_candidates"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("analysis_sessions.id"), nullable=True)
    
    value = Column(String(500), nullable=False)
    confidence = Column(Float, default=0.5)
    source = Column(String(200), nullable=False)
    evidence_id = Column(String(50), nullable=True)
    context = Column(Text, nullable=True)
    
    is_verified = Column(Boolean, default=False)
    verified_at = Column(DateTime, nullable=True)
    
    # Relationships
    session = relationship("AnalysisSession", back_populates="flags_found")


class Session(Base):
    __tablename__ = "sessions"
    
    id = Column(String(64), primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    csrf_token = Column(String(64), nullable=False)


class AnalysisSession(Base):
    """Represents a single analysis attempt/run for a job."""
    __tablename__ = "analysis_sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    
    # Session metadata
    name = Column(String(255), default="Analysis Session")
    strategy = Column(String(100), nullable=True)  # auto, manual, custom
    detected_category = Column(String(50), nullable=True)
    
    # Status
    status = Column(String(50), default="running")  # running, completed, stopped, failed
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    
    # Results
    total_commands = Column(Integer, default=0)
    successful_commands = Column(Integer, default=0)
    flags_found_count = Column(Integer, default=0)
    
    # AI analysis data
    ai_insights = Column(JSON, default=list)
    ai_suggestions_used = Column(Integer, default=0)
    
    # Learning data
    effective_tools = Column(JSON, default=list)
    effective_patterns = Column(JSON, default=list)
    
    # Notes
    notes = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    
    # Relationships
    job = relationship("Job", back_populates="analysis_sessions")
    commands = relationship("Command", back_populates="session")
    flags_found = relationship("FlagCandidate", back_populates="session")


class GlobalSolveHistory(Base):
    """Global history of solved challenges for AI learning."""
    __tablename__ = "global_solve_history"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Challenge info
    category = Column(String(50), nullable=False)
    file_types = Column(JSON, default=list)
    difficulty_estimate = Column(String(20), nullable=True)
    
    # Solution data
    successful_tools = Column(JSON, default=list)
    tool_sequence = Column(JSON, default=list)
    key_patterns = Column(JSON, default=list)
    
    # Strategy info
    winning_strategy = Column(String(100), nullable=True)
    time_to_solve_seconds = Column(Integer, nullable=True)
    total_commands = Column(Integer, default=0)
    
    # Searchable hints
    keywords = Column(JSON, default=list)
    flag_format = Column(String(100), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
