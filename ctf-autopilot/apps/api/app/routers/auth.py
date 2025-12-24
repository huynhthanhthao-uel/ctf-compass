from fastapi import APIRouter, Response, HTTPException, Depends, Cookie
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from datetime import datetime, timedelta
import secrets
import argon2

from app.database import get_db
from app.config import settings
from app.models import Session
from app.schemas import LoginRequest, LoginResponse


router = APIRouter()
ph = argon2.PasswordHasher()


def verify_password(password: str) -> bool:
    """Verify password against stored admin password."""
    return secrets.compare_digest(password, settings.admin_password)


async def get_current_session(
    session_id: str = Cookie(None, alias="session_id"),
    db: AsyncSession = Depends(get_db),
) -> Session:
    """Verify session is valid and not expired."""
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    result = await db.execute(
        select(Session).where(Session.id == session_id)
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    if session.expires_at < datetime.utcnow():
        await db.execute(delete(Session).where(Session.id == session_id))
        raise HTTPException(status_code=401, detail="Session expired")
    
    return session


def verify_csrf(
    session: Session = Depends(get_current_session),
    csrf_token: str = Cookie(None, alias="csrf_token"),
):
    """Verify CSRF token matches session."""
    if not csrf_token or not secrets.compare_digest(csrf_token, session.csrf_token):
        raise HTTPException(status_code=403, detail="Invalid CSRF token")
    return True


@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate and create session."""
    if not verify_password(request.password):
        raise HTTPException(status_code=401, detail="Invalid password")
    
    # Create session
    session_id = secrets.token_urlsafe(32)
    csrf_token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(seconds=settings.session_timeout_seconds)
    
    session = Session(
        id=session_id,
        expires_at=expires_at,
        csrf_token=csrf_token,
    )
    db.add(session)
    
    # Set cookies
    cookie_params = {
        "httponly": True,
        "samesite": "strict",
        "secure": settings.enable_tls,
        "max_age": settings.session_timeout_seconds,
    }
    
    response.set_cookie("session_id", session_id, **cookie_params)
    response.set_cookie("csrf_token", csrf_token, **{**cookie_params, "httponly": False})
    
    return LoginResponse(
        message="Login successful",
        expires_at=expires_at,
    )


@router.post("/logout")
async def logout(
    response: Response,
    session: Session = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
):
    """End current session."""
    await db.execute(delete(Session).where(Session.id == session.id))
    
    response.delete_cookie("session_id")
    response.delete_cookie("csrf_token")
    
    return {"message": "Logged out"}


@router.get("/me")
async def get_current_user(session: Session = Depends(get_current_session)):
    """Get current session info."""
    return {
        "authenticated": True,
        "expires_at": session.expires_at,
    }
