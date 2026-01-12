"""
Session management endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from datetime import datetime

from app.utils.auth import verify_token, CurrentUser
from app.utils.error_handler import handle_error, AppError
from app.utils.database import get_supabase

router = APIRouter()


class SessionResponse(BaseModel):
    """Session response model"""
    id: str
    parentId: str
    sitterId: Optional[str] = None
    childId: str
    status: str
    startTime: str
    endTime: Optional[str] = None
    location: Optional[str] = None
    hourlyRate: Optional[float] = None
    totalAmount: Optional[float] = None
    notes: Optional[str] = None
    createdAt: str
    updatedAt: str


class CreateSessionRequest(BaseModel):
    """Request model for creating a session"""
    parentId: str
    sitterId: Optional[str] = None
    childId: str
    startTime: str
    location: Optional[str] = None
    hourlyRate: Optional[float] = None
    notes: Optional[str] = None


class UpdateSessionRequest(BaseModel):
    """Request model for updating a session"""
    status: Optional[str] = None
    endTime: Optional[str] = None
    location: Optional[str] = None
    hourlyRate: Optional[float] = None
    totalAmount: Optional[float] = None
    notes: Optional[str] = None


def db_to_session_response(session_data: dict) -> SessionResponse:
    """Convert database session to API response"""
    return SessionResponse(
        id=session_data["id"],
        parentId=session_data["parent_id"],
        sitterId=session_data.get("sitter_id"),
        childId=session_data["child_id"],
        status=session_data["status"],
        startTime=session_data["start_time"],
        endTime=session_data.get("end_time"),
        location=session_data.get("location"),
        hourlyRate=float(session_data["hourly_rate"]) if session_data.get("hourly_rate") else None,
        totalAmount=float(session_data["total_amount"]) if session_data.get("total_amount") else None,
        notes=session_data.get("notes"),
        createdAt=session_data["created_at"],
        updatedAt=session_data.get("updated_at", session_data["created_at"])
    )


def verify_session_access(session_data: dict, user: CurrentUser) -> bool:
    """Verify user has access to this session"""
    if user.role == "admin":
        return True
    return (
        session_data.get("parent_id") == user.id or
        session_data.get("sitter_id") == user.id
    )


@router.get("", response_model=List[SessionResponse])
async def get_user_sessions(
    status: Optional[str] = Query(None, description="Filter by status"),
    current_user: CurrentUser = Depends(verify_token)
):
    """
    Get current user's sessions (parent or sitter)
    """
    try:
        supabase = get_supabase()
        
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
        
        # Apply status filter if provided
        if status:
            query = query.eq("status", status)
        
        # Order by start_time descending
        query = query.order("start_time", desc=True).limit(100)
        
        response = query.execute()
        
        sessions = []
        for session_data in (response.data or []):
            sessions.append(db_to_session_response(session_data))
        
        return sessions
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to fetch sessions")


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session_by_id(
    session_id: str,
    current_user: CurrentUser = Depends(verify_token)
):
    """
    Get session by ID
    """
    try:
        supabase = get_supabase()
        
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


@router.post("", response_model=SessionResponse)
async def create_session(
    session_data: CreateSessionRequest,
    current_user: CurrentUser = Depends(verify_token)
):
    """
    Create a new session request
    """
    try:
        supabase = get_supabase()
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
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
        
        # Insert session
        insert_data = {
            "parent_id": session_data.parentId,
            "sitter_id": session_data.sitterId,
            "child_id": session_data.childId,
            "status": "requested",
            "start_time": session_data.startTime,
            "location": session_data.location,
            "hourly_rate": Decimal(str(session_data.hourlyRate)) if session_data.hourlyRate else None,
            "notes": session_data.notes,
        }
        
        response = supabase.table("sessions").insert(insert_data).select().execute()
        
        if not response.data:
            raise AppError(
                code="CREATE_FAILED",
                message="Failed to create session",
                status_code=500
            )
        
        return db_to_session_response(response.data[0])
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to create session")


@router.put("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: str,
    updates: UpdateSessionRequest,
    current_user: CurrentUser = Depends(verify_token)
):
    """
    Update session (status, notes, etc.)
    """
    try:
        supabase = get_supabase()
        
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
        
        # Verify access
        if not verify_session_access(session_data, current_user):
            raise AppError(
                code="FORBIDDEN",
                message="You don't have access to this session",
                status_code=403
            )
        
        # Build update data
        update_data = {}
        if updates.status is not None:
            update_data["status"] = updates.status
        if updates.endTime is not None:
            update_data["end_time"] = updates.endTime
        if updates.location is not None:
            update_data["location"] = updates.location
        if updates.hourlyRate is not None:
            update_data["hourly_rate"] = Decimal(str(updates.hourlyRate))
        if updates.totalAmount is not None:
            update_data["total_amount"] = Decimal(str(updates.totalAmount))
        if updates.notes is not None:
            update_data["notes"] = updates.notes
        
        # Add updated_at timestamp
        update_data["updated_at"] = datetime.utcnow().isoformat()
        
        # Update session
        response = supabase.table("sessions").update(update_data).eq("id", session_id).select().execute()
        
        if not response.data:
            raise AppError(
                code="UPDATE_FAILED",
                message="Failed to update session",
                status_code=500
            )
        
        return db_to_session_response(response.data[0])
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to update session")


@router.delete("/{session_id}")
async def cancel_session(
    session_id: str,
    current_user: CurrentUser = Depends(verify_token)
):
    """
    Cancel a session
    """
    try:
        supabase = get_supabase()
        
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
        
        # Verify access
        if not verify_session_access(session_data, current_user):
            raise AppError(
                code="FORBIDDEN",
                message="You don't have access to this session",
                status_code=403
            )
        
        # Update status to cancelled instead of deleting
        update_data = {
            "status": "cancelled",
            "updated_at": datetime.utcnow().isoformat()
        }
        
        response = supabase.table("sessions").update(update_data).eq("id", session_id).execute()
        
        if not response.data:
            raise AppError(
                code="UPDATE_FAILED",
                message="Failed to cancel session",
                status_code=500
            )
        
        return {
            "success": True,
            "message": "Session cancelled successfully"
        }
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to cancel session")
