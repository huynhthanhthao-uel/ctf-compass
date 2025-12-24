"""History API endpoints."""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.history_service import history_service
from app.routers.auth import require_auth


router = APIRouter(prefix="/history", tags=["Analysis History"])


# ============ Request/Response Models ============

class CreateSessionRequest(BaseModel):
    job_id: str
    name: str = "Analysis Session"
    strategy: str = "auto"


class UpdateSessionRequest(BaseModel):
    detected_category: Optional[str] = None
    notes: Optional[str] = None
    ai_insights: Optional[List[Dict]] = None
    effective_tools: Optional[List[Dict]] = None


class EndSessionRequest(BaseModel):
    status: str = "completed"
    summary: Optional[str] = None


class AddInsightRequest(BaseModel):
    analysis: str
    category: str
    confidence: float
    findings: List[str] = []
    next_commands: List[Dict] = []


class RecordToolRequest(BaseModel):
    tool: str
    context: Optional[str] = None


class SaveToGlobalRequest(BaseModel):
    file_types: List[str]
    successful_tools: List[str]
    tool_sequence: List[str]
    keywords: List[str] = []


class RecommendToolsRequest(BaseModel):
    category: str
    file_types: List[str]


class SessionResponse(BaseModel):
    id: str
    job_id: str
    name: str
    strategy: Optional[str]
    detected_category: Optional[str]
    status: str
    started_at: datetime
    ended_at: Optional[datetime]
    total_commands: int
    successful_commands: int
    flags_found_count: int
    ai_suggestions_used: int
    notes: Optional[str]
    summary: Optional[str]
    
    class Config:
        from_attributes = True


class SessionListResponse(BaseModel):
    sessions: List[SessionResponse]
    total: int


class CommandSummary(BaseModel):
    id: str
    tool: str
    arguments: List[str]
    exit_code: Optional[int]
    stdout_preview: str
    executed_at: datetime
    duration_ms: int


class FlagSummary(BaseModel):
    id: str
    value: str
    confidence: float
    source: Optional[str]


class SessionDetailResponse(BaseModel):
    session: SessionResponse
    commands: List[CommandSummary]
    flags: List[FlagSummary]
    ai_insights: List[Dict]
    effective_tools: List[Dict]


class ToolRecommendation(BaseModel):
    tool: str
    score: int
    reason: str


class SimilarSolveResponse(BaseModel):
    id: str
    category: str
    file_types: List[str]
    successful_tools: List[str]
    tool_sequence: List[str]
    time_to_solve_seconds: Optional[int]
    total_commands: int


# ============ Endpoints ============

@router.post("/sessions", response_model=SessionResponse)
async def create_session(
    request: CreateSessionRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    """Create a new analysis session."""
    try:
        session = await history_service.create_session(
            db,
            job_id=UUID(request.job_id),
            name=request.name,
            strategy=request.strategy,
        )
        return SessionResponse(
            id=str(session.id),
            job_id=str(session.job_id),
            name=session.name,
            strategy=session.strategy,
            detected_category=session.detected_category,
            status=session.status,
            started_at=session.started_at,
            ended_at=session.ended_at,
            total_commands=session.total_commands or 0,
            successful_commands=session.successful_commands or 0,
            flags_found_count=session.flags_found_count or 0,
            ai_suggestions_used=session.ai_suggestions_used or 0,
            notes=session.notes,
            summary=session.summary,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{job_id}", response_model=SessionListResponse)
async def get_job_sessions(
    job_id: str,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    """Get all analysis sessions for a job."""
    try:
        sessions = await history_service.get_job_sessions(
            db, UUID(job_id), limit=limit
        )
        return SessionListResponse(
            sessions=[
                SessionResponse(
                    id=str(s.id),
                    job_id=str(s.job_id),
                    name=s.name,
                    strategy=s.strategy,
                    detected_category=s.detected_category,
                    status=s.status,
                    started_at=s.started_at,
                    ended_at=s.ended_at,
                    total_commands=s.total_commands or 0,
                    successful_commands=s.successful_commands or 0,
                    flags_found_count=s.flags_found_count or 0,
                    ai_suggestions_used=s.ai_suggestions_used or 0,
                    notes=s.notes,
                    summary=s.summary,
                )
                for s in sessions
            ],
            total=len(sessions),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{job_id}/{session_id}", response_model=SessionDetailResponse)
async def get_session_details(
    job_id: str,
    session_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    """Get detailed session info including commands and flags."""
    try:
        details = await history_service.get_session_details(db, UUID(session_id))
        
        if not details:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session = details["session"]
        commands = details["commands"]
        flags = details["flags"]
        
        return SessionDetailResponse(
            session=SessionResponse(
                id=str(session.id),
                job_id=str(session.job_id),
                name=session.name,
                strategy=session.strategy,
                detected_category=session.detected_category,
                status=session.status,
                started_at=session.started_at,
                ended_at=session.ended_at,
                total_commands=session.total_commands or 0,
                successful_commands=session.successful_commands or 0,
                flags_found_count=session.flags_found_count or 0,
                ai_suggestions_used=session.ai_suggestions_used or 0,
                notes=session.notes,
                summary=session.summary,
            ),
            commands=[
                CommandSummary(
                    id=str(cmd.id),
                    tool=cmd.tool,
                    arguments=cmd.arguments or [],
                    exit_code=cmd.exit_code,
                    stdout_preview=(cmd.stdout or "")[:500],
                    executed_at=cmd.executed_at,
                    duration_ms=cmd.duration_ms or 0,
                )
                for cmd in commands
            ],
            flags=[
                FlagSummary(
                    id=str(flag.id),
                    value=flag.value,
                    confidence=flag.confidence,
                    source=flag.source,
                )
                for flag in flags
            ],
            ai_insights=session.ai_insights or [],
            effective_tools=session.effective_tools or [],
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/sessions/{session_id}")
async def update_session(
    session_id: str,
    request: UpdateSessionRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    """Update an analysis session."""
    try:
        updates = request.model_dump(exclude_none=True)
        session = await history_service.update_session(db, UUID(session_id), **updates)
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return {"message": "Session updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sessions/{session_id}/end")
async def end_session(
    session_id: str,
    request: EndSessionRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    """End an analysis session."""
    try:
        session = await history_service.end_session(
            db, UUID(session_id), 
            status=request.status,
            summary=request.summary,
        )
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return {"message": "Session ended", "session_id": str(session.id)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sessions/{session_id}/insight")
async def add_insight(
    session_id: str,
    request: AddInsightRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    """Add an AI insight to the session."""
    try:
        await history_service.add_ai_insight(
            db, UUID(session_id), request.model_dump()
        )
        return {"message": "Insight added"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sessions/{session_id}/effective-tool")
async def record_effective_tool(
    session_id: str,
    request: RecordToolRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    """Record a tool that produced useful results."""
    try:
        await history_service.record_effective_tool(
            db, UUID(session_id), request.tool, request.context
        )
        return {"message": "Tool recorded"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sessions/{session_id}/save-global")
async def save_to_global_history(
    session_id: str,
    request: SaveToGlobalRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    """Save a successful solve to global history for AI learning."""
    try:
        # Get session
        details = await history_service.get_session_details(db, UUID(session_id))
        if not details:
            raise HTTPException(status_code=404, detail="Session not found")
        
        history = await history_service.save_to_global_history(
            db,
            details["session"],
            file_types=request.file_types,
            successful_tools=request.successful_tools,
            tool_sequence=request.tool_sequence,
            keywords=request.keywords,
        )
        return {"message": "Saved to global history", "id": str(history.id)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/recommend-tools", response_model=List[ToolRecommendation])
async def recommend_tools(
    request: RecommendToolsRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    """Get tool recommendations based on past successful solves."""
    try:
        recommendations = await history_service.get_recommended_tools(
            db, request.category, request.file_types
        )
        return [ToolRecommendation(**r) for r in recommendations]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/similar-solves", response_model=List[SimilarSolveResponse])
async def get_similar_solves(
    request: RecommendToolsRequest,
    limit: int = 5,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_auth),
):
    """Get similar past solves for reference."""
    try:
        solves = await history_service.get_similar_solves(
            db, request.category, request.file_types, limit=limit
        )
        return [
            SimilarSolveResponse(
                id=str(s.id),
                category=s.category,
                file_types=s.file_types or [],
                successful_tools=s.successful_tools or [],
                tool_sequence=s.tool_sequence or [],
                time_to_solve_seconds=s.time_to_solve_seconds,
                total_commands=s.total_commands or 0,
            )
            for s in solves
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
