"""
User and profile management endpoints
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional
from decimal import Decimal

from app.utils.auth import verify_token, CurrentUser
from app.utils.error_handler import handle_error, AppError
from app.utils.database import get_supabase

router = APIRouter()


class UserProfileResponse(BaseModel):
    """User profile response model"""
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


class UpdateProfileRequest(BaseModel):
    """Request model for updating user profile"""
    displayName: Optional[str] = None
    phoneNumber: Optional[str] = None
    profileImageUrl: Optional[str] = None
    preferredLanguage: Optional[str] = None
    theme: Optional[str] = None
    bio: Optional[str] = None
    hourlyRate: Optional[float] = None


@router.get("/me", response_model=UserProfileResponse)
async def get_current_user_profile(
    current_user: CurrentUser = Depends(verify_token)
):
    """
    Get current user's profile
    """
    try:
        supabase = get_supabase()
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        
        # Fetch user profile from database
        response = supabase.table("users").select("*").eq("id", current_user.id).single().execute()
        
        if not response.data:
            raise AppError(
                code="PROFILE_NOT_FOUND",
                message="User profile not found",
                status_code=404
            )
        
        user_data = response.data
        
        # Convert database format to API response format
        return UserProfileResponse(
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
        raise handle_error(e, "Failed to fetch user profile")


@router.put("/me", response_model=UserProfileResponse)
async def update_current_user_profile(
    updates: UpdateProfileRequest,
    current_user: CurrentUser = Depends(verify_token)
):
    """
    Update current user's profile
    """
    try:
        supabase = get_supabase()
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        
        # Build update dictionary (only include provided fields)
        update_data = {}
        if updates.displayName is not None:
            update_data["display_name"] = updates.displayName
        if updates.phoneNumber is not None:
            update_data["phone_number"] = updates.phoneNumber
        if updates.profileImageUrl is not None:
            update_data["photo_url"] = updates.profileImageUrl
        if updates.preferredLanguage is not None:
            update_data["preferred_language"] = updates.preferredLanguage
        if updates.theme is not None:
            update_data["theme"] = updates.theme
        if updates.bio is not None:
            update_data["bio"] = updates.bio
        if updates.hourlyRate is not None:
            update_data["hourly_rate"] = Decimal(str(updates.hourlyRate))
        
        # Add updated_at timestamp
        from datetime import datetime
        update_data["updated_at"] = datetime.utcnow().isoformat()
        
        # Update user profile
        response = supabase.table("users").update(update_data).eq("id", current_user.id).execute()
        
        if not response.data:
            raise AppError(
                code="UPDATE_FAILED",
                message="Failed to update user profile",
                status_code=500
            )
        
        user_data = response.data[0] if isinstance(response.data, list) else response.data
        
        # Return updated profile
        return UserProfileResponse(
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
        raise handle_error(e, "Failed to update user profile")
