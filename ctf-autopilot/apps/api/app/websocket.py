"""WebSocket manager for real-time job updates."""
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json
import asyncio


class ConnectionManager:
    """Manages WebSocket connections for real-time updates."""
    
    def __init__(self):
        # Map of job_id -> set of connected WebSockets
        self.job_connections: Dict[str, Set[WebSocket]] = {}
        # Set of connections subscribed to all job updates
        self.global_connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()
    
    async def connect_global(self, websocket: WebSocket):
        """Connect a client to receive all job updates."""
        await websocket.accept()
        async with self._lock:
            self.global_connections.add(websocket)
        print(f"[WS] Global client connected. Total: {len(self.global_connections)}")
    
    async def connect_job(self, websocket: WebSocket, job_id: str):
        """Connect a client to a specific job's updates."""
        await websocket.accept()
        async with self._lock:
            if job_id not in self.job_connections:
                self.job_connections[job_id] = set()
            self.job_connections[job_id].add(websocket)
        print(f"[WS] Client connected to job {job_id}. Total: {len(self.job_connections.get(job_id, set()))}")
    
    async def disconnect_global(self, websocket: WebSocket):
        """Disconnect a global client."""
        async with self._lock:
            self.global_connections.discard(websocket)
        print(f"[WS] Global client disconnected. Total: {len(self.global_connections)}")
    
    async def disconnect_job(self, websocket: WebSocket, job_id: str):
        """Disconnect a client from a job."""
        async with self._lock:
            if job_id in self.job_connections:
                self.job_connections[job_id].discard(websocket)
                if not self.job_connections[job_id]:
                    del self.job_connections[job_id]
        print(f"[WS] Client disconnected from job {job_id}")
    
    async def broadcast_job_update(self, job_id: str, data: dict):
        """Send job update to all connected clients."""
        message = json.dumps({
            "type": "job_update",
            "job_id": job_id,
            "data": data,
        })
        
        disconnected = []
        
        # Send to job-specific connections
        async with self._lock:
            job_clients = list(self.job_connections.get(job_id, set()))
            global_clients = list(self.global_connections)
        
        for websocket in job_clients:
            try:
                await websocket.send_text(message)
            except Exception:
                disconnected.append(("job", job_id, websocket))
        
        # Send to global connections
        for websocket in global_clients:
            try:
                await websocket.send_text(message)
            except Exception:
                disconnected.append(("global", None, websocket))
        
        # Clean up disconnected clients
        for conn_type, jid, ws in disconnected:
            if conn_type == "job":
                await self.disconnect_job(ws, jid)
            else:
                await self.disconnect_global(ws)
    
    async def broadcast_job_progress(
        self, 
        job_id: str, 
        status: str, 
        progress: int,
        message: str = "",
        **kwargs
    ):
        """Convenience method to broadcast job progress."""
        await self.broadcast_job_update(job_id, {
            "status": status,
            "progress": progress,
            "message": message,
            **kwargs,
        })
    
    async def broadcast_job_log(self, job_id: str, log_entry: str, level: str = "info"):
        """Broadcast a log entry for a job."""
        message = json.dumps({
            "type": "job_log",
            "job_id": job_id,
            "data": {
                "level": level,
                "message": log_entry,
            },
        })
        
        async with self._lock:
            job_clients = list(self.job_connections.get(job_id, set()))
        
        for websocket in job_clients:
            try:
                await websocket.send_text(message)
            except Exception:
                pass
    
    async def broadcast_job_complete(
        self, 
        job_id: str, 
        status: str,
        flag_candidates: list = None,
        error_message: str = None,
    ):
        """Broadcast job completion."""
        await self.broadcast_job_update(job_id, {
            "status": status,
            "progress": 100 if status == "completed" else 0,
            "completed": True,
            "flag_candidates": flag_candidates or [],
            "error_message": error_message,
        })


# Global instance
manager = ConnectionManager()


def get_ws_manager() -> ConnectionManager:
    """Get the global WebSocket manager."""
    return manager
