"""
Pre-booking video call: parent requests to meet sitter before sending a session request.
Sitter receives request, can accept (then we create Daily room and notify parent) or decline.
"""
import logging
import re
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import Optional

from app.utils.auth import verify_token, CurrentUser, security
from app.utils.error_handler import handle_error, AppError
from app.utils.database import get_supabase_with_auth
from fastapi.security import HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)
router = APIRouter()

JITSI_BASE = "https://meet.jit.si"


def _create_alert(supabase_client, alert_type: str, title: str, message: str, parent_id: str, sitter_id: Optional[str] = None):
    """Create alert (session_id null for meeting alerts)."""
    if not supabase_client:
        return
    try:
        supabase_client.table("alerts").insert({
            "session_id": None,
            "parent_id": parent_id,
            "sitter_id": sitter_id,
            "type": alert_type,
            "severity": "low",
            "title": title,
            "message": message,
            "status": "new",
        }).execute()
    except Exception as e:
        logger.warning("Failed to create alert: %s", e)


def _meeting_link(meeting_request_id: str) -> str:
    """Jitsi Meet room URL (no API key). Room name: carelum-<uuid without hyphens>."""
    room = "carelum-" + re.sub(r"[^a-zA-Z0-9]", "", meeting_request_id)[:32]
    return f"{JITSI_BASE}/{room}"


class CreateMeetingRequestInput(BaseModel):
    sitter_id: str
    preferred_time: Optional[str] = None  # ISO datetime; if not set, sitter chooses when accepting


class AcceptMeetingRequestInput(BaseModel):
    scheduled_time: Optional[str] = None  # ISO datetime; if not set, use parent's preferred_time or now + 24h


@router.post("/")
async def create_meeting_request(
    body: CreateMeetingRequestInput,
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Parent requests a video call with a sitter (before sending a booking request). Notifies sitter."""
    auth_token = credentials.credentials
    supabase = get_supabase_with_auth(auth_token)
    if not supabase:
        raise AppError(code="DB_NOT_AVAILABLE", message="Database unavailable", status_code=503)
    if current_user.role != "parent":
        raise AppError(code="FORBIDDEN", message="Only parents can request a video call", status_code=403)

    # Resolve parent display name for alert
    parent_resp = supabase.table("users").select("display_name").eq("id", current_user.id).single().execute()
    parent_name = (parent_resp.data or {}).get("display_name") or "A parent"

    insert_data = {
        "parent_id": current_user.id,
        "sitter_id": body.sitter_id,
        "status": "pending",
        "preferred_time": datetime.fromisoformat(body.preferred_time.replace("Z", "+00:00")).isoformat() if body.preferred_time else None,
    }
    ins = supabase.table("meeting_requests").insert(insert_data).execute()
    if not ins.data or len(ins.data) == 0:
        raise AppError(code="DB_ERROR", message="Failed to create meeting request", status_code=500)
    row = ins.data[0]

    _create_alert(
        supabase,
        "meeting_request",
        "Video call requested",
        f"{parent_name} would like to schedule a video call with you before booking. Open Meeting requests to accept or decline.",
        parent_id=current_user.id,
        sitter_id=body.sitter_id,
    )

    return {
        "id": row["id"],
        "parent_id": row["parent_id"],
        "sitter_id": row["sitter_id"],
        "preferred_time": row.get("preferred_time"),
        "scheduled_time": row.get("scheduled_time"),
        "meeting_link": row.get("meeting_link"),
        "status": row["status"],
        "created_at": row["created_at"],
    }


@router.get("/")
async def list_meeting_requests(
    role: str = Query(..., description="parent | sitter"),
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """List meeting requests: parent = sent by me, sitter = received by me."""
    auth_token = credentials.credentials
    supabase = get_supabase_with_auth(auth_token)
    if not supabase:
        raise AppError(code="DB_NOT_AVAILABLE", message="Database unavailable", status_code=503)

    if role == "parent":
        resp = supabase.table("meeting_requests").select("*").eq("parent_id", current_user.id).order("created_at", desc=True).execute()
    elif role == "sitter":
        resp = supabase.table("meeting_requests").select("*").eq("sitter_id", current_user.id).order("created_at", desc=True).execute()
    else:
        raise AppError(code="INVALID_ROLE", message="role must be parent or sitter", status_code=400)

    data = resp.data or []
    # Resolve display names
    user_ids = set()
    for row in data:
        user_ids.add(row["parent_id"])
        user_ids.add(row["sitter_id"])
    users_map = {}
    if user_ids:
        users_resp = supabase.table("users").select("id, display_name, photo_url").in_("id", list(user_ids)).execute()
        for u in (users_resp.data or []):
            users_map[u["id"]] = u
    out = []
    for row in data:
        r = dict(row)
        r["parent_display_name"] = (users_map.get(row["parent_id"]) or {}).get("display_name")
        r["parent_photo_url"] = (users_map.get(row["parent_id"]) or {}).get("photo_url")
        r["sitter_display_name"] = (users_map.get(row["sitter_id"]) or {}).get("display_name")
        r["sitter_photo_url"] = (users_map.get(row["sitter_id"]) or {}).get("photo_url")
        out.append(r)
    return out


@router.get("/{meeting_request_id}")
async def get_meeting_request(
    meeting_request_id: str,
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Get one meeting request (parent or sitter participant)."""
    auth_token = credentials.credentials
    supabase = get_supabase_with_auth(auth_token)
    if not supabase:
        raise AppError(code="DB_NOT_AVAILABLE", message="Database unavailable", status_code=503)

    resp = supabase.table("meeting_requests").select("*").eq("id", meeting_request_id).single().execute()
    if not resp.data:
        raise AppError(code="NOT_FOUND", message="Meeting request not found", status_code=404)
    row = resp.data
    if row["parent_id"] != current_user.id and row["sitter_id"] != current_user.id:
        raise AppError(code="FORBIDDEN", message="Not allowed", status_code=403)
    return row


@router.patch("/{meeting_request_id}/accept")
async def accept_meeting_request(
    meeting_request_id: str,
    body: AcceptMeetingRequestInput,
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Sitter accepts the meeting request. Backend creates Daily room and sets meeting_link and scheduled_time. Notifies parent."""
    auth_token = credentials.credentials
    supabase = get_supabase_with_auth(auth_token)
    if not supabase:
        raise AppError(code="DB_NOT_AVAILABLE", message="Database unavailable", status_code=503)

    resp = supabase.table("meeting_requests").select("*").eq("id", meeting_request_id).single().execute()
    if not resp.data:
        raise AppError(code="NOT_FOUND", message="Meeting request not found", status_code=404)
    row = resp.data
    if row["sitter_id"] != current_user.id:
        raise AppError(code="FORBIDDEN", message="Only the sitter can accept this request", status_code=403)
    if row["status"] != "pending":
        raise AppError(code="INVALID_STATUS", message="Request is no longer pending", status_code=400)

    meeting_link = _meeting_link(meeting_request_id)

    # scheduled_time: body > parent preferred > now + 24h
    if body.scheduled_time:
        scheduled_dt = datetime.fromisoformat(body.scheduled_time.replace("Z", "+00:00"))
    elif row.get("preferred_time"):
        scheduled_dt = datetime.fromisoformat(row["preferred_time"].replace("Z", "+00:00"))
    else:
        scheduled_dt = datetime.utcnow() + timedelta(hours=24)
    scheduled_iso = scheduled_dt.isoformat()

    supabase.table("meeting_requests").update({
        "status": "accepted",
        "scheduled_time": scheduled_iso,
        "meeting_link": meeting_link,
        "updated_at": datetime.utcnow().isoformat(),
    }).eq("id", meeting_request_id).execute()

    sitter_resp = supabase.table("users").select("display_name").eq("id", current_user.id).single().execute()
    sitter_name = (sitter_resp.data or {}).get("display_name") or "The sitter"

    _create_alert(
        supabase,
        "meeting_accepted",
        "Video call accepted",
        f"{sitter_name} accepted your video call. Join at the scheduled time from Meeting requests.",
        parent_id=row["parent_id"],
        sitter_id=row["sitter_id"],
    )

    updated = supabase.table("meeting_requests").select("*").eq("id", meeting_request_id).single().execute()
    return updated.data


@router.patch("/{meeting_request_id}/decline")
async def decline_meeting_request(
    meeting_request_id: str,
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Sitter declines the meeting request. Notifies parent."""
    auth_token = credentials.credentials
    supabase = get_supabase_with_auth(auth_token)
    if not supabase:
        raise AppError(code="DB_NOT_AVAILABLE", message="Database unavailable", status_code=503)

    resp = supabase.table("meeting_requests").select("*").eq("id", meeting_request_id).single().execute()
    if not resp.data:
        raise AppError(code="NOT_FOUND", message="Meeting request not found", status_code=404)
    row = resp.data
    if row["sitter_id"] != current_user.id:
        raise AppError(code="FORBIDDEN", message="Only the sitter can decline this request", status_code=403)
    if row["status"] != "pending":
        raise AppError(code="INVALID_STATUS", message="Request is no longer pending", status_code=400)

    supabase.table("meeting_requests").update({
        "status": "declined",
        "updated_at": datetime.utcnow().isoformat(),
    }).eq("id", meeting_request_id).execute()

    sitter_resp = supabase.table("users").select("display_name").eq("id", current_user.id).single().execute()
    sitter_name = (sitter_resp.data or {}).get("display_name") or "The sitter"

    _create_alert(
        supabase,
        "meeting_declined",
        "Video call declined",
        f"{sitter_name} declined your video call request.",
        parent_id=row["parent_id"],
        sitter_id=row["sitter_id"],
    )

    updated = supabase.table("meeting_requests").select("*").eq("id", meeting_request_id).single().execute()
    return updated.data


@router.post("/{meeting_request_id}/complete")
async def complete_meeting_request(
    meeting_request_id: str,
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Mark meeting as completed (parent or sitter, after the call ends)."""
    auth_token = credentials.credentials
    supabase = get_supabase_with_auth(auth_token)
    if not supabase:
        raise AppError(code="DB_NOT_AVAILABLE", message="Database unavailable", status_code=503)

    resp = supabase.table("meeting_requests").select("*").eq("id", meeting_request_id).single().execute()
    if not resp.data:
        raise AppError(code="NOT_FOUND", message="Meeting request not found", status_code=404)
    row = resp.data
    if row["parent_id"] != current_user.id and row["sitter_id"] != current_user.id:
        raise AppError(code="FORBIDDEN", message="Not allowed", status_code=403)
    if row["status"] == "completed":
        return {"success": True, "status": "completed"}

    supabase.table("meeting_requests").update({
        "status": "completed",
        "updated_at": datetime.utcnow().isoformat(),
    }).eq("id", meeting_request_id).execute()
    return {"success": True, "status": "completed"}
