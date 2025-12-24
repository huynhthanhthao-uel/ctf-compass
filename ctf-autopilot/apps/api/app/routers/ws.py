"""WebSocket router for real-time job updates."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from typing import Optional

from app.websocket import get_ws_manager, ConnectionManager


router = APIRouter()


@router.websocket("/jobs")
async def websocket_all_jobs(
    websocket: WebSocket,
    manager: ConnectionManager = Depends(get_ws_manager),
):
    """
    WebSocket endpoint for receiving updates on all jobs.
    
    Connect to ws://host/ws/jobs to receive real-time updates for all job changes.
    
    Messages received:
    - job_update: {type: "job_update", job_id: str, data: {status, progress, message, ...}}
    """
    await manager.connect_global(websocket)
    
    try:
        while True:
            # Keep connection alive, handle ping/pong
            data = await websocket.receive_text()
            
            # Handle client messages (ping, etc.)
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await manager.disconnect_global(websocket)
    except Exception as e:
        print(f"[WS] Error in global connection: {e}")
        await manager.disconnect_global(websocket)


@router.websocket("/jobs/{job_id}")
async def websocket_job(
    websocket: WebSocket,
    job_id: str,
    manager: ConnectionManager = Depends(get_ws_manager),
):
    """
    WebSocket endpoint for receiving updates on a specific job.
    
    Connect to ws://host/ws/jobs/{job_id} to receive real-time updates for that job.
    
    Messages received:
    - job_update: {type: "job_update", job_id: str, data: {status, progress, message, ...}}
    - job_log: {type: "job_log", job_id: str, data: {level, message}}
    """
    await manager.connect_job(websocket, job_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await manager.disconnect_job(websocket, job_id)
    except Exception as e:
        print(f"[WS] Error in job {job_id} connection: {e}")
        await manager.disconnect_job(websocket, job_id)
