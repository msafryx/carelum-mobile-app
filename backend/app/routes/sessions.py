"""
Session management endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from datetime import datetime
import json
import os

from app.utils.auth import verify_token, CurrentUser, security
from app.utils.error_handler import handle_error, AppError
from app.utils.database import get_supabase, get_supabase_with_auth


def _session_scheduled_duration_hours(session_data: dict) -> float:
    """Compute scheduled duration in hours from time_slots or start_time/end_time."""
    time_slots = session_data.get("time_slots")
    if time_slots:
        if isinstance(time_slots, str):
            try:
                time_slots = json.loads(time_slots)
            except Exception:
                time_slots = []
        if isinstance(time_slots, list) and len(time_slots) > 0:
            total = 0.0
            for slot in time_slots:
                if isinstance(slot, dict) and slot.get("hours") is not None:
                    total += float(slot["hours"])
                elif isinstance(slot, dict) and slot.get("startTime") and slot.get("endTime"):
                    # Approximate
                    total += 1.0
            return total if total > 0 else 1.0
    start_time = session_data.get("start_time")
    end_time = session_data.get("end_time")
    if start_time and end_time:
        try:
            start = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
            end = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
            delta = (end - start).total_seconds() / 3600.0
            return max(0.1, delta)
        except Exception:
            pass
    return 1.0


def _extract_session_city(location) -> Optional[str]:
    """Extract city from session location (string or dict)."""
    if not location:
        return None
    if isinstance(location, str):
        try:
            location = json.loads(location)
        except Exception:
            return None
    if isinstance(location, dict):
        return location.get("city") or location.get("address")
    return None


def _notify_sitters_of_new_request(
    supabase_client,
    session_id: str,
    parent_id: str,
    child_id: Optional[str],
    search_scope: str,
    location,
) -> None:
    """Create alerts so sitters see the new request in Notifications (city/nearby/nationwide)."""
    if not supabase_client or search_scope not in ("city", "nearby", "nationwide"):
        return
    try:
        # Parents can read verified sitters (RLS). Fetch sitter IDs and optional city.
        response = supabase_client.table("users").select("id, city").eq("role", "sitter").limit(500).execute()
        rows = response.data or []
        session_city = _extract_session_city(location) if search_scope == "city" and location else None
        if session_city and isinstance(session_city, str):
            session_city_lower = session_city.lower().strip()
        else:
            session_city_lower = None
        sitter_ids = []
        for row in rows:
            sid = row.get("id")
            if not sid:
                continue
            if search_scope == "city" and session_city_lower:
                row_city = (row.get("city") or "").strip().lower()
                if row_city != session_city_lower:
                    continue
            sitter_ids.append(sid)
        for sitter_id in sitter_ids[:300]:  # cap at 300 alerts
            _create_alert(
                supabase_client,
                session_id=session_id,
                parent_id=parent_id,
                sitter_id=sitter_id,
                alert_type="session_request",
                title="New session request",
                message="A parent is looking for a sitter in your area.",
                child_id=child_id,
            )
    except Exception as e:
        print(f"⚠️ Failed to notify sitters of new request: {e}")


def _create_alert(
    supabase_client,
    session_id: str,
    parent_id: str,
    sitter_id: Optional[str],
    alert_type: str,
    title: str,
    message: str,
    child_id: Optional[str] = None,
) -> None:
    """Create an alert for session-related events (cancelled, accepted). Uses authenticated client so RLS allows insert."""
    if not supabase_client:
        return
    try:
        insert_data = {
            "session_id": session_id,
            "parent_id": parent_id,
            "sitter_id": sitter_id,
            "child_id": child_id,
            "type": alert_type,
            "severity": "low",
            "title": title,
            "message": message,
            "status": "new",
        }
        supabase_client.table("alerts").insert(insert_data).execute()
    except Exception as e:
        print(f"⚠️ Failed to create alert: {e}")


def _create_session_event(supabase_client, session_id: str, event_type: str, triggered_by: str) -> None:
    """Create a timeline event (session_started, session_completed, session_cancelled, etc.)."""
    if not supabase_client:
        return
    try:
        supabase_client.table("session_events").insert({
            "session_id": session_id,
            "type": event_type,
            "triggered_by": triggered_by,
        }).execute()
    except Exception as e:
        print(f"⚠️ Failed to create session event: {e}")


from fastapi.security import HTTPAuthorizationCredentials

router = APIRouter()


class TimeSlot(BaseModel):
    """Time slot model for multi-day sessions"""
    date: str
    startTime: str
    endTime: str
    hours: float


class SessionResponse(BaseModel):
    """Session response model"""
    id: str
    parentId: str
    sitterId: Optional[str] = None
    childId: str
    childIds: Optional[List[str]] = None  # Array of child IDs for sessions with multiple children
    status: str
    startTime: str
    endTime: Optional[str] = None
    location: Optional[str] = None
    hourlyRate: Optional[float] = None
    totalAmount: Optional[float] = None
    notes: Optional[str] = None
    searchScope: Optional[str] = None
    maxDistanceKm: Optional[float] = None
    timeSlots: Optional[List[TimeSlot]] = None  # Array of time slots for multi-day sessions
    expiresAt: Optional[str] = None  # When the request expires (for OPEN status requests)
    cancelledAt: Optional[str] = None
    cancelledBy: Optional[str] = None
    cancellationReason: Optional[str] = None
    completedAt: Optional[str] = None
    endedAt: Optional[str] = None
    startedAt: Optional[str] = None  # When sitter started session (LIVE)
    monitoringEnabled: Optional[bool] = None
    lastLocationAt: Optional[str] = None
    lastAudioSignalAt: Optional[str] = None
    monitoringStartedAt: Optional[str] = None
    createdAt: str
    updatedAt: str
    paymentStatus: Optional[str] = None  # payment_pending | paid | refunded
    estimatedAmount: Optional[float] = None


class SessionEventResponse(BaseModel):
    """Session timeline event"""
    id: str
    sessionId: str
    type: str
    triggeredBy: Optional[str] = None
    createdAt: str


class SessionReportResponse(BaseModel):
    """Aggregated session report for parent/sitter/admin."""
    sessionId: str
    parentId: str
    sitterId: Optional[str]
    childId: str
    status: str
    startedAt: Optional[str] = None
    endedAt: Optional[str] = None
    monitoringStartedAt: Optional[str] = None
    monitoringEnabled: Optional[bool] = None
    lastLocationAt: Optional[str] = None
    lastAudioSignalAt: Optional[str] = None
    # Derived metrics
    monitoringDurationMinutes: Optional[int] = None
    cryAlertCount: int
    gpsPointCount: int
    # Basic parties summary
    parentName: Optional[str] = None
    sitterName: Optional[str] = None
    childName: Optional[str] = None


class EmergencyInfoResponse(BaseModel):
    """Phones and labels for emergency call bottom sheet."""
    emergencyNumber: str
    sitterPhone: Optional[str] = None
    parentPhone: Optional[str] = None
    childEmergencyContactName: Optional[str] = None
    childEmergencyContactPhone: Optional[str] = None
    doctorContact: Optional[str] = None
    doctorPhone: Optional[str] = None


class EmergencyCallRequest(BaseModel):
    """Log which emergency option was used."""
    action: str  # 'sitter' | 'parent' | 'emergency' | 'child_contact' | 'doctor'


class CreateSessionRequest(BaseModel):
    """Request model for creating a session"""
    parentId: str
    sitterId: Optional[str] = None
    childId: str
    childIds: Optional[List[str]] = None  # Array of child IDs for sessions with multiple children
    startTime: str
    endTime: Optional[str] = None
    location: Optional[str] = None
    hourlyRate: Optional[float] = None
    notes: Optional[str] = None
    searchScope: Optional[str] = None  # 'invite' | 'nearby' | 'city' | 'nationwide'
    maxDistanceKm: Optional[float] = None  # Only used when searchScope = 'nearby'
    timeSlots: Optional[List[TimeSlot]] = None  # Array of time slots for multi-day sessions


class UpdateSessionRequest(BaseModel):
    """Request model for updating a session"""
    status: Optional[str] = None
    endTime: Optional[str] = None
    location: Optional[str] = None
    hourlyRate: Optional[float] = None
    totalAmount: Optional[float] = None
    notes: Optional[str] = None
    cancellationReason: Optional[str] = None  # For cancellation tracking


class MonitoringToggleRequest(BaseModel):
    enabled: bool


def db_to_session_response(session_data: dict) -> SessionResponse:
    """Convert database session to API response"""
    # Parse child_ids JSONB field if present
    child_ids = None
    if session_data.get("child_ids"):
        if isinstance(session_data["child_ids"], str):
            try:
                child_ids = json.loads(session_data["child_ids"])
            except:
                child_ids = None
        elif isinstance(session_data["child_ids"], list):
            child_ids = session_data["child_ids"]
    
    # Parse time_slots JSONB field if present
    time_slots = None
    if session_data.get("time_slots"):
        if isinstance(session_data["time_slots"], str):
            try:
                time_slots = json.loads(session_data["time_slots"])
            except:
                time_slots = None
        elif isinstance(session_data["time_slots"], list):
            time_slots = session_data["time_slots"]
    
    return SessionResponse(
        id=session_data["id"],
        parentId=session_data["parent_id"],
        sitterId=session_data.get("sitter_id"),
        childId=session_data["child_id"],
        childIds=child_ids,  # Array of child IDs
        status=session_data["status"],
        startTime=session_data["start_time"],
        endTime=session_data.get("end_time"),
        location=session_data.get("location"),
        hourlyRate=float(session_data["hourly_rate"]) if session_data.get("hourly_rate") else None,
        totalAmount=float(session_data["total_amount"]) if session_data.get("total_amount") else None,
        notes=session_data.get("notes"),
        searchScope=session_data.get("search_scope"),
        maxDistanceKm=float(session_data["max_distance_km"]) if session_data.get("max_distance_km") else None,
        timeSlots=time_slots,  # Array of time slots
        expiresAt=session_data.get("expires_at"),  # Request expiration time
        cancelledAt=session_data.get("cancelled_at"),
        cancelledBy=session_data.get("cancelled_by"),
        cancellationReason=session_data.get("cancellation_reason"),
        completedAt=session_data.get("completed_at"),
        endedAt=session_data.get("ended_at"),
        startedAt=session_data.get("started_at"),
        monitoringEnabled=session_data.get("monitoring_enabled"),
        lastLocationAt=session_data.get("last_location_at"),
        lastAudioSignalAt=session_data.get("last_audio_signal_at"),
        monitoringStartedAt=session_data.get("monitoring_started_at"),
        createdAt=session_data["created_at"],
        updatedAt=session_data.get("updated_at", session_data["created_at"]),
        paymentStatus=session_data.get("payment_status"),
        estimatedAmount=float(session_data["estimated_amount"]) if session_data.get("estimated_amount") is not None else None,
    )


def verify_session_access(session_data: dict, user: CurrentUser) -> bool:
    """Verify user has access to this session"""
    if user.role == "admin":
        return True
    return (
        session_data.get("parent_id") == user.id or
        session_data.get("sitter_id") == user.id
    )


def validate_status_transition(current_status: str, new_status: str, user_role: str, session_data: dict) -> tuple[bool, str]:
    """
    Validate session status transition (Uber-like state machine).
    Flow: requested -> [interview_scheduled | accepted] -> ... -> payment_pending -> booked -> active -> completed.
    """
    valid_transitions = {
        'requested': ['interview_scheduled', 'accepted', 'cancelled'],
        'interview_scheduled': ['interview_completed', 'cancelled'],
        'interview_completed': ['accepted', 'cancelled'],
        'accepted': ['payment_pending', 'active', 'cancelled'],  # payment_pending set by backend when sitter accepts
        'payment_pending': ['booked', 'cancelled'],  # booked set by payment webhook
        'booked': ['active', 'cancelled'],
        'active': ['completed', 'cancelled'],
        'completed': [],
        'cancelled': [],
        'pending': ['accepted', 'cancelled'],
    }

    if current_status in ['completed', 'cancelled']:
        return False, f"Cannot change status from {current_status} (terminal state)"

    if new_status not in valid_transitions.get(current_status, []):
        return False, f"Invalid status transition from {current_status} to {new_status}"

    if new_status == 'accepted':
        if user_role != 'sitter':
            return False, "Only sitters can accept session requests"
        if session_data.get('search_scope') == 'invite' and session_data.get('sitter_id') != session_data.get('current_user_id'):
            return False, "This session was not invited to you"

    if new_status == 'payment_pending':
        if user_role != 'sitter':
            return False, "Only sitters can accept (payment_pending is set when sitter accepts)"

    if new_status == 'active':
        if user_role != 'sitter':
            return False, "Only sitters can start sessions"
        if current_status not in ('accepted', 'booked'):
            return False, "Session must be accepted and paid (booked) before it can be started"

    if new_status == 'completed':
        if user_role != 'sitter':
            return False, "Only sitters can complete sessions"
        if current_status != 'active':
            return False, "Session must be active before it can be completed"

    return True, ""


@router.get("", response_model=List[SessionResponse])
async def get_user_sessions(
    status: Optional[str] = Query(None, description="Filter by status"),
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Get current user's sessions (parent or sitter)
    """
    try:
        # Use authenticated Supabase client for RLS to work properly
        auth_token = credentials.credentials
        supabase = get_supabase_with_auth(auth_token)
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        
        # Build query based on user role
        if current_user.role == "parent":
            query = supabase.table("sessions").select("*").eq("parent_id", current_user.id)
        elif current_user.role == "sitter":
            query = supabase.table("sessions").select("*").eq("sitter_id", current_user.id)
        else:
            # Admin can see all, or return empty for other roles
            query = supabase.table("sessions").select("*")
        
        # Apply status filter if provided (comma-separated = any of)
        if status:
            statuses = [s.strip() for s in status.split(",") if s.strip()]
            if len(statuses) == 1:
                query = query.eq("status", statuses[0])
            elif len(statuses) > 1:
                query = query.in_("status", statuses)
        
        # Order by start_time descending
        query = query.order("start_time", desc=True).limit(100)
        
        print(f"🔍 Querying sessions for user {current_user.id} (role: {current_user.role}, status filter: {status})")
        response = query.execute()
        
        print(f"📥 Raw response data: {response.data if hasattr(response, 'data') else 'NO DATA'}")
        print(f"📥 Fetched {len(response.data or [])} sessions for user {current_user.id} (role: {current_user.role}, status filter: {status})")
        
        # Check for errors in response
        if hasattr(response, 'error') and response.error:
            print(f"❌ Supabase query error: {response.error}")
        
        sessions = []
        for session_data in (response.data or []):
            print(f"📋 Session: {session_data.get('id')} - status: {session_data.get('status')}")
            sessions.append(db_to_session_response(session_data))
        
        return sessions
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to fetch sessions")


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session_by_id(
    session_id: str,
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Get session by ID
    """
    try:
        # Use authenticated Supabase client for RLS
        auth_token = credentials.credentials
        supabase = get_supabase_with_auth(auth_token)
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        
        response = supabase.table("sessions").select("*").eq("id", session_id).single().execute()
        
        if not response.data:
            raise AppError(
                code="SESSION_NOT_FOUND",
                message="Session not found",
                status_code=404
            )
        
        session_data = response.data
        
        # Verify access
        if not verify_session_access(session_data, current_user):
            raise AppError(
                code="FORBIDDEN",
                message="You don't have access to this session",
                status_code=403
            )
        
        return db_to_session_response(session_data)
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to fetch session")


@router.get("/{session_id}/events", response_model=List[SessionEventResponse])
async def get_session_events(
    session_id: str,
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Get timeline events for a session. Same access as get session (parent/sitter/admin).
    """
    try:
        auth_token = credentials.credentials
        supabase = get_supabase_with_auth(auth_token)
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        session_resp = supabase.table("sessions").select("id, parent_id, sitter_id").eq("id", session_id).single().execute()
        if not session_resp.data:
            raise AppError(
                code="SESSION_NOT_FOUND",
                message="Session not found",
                status_code=404
            )
        session_data = session_resp.data
        if not verify_session_access(session_data, current_user):
            raise AppError(
                code="FORBIDDEN",
                message="You don't have access to this session",
                status_code=403
            )
        events_resp = supabase.table("session_events").select("id, session_id, type, triggered_by, created_at").eq("session_id", session_id).order("created_at", desc=False).execute()
        events = events_resp.data or []
        return [
            SessionEventResponse(
                id=e["id"],
                sessionId=e["session_id"],
                type=e["type"],
                triggeredBy=e.get("triggered_by"),
                createdAt=e["created_at"],
            )
            for e in events
        ]
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to fetch session events")


@router.get("/{session_id}/report", response_model=SessionReportResponse)
async def get_session_report(
    session_id: str,
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Generate an aggregated session report (start/end, monitoring, alerts, GPS).
    Parent can download, sitter can view history, admin can export.
    """
    try:
        auth_token = credentials.credentials
        supabase = get_supabase_with_auth(auth_token)
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )

        # Fetch session
        session_resp = supabase.table("sessions").select("*").eq("id", session_id).single().execute()
        if not session_resp.data:
            raise AppError(
                code="SESSION_NOT_FOUND",
                message="Session not found",
                status_code=404
            )
        session_data = session_resp.data

        # Access check
        if not verify_session_access(session_data, current_user):
            raise AppError(
                code="FORBIDDEN",
                message="You don't have access to this session",
                status_code=403
            )

        # Basic fields from session
        started_at = session_data.get("started_at")
        ended_at = session_data.get("ended_at") or session_data.get("completed_at") or session_data.get("end_time")
        monitoring_started_at = session_data.get("monitoring_started_at")
        monitoring_enabled = session_data.get("monitoring_enabled")
        last_location_at = session_data.get("last_location_at")
        last_audio_signal_at = session_data.get("last_audio_signal_at")

        # Derived monitoring duration (in minutes)
        monitoring_duration_minutes: Optional[int] = None
        if monitoring_started_at and ended_at:
            try:
                from datetime import datetime
                start_dt = datetime.fromisoformat(str(monitoring_started_at).replace("Z", "+00:00"))
                end_dt = datetime.fromisoformat(str(ended_at).replace("Z", "+00:00"))
                diff_sec = max(0, (end_dt - start_dt).total_seconds())
                monitoring_duration_minutes = int(diff_sec // 60)
            except Exception as _:
                monitoring_duration_minutes = None

        # Cry alerts count
        alerts_resp = supabase.table("alerts").select("id, type").eq("session_id", session_id).execute()
        alerts = alerts_resp.data or []
        cry_alert_count = sum(1 for a in alerts if a.get("type") == "cry_detection")

        # GPS summary: count of points
        gps_resp = supabase.table("gps_tracking").select("id").eq("session_id", session_id).execute()
        gps_points = gps_resp.data or []
        gps_point_count = len(gps_points)

        # Basic party names (best-effort, optional)
        parent_name = None
        sitter_name = None
        child_name = None
        parent_id = session_data.get("parent_id")
        sitter_id = session_data.get("sitter_id")
        child_id = session_data.get("child_id")
        try:
            if parent_id:
                u = supabase.table("users").select("id, display_name").eq("id", parent_id).single().execute()
                if u.data:
                    parent_name = u.data.get("display_name")
            if sitter_id:
                u = supabase.table("users").select("id, display_name").eq("id", sitter_id).single().execute()
                if u.data:
                    sitter_name = u.data.get("display_name")
            if child_id:
                c = supabase.table("children").select("id, name").eq("id", child_id).single().execute()
                if c.data:
                    child_name = c.data.get("name")
        except Exception as _:
            # Non-fatal if name lookups fail
            pass

        return SessionReportResponse(
            sessionId=session_data.get("id"),
            parentId=parent_id,
            sitterId=sitter_id,
            childId=child_id,
            status=session_data.get("status"),
            startedAt=started_at,
            endedAt=ended_at,
            monitoringStartedAt=monitoring_started_at,
            monitoringEnabled=monitoring_enabled,
            lastLocationAt=last_location_at,
            lastAudioSignalAt=last_audio_signal_at,
            monitoringDurationMinutes=monitoring_duration_minutes,
            cryAlertCount=cry_alert_count,
            gpsPointCount=gps_point_count,
            parentName=parent_name,
            sitterName=sitter_name,
            childName=child_name,
        )
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to generate session report")


@router.get("/{session_id}/emergency-info", response_model=EmergencyInfoResponse)
async def get_session_emergency_info(
    session_id: str,
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Get phone numbers for emergency call sheet (parent/sitter, session must be accessible).
    Only useful when session is active; caller can still use for completed sessions.
    """
    try:
        auth_token = credentials.credentials
        supabase = get_supabase_with_auth(auth_token)
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        session_resp = supabase.table("sessions").select("*").eq("id", session_id).single().execute()
        if not session_resp.data:
            raise AppError(
                code="SESSION_NOT_FOUND",
                message="Session not found",
                status_code=404
            )
        session_data = session_resp.data
        if not verify_session_access(session_data, current_user):
            raise AppError(
                code="FORBIDDEN",
                message="You don't have access to this session",
                status_code=403
            )
        emergency_number = os.getenv("EMERGENCY_PHONE_NUMBER", "911").strip() or "911"
        parent_id = session_data.get("parent_id")
        sitter_id = session_data.get("sitter_id")
        child_id = session_data.get("child_id")
        sitter_phone = None
        parent_phone = None
        child_emergency_name = None
        child_emergency_phone = None
        doctor_contact = None
        doctor_phone = None
        if sitter_id:
            u = supabase.table("users").select("phone_number").eq("id", sitter_id).single().execute()
            if u.data:
                sitter_phone = u.data.get("phone_number")
        if parent_id:
            u = supabase.table("users").select("phone_number").eq("id", parent_id).single().execute()
            if u.data:
                parent_phone = u.data.get("phone_number")
        if child_id:
            c = supabase.table("children").select(
                "emergency_contact_name, emergency_contact_phone, doctor_contact, doctor_phone"
            ).eq("id", child_id).single().execute()
            if c.data:
                child_emergency_name = c.data.get("emergency_contact_name")
                child_emergency_phone = c.data.get("emergency_contact_phone")
                doctor_contact = c.data.get("doctor_contact")
                doctor_phone = c.data.get("doctor_phone")
        return EmergencyInfoResponse(
            emergencyNumber=emergency_number,
            sitterPhone=sitter_phone,
            parentPhone=parent_phone,
            childEmergencyContactName=child_emergency_name,
            childEmergencyContactPhone=child_emergency_phone,
            doctorContact=doctor_contact,
            doctorPhone=doctor_phone,
        )
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to get emergency info")


@router.post("/{session_id}/emergency-call")
async def log_emergency_call(
    session_id: str,
    body: EmergencyCallRequest,
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Log that the user used the emergency call button (creates session_event emergency_contact_called).
    Admin can view in session timeline.
    """
    try:
        auth_token = credentials.credentials
        supabase = get_supabase_with_auth(auth_token)
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        session_resp = supabase.table("sessions").select("id, parent_id, sitter_id").eq("id", session_id).single().execute()
        if not session_resp.data:
            raise AppError(
                code="SESSION_NOT_FOUND",
                message="Session not found",
                status_code=404
            )
        session_data = session_resp.data
        if not verify_session_access(session_data, current_user):
            raise AppError(
                code="FORBIDDEN",
                message="You don't have access to this session",
                status_code=403
            )
        _create_session_event(supabase, session_id, "emergency_contact_called", current_user.id)
        return {"success": True, "action": body.action}
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to log emergency call")


@router.post("/{session_id}/start", response_model=SessionResponse)
async def start_session(
    session_id: str,
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Start a session (sitter only). Transitions BOOKED (accepted) → LIVE (active).
    Idempotent: if already LIVE, returns current session.
    Sets started_at and creates SESSION_STARTED timeline event.
    """
    try:
        auth_token = credentials.credentials
        supabase = get_supabase_with_auth(auth_token)
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        response = supabase.table("sessions").select("*").eq("id", session_id).single().execute()
        if not response.data:
            raise AppError(
                code="SESSION_NOT_FOUND",
                message="Session not found",
                status_code=404
            )
        session_data = response.data
        if not verify_session_access(session_data, current_user):
            raise AppError(
                code="FORBIDDEN",
                message="You don't have access to this session",
                status_code=403
            )
        current_status = session_data.get("status")
        sitter_id = session_data.get("sitter_id")

        # Only the assigned sitter can start
        if current_user.role != "sitter":
            raise AppError(
                code="FORBIDDEN",
                message="Only the assigned sitter can start this session",
                status_code=403
            )
        if sitter_id != current_user.id:
            raise AppError(
                code="FORBIDDEN",
                message="Only the assigned sitter can start this session",
                status_code=403
            )

        # Idempotent: already LIVE → return current session
        if current_status == "active":
            return db_to_session_response(session_data)

        if current_status not in ("accepted", "booked", "payment_pending"):
            raise AppError(
                code="INVALID_STATUS",
                message="Session is not ready to start",
                status_code=400
            )
        # When payment_pending: parent and sitter must have added accounts (parent: payment method, sitter: Connect already checked on accept)
        parent_id = session_data.get("parent_id")
        if current_status == "payment_pending" and parent_id:
            pm = supabase.table("payment_methods").select("stripe_customer_id").eq("parent_id", parent_id).execute()
            if not pm.data or not pm.data[0].get("stripe_customer_id"):
                raise AppError(
                    code="PAYMENT_REQUIRED",
                    message="Parent must add a payment method in Profile before the session can start. You will be charged when the parent ends the session.",
                    status_code=400
                )

        now_iso = datetime.utcnow().isoformat()
        update_data = {
            "status": "active",
            "started_at": now_iso,
            "updated_at": now_iso,
        }
        supabase.table("sessions").update(update_data).eq("id", session_id).execute()
        _create_session_event(supabase, session_id, "session_started", current_user.id)
        # Notify parent that sitter has started the session
        parent_id = session_data.get("parent_id")
        if parent_id:
            _create_alert(
                supabase,
                session_id=session_id,
                parent_id=parent_id,
                sitter_id=current_user.id,
                alert_type="session_started",
                title="Session started",
                message="Your sitter has started the session.",
                child_id=session_data.get("child_id"),
            )

        response = supabase.table("sessions").select("*").eq("id", session_id).single().execute()
        if not response.data:
            raise AppError(
                code="UPDATE_FAILED",
                message="Failed to update session",
                status_code=500
            )
        return db_to_session_response(response.data)
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to start session")


class EndSessionRequest(BaseModel):
    endedBy: Optional[str] = None  # 'parent' | 'admin' (optional; derived from role if missing)


@router.post("/{session_id}/end", response_model=SessionResponse)
async def end_session(
    session_id: str,
    payload: Optional[EndSessionRequest] = None,
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Safely complete a session.

    Corrected rules:
    - Parent (session parent) can end active session at any time.
    - Admin can force end any non-terminal session.
    - Sitter cannot end sessions (must use request-end flow).
    """
    try:
        auth_token = credentials.credentials
        supabase = get_supabase_with_auth(auth_token)
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503,
            )

        response = supabase.table("sessions").select("*").eq("id", session_id).single().execute()
        if not response.data:
            raise AppError(
                code="SESSION_NOT_FOUND",
                message="Session not found",
                status_code=404,
            )
        session_data = response.data

        # Verify access at session level (parent, sitter, admin)
        if not verify_session_access(session_data, current_user):
            raise AppError(
                code="FORBIDDEN",
                message="You don't have access to this session",
                status_code=403,
            )

        parent_id = session_data.get("parent_id")
        sitter_id = session_data.get("sitter_id")

        # Determine who is ending the session
        ended_by = (payload.endedBy if payload else None) or (
            "parent" if current_user.role == "parent" else
            "admin" if current_user.role == "admin" else
            None
        )

        # Sitter is never allowed to end
        if current_user.role == "sitter":
            raise AppError(
                code="FORBIDDEN",
                message="Sitters cannot end sessions. They can only request to end.",
                status_code=403,
            )

        # Parent: must be owning parent
        if current_user.role == "parent":
            if parent_id != current_user.id:
                raise AppError(
                    code="FORBIDDEN",
                    message="Only the session parent can end this session",
                    status_code=403,
                )

        # Admin: always allowed (force end)
        if current_user.role not in ["parent", "admin"]:
            raise AppError(
                code="FORBIDDEN",
                message="Only parent or admin can end this session",
                status_code=403,
            )

        current_status = session_data.get("status")

        # Idempotent: already completed
        if current_status == "completed":
            return db_to_session_response(session_data)

        # Only allow ending non-terminal sessions
        if current_status in ["cancelled"]:
            raise AppError(
                code="INVALID_STATUS",
                message="Cannot end a cancelled session",
                status_code=400,
            )

        # Must be active to end (for safety / monitoring shutdown)
        if current_status != "active":
            raise AppError(
                code="INVALID_STATUS",
                message="Session is not active",
                status_code=400,
            )

        now_iso = datetime.utcnow().isoformat()
        now_dt = datetime.utcnow()
        update_data = {
            "status": "completed",
            "completed_at": now_iso,
            "ended_at": now_iso,
            "updated_at": now_iso,
            "monitoring_enabled": False,
        }
        if not session_data.get("end_time"):
            update_data["end_time"] = now_iso

        # Prorated amount: charge only for time actually used (started_at → now)
        hourly_rate = session_data.get("hourly_rate")
        started_at = session_data.get("started_at")
        estimated = session_data.get("estimated_amount")
        if hourly_rate is not None and started_at:
            try:
                start_dt = datetime.fromisoformat(str(started_at).replace("Z", "+00:00"))
                hours_used = max(0.0, (now_dt - start_dt).total_seconds() / 3600.0)
                # Minimum charge 15 minutes; cap at estimated (authorized) amount
                hours_used = max(0.25, round(hours_used, 2))
                total_amount = round(float(hourly_rate) * hours_used, 2)
                if estimated is not None:
                    total_amount = min(total_amount, float(estimated))
                if total_amount < 0.50:
                    total_amount = 0.50
                update_data["total_amount"] = total_amount
            except Exception:
                if estimated is not None:
                    update_data["total_amount"] = float(estimated)
        elif estimated is not None:
            update_data["total_amount"] = float(estimated)

        supabase.table("sessions").update(update_data).eq("id", session_id).execute()

        # Auto-capture payment for actual time used (prorated); sitter payout is created inside
        try:
            from app.routes.payments import do_capture_after_session_end
            do_capture_after_session_end(session_id)
        except Exception as cap_err:
            import logging
            logging.getLogger(__name__).warning("Auto-capture after end_session failed: %s", cap_err)

        # Timeline event: session_completed (triggered_by parent/admin)
        _create_session_event(supabase, session_id, "session_completed", current_user.id)
        if current_user.role == "admin":
            _create_session_event(supabase, session_id, "admin_action", current_user.id)

        # Notify parent that session has completed
        if parent_id:
            _create_alert(
                supabase,
                session_id=session_id,
                parent_id=parent_id,
                sitter_id=session_data.get("sitter_id"),
                alert_type="session_completed",
                title="Session completed",
                message="Your session has been completed.",
                child_id=session_data.get("child_id"),
            )

        updated = supabase.table("sessions").select("*").eq("id", session_id).single().execute()
        if not updated.data:
            raise AppError(
                code="UPDATE_FAILED",
                message="Failed to update session",
                status_code=500,
            )
        return db_to_session_response(updated.data)
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to end session")


@router.post("/{session_id}/request-end")
async def request_end_session(
    session_id: str,
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Sitter requests to end an active session.
    Creates timeline event + alert to parent. Does NOT change status.
    """
    try:
        auth_token = credentials.credentials
        supabase = get_supabase_with_auth(auth_token)
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503,
            )

        response = supabase.table("sessions").select("*").eq("id", session_id).single().execute()
        if not response.data:
            raise AppError(
                code="SESSION_NOT_FOUND",
                message="Session not found",
                status_code=404,
            )
        session_data = response.data

        # Only assigned sitter can request end, and session must be active
        if current_user.role != "sitter":
            raise AppError(
                code="FORBIDDEN",
                message="Only the sitter can request to end the session",
                status_code=403,
            )
        if session_data.get("sitter_id") != current_user.id:
            raise AppError(
                code="FORBIDDEN",
                message="Only the assigned sitter can request to end this session",
                status_code=403,
            )
        if session_data.get("status") != "active":
            raise AppError(
                code="INVALID_STATUS",
                message="Only active sessions can be requested to end",
                status_code=400,
            )

        # Timeline event
        _create_session_event(supabase, session_id, "sitter_requested_end", current_user.id)

        # Notify parent
        parent_id = session_data.get("parent_id")
        if parent_id:
            _create_alert(
                supabase,
                session_id=session_id,
                parent_id=parent_id,
                sitter_id=current_user.id,
                alert_type="session_reminder",
                title="Sitter requested to end session",
                message="Your sitter has requested to end the session. Please review and decide whether to extend or finish.",
                child_id=session_data.get("child_id"),
            )

        return {"success": True}
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to request session end")

@router.put("/{session_id}/monitoring", response_model=SessionResponse)
async def set_monitoring(
    session_id: str,
    payload: MonitoringToggleRequest,
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Enable/disable monitoring (separate from session start).

    Rules:
    - Sitter can enable/disable for their assigned active session
    - Admin can only disable monitoring (safety)
    - Session must be active

    Updates:
    - monitoring_enabled
    - monitoring_started_at (set when enabling; cleared when disabling)
    Inserts session_event: monitoring_enabled
    """
    try:
        auth_token = credentials.credentials
        supabase = get_supabase_with_auth(auth_token)
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503,
            )

        response = supabase.table("sessions").select("*").eq("id", session_id).single().execute()
        if not response.data:
            raise AppError(
                code="SESSION_NOT_FOUND",
                message="Session not found",
                status_code=404,
            )
        session_data = response.data

        if not verify_session_access(session_data, current_user):
            raise AppError(
                code="FORBIDDEN",
                message="You don't have access to this session",
                status_code=403,
            )

        if session_data.get("status") != "active":
            raise AppError(
                code="INVALID_STATUS",
                message="Session must be active to change monitoring",
                status_code=400,
            )

        # Authorization: sitter (assigned) can toggle; admin can only disable
        sitter_id = session_data.get("sitter_id")
        if current_user.role == "admin":
            if payload.enabled is True:
                raise AppError(
                    code="FORBIDDEN",
                    message="Admin cannot enable monitoring",
                    status_code=403,
                )
        else:
            if current_user.role != "sitter":
                raise AppError(
                    code="FORBIDDEN",
                    message="Only sitter can change monitoring",
                    status_code=403,
                )
            if sitter_id != current_user.id:
                raise AppError(
                    code="FORBIDDEN",
                    message="Only the assigned sitter can change monitoring",
                    status_code=403,
                )

        now_iso = datetime.utcnow().isoformat()
        update_data = {
            "monitoring_enabled": payload.enabled,
            "monitoring_started_at": now_iso if payload.enabled else None,
            "updated_at": now_iso,
        }
        supabase.table("sessions").update(update_data).eq("id", session_id).execute()

        # Session event
        _create_session_event(supabase, session_id, "monitoring_enabled" if payload.enabled else "monitoring_disabled", current_user.id)

        updated = supabase.table("sessions").select("*").eq("id", session_id).single().execute()
        if not updated.data:
            raise AppError(
                code="UPDATE_FAILED",
                message="Failed to update monitoring",
                status_code=500,
            )
        return db_to_session_response(updated.data)
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to update monitoring")


@router.post("", response_model=SessionResponse)
async def create_session(
    session_data: CreateSessionRequest,
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Create a new session request
    """
    try:
        # CRITICAL: Use Supabase client with user's auth token for RLS to work!
        auth_token = credentials.credentials
        supabase = get_supabase_with_auth(auth_token)
        
        if not supabase:
            raise AppError(
                code="AUTH_ERROR",
                message="Failed to authenticate with database",
                status_code=500
            )
        
        # Only parents can create sessions
        if current_user.role != "parent":
            raise AppError(
                code="FORBIDDEN",
                message="Only parents can create sessions",
                status_code=403
            )
        
        # Verify parent_id matches current user
        if session_data.parentId != current_user.id:
            raise AppError(
                code="FORBIDDEN",
                message="Cannot create session for another parent",
                status_code=403
            )
        
        # Validate search scope
        valid_scopes = ['invite', 'nearby', 'city', 'nationwide']
        search_scope = session_data.searchScope or 'invite'  # Default to invite for backward compatibility
        
        if search_scope not in valid_scopes:
            raise AppError(
                code="INVALID_SCOPE",
                message=f"Invalid search scope. Must be one of: {', '.join(valid_scopes)}",
                status_code=400
            )
        
        # Validate scope-specific requirements
        if search_scope == 'invite' and not session_data.sitterId:
            raise AppError(
                code="INVALID_REQUEST",
                message="sitterId is required when searchScope is 'invite'",
                status_code=400
            )
        
        if search_scope == 'nearby' and not session_data.maxDistanceKm:
            raise AppError(
                code="INVALID_REQUEST",
                message="maxDistanceKm is required when searchScope is 'nearby'",
                status_code=400
            )
        
        if search_scope == 'nearby' and session_data.maxDistanceKm not in [5, 10, 25]:
            raise AppError(
                code="INVALID_REQUEST",
                message="maxDistanceKm must be 5, 10, or 25 when searchScope is 'nearby'",
                status_code=400
            )
        
        # Insert session
        # Convert Decimal to float for JSON serialization (Supabase will handle the conversion to DECIMAL in DB)
        # Handle child_ids: if provided, use it; otherwise, default to array with single child_id
        child_ids_array = session_data.childIds if session_data.childIds else [session_data.childId]
        
        insert_data = {
            "parent_id": session_data.parentId,
            "sitter_id": session_data.sitterId if search_scope == 'invite' else None,
            "child_id": session_data.childId,  # Primary child (for backward compatibility)
            "status": "requested",
            "start_time": session_data.startTime,
            "end_time": session_data.endTime if session_data.endTime else None,  # Include end_time
            "location": session_data.location,
            "hourly_rate": float(session_data.hourlyRate) if session_data.hourlyRate else None,
            "notes": session_data.notes,
            "search_scope": search_scope,
            "max_distance_km": float(session_data.maxDistanceKm) if session_data.maxDistanceKm else None,
        }
        
        # Only include child_ids if the column exists (try-catch will handle if it doesn't)
        # If child_ids column doesn't exist, we'll fall back to just using child_id
        if child_ids_array and len(child_ids_array) > 1:
            # Only add child_ids if we have multiple children (optimization)
            insert_data["child_ids"] = json.dumps(child_ids_array)
        
        # Include time_slots if provided (for Time Slots mode)
        # Note: This column may not exist in older databases, so we'll handle it gracefully
        if session_data.timeSlots and len(session_data.timeSlots) > 0:
            time_slots_data = [
                {
                    "date": slot.date,
                    "startTime": slot.startTime,
                    "endTime": slot.endTime,
                    "hours": slot.hours
                }
                for slot in session_data.timeSlots
            ]
            insert_data["time_slots"] = json.dumps(time_slots_data)
        
        print(f"🔄 Attempting to insert session with data: {insert_data}")
        print(f"📤 Insert data keys: {list(insert_data.keys())}")
        print(f"📤 Insert data values: {insert_data}")
        print(f"🔑 Using authenticated Supabase client: {hasattr(supabase, 'postgrest')}")
        if hasattr(supabase, 'postgrest') and hasattr(supabase.postgrest, 'headers'):
            auth_header = supabase.postgrest.headers.get('Authorization', 'NOT SET')
            print(f"🔑 Auth header present: {auth_header[:30] if auth_header != 'NOT SET' else 'NOT SET'}...")
        
        try:
            print(f"📤 Executing insert query...")
            # Supabase Python client: The insert() method returns a query builder
            # In newer versions, we need to use execute() directly, which returns the inserted data
            # The .select() method might not be available on SyncQueryRequestBuilder
            
            # Try to insert with child_ids and time_slots first, if it fails due to missing column, retry without them
            try:
                response = supabase.table("sessions").insert(insert_data).execute()
            except Exception as column_error:
                error_str = str(column_error)
                # Check if error is about missing columns
                if "child_ids" in error_str.lower() or "time_slots" in error_str.lower() or "PGRST204" in error_str:
                    print(f"⚠️ Some columns not found in database, retrying without optional columns")
                    # Remove optional columns from insert_data and retry
                    insert_data_retry = {k: v for k, v in insert_data.items() 
                                       if k not in ["child_ids", "time_slots"]}
                    if "child_ids" in error_str.lower():
                        print(f"💡 Run scripts/ADD_CHILD_IDS_COLUMN.sql in Supabase SQL Editor to enable multiple children per session")
                    if "time_slots" in error_str.lower():
                        print(f"💡 Run scripts/ADD_TIME_SLOTS_COLUMN.sql in Supabase SQL Editor to enable time slots")
                    response = supabase.table("sessions").insert(insert_data_retry).execute()
                else:
                    raise  # Re-raise if it's a different error
            print(f"📥 Insert response type: {type(response)}")
            print(f"📥 Response has data attr: {hasattr(response, 'data')}")
            print(f"📥 Response has error attr: {hasattr(response, 'error')}")
            print(f"📥 Response data: {response.data if hasattr(response, 'data') else 'NO DATA ATTR'}")
            print(f"📥 Response data type: {type(response.data) if hasattr(response, 'data') else 'N/A'}")
            print(f"📥 Response data length: {len(response.data) if hasattr(response, 'data') and response.data else 0}")
            
            # Check for errors in response
            error = None
            if hasattr(response, 'error'):
                error = response.error
            elif hasattr(response, 'errors') and response.errors:
                error = response.errors[0] if isinstance(response.errors, list) else response.errors
            elif not hasattr(response, 'data') or not response.data:
                # Check if response itself indicates an error
                error = "No data returned from insert"
            
            if error:
                error_str = str(error)
                print(f"❌ Supabase insert error: {error_str}")
                print(f"❌ Error type: {type(error)}")
                print(f"❌ Error repr: {repr(error)}")
                
                if "status" in error_str.lower() or "check" in error_str.lower() or "constraint" in error_str.lower() or "sessions_status_check" in error_str:
                    raise AppError(
                        code="INVALID_STATUS",
                        message=f"Invalid status value 'requested'. The database constraint may not allow this status yet. Please run UPDATE_SESSIONS_STATUS.sql in Supabase. Error: {error_str}",
                        status_code=400
                    )
                elif "permission" in error_str.lower() or "policy" in error_str.lower() or "RLS" in error_str or "PGRST" in error_str or "406" in error_str:
                    raise AppError(
                        code="PERMISSION_DENIED",
                        message=f"Database insert blocked by RLS policies. Make sure you're using an authenticated Supabase client. Error: {error_str}",
                        status_code=403
                    )
                else:
                    raise AppError(
                        code="CREATE_FAILED",
                        message=f"Database error: {error_str}",
                        status_code=500
                    )
            
            # Check if response has data attribute
            if hasattr(response, 'data'):
                response_data = response.data
            elif isinstance(response, list) and len(response) > 0:
                # Response might be a list directly
                response_data = response
            else:
                response_data = None
            
            if not response_data or len(response_data) == 0:
                print(f"❌ Empty response from insert - no data returned")
                print(f"❌ This might indicate:")
                print(f"   1. RLS policy blocking the insert")
                print(f"   2. Constraint violation (e.g., status 'requested' not allowed)")
                print(f"   3. Foreign key constraint violation")
                print(f"   4. Database connection issue")
                raise AppError(
                    code="CREATE_FAILED",
                    message="Failed to create session - no data returned from database. Check RLS policies and database constraints.",
                    status_code=500
                )
            
            # Extract the first item from response_data (could be list or dict)
            session_record = response_data[0] if isinstance(response_data, list) else response_data
            print(f"✅ Session created successfully: {session_record.get('id') if isinstance(session_record, dict) else 'NO ID'}")
            # Notify sitters so they see the request in Notifications
            new_session_id = session_record.get("id") if isinstance(session_record, dict) else None
            if new_session_id:
                _create_session_event(supabase, new_session_id, "session_requested", current_user.id)
                if search_scope == "invite" and session_data.sitterId:
                    _create_alert(
                        supabase,
                        session_id=new_session_id,
                        parent_id=session_data.parentId,
                        sitter_id=session_data.sitterId,
                        alert_type="session_request",
                        title="New invitation",
                        message="You have a new session invitation.",
                        child_id=session_data.childId,
                    )
                else:
                    _notify_sitters_of_new_request(
                        supabase,
                        session_id=new_session_id,
                        parent_id=session_data.parentId,
                        child_id=session_data.childId,
                        search_scope=search_scope,
                        location=session_record.get("location") if isinstance(session_record, dict) else session_data.location,
                    )
            return db_to_session_response(session_record)
            
        except AppError:
            raise
        except Exception as insert_error:
            import traceback
            error_str = str(insert_error)
            error_type = type(insert_error).__name__
            error_traceback = traceback.format_exc()
            
            print(f"❌ Exception during session insert: {error_type}: {error_str}")
            print(f"❌ Exception details: {repr(insert_error)}")
            print(f"❌ Full traceback:\n{error_traceback}")
            
            # Check if it's a Supabase API error
            if hasattr(insert_error, 'message'):
                error_str = insert_error.message
            elif hasattr(insert_error, 'args') and insert_error.args:
                error_str = str(insert_error.args[0])
            
            # Check for specific error types
            if "status" in error_str.lower() or "check" in error_str.lower() or "constraint" in error_str.lower() or "sessions_status_check" in error_str:
                raise AppError(
                    code="INVALID_STATUS",
                    message=f"Invalid status value 'requested'. The database constraint may not allow this status yet. Please run UPDATE_SESSIONS_STATUS.sql in Supabase. Error: {error_str}",
                    status_code=400
                )
            elif "permission" in error_str.lower() or "policy" in error_str.lower() or "RLS" in error_str or "PGRST" in error_str or "406" in error_str:
                raise AppError(
                    code="PERMISSION_DENIED",
                    message=f"Database insert blocked by RLS policies. Make sure you're using an authenticated Supabase client. Error: {error_str}",
                    status_code=403
                )
            else:
                raise AppError(
                    code="CREATE_FAILED",
                    message=f"Failed to create session: {error_str}",
                    status_code=500
                )
        
    except AppError:
        raise
    except Exception as e:
        error_str = str(e)
        error_type = type(e).__name__
        print(f"❌ Unexpected error in create_session: {error_type}: {error_str}")
        print(f"❌ Full exception: {repr(e)}")
        raise handle_error(e, f"Failed to create session: {error_str}")


@router.put("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: str,
    updates: UpdateSessionRequest,
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Update session (status, notes, etc.) with proper state machine validation
    """
    try:
        # Use authenticated Supabase client for RLS
        auth_token = credentials.credentials
        supabase = get_supabase_with_auth(auth_token)
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        
        # Get existing session
        response = supabase.table("sessions").select("*").eq("id", session_id).single().execute()
        
        if not response.data:
            raise AppError(
                code="SESSION_NOT_FOUND",
                message="Session not found",
                status_code=404
            )
        
        session_data = response.data
        current_status = session_data.get("status")
        
        # Verify access
        if not verify_session_access(session_data, current_user):
            raise AppError(
                code="FORBIDDEN",
                message="You don't have access to this session",
                status_code=403
            )
        
        # Validate status transition if status is being updated
        if updates.status is not None and updates.status != current_status:
            is_valid, error_msg = validate_status_transition(
                current_status, 
                updates.status, 
                current_user.role,
                {**session_data, 'current_user_id': current_user.id}
            )
            if not is_valid:
                raise AppError(
                    code="INVALID_STATUS_TRANSITION",
                    message=error_msg,
                    status_code=400
                )
        
        # Build update data
        update_data = {}
        if updates.status is not None:
            new_status = updates.status
            # When sitter accepts, transition to payment_pending and set estimated amount
            if updates.status == "accepted" and current_user.role == "sitter":
                # Sitter must have completed Stripe Connect onboarding to accept
                sa = supabase.table("sitter_accounts").select("onboarding_status").eq("sitter_id", current_user.id).execute()
                if sa.data and len(sa.data) > 0 and sa.data[0].get("onboarding_status") != "completed":
                    raise AppError(
                        code="ONBOARDING_INCOMPLETE",
                        message="Complete payout account setup (Connect Bank Account) before accepting sessions",
                        status_code=400,
                    )
                new_status = "payment_pending"
                update_data["status"] = new_status
                update_data["payment_status"] = "payment_pending"
                if not session_data.get("sitter_id"):
                    update_data["sitter_id"] = current_user.id
                hours = _session_scheduled_duration_hours(session_data)
                hourly_rate = session_data.get("hourly_rate") or 0
                if hourly_rate and hours:
                    update_data["estimated_amount"] = round(float(hourly_rate) * hours, 2)
            else:
                update_data["status"] = new_status
            
            # Handle status-specific updates (Uber-like tracking)
            if new_status == "cancelled":
                update_data["cancelled_at"] = datetime.utcnow().isoformat()
                update_data["cancelled_by"] = current_user.role
                if updates.cancellationReason:
                    update_data["cancellation_reason"] = updates.cancellationReason
            elif new_status == "completed":
                update_data["completed_at"] = datetime.utcnow().isoformat()
                if not updates.endTime:
                    update_data["end_time"] = datetime.utcnow().isoformat()
            elif new_status == "active":
                if not session_data.get("started_at"):
                    update_data["started_at"] = datetime.utcnow().isoformat()
        
        if updates.endTime is not None:
            update_data["end_time"] = updates.endTime
        if updates.location is not None:
            update_data["location"] = updates.location
        if updates.hourlyRate is not None:
            update_data["hourly_rate"] = float(updates.hourlyRate)  # Convert to float for JSON
        if updates.totalAmount is not None:
            update_data["total_amount"] = float(updates.totalAmount)  # Convert to float for JSON
        if updates.notes is not None:
            update_data["notes"] = updates.notes
        
        # Add updated_at timestamp
        update_data["updated_at"] = datetime.utcnow().isoformat()
        
        # Update session (supabase-py: update().eq() does not have .select(); do update then fetch)
        supabase.table("sessions").update(update_data).eq("id", session_id).execute()
        response = supabase.table("sessions").select("*").eq("id", session_id).single().execute()
        
        if not response.data:
            raise AppError(
                code="UPDATE_FAILED",
                message="Failed to update session",
                status_code=500
            )
        
        updated = response.data
        # Timeline event when session is started (LIVE)
        if updates.status == "active" and session_data.get("status") != "active":
            _create_session_event(supabase, session_id, "session_started", current_user.id)
            # Notify parent that sitter has started the session
            parent_id = session_data.get("parent_id")
            if parent_id:
                _create_alert(
                    supabase,
                    session_id=session_id,
                    parent_id=parent_id,
                    sitter_id=updated.get("sitter_id"),
                    alert_type="session_started",
                    title="Session started",
                    message="Your sitter has started the session.",
                    child_id=session_data.get("child_id"),
                )
        # Timeline event + notify parent when sitter accepts (we set status to payment_pending)
        if updates.status == "accepted" and current_user.role == "sitter":
            _create_session_event(supabase, session_id, "session_accepted", current_user.id)
            if session_data.get("parent_id"):
                _create_alert(
                    supabase,
                    session_id=session_id,
                    parent_id=session_data["parent_id"],
                    sitter_id=updated.get("sitter_id"),
                    alert_type="session_accepted",
                    title="Session accepted",
                    message="Payment required to confirm booking.",
                    child_id=session_data.get("child_id"),
                )

        return db_to_session_response(updated)
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to update session")


@router.delete("/{session_id}")
async def cancel_session(
    session_id: str,
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    reason: Optional[str] = Query(None, description="Cancellation reason")
):
    """
    Cancel a session (Uber-like: soft delete with tracking)
    """
    try:
        # Use authenticated Supabase client for RLS
        auth_token = credentials.credentials
        supabase = get_supabase_with_auth(auth_token)
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        
        # Get existing session
        response = supabase.table("sessions").select("*").eq("id", session_id).single().execute()
        
        if not response.data:
            raise AppError(
                code="SESSION_NOT_FOUND",
                message="Session not found",
                status_code=404
            )
        
        session_data = response.data
        current_status = session_data.get("status")
        
        # Verify access
        if not verify_session_access(session_data, current_user):
            raise AppError(
                code="FORBIDDEN",
                message="You don't have access to this session",
                status_code=403
            )
        
        # Validate cancellation is allowed
        if current_status in ['completed', 'cancelled']:
            raise AppError(
                code="INVALID_STATUS",
                message=f"Cannot cancel session with status {current_status}",
                status_code=400
            )
        
        # Update status to cancelled with tracking
        update_data = {
            "status": "cancelled",
            "cancelled_at": datetime.utcnow().isoformat(),
            "cancelled_by": current_user.role,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        if reason:
            update_data["cancellation_reason"] = reason
        
        supabase.table("sessions").update(update_data).eq("id", session_id).execute()

        _create_session_event(supabase, session_id, "session_cancelled", current_user.id)

        # Notify parent and sitter (message depends on who cancelled)
        parent_id = session_data.get("parent_id")
        sitter_id = session_data.get("sitter_id")
        if parent_id:
            cancel_message = "A sitter declined your invitation." if current_user.role == "sitter" else (reason or "This session was cancelled.")
            _create_alert(
                supabase,
                session_id=session_id,
                parent_id=parent_id,
                sitter_id=sitter_id,
                alert_type="session_cancelled",
                title="Session cancelled",
                message=cancel_message,
                child_id=session_data.get("child_id"),
            )
        
        return {
            "success": True,
            "message": "Session cancelled successfully"
        }
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to cancel session")


@router.get("/discover/available", response_model=List[SessionResponse])
async def discover_available_sessions(
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    scope: Optional[str] = Query(None, description="Filter by search scope: invite, nearby, city, nationwide"),
    max_distance: Optional[float] = Query(None, description="Maximum distance in km (for nearby scope)"),
    sitter_city: Optional[str] = Query(None, description="Sitter's city (for city scope filtering)")
):
    """
    Discover available session requests for sitters (Uber-like discovery)
    Returns sessions that match the sitter's location and preferences
    
    Request visibility rules:
    - INVITE mode: Show requests where searchScope = 'invite' AND sitterId = current sitter id (pinned at top)
    - NEARBY mode: Show requests where searchScope = 'nearby', status = 'requested', and within radius
    - CITY mode: Show requests where searchScope = 'city', status = 'requested', and city matches
    - NATIONWIDE mode: Show requests where searchScope = 'nationwide' and status = 'requested'
    """
    try:
        # Only sitters can discover sessions
        if current_user.role != "sitter":
            raise AppError(
                code="FORBIDDEN",
                message="Only sitters can discover available sessions",
                status_code=403
            )
        
        # Use authenticated Supabase client for RLS
        auth_token = credentials.credentials
        supabase = get_supabase_with_auth(auth_token)
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        
        # Only verified sitters can see session requests
        try:
            profile_response = supabase.table("users").select("is_verified, city").eq("id", current_user.id).single().execute()
            if profile_response.data:
                if not profile_response.data.get("is_verified", False):
                    print(f"🔒 Unverified sitter {current_user.id} attempted to discover sessions - returning empty list")
                    return []
                sitter_profile = profile_response.data
                sitter_city = sitter_city or profile_response.data.get("city")
            else:
                # No profile or unverified - return empty
                return []
        except Exception as profile_err:
            print(f"⚠️ Could not load sitter profile for verification check: {profile_err}")
            return []  # Fail closed: don't show sessions if we can't verify
        
        # Query for available sessions (status = 'requested')
        # Note: expires_at column may not exist yet - we'll filter expired sessions in Python
        query = supabase.table("sessions").select("*").eq("status", "requested")
        
        # Filter by scope if provided
        if scope:
            if scope not in ['invite', 'nearby', 'city', 'nationwide']:
                raise AppError(
                    code="INVALID_SCOPE",
                    message="Scope must be one of: invite, nearby, city, nationwide",
                    status_code=400
                )
            query = query.eq("search_scope", scope)
        
        # For nearby scope, filter by max_distance if provided
        if scope == 'nearby' and max_distance:
            query = query.lte("max_distance_km", max_distance)
        
        # Order by: invite requests first (if sitter is invited), then by start_time
        # Note: We'll sort in Python to prioritize invite requests
        query = query.order("start_time", desc=False).limit(200)  # Get more to sort properly
        
        response = query.execute()
        
        sessions = []
        invite_sessions = []
        other_sessions = []
        
        # Filter out expired sessions in Python (if expires_at exists in data)
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        
        for session_data in (response.data or []):
            # Check if session is expired (if expires_at column exists)
            expires_at = session_data.get("expires_at")
            if expires_at:
                try:
                    expires_date = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                    if expires_date < now:
                        continue  # Skip expired sessions
                except:
                    pass  # If parsing fails, include the session anyway
            
            search_scope = session_data.get("search_scope")
            sitter_id = session_data.get("sitter_id")
            
            # INVITE mode: Only show if this sitter is invited
            if search_scope == "invite":
                if sitter_id == current_user.id:
                    invite_sessions.append(db_to_session_response(session_data))
                continue  # Skip other invite requests
            
            # CITY mode: Filter by city match
            if search_scope == "city" and sitter_city:
                location = session_data.get("location")
                session_city = None
                if location:
                    if isinstance(location, str):
                        try:
                            import json
                            location_obj = json.loads(location)
                            session_city = location_obj.get("city") if isinstance(location_obj, dict) else None
                        except:
                            pass
                    elif isinstance(location, dict):
                        session_city = location.get("city")
                
                # If city doesn't match, skip
                if session_city and session_city.lower() != sitter_city.lower():
                    continue
            
            # NEARBY and NATIONWIDE: Show all (already filtered by status and scope)
            other_sessions.append(db_to_session_response(session_data))
        
        # Combine: invite sessions first (pinned), then others
        sessions = invite_sessions + other_sessions
        
        # Limit to 100 total
        sessions = sessions[:100]
        
        print(f"🔍 Discovered {len(sessions)} available sessions for sitter {current_user.id} (invites: {len(invite_sessions)})")
        return sessions
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to discover available sessions")
