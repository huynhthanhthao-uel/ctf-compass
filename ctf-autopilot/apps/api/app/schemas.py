from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from datetime import datetime
from uuid import UUID
import re

from app.models import JobStatus


# Auth
class LoginRequest(BaseModel):
    password: str = Field(..., min_length=1)


class LoginResponse(BaseModel):
    message: str
    expires_at: datetime


# Jobs
class JobCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., max_length=10000)
    flag_format: str = Field(default=r"CTF\{[^}]+\}", max_length=500)
    
    @field_validator('flag_format')
    @classmethod
    def validate_regex(cls, v: str) -> str:
        try:
            re.compile(v)
        except re.error as e:
            raise ValueError(f'Invalid regex pattern: {e}')
        return v


class TimelineEvent(BaseModel):
    timestamp: datetime
    event: str


class JobSummary(BaseModel):
    id: UUID
    title: str
    status: JobStatus
    created_at: datetime
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class FlagCandidateResponse(BaseModel):
    value: str
    confidence: float
    source: str
    evidence_id: Optional[str] = None
    
    class Config:
        from_attributes = True


class JobDetail(BaseModel):
    id: UUID
    title: str
    description: str
    flag_format: str
    status: JobStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    input_files: List[str]
    commands_executed: int
    error_message: Optional[str] = None
    timeline: List[TimelineEvent]
    flag_candidates: List[FlagCandidateResponse] = []
    
    class Config:
        from_attributes = True


class JobListResponse(BaseModel):
    jobs: List[JobSummary]
    total: int
    limit: int
    offset: int


# Commands
class CommandResponse(BaseModel):
    id: str
    tool: str
    arguments: List[str]
    started_at: datetime
    completed_at: Optional[datetime] = None
    exit_code: Optional[int] = None
    stdout: str
    stderr: str
    output_hash: Optional[str] = None
    
    class Config:
        from_attributes = True


class CommandListResponse(BaseModel):
    commands: List[CommandResponse]


# Artifacts
class ArtifactInfo(BaseModel):
    path: str
    size: int
    type: str
    hash: Optional[str] = None


class ArtifactListResponse(BaseModel):
    artifacts: List[ArtifactInfo]


# Config
class ConfigResponse(BaseModel):
    max_upload_size_mb: int
    sandbox_timeout_seconds: int
    allowed_extensions: List[str]
    allowed_tools: List[str]


class ConfigUpdate(BaseModel):
    max_upload_size_mb: Optional[int] = Field(None, ge=1, le=1000)
    sandbox_timeout_seconds: Optional[int] = Field(None, ge=10, le=600)


# Errors
class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
