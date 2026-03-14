"""
Interview (parent–sitter video call) scheduling and meeting links.
Uses Daily.co for video rooms. Session flow: requested -> interview_scheduled -> ... -> interview_completed -> accepted.
"""
import os
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional

import httpx

from app.utils.auth import verify_token, CurrentUser, security
from app.utils.error_handler import handle_error, AppError
from app.utils.database import get_supabase_with_auth
from fastapi.security import HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)
router = APIRouter()

DAILY_API = "https://api.daily.co/v1"
# Optional: DAILY_API_KEY in env. If not set, we still create interview row but use a placeholder meeting_link.


class ScheduleInterviewInput(BaseModel):
    session_id: str
    preferred_time: str  # ISO datetime


class ScheduleInterviewResponse(BaseModel):
    interview_id: str
    scheduled_time: str
    meeting_link: str
    status: str = "scheduled"


def _create_daily_room(session_id: str, expires_hours: int = 24) -> Optional[str]:
    key = os.getenv("DAILY_API_KEY")
    if not key:
        logger.warning("DAILY_API_KEY not set; returning placeholder meeting link")
        return f"https://meet.placeholder.local/interview-{session_id}"
    name = f"carelum-interview-{session_id}".replace("-", "_")[:128]
    exp = int((datetime.utcnow() + timedelta(hours=expires_hours)).timestamp())
    try:
        with httpx.Client() as client:
            r = client.post(
                f"{DAILY_API}/rooms",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={
                    "name": name,
                    "properties": {
                        "exp": exp,
                        "max_participants": 4,
                    },
                },
                timeout=10.0,
            )
            r.raise_for_status()
            data = r.json()
            return data.get("url") or data.get("meeting_url")
    except Exception as e:
        logger.exception("Daily room create failed: %s", e)
        return None


@router.post("/schedule", response_model=ScheduleInterviewResponse)
async def schedule_interview(
    body: ScheduleInterviewInput,
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Parent schedules an interview for a session. Creates Daily.co room and interview row. Notifies sitter."""
    auth_token = credentials.credentials
    supabase = get_supabase_with_auth(auth_token)
    if not supabase:
        raise AppError(code="DB_NOT_AVAILABLE", message="Database unavailable", status_code=503)

    session_id = body.session_id
    session_resp = supabase.table("sessions").select("*").eq("id", session_id).single().execute()
    if not session_resp.data:
        raise AppError(code="SESSION_NOT_FOUND", message="Session not found", status_code=404)
    session_data = session_resp.data
    if session_data.get("parent_id") != current_user.id:
        raise AppError(code="FORBIDDEN", message="Not your session", status_code=403)
    if session_data.get("status") != "requested":
        raise AppError(
            code="INVALID_STATUS",
            message="Interview can only be scheduled for a requested session",
            status_code=400,
        )
    sitter_id = session_data.get("sitter_id")
    if not sitter_id:
        raise AppError(
            code="NO_SITTER",
            message="Session must have an assigned sitter to schedule interview",
            status_code=400,
        )

    meeting_link = _create_daily_room(session_id)
    if not meeting_link:
        meeting_link = f"https://meet.placeholder.local/interview-{session_id}"

    try:
        scheduled_dt = datetime.fromisoformat(body.preferred_time.replace("Z", "+00:00"))
    except Exception:
        scheduled_dt = datetime.utcnow() + timedelta(hours=24)
    scheduled_iso = scheduled_dt.isoformat()

    insert_data = {
        "session_id": session_id,
        "parent_id": current_user.id,
        "sitter_id": sitter_id,
        "scheduled_time": scheduled_iso,
        "meeting_link": meeting_link,
        "status": "scheduled",
    }
    # If RLS allows only parent to insert, use auth client
    ins = supabase.table("interviews").insert(insert_data).execute()
    if not ins.data or len(ins.data) == 0:
        raise AppError(code="DB_ERROR", message="Failed to create interview", status_code=500)
    interview_id = ins.data[0]["id"]

    supabase.table("sessions").update({
        "status": "interview_scheduled",
        "updated_at": datetime.utcnow().isoformat(),
    }).eq("id", session_id).execute()

    # Notify sitter
    from app.routes.sessions import _create_alert
    _create_alert(
        supabase,
        session_id=session_id,
        parent_id=current_user.id,
        sitter_id=sitter_id,
        alert_type="interview_scheduled",
        title="Interview scheduled",
        message="Parent requested a video call before the session.",
        child_id=session_data.get("child_id"),
    )

    return ScheduleInterviewResponse(
        interview_id=interview_id,
        scheduled_time=scheduled_iso,
        meeting_link=meeting_link,
        status="scheduled",
    )


@router.get("/session/{session_id}")
async def get_interview_by_session(
    session_id: str,
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Get interview for a session (participants only)."""
    auth_token = credentials.credentials
    supabase = get_supabase_with_auth(auth_token)
    if not supabase:
        raise AppError(code="DB_NOT_AVAILABLE", message="Database unavailable", status_code=503)
    session_resp = supabase.table("sessions").select("id, parent_id, sitter_id").eq("id", session_id).single().execute()
    if not session_resp.data:
        raise AppError(code="SESSION_NOT_FOUND", message="Session not found", status_code=404)
    s = session_resp.data
    if s.get("parent_id") != current_user.id and s.get("sitter_id") != current_user.id and current_user.role != "admin":
        raise AppError(code="FORBIDDEN", message="Not allowed", status_code=403)
    row = supabase.table("interviews").select("*").eq("session_id", session_id).order("created_at", desc=True).limit(1).execute()
    if not row.data or len(row.data) == 0:
        return None
    return row.data[0]


@router.get("/{interview_id}")
async def get_interview(
    interview_id: str,
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Get interview by id (participants and admin only)."""
    auth_token = credentials.credentials
    supabase = get_supabase_with_auth(auth_token)
    if not supabase:
        raise AppError(code="DB_NOT_AVAILABLE", message="Database unavailable", status_code=503)

    row = supabase.table("interviews").select("*").eq("id", interview_id).single().execute()
    if not row.data:
        raise AppError(code="NOT_FOUND", message="Interview not found", status_code=404)
    data = row.data
    if data.get("parent_id") != current_user.id and data.get("sitter_id") != current_user.id and current_user.role != "admin":
        raise AppError(code="FORBIDDEN", message="Not allowed", status_code=403)
    return data


@router.post("/{interview_id}/complete")
async def complete_interview(
    interview_id: str,
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Mark interview as completed (after video call ends). Updates session to interview_completed."""
    auth_token = credentials.credentials
    supabase = get_supabase_with_auth(auth_token)
    if not supabase:
        raise AppError(code="DB_NOT_AVAILABLE", message="Database unavailable", status_code=503)

    row = supabase.table("interviews").select("*").eq("id", interview_id).single().execute()
    if not row.data:
        raise AppError(code="NOT_FOUND", message="Interview not found", status_code=404)
    data = row.data
    if data.get("parent_id") != current_user.id and data.get("sitter_id") != current_user.id:
        raise AppError(code="FORBIDDEN", message="Not allowed", status_code=403)
    if data.get("status") == "completed":
        return {"success": True, "status": "completed"}

    session_id = data["session_id"]
    supabase.table("interviews").update({
        "status": "completed",
        "updated_at": datetime.utcnow().isoformat(),
    }).eq("id", interview_id).execute()
    supabase.table("sessions").update({
        "status": "interview_completed",
        "updated_at": datetime.utcnow().isoformat(),
    }).eq("id", session_id).execute()
    return {"success": True, "status": "completed"}
