"""
FastAPI HTTP interface — used by Nginx's /api/ai/* proxy.

Endpoints here are internal (called by the PHP app or directly by the
frontend in authenticated contexts). The heavy lifting happens in the
RQ worker process (tasks.py), not here.
"""

from fastapi import FastAPI, HTTPException
from sqlalchemy import text

from database import SessionLocal, update_session_status
from config import settings

app = FastAPI(title="HawkVision AI Worker", version="1.0.0")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "fastapi-worker"}


@app.get("/sessions/{session_id}/status")
def session_status(session_id: str) -> dict:
    with SessionLocal() as db:
        row = db.execute(
            text("SELECT id, status, created_at FROM sessions WHERE id = :id"),
            {"id": session_id},
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"session_id": row.id, "status": row.status, "created_at": str(row.created_at)}


@app.get("/sessions/{session_id}/tracks")
def session_tracks(session_id: str) -> dict:
    import json

    with SessionLocal() as db:
        row = db.execute(
            text("SELECT track_data FROM session_tracks WHERE session_id = :id"),
            {"id": session_id},
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Tracks not ready")

    return json.loads(row.track_data)
