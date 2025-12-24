"""AI analysis API endpoints."""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from uuid import UUID

from app.services.ai_analysis_service import ai_analysis_service
from app.routers.auth import require_auth


router = APIRouter(prefix="/ai", tags=["AI Analysis"])


class CommandOutput(BaseModel):
    tool: str
    args: List[str] = []
    stdout: str = ""
    stderr: str = ""
    exit_code: int = 0


class AnalyzeRequest(BaseModel):
    job_id: str
    files: List[str]
    command_history: List[CommandOutput] = []
    description: str = ""
    flag_format: str = "CTF{...}"
    current_category: str = "unknown"
    attempt_number: int = 1


class NextCommand(BaseModel):
    tool: str
    args: List[str]
    reason: str


class AnalyzeResponse(BaseModel):
    analysis: str
    category: str
    confidence: float
    findings: List[str] = []
    next_commands: List[NextCommand] = []
    flag_candidates: List[str] = []
    should_continue: bool = True
    rule_based: bool = False


class DetectCategoryRequest(BaseModel):
    files: List[str]
    file_outputs: Dict[str, str] = {}
    strings_outputs: Dict[str, str] = {}


class DetectCategoryResponse(BaseModel):
    category: str
    confidence: float


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_outputs(request: AnalyzeRequest, _: None = Depends(require_auth)):
    """Analyze command outputs and suggest next steps using AI."""
    try:
        result = await ai_analysis_service.analyze_and_suggest(
            files=request.files,
            command_history=[cmd.model_dump() for cmd in request.command_history],
            description=request.description,
            flag_format=request.flag_format,
            current_category=request.current_category,
            attempt_number=request.attempt_number,
        )
        
        # Ensure next_commands are properly formatted
        next_commands = []
        for cmd in result.get("next_commands", []):
            if isinstance(cmd, dict) and "tool" in cmd:
                next_commands.append(NextCommand(
                    tool=cmd["tool"],
                    args=cmd.get("args", []),
                    reason=cmd.get("reason", ""),
                ))
        
        return AnalyzeResponse(
            analysis=result.get("analysis", ""),
            category=result.get("category", "unknown"),
            confidence=result.get("confidence", 0.5),
            findings=result.get("findings", []),
            next_commands=next_commands,
            flag_candidates=result.get("flag_candidates", []),
            should_continue=result.get("should_continue", True),
            rule_based=result.get("rule_based", False),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detect-category", response_model=DetectCategoryResponse)
async def detect_category(request: DetectCategoryRequest, _: None = Depends(require_auth)):
    """Detect challenge category from file analysis."""
    try:
        category, confidence = ai_analysis_service.detect_category(
            files=request.files,
            file_outputs=request.file_outputs,
            strings_outputs=request.strings_outputs,
        )
        
        return DetectCategoryResponse(
            category=category,
            confidence=confidence,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
