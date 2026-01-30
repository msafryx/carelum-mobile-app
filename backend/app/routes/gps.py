"""
GPS tracking endpoints
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from datetime import datetime

from app.utils.auth import verify_token, CurrentUser, security
from app.utils.error_handler import handle_error, AppError
from app.utils.database import get_supabase, get_supabase_with_auth
from fastapi.security import HTTPAuthorizationCredentials

router = APIRouter()


class GPSLocationResponse(BaseModel):
    """GPS location response model"""
    id: str
    sessionId: str
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    speed: Optional[float] = None
    heading: Optional[float] = None
    createdAt: str


class TrackLocationRequest(BaseModel):
    """Request model for tracking a location"""
    sessionId: str
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    speed: Optional[float] = None
    heading: Optional[float] = None


def db_to_gps_response(gps_data: dict) -> GPSLocationResponse:
    """Convert database GPS data to API response"""
    return GPSLocationResponse(
        id=gps_data["id"],
        sessionId=gps_data["session_id"],
        latitude=float(gps_data["latitude"]),
        longitude=float(gps_data["longitude"]),
        accuracy=float(gps_data["accuracy"]) if gps_data.get("accuracy") else None,
        speed=float(gps_data["speed"]) if gps_data.get("speed") else None,
        heading=float(gps_data["heading"]) if gps_data.get("heading") else None,
        createdAt=gps_data["created_at"]
    )


def verify_session_access_for_gps(session_data: dict, user: CurrentUser) -> bool:
    """Verify user has access to this session for GPS tracking (session_data already fetched with auth)."""
    if user.role == "admin":
        return True
    if user.role == "sitter":
        return session_data.get("sitter_id") == user.id
    if user.role == "parent":
        return session_data.get("parent_id") == user.id
    return False


@router.post("/track", response_model=GPSLocationResponse)
async def track_location(
    location_data: TrackLocationRequest,
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Record GPS location update (sitter only for active sessions).
    Uses authenticated Supabase client so RLS allows session read and GPS insert.
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
        # Fetch session with user's auth so RLS allows read
        session_response = supabase.table("sessions").select("*").eq("id", location_data.sessionId).single().execute()
        if not session_response.data:
            raise AppError(
                code="SESSION_NOT_FOUND",
                message="Session not found",
                status_code=404
            )
        session_data = session_response.data
        if not verify_session_access_for_gps(session_data, current_user):
            raise AppError(
                code="FORBIDDEN",
                message="You don't have access to track GPS for this session",
                status_code=403
            )
        if session_data.get("status") != "active":
            raise AppError(
                code="INVALID_SESSION_STATUS",
                message="GPS tracking is only allowed for active sessions",
                status_code=400
            )
        insert_data = {
            "session_id": location_data.sessionId,
            "latitude": Decimal(str(location_data.latitude)),
            "longitude": Decimal(str(location_data.longitude)),
            "accuracy": Decimal(str(location_data.accuracy)) if location_data.accuracy else None,
            "speed": Decimal(str(location_data.speed)) if location_data.speed else None,
            "heading": Decimal(str(location_data.heading)) if location_data.heading else None,
        }
        response = supabase.table("gps_tracking").insert(insert_data).select().execute()
        
        if not response.data:
            raise AppError(
                code="CREATE_FAILED",
                message="Failed to record GPS location",
                status_code=500
            )
        
        return db_to_gps_response(response.data[0])
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to track location")


@router.get("/sessions/{session_id}/gps", response_model=List[GPSLocationResponse])
async def get_session_gps_history(
    session_id: str,
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Get GPS history for a session. Uses authenticated client so RLS allows session read.
    """
    try:
        supabase = get_supabase_with_auth(credentials.credentials)
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        session_response = supabase.table("sessions").select("*").eq("id", session_id).single().execute()
        if not session_response.data:
            raise AppError(code="SESSION_NOT_FOUND", message="Session not found", status_code=404)
        if not verify_session_access_for_gps(session_response.data, current_user):
            raise AppError(
                code="FORBIDDEN",
                message="You don't have access to view GPS for this session",
                status_code=403
            )
        response = supabase.table("gps_tracking").select("*").eq("session_id", session_id).order("created_at", desc=True).limit(1000).execute()
        
        locations = []
        for gps_data in (response.data or []):
            locations.append(db_to_gps_response(gps_data))
        
        return locations
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to fetch GPS history")


@router.get("/sessions/{session_id}/gps/latest", response_model=GPSLocationResponse)
async def get_latest_gps_location(
    session_id: str,
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Get latest GPS location for a session. Uses authenticated client so RLS allows session read.
    """
    try:
        supabase = get_supabase_with_auth(credentials.credentials)
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        session_response = supabase.table("sessions").select("*").eq("id", session_id).single().execute()
        if not session_response.data:
            raise AppError(code="SESSION_NOT_FOUND", message="Session not found", status_code=404)
        if not verify_session_access_for_gps(session_response.data, current_user):
            raise AppError(
                code="FORBIDDEN",
                message="You don't have access to view GPS for this session",
                status_code=403
            )
        response = supabase.table("gps_tracking").select("*").eq("session_id", session_id).order("created_at", desc=True).limit(1).execute()
        
        if not response.data or len(response.data) == 0:
            raise AppError(
                code="GPS_NOT_FOUND",
                message="No GPS location found for this session",
                status_code=404
            )
        
        return db_to_gps_response(response.data[0])
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to fetch latest GPS location")
