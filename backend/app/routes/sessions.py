"""
Session management endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from datetime import datetime
import json

from app.utils.auth import verify_token, CurrentUser, security
from app.utils.error_handler import handle_error, AppError
from app.utils.database import get_supabase, get_supabase_with_auth
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
    createdAt: str
    updatedAt: str


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


def validate_status_transition(current_status: str, new_status: str, user_role: str, session_data: dict) -> tuple[bool, str]:
    """
    Validate session status transition (Uber-like state machine)
    Returns: (is_valid, error_message)
    """
    # Define valid transitions
    valid_transitions = {
        'requested': ['accepted', 'cancelled'],  # Can be accepted by sitter or cancelled by anyone
        'accepted': ['active', 'cancelled'],     # Can start (active) or cancel
        'active': ['completed', 'cancelled'],    # Can complete or cancel
        'completed': [],                          # Terminal state
        'cancelled': [],                          # Terminal state
        'pending': ['accepted', 'cancelled']     # Legacy support
    }
    
    # Terminal states cannot be changed
    if current_status in ['completed', 'cancelled']:
        return False, f"Cannot change status from {current_status} (terminal state)"
    
    # Check if transition is valid
    if new_status not in valid_transitions.get(current_status, []):
        return False, f"Invalid status transition from {current_status} to {new_status}"
    
    # Role-based validation
    if new_status == 'accepted':
        # Only sitters can accept, and only if they're assigned or it's an open request
        if user_role != 'sitter':
            return False, "Only sitters can accept session requests"
        # For 'invite' scope, sitter_id must match
        if session_data.get('search_scope') == 'invite' and session_data.get('sitter_id') != session_data.get('current_user_id'):
            return False, "This session was not invited to you"
    
    if new_status == 'active':
        # Only sitter can start the session
        if user_role != 'sitter':
            return False, "Only sitters can start sessions"
        # Must be accepted first
        if current_status != 'accepted':
            return False, "Session must be accepted before it can be started"
    
    if new_status == 'completed':
        # Only sitter can complete
        if user_role != 'sitter':
            return False, "Only sitters can complete sessions"
        # Must be active first
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
        
        # Apply status filter if provided
        if status:
            query = query.eq("status", status)
        
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
            update_data["status"] = updates.status
            
            # Handle status-specific updates (Uber-like tracking)
            if updates.status == "accepted":
                # When sitter accepts, assign them to the session
                if current_user.role == "sitter" and not session_data.get("sitter_id"):
                    update_data["sitter_id"] = current_user.id
            elif updates.status == "cancelled":
                # Track who cancelled and when
                update_data["cancelled_at"] = datetime.utcnow().isoformat()
                update_data["cancelled_by"] = current_user.role
                if updates.cancellationReason:
                    update_data["cancellation_reason"] = updates.cancellationReason
            elif updates.status == "completed":
                # Track completion time
                update_data["completed_at"] = datetime.utcnow().isoformat()
                if not updates.endTime:
                    update_data["end_time"] = datetime.utcnow().isoformat()
            elif updates.status == "active":
                # Ensure sitter is assigned
                if current_user.role == "sitter" and not session_data.get("sitter_id"):
                    update_data["sitter_id"] = current_user.id
        
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
        
        # Get sitter's profile to check city
        sitter_profile = None
        if sitter_city or scope == 'city':
            try:
                profile_response = supabase.table("users").select("city").eq("id", current_user.id).single().execute()
                if profile_response.data:
                    sitter_profile = profile_response.data
                    sitter_city = sitter_city or profile_response.data.get("city")
            except:
                pass  # Continue without city filter if profile fetch fails
        
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
