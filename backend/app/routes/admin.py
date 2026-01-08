"""
Admin endpoints for user management
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal

from app.utils.auth import verify_admin, CurrentUser
from app.utils.error_handler import handle_error, AppError
from app.utils.database import get_supabase

router = APIRouter()


class UserResponse(BaseModel):
    """User response model for admin endpoints"""
    id: str
    email: str
    displayName: str
    role: str
    preferredLanguage: str
    userNumber: Optional[str] = None
    phoneNumber: Optional[str] = None
    profileImageUrl: Optional[str] = None
    theme: str = "auto"
    isVerified: bool = False
    verificationStatus: Optional[str] = None
    hourlyRate: Optional[float] = None
    bio: Optional[str] = None
    createdAt: str
    updatedAt: str


class UpdateUserRequest(BaseModel):
    """Request model for updating user (admin)"""
    displayName: Optional[str] = None
    role: Optional[str] = None
    phoneNumber: Optional[str] = None
    profileImageUrl: Optional[str] = None
    preferredLanguage: Optional[str] = None
    theme: Optional[str] = None
    isVerified: Optional[bool] = None
    verificationStatus: Optional[str] = None
    hourlyRate: Optional[float] = None
    bio: Optional[str] = None


class AdminStatsResponse(BaseModel):
    """Admin statistics response"""
    totalUsers: int
    totalParents: int
    totalSitters: int
    totalAdmins: int
    pendingVerifications: int
    activeSessions: int


@router.get("/users", response_model=List[UserResponse])
async def get_all_users(
    role: Optional[str] = Query(None, description="Filter by role: parent, sitter, admin"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of users to return"),
    admin_user: CurrentUser = Depends(verify_admin)
):
    """
    Get all users (admin only)
    """
    try:
        supabase = get_supabase()
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        
        # Build query
        query = supabase.table("users").select("*")
        
        # Apply role filter if provided
        if role:
            # Normalize role: 'babysitter' -> 'sitter' for database
            db_role = "sitter" if role == "babysitter" else role
            query = query.eq("role", db_role)
        
        # Order and limit
        query = query.order("created_at", desc=True).limit(limit)
        
        response = query.execute()
        
        # Convert to response format
        users = []
        for user_data in (response.data or []):
            users.append(UserResponse(
                id=user_data["id"],
                email=user_data["email"],
                displayName=user_data.get("display_name", ""),
                role=user_data.get("role", "parent"),
                preferredLanguage=user_data.get("preferred_language", "en"),
                userNumber=user_data.get("user_number"),
                phoneNumber=user_data.get("phone_number"),
                profileImageUrl=user_data.get("photo_url"),
                theme=user_data.get("theme", "auto"),
                isVerified=user_data.get("is_verified", False),
                verificationStatus=user_data.get("verification_status"),
                hourlyRate=float(user_data["hourly_rate"]) if user_data.get("hourly_rate") else None,
                bio=user_data.get("bio"),
                createdAt=user_data["created_at"],
                updatedAt=user_data.get("updated_at", user_data["created_at"])
            ))
        
        return users
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to fetch users")


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user_by_id(
    user_id: str,
    admin_user: CurrentUser = Depends(verify_admin)
):
    """
    Get user by ID (admin only)
    """
    try:
        supabase = get_supabase()
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        
        response = supabase.table("users").select("*").eq("id", user_id).single().execute()
        
        if not response.data:
            raise AppError(
                code="USER_NOT_FOUND",
                message="User not found",
                status_code=404
            )
        
        user_data = response.data
        
        return UserResponse(
            id=user_data["id"],
            email=user_data["email"],
            displayName=user_data.get("display_name", ""),
            role=user_data.get("role", "parent"),
            preferredLanguage=user_data.get("preferred_language", "en"),
            userNumber=user_data.get("user_number"),
            phoneNumber=user_data.get("phone_number"),
            profileImageUrl=user_data.get("photo_url"),
            theme=user_data.get("theme", "auto"),
            isVerified=user_data.get("is_verified", False),
            verificationStatus=user_data.get("verification_status"),
            hourlyRate=float(user_data["hourly_rate"]) if user_data.get("hourly_rate") else None,
            bio=user_data.get("bio"),
            createdAt=user_data["created_at"],
            updatedAt=user_data.get("updated_at", user_data["created_at"])
        )
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to fetch user")


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    updates: UpdateUserRequest,
    admin_user: CurrentUser = Depends(verify_admin)
):
    """
    Update user (admin only)
    """
    try:
        supabase = get_supabase()
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        
        # Build update dictionary
        update_data = {}
        if updates.displayName is not None:
            update_data["display_name"] = updates.displayName
        if updates.role is not None:
            # Normalize role: 'babysitter' -> 'sitter' for database
            db_role = "sitter" if updates.role == "babysitter" else updates.role
            update_data["role"] = db_role
        if updates.phoneNumber is not None:
            update_data["phone_number"] = updates.phoneNumber
        if updates.profileImageUrl is not None:
            update_data["photo_url"] = updates.profileImageUrl
        if updates.preferredLanguage is not None:
            update_data["preferred_language"] = updates.preferredLanguage
        if updates.theme is not None:
            update_data["theme"] = updates.theme
        if updates.isVerified is not None:
            update_data["is_verified"] = updates.isVerified
        if updates.verificationStatus is not None:
            update_data["verification_status"] = updates.verificationStatus
        if updates.hourlyRate is not None:
            update_data["hourly_rate"] = Decimal(str(updates.hourlyRate))
        if updates.bio is not None:
            update_data["bio"] = updates.bio
        
        # Add updated_at timestamp
        from datetime import datetime
        update_data["updated_at"] = datetime.utcnow().isoformat()
        
        # Update user
        response = supabase.table("users").update(update_data).eq("id", user_id).execute()
        
        if not response.data:
            raise AppError(
                code="UPDATE_FAILED",
                message="Failed to update user",
                status_code=500
            )
        
        user_data = response.data[0] if isinstance(response.data, list) else response.data
        
        return UserResponse(
            id=user_data["id"],
            email=user_data["email"],
            displayName=user_data.get("display_name", ""),
            role=user_data.get("role", "parent"),
            preferredLanguage=user_data.get("preferred_language", "en"),
            userNumber=user_data.get("user_number"),
            phoneNumber=user_data.get("phone_number"),
            profileImageUrl=user_data.get("photo_url"),
            theme=user_data.get("theme", "auto"),
            isVerified=user_data.get("is_verified", False),
            verificationStatus=user_data.get("verification_status"),
            hourlyRate=float(user_data["hourly_rate"]) if user_data.get("hourly_rate") else None,
            bio=user_data.get("bio"),
            createdAt=user_data["created_at"],
            updatedAt=user_data.get("updated_at", user_data["created_at"])
        )
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to update user")


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    admin_user: CurrentUser = Depends(verify_admin)
):
    """
    Delete user (admin only)
    """
    try:
        supabase = get_supabase()
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        
        # Delete from users table (cascade will handle related data)
        response = supabase.table("users").delete().eq("id", user_id).execute()
        
        return {
            "success": True,
            "message": "User deleted successfully"
        }
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to delete user")


@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    admin_user: CurrentUser = Depends(verify_admin)
):
    """
    Get admin statistics
    """
    try:
        supabase = get_supabase()
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        
        # Get counts
        all_users = supabase.table("users").select("id", count="exact").execute()
        parents = supabase.table("users").select("id", count="exact").eq("role", "parent").execute()
        sitters = supabase.table("users").select("id", count="exact").eq("role", "sitter").execute()
        admins = supabase.table("users").select("id", count="exact").eq("role", "admin").execute()
        
        # Check if verification_requests table exists
        pending_verifications = 0
        try:
            verifications_result = supabase.table("verification_requests").select("id", count="exact").eq("status", "pending").execute()
            pending_verifications = verifications_result.count if hasattr(verifications_result, 'count') else 0
        except:
            pass
        
        # Check if sessions table exists
        active_sessions = 0
        try:
            sessions_result = supabase.table("sessions").select("id", count="exact").eq("status", "active").execute()
            active_sessions = sessions_result.count if hasattr(sessions_result, 'count') else 0
        except:
            pass
        
        return AdminStatsResponse(
            totalUsers=all_users.count if hasattr(all_users, 'count') else 0,
            totalParents=parents.count if hasattr(parents, 'count') else 0,
            totalSitters=sitters.count if hasattr(sitters, 'count') else 0,
            totalAdmins=admins.count if hasattr(admins, 'count') else 0,
            pendingVerifications=pending_verifications,
            activeSessions=active_sessions
        )
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to fetch admin statistics")
