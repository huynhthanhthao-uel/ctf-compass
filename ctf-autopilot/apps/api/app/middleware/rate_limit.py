from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from collections import defaultdict
from datetime import datetime, timedelta
import asyncio

from app.config import settings


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.requests: dict = defaultdict(list)
        self.lock = asyncio.Lock()
    
    async def dispatch(self, request: Request, call_next):
        client_ip = self._get_client_ip(request)
        path = request.url.path
        
        # Determine rate limit based on endpoint
        if path.startswith("/api/jobs") and request.method == "POST":
            limit = settings.rate_limit_uploads
        elif path.startswith("/api/auth/login"):
            limit = 5  # Strict limit for login
        else:
            limit = settings.rate_limit_api
        
        # Check rate limit
        async with self.lock:
            now = datetime.utcnow()
            window_start = now - timedelta(minutes=1)
            
            key = f"{client_ip}:{path}"
            self.requests[key] = [
                ts for ts in self.requests[key]
                if ts > window_start
            ]
            
            if len(self.requests[key]) >= limit:
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": "Too many requests. Please try again later.",
                        "code": "RATE_LIMITED",
                        "retry_after": 60,
                    },
                    headers={"Retry-After": "60"},
                )
            
            self.requests[key].append(now)
        
        return await call_next(request)
    
    def _get_client_ip(self, request: Request) -> str:
        # Check for proxy headers
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"
