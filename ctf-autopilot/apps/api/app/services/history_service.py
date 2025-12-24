"""Service for managing analysis history and AI learning."""

from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID
import json

from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AnalysisSession, GlobalSolveHistory, Command, FlagCandidate


class HistoryService:
    """Service for managing analysis history and learning from past solutions."""
    
    async def create_session(
        self,
        db: AsyncSession,
        job_id: UUID,
        name: str = "Analysis Session",
        strategy: str = "auto",
    ) -> AnalysisSession:
        """Create a new analysis session."""
        session = AnalysisSession(
            job_id=job_id,
            name=name,
            strategy=strategy,
            started_at=datetime.utcnow(),
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return session
    
    async def update_session(
        self,
        db: AsyncSession,
        session_id: UUID,
        **updates,
    ) -> Optional[AnalysisSession]:
        """Update an analysis session."""
        result = await db.execute(
            select(AnalysisSession).where(AnalysisSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if session:
            for key, value in updates.items():
                if hasattr(session, key):
                    setattr(session, key, value)
            await db.commit()
            await db.refresh(session)
        
        return session
    
    async def end_session(
        self,
        db: AsyncSession,
        session_id: UUID,
        status: str = "completed",
        summary: str = None,
    ) -> Optional[AnalysisSession]:
        """End an analysis session and compute final stats."""
        result = await db.execute(
            select(AnalysisSession).where(AnalysisSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if session:
            session.status = status
            session.ended_at = datetime.utcnow()
            session.summary = summary
            
            # Count commands
            cmd_result = await db.execute(
                select(func.count(Command.id)).where(Command.session_id == session_id)
            )
            session.total_commands = cmd_result.scalar() or 0
            
            # Count successful commands
            success_result = await db.execute(
                select(func.count(Command.id)).where(
                    Command.session_id == session_id,
                    Command.exit_code == 0
                )
            )
            session.successful_commands = success_result.scalar() or 0
            
            # Count flags found
            flags_result = await db.execute(
                select(func.count(FlagCandidate.id)).where(
                    FlagCandidate.session_id == session_id
                )
            )
            session.flags_found_count = flags_result.scalar() or 0
            
            await db.commit()
            await db.refresh(session)
        
        return session
    
    async def get_job_sessions(
        self,
        db: AsyncSession,
        job_id: UUID,
        limit: int = 20,
    ) -> List[AnalysisSession]:
        """Get all analysis sessions for a job."""
        result = await db.execute(
            select(AnalysisSession)
            .where(AnalysisSession.job_id == job_id)
            .order_by(desc(AnalysisSession.started_at))
            .limit(limit)
        )
        return list(result.scalars().all())
    
    async def get_session_details(
        self,
        db: AsyncSession,
        session_id: UUID,
    ) -> Optional[Dict]:
        """Get detailed session info including commands and flags."""
        result = await db.execute(
            select(AnalysisSession).where(AnalysisSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if not session:
            return None
        
        # Get commands
        cmd_result = await db.execute(
            select(Command)
            .where(Command.session_id == session_id)
            .order_by(Command.executed_at)
        )
        commands = list(cmd_result.scalars().all())
        
        # Get flags
        flag_result = await db.execute(
            select(FlagCandidate).where(FlagCandidate.session_id == session_id)
        )
        flags = list(flag_result.scalars().all())
        
        return {
            "session": session,
            "commands": commands,
            "flags": flags,
        }
    
    async def add_ai_insight(
        self,
        db: AsyncSession,
        session_id: UUID,
        insight: Dict,
    ) -> None:
        """Add an AI insight to the session."""
        result = await db.execute(
            select(AnalysisSession).where(AnalysisSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if session:
            insights = session.ai_insights or []
            insights.append({
                **insight,
                "timestamp": datetime.utcnow().isoformat(),
            })
            session.ai_insights = insights
            session.ai_suggestions_used = (session.ai_suggestions_used or 0) + 1
            await db.commit()
    
    async def record_effective_tool(
        self,
        db: AsyncSession,
        session_id: UUID,
        tool: str,
        context: str = None,
    ) -> None:
        """Record a tool that produced useful results."""
        result = await db.execute(
            select(AnalysisSession).where(AnalysisSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if session:
            tools = session.effective_tools or []
            tools.append({
                "tool": tool,
                "context": context,
                "timestamp": datetime.utcnow().isoformat(),
            })
            session.effective_tools = tools
            await db.commit()
    
    async def save_to_global_history(
        self,
        db: AsyncSession,
        session: AnalysisSession,
        file_types: List[str],
        successful_tools: List[str],
        tool_sequence: List[str],
        keywords: List[str] = None,
    ) -> GlobalSolveHistory:
        """Save a successful solve to global history for AI learning."""
        
        # Calculate time to solve
        time_to_solve = None
        if session.started_at and session.ended_at:
            time_to_solve = int((session.ended_at - session.started_at).total_seconds())
        
        history = GlobalSolveHistory(
            category=session.detected_category or "misc",
            file_types=file_types,
            successful_tools=successful_tools,
            tool_sequence=tool_sequence,
            winning_strategy=session.strategy,
            time_to_solve_seconds=time_to_solve,
            total_commands=session.total_commands,
            keywords=keywords or [],
        )
        
        db.add(history)
        await db.commit()
        await db.refresh(history)
        return history
    
    async def get_similar_solves(
        self,
        db: AsyncSession,
        category: str,
        file_types: List[str],
        limit: int = 5,
    ) -> List[GlobalSolveHistory]:
        """Get similar past solves for AI learning."""
        
        # Query by category first
        result = await db.execute(
            select(GlobalSolveHistory)
            .where(GlobalSolveHistory.category == category)
            .order_by(desc(GlobalSolveHistory.created_at))
            .limit(limit * 2)
        )
        candidates = list(result.scalars().all())
        
        # Score by file type overlap
        def score_match(history: GlobalSolveHistory) -> int:
            history_types = set(history.file_types or [])
            query_types = set(file_types)
            return len(history_types & query_types)
        
        # Sort by match score
        candidates.sort(key=score_match, reverse=True)
        
        return candidates[:limit]
    
    async def get_recommended_tools(
        self,
        db: AsyncSession,
        category: str,
        file_types: List[str],
    ) -> List[Dict]:
        """Get tool recommendations based on past successful solves."""
        
        similar = await self.get_similar_solves(db, category, file_types, limit=10)
        
        # Aggregate tool usage
        tool_scores: Dict[str, int] = {}
        tool_contexts: Dict[str, List[str]] = {}
        
        for solve in similar:
            for tool in (solve.successful_tools or []):
                tool_scores[tool] = tool_scores.get(tool, 0) + 2
                
            for tool in (solve.tool_sequence or []):
                tool_scores[tool] = tool_scores.get(tool, 0) + 1
        
        # Sort by score
        recommendations = [
            {"tool": tool, "score": score, "reason": f"Used in {score} similar solves"}
            for tool, score in sorted(tool_scores.items(), key=lambda x: -x[1])
        ]
        
        return recommendations[:10]


history_service = HistoryService()
