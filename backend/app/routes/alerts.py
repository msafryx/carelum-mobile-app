"""
Alert management endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.utils.auth import verify_token, CurrentUser
from app.utils.error_handler import handle_error, AppError
from app.utils.database import get_supabase

router = APIRouter()


class AlertResponse(BaseModel):
    """Alert response model"""
    id: str
    sessionId: Optional[str] = None
    childId: Optional[str] = None
    parentId: str
    sitterId: Optional[str] = None
    type: str
    severity: str
    title: str
    message: str
    status: str
    audioLogId: Optional[str] = None
    location: Optional[dict] = None
    viewedAt: Optional[str] = None
    acknowledgedAt: Optional[str] = None
    resolvedAt: Optional[str] = None
    createdAt: str


class CreateAlertRequest(BaseModel):
    """Request model for creating an alert"""
    sessionId: Optional[str] = None
    childId: Optional[str] = None
    parentId: str
    sitterId: Optional[str] = None
    type: str
    severity: str
    title: str
    message: str
    audioLogId: Optional[str] = None
    location: Optional[dict] = None


def db_to_alert_response(alert_data: dict) -> AlertResponse:
    """Convert database alert to API response"""
    # Parse location if it's a string
    location = alert_data.get("location")
    if isinstance(location, str):
        try:
            import json
            location = json.loads(location)
        except:
            location = None
    
    return AlertResponse(
        id=alert_data["id"],
        sessionId=alert_data.get("session_id"),
        childId=alert_data.get("child_id"),
        parentId=alert_data["parent_id"],
        sitterId=alert_data.get("sitter_id"),
        type=alert_data["type"],
        severity=alert_data["severity"],
        title=alert_data["title"],
        message=alert_data["message"],
        status=alert_data["status"],
        audioLogId=alert_data.get("audio_log_id"),
        location=location,
        viewedAt=alert_data.get("viewed_at"),
        acknowledgedAt=alert_data.get("acknowledged_at"),
        resolvedAt=alert_data.get("resolved_at"),
        createdAt=alert_data["created_at"]
    )


def verify_alert_access(alert_data: dict, user: CurrentUser) -> bool:
    """Verify user has access to this alert"""
    if user.role == "admin":
        return True
    return (
        alert_data.get("parent_id") == user.id or
        alert_data.get("sitter_id") == user.id
    )


@router.get("", response_model=List[AlertResponse])
async def get_user_alerts(
    sessionId: Optional[str] = Query(None, alias="session_id", description="Filter by session ID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    alertType: Optional[str] = Query(None, alias="type", description="Filter by alert type"),
    current_user: CurrentUser = Depends(verify_token)
):
    """
    Get current user's alerts (parent or sitter)
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
            query = supabase.table("alerts").select("*").eq("parent_id", current_user.id)
        elif current_user.role == "sitter":
            query = supabase.table("alerts").select("*").eq("sitter_id", current_user.id)
        else:
            # Admin can see all, or return empty for other roles
            query = supabase.table("alerts").select("*")
        
        # Apply filters
        if sessionId:
            query = query.eq("session_id", sessionId)
        if status:
            query = query.eq("status", status)
        if alertType:
            query = query.eq("type", alertType)
        
        # Order by created_at descending
        query = query.order("created_at", desc=True).limit(100)
        
        response = query.execute()
        
        alerts = []
        for alert_data in (response.data or []):
            alerts.append(db_to_alert_response(alert_data))
        
        return alerts
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to fetch alerts")


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert_by_id(
    alert_id: str,
    current_user: CurrentUser = Depends(verify_token)
):
    """
    Get alert by ID
    """
    try:
        supabase = get_supabase()
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        
        response = supabase.table("alerts").select("*").eq("id", alert_id).single().execute()
        
        if not response.data:
            raise AppError(
                code="ALERT_NOT_FOUND",
                message="Alert not found",
                status_code=404
            )
        
        alert_data = response.data
        
        # Verify access
        if not verify_alert_access(alert_data, current_user):
            raise AppError(
                code="FORBIDDEN",
                message="You don't have access to this alert",
                status_code=403
            )
        
        return db_to_alert_response(alert_data)
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to fetch alert")


@router.post("", response_model=AlertResponse)
async def create_alert(
    alert_data: CreateAlertRequest,
    current_user: CurrentUser = Depends(verify_token)
):
    """
    Create a new alert (for system/internal use)
    """
    try:
        supabase = get_supabase()
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        
        # Insert alert
        insert_data = {
            "session_id": alert_data.sessionId,
            "child_id": alert_data.childId,
            "parent_id": alert_data.parentId,
            "sitter_id": alert_data.sitterId,
            "type": alert_data.type,
            "severity": alert_data.severity,
            "title": alert_data.title,
            "message": alert_data.message,
            "status": "new",
            "audio_log_id": alert_data.audioLogId,
            "location": alert_data.location,
        }
        
        response = supabase.table("alerts").insert(insert_data).select().execute()
        
        if not response.data:
            raise AppError(
                code="CREATE_FAILED",
                message="Failed to create alert",
                status_code=500
            )
        
        return db_to_alert_response(response.data[0])
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to create alert")


@router.put("/{alert_id}/view", response_model=AlertResponse)
async def mark_alert_as_viewed(
    alert_id: str,
    current_user: CurrentUser = Depends(verify_token)
):
    """
    Mark alert as viewed
    """
    try:
        supabase = get_supabase()
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        
        # Get existing alert
        response = supabase.table("alerts").select("*").eq("id", alert_id).single().execute()
        
        if not response.data:
            raise AppError(
                code="ALERT_NOT_FOUND",
                message="Alert not found",
                status_code=404
            )
        
        alert_data = response.data
        
        # Verify access
        if not verify_alert_access(alert_data, current_user):
            raise AppError(
                code="FORBIDDEN",
                message="You don't have access to this alert",
                status_code=403
            )
        
        # Update status
        update_data = {
            "status": "viewed",
            "viewed_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        response = supabase.table("alerts").update(update_data).eq("id", alert_id).select().execute()
        
        if not response.data:
            raise AppError(
                code="UPDATE_FAILED",
                message="Failed to update alert",
                status_code=500
            )
        
        return db_to_alert_response(response.data[0])
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to mark alert as viewed")


@router.put("/{alert_id}/acknowledge", response_model=AlertResponse)
async def acknowledge_alert(
    alert_id: str,
    current_user: CurrentUser = Depends(verify_token)
):
    """
    Acknowledge alert
    """
    try:
        supabase = get_supabase()
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        
        # Get existing alert
        response = supabase.table("alerts").select("*").eq("id", alert_id).single().execute()
        
        if not response.data:
            raise AppError(
                code="ALERT_NOT_FOUND",
                message="Alert not found",
                status_code=404
            )
        
        alert_data = response.data
        
        # Verify access
        if not verify_alert_access(alert_data, current_user):
            raise AppError(
                code="FORBIDDEN",
                message="You don't have access to this alert",
                status_code=403
            )
        
        # Update status
        update_data = {
            "status": "acknowledged",
            "acknowledged_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        response = supabase.table("alerts").update(update_data).eq("id", alert_id).select().execute()
        
        if not response.data:
            raise AppError(
                code="UPDATE_FAILED",
                message="Failed to update alert",
                status_code=500
            )
        
        return db_to_alert_response(response.data[0])
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to acknowledge alert")


@router.put("/{alert_id}/resolve", response_model=AlertResponse)
async def resolve_alert(
    alert_id: str,
    current_user: CurrentUser = Depends(verify_token)
):
    """
    Resolve alert
    """
    try:
        supabase = get_supabase()
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        
        # Get existing alert
        response = supabase.table("alerts").select("*").eq("id", alert_id).single().execute()
        
        if not response.data:
            raise AppError(
                code="ALERT_NOT_FOUND",
                message="Alert not found",
                status_code=404
            )
        
        alert_data = response.data
        
        # Verify access
        if not verify_alert_access(alert_data, current_user):
            raise AppError(
                code="FORBIDDEN",
                message="You don't have access to this alert",
                status_code=403
            )
        
        # Update status
        update_data = {
            "status": "resolved",
            "resolved_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        response = supabase.table("alerts").update(update_data).eq("id", alert_id).select().execute()
        
        if not response.data:
            raise AppError(
                code="UPDATE_FAILED",
                message="Failed to update alert",
                status_code=500
            )
        
        return db_to_alert_response(response.data[0])
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to resolve alert")
