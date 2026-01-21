"""
Session management endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from datetime import datetime

from app.utils.auth import verify_token, CurrentUser, security
from app.utils.error_handler import handle_error, AppError
from app.utils.database import get_supabase, get_supabase_with_auth
from fastapi.security import HTTPAuthorizationCredentials

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
    searchScope: Optional[str] = None
    maxDistanceKm: Optional[float] = None
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
    searchScope: Optional[str] = None  # 'invite' | 'nearby' | 'city' | 'nationwide'
    maxDistanceKm: Optional[float] = None  # Only used when searchScope = 'nearby'


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
        searchScope=session_data.get("search_scope"),
        maxDistanceKm=float(session_data["max_distance_km"]) if session_data.get("max_distance_km") else None,
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
        insert_data = {
            "parent_id": session_data.parentId,
            "sitter_id": session_data.sitterId if search_scope == 'invite' else None,
            "child_id": session_data.childId,
            "status": "requested",
            "start_time": session_data.startTime,
            "end_time": session_data.endTime if session_data.endTime else None,  # Include end_time
            "location": session_data.location,
            "hourly_rate": float(session_data.hourlyRate) if session_data.hourlyRate else None,
            "notes": session_data.notes,
            "search_scope": search_scope,
            "max_distance_km": float(session_data.maxDistanceKm) if session_data.maxDistanceKm else None,
        }
        
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
            response = supabase.table("sessions").insert(insert_data).execute()
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
